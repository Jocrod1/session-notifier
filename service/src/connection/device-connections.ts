import { timingSafeEqual, randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { DeviceRegistry, PairedDevice } from '../pairing/device-registry.js';
import { CONNECTION_PATH, CONNECTION_PROTOCOL_VERSION, isNotificationId, parseClientJson, ProtocolError } from './protocol.js';
import type { ClientMessage, NotificationAcknowledgement, ServerMessage } from './protocol.js';

export interface ConnectedDevice {
  id: string;
  name: string;
  connectedAt: string;
}

export function selectSingleConnectedDevice(devices: ConnectedDevice[]): ConnectedDevice | undefined {
  return devices.length === 1 ? devices[0] : undefined;
}

export interface DeviceMessaging {
  isConnected(deviceId: string): boolean;
  listConnected(): ConnectedDevice[];
  send(deviceId: string, message: ServerMessage): void;
  sendNotification(
    deviceId: string,
    notificationId: string,
    title: string,
    body: string,
    timeoutMs?: number,
  ): Promise<NotificationAcknowledgement>;
}

interface PendingNotification {
  resolve: (acknowledgement: NotificationAcknowledgement) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface ActiveConnection {
  device: ConnectedDevice;
  socket: WebSocket;
  pingTimer: NodeJS.Timeout;
  pendingPing?: { nonce: string; timeout: NodeJS.Timeout };
  pendingNotifications: Map<string, PendingNotification>;
  usedNotificationIds: Set<string>;
}

export class DeviceConnections implements DeviceMessaging {
  private server?: WebSocketServer;
  private readonly active = new Map<string, ActiveConnection>();
  private stopping = false;

  constructor(
    private readonly registry: DeviceRegistry,
    private readonly listenPort: number,
    private readonly heartbeatMs = 25_000,
    private readonly pongTimeoutMs = 10_000,
  ) {}

  get listeningPort(): number | undefined {
    const address = this.server?.address();
    return address && typeof address !== 'string' ? address.port : undefined;
  }

  async start(): Promise<void> {
    if (this.server) throw new Error('Device connections already started');
    this.stopping = false;
    const server = new WebSocketServer({
      host: '0.0.0.0',
      port: this.listenPort,
      path: CONNECTION_PATH,
      maxPayload: 16_384,
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    server.on('connection', (socket) => this.accept(socket));
    server.on('error', (error) => console.error(`[device] connection server error: ${error.message}`));
  }

  isConnected(deviceId: string): boolean {
    return this.active.has(deviceId);
  }

  listConnected(): ConnectedDevice[] {
    return [...this.active.values()].map(({ device }) => ({ ...device }));
  }

  send(deviceId: string, message: ServerMessage): void {
    const connection = this.active.get(deviceId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Device ${deviceId} is not connected`);
    }
    connection.socket.send(JSON.stringify(message));
  }

  sendNotification(
    deviceId: string,
    notificationId: string,
    title: string,
    body: string,
    timeoutMs = 5_000,
  ): Promise<NotificationAcknowledgement> {
    const connection = this.active.get(deviceId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Device ${deviceId} is not connected`);
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Notification acknowledgement timeout must be a positive integer');
    }
    if (
      !isNotificationId(notificationId) ||
      title.trim().length === 0 ||
      title.length > 120 ||
      /[\u0000-\u001f\u007f]/.test(title) ||
      body.trim().length === 0 ||
      body.length > 1_000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)
    ) {
      throw new Error('Test notification content is invalid');
    }
    if (connection.usedNotificationIds.has(notificationId)) {
      throw new Error(`Notification ID ${notificationId} has already been used on this connection`);
    }
    connection.usedNotificationIds.add(notificationId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pendingNotifications.delete(notificationId);
        reject(new Error(`Timed out waiting for notification acknowledgement from ${connection.device.name}`));
      }, timeoutMs);
      timeout.unref();
      connection.pendingNotifications.set(notificationId, { resolve, reject, timeout });
      try {
        this.send(deviceId, {
          type: 'notification',
          protocolVersion: CONNECTION_PROTOCOL_VERSION,
          notificationId,
          title,
          body,
        });
      } catch (error: unknown) {
        clearTimeout(timeout);
        connection.pendingNotifications.delete(notificationId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async close(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.stopping = true;
    for (const connection of this.active.values()) {
      clearInterval(connection.pingTimer);
      if (connection.pendingPing) clearTimeout(connection.pendingPing.timeout);
      this.failPendingNotifications(connection, new Error('Connection manager is shutting down'));
    }
    for (const socket of server.clients) socket.close(1001, 'Service shutting down');
    this.server = undefined;
    const closed = new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    const forceCloseTimer = setTimeout(() => {
      for (const socket of server.clients) {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
      }
    }, 1_000);
    forceCloseTimer.unref();
    await closed;
    clearTimeout(forceCloseTimer);
    for (const connection of this.active.values()) {
      console.log(`[device] ${connection.device.name} disconnected`);
    }
    this.active.clear();
  }

  private accept(socket: WebSocket): void {
    let connection: ActiveConnection | undefined;
    let authenticated = false;
    let authenticating = false;
    const helloTimer = setTimeout(() => socket.close(4400, 'Hello timed out'), 10_000);
    helloTimer.unref();
    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        socket.close(4400, 'Text messages required');
        return;
      }
      let message: ClientMessage;
      try {
        message = parseClientJson(data.toString());
      } catch (error: unknown) {
        const protocolError = error instanceof ProtocolError ? error : new ProtocolError('Malformed connection message', 4400);
        socket.close(protocolError.closeCode, protocolError.message);
        return;
      }
      if (!authenticated) {
        if (authenticating) {
          socket.close(4400, 'Hello already received');
          return;
        }
        if (message.type !== 'hello') {
          socket.close(4400, 'Hello required');
          return;
        }
        authenticating = true;
        void this.authenticate(socket, message).then((result) => {
          if (!result || socket.readyState !== WebSocket.OPEN || this.stopping) return;
          clearTimeout(helloTimer);
          authenticated = true;
          const previous = this.active.get(result.id);
          if (previous) {
            clearInterval(previous.pingTimer);
            if (previous.pendingPing) clearTimeout(previous.pendingPing.timeout);
            this.failPendingNotifications(previous, new Error('Connection replaced by a newer connection'));
            previous.socket.close(4001, 'Replaced by a newer connection');
          }
          const active: ActiveConnection = {
            device: { id: result.id, name: result.name, connectedAt: new Date().toISOString() },
            socket,
            pingTimer: setInterval(() => this.ping(active), this.heartbeatMs),
            pendingNotifications: new Map(),
            usedNotificationIds: new Set(),
          };
          active.pingTimer.unref();
          connection = active;
          this.active.set(result.id, active);
          socket.send(JSON.stringify({
            type: 'hello',
            protocolVersion: CONNECTION_PROTOCOL_VERSION,
            deviceId: result.id,
          }));
          console.log(`[device] ${result.name} connected`);
        }).catch((error: unknown) => {
          console.error(`[device] authentication failed: ${error instanceof Error ? error.message : String(error)}`);
          socket.close(1011, 'Connection error');
        });
        return;
      }
      if (message.type !== 'pong' || !connection) {
        if (message.type === 'notification-ack' && connection) {
          const pending = connection.pendingNotifications.get(message.notificationId);
          if (pending) {
            clearTimeout(pending.timeout);
            connection.pendingNotifications.delete(message.notificationId);
            pending.resolve(message);
          }
          return;
        }
        socket.close(4400, 'Unexpected message');
        return;
      }
      if (connection.pendingPing?.nonce === message.nonce) {
        clearTimeout(connection.pendingPing.timeout);
        connection.pendingPing = undefined;
      }
    });
    socket.on('close', () => {
      clearTimeout(helloTimer);
      if (!connection) return;
      clearInterval(connection.pingTimer);
      if (connection.pendingPing) clearTimeout(connection.pendingPing.timeout);
      this.failPendingNotifications(connection, new Error(`Device ${connection.device.name} disconnected`));
      if (this.active.get(connection.device.id) === connection) {
        this.active.delete(connection.device.id);
        console.log(`[device] ${connection.device.name} disconnected`);
      }
    });
    socket.on('error', (error) => {
      if (!this.stopping) console.error(`[device] socket error: ${error.message}`);
    });
  }

  private async authenticate(
    socket: WebSocket,
    hello: Extract<ReturnType<typeof parseClientJson>, { type: 'hello' }>,
  ): Promise<PairedDevice | undefined> {
    const device = await this.registry.get(hello.deviceId);
    if (!device) {
      socket.close(4404, 'Unknown device');
      return undefined;
    }
    if (!credentialsMatch(device.credential, hello.credential)) {
      socket.close(4401, 'Authentication failed');
      return undefined;
    }
    return device;
  }

  private ping(connection: ActiveConnection): void {
    if (connection.socket.readyState !== WebSocket.OPEN) return;
    if (connection.pendingPing) {
      connection.socket.close(4002, 'Heartbeat timed out');
      return;
    }
    const nonce = randomUUID();
    const timeout = setTimeout(() => connection.socket.close(4002, 'Heartbeat timed out'), this.pongTimeoutMs);
    timeout.unref();
    connection.pendingPing = { nonce, timeout };
    try {
      this.send(connection.device.id, {
        type: 'ping',
        protocolVersion: CONNECTION_PROTOCOL_VERSION,
        nonce,
      });
    } catch {
      connection.socket.close(4002, 'Heartbeat send failed');
    }
  }

  private failPendingNotifications(connection: ActiveConnection, error: Error): void {
    for (const [notificationId, pending] of connection.pendingNotifications) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      connection.pendingNotifications.delete(notificationId);
    }
  }

  sendTestNotification(deviceId: string, timeoutMs = 5_000): Promise<NotificationAcknowledgement> {
    return this.sendNotification(
      deviceId,
      randomUUID(),
      'Session Notifier test',
      'Test notification sent from the PC service.',
      timeoutMs,
    );
  }
}

function credentialsMatch(expected: string, supplied: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
