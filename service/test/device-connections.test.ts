import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceConnections } from '../src/connection/device-connections.js';
import { CONNECTION_PROTOCOL_VERSION } from '../src/connection/protocol.js';
import { JsonDeviceRegistry, type PairedDevice } from '../src/pairing/device-registry.js';

describe('device connections', () => {
  let directory: string;
  let registry: JsonDeviceRegistry;
  let registryPath: string;
  let device: PairedDevice;
  let connections: DeviceConnections;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'session-notifier-connections-'));
    registryPath = join(directory, 'devices.json');
    registry = new JsonDeviceRegistry(registryPath);
    device = await registry.add({
      name: 'Test Android',
      platform: 'android',
      appVersion: '0.1.0',
      credential: 'test-device-credential-0123456789',
    });
    connections = new DeviceConnections(registry, 0, 60_000, 1_000);
    await connections.start();
  });

  afterEach(async () => {
    await connections.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('authenticates a paired device and registers its connection', async () => {
    const socket = await connect(connections.listeningPort!, hello(device));
    expect(connections.isConnected(device.id)).toBe(true);
    expect(connections.listConnected()).toMatchObject([{ id: device.id, name: device.name }]);
    socket.close(1000);
    await waitUntil(() => !connections.isConnected(device.id));
  });

  it('rejects invalid credentials without registering a connection', async () => {
    const code = await closedWithCode(connections.listeningPort!, { ...hello(device), credential: 'invalid-device-credential-01234567' });
    expect(code).toBe(4401);
    expect(connections.listConnected()).toEqual([]);
  });

  it('rejects unknown device IDs', async () => {
    const code = await closedWithCode(connections.listeningPort!, {
      ...hello(device),
      deviceId: 'unknown-device-id',
    });
    expect(code).toBe(4404);
    expect(connections.listConnected()).toEqual([]);
  });

  it('recognizes a device paired by a separate pairing process while the service is running', async () => {
    await registry.get('not-yet-paired');
    const pairedElsewhere = await new JsonDeviceRegistry(registryPath).add({
      name: 'Second Android',
      platform: 'android',
      appVersion: '0.1.0',
      credential: 'another-test-credential-0123456789',
    });
    const socket = await connect(connections.listeningPort!, hello(pairedElsewhere));
    expect(connections.isConnected(pairedElsewhere.id)).toBe(true);
    socket.close(1000);
    await waitUntil(() => !connections.isConnected(pairedElsewhere.id));
  });

  it('rejects malformed protocol messages', async () => {
    const code = await closedWithPayload(connections.listeningPort!, '{');
    expect(code).toBe(4400);
  });

  it('rejects unsupported protocol versions', async () => {
    const code = await closedWithCode(connections.listeningPort!, {
      ...hello(device),
      protocolVersion: CONNECTION_PROTOCOL_VERSION + 1,
    });
    expect(code).toBe(4406);
  });

  it('sends protocol messages to registered devices', async () => {
    const socket = await connect(connections.listeningPort!, hello(device));
    const messagePromise = waitForMessage(socket);
    const ping = { type: 'ping' as const, protocolVersion: 1 as const, nonce: 'test-nonce' };
    connections.send(device.id, ping);
    expect(await messagePromise).toEqual(ping);
    socket.send(JSON.stringify({
      type: 'pong',
      protocolVersion: CONNECTION_PROTOCOL_VERSION,
      nonce: 'test-nonce',
    }));
    socket.close(1000);
    await waitUntil(() => !connections.isConnected(device.id));
  });

  it('keeps a device connected when it answers server heartbeats', async () => {
    const heartbeatConnections = new DeviceConnections(registry, 0, 50, 300);
    await heartbeatConnections.start();
    const socket = await connect(heartbeatConnections.listeningPort!, hello(device));
    let heartbeatCount = 0;
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as { type?: string; protocolVersion?: number; nonce?: string };
      if (message.type !== 'ping' || !message.nonce) return;
      heartbeatCount += 1;
      socket.send(JSON.stringify({
        type: 'pong',
        protocolVersion: CONNECTION_PROTOCOL_VERSION,
        nonce: message.nonce,
      }));
    });
    await waitUntil(() => heartbeatCount >= 2);
    expect(heartbeatConnections.isConnected(device.id)).toBe(true);
    await heartbeatConnections.close();
    await waitUntil(() => !heartbeatConnections.isConnected(device.id));
  });

  it('keeps only the newest connection for a paired device', async () => {
    const first = await connect(connections.listeningPort!, hello(device));
    const firstClosed = waitForClose(first);
    const second = await connect(connections.listeningPort!, hello(device));
    expect(await firstClosed).toBe(4001);
    expect(connections.listConnected()).toHaveLength(1);
    expect(connections.isConnected(device.id)).toBe(true);
    second.close(1000);
  });

  it('removes a device after graceful disconnect', async () => {
    const socket = await connect(connections.listeningPort!, hello(device));
    const closed = waitForClose(socket);
    socket.close(1000, 'client stopped');
    expect(await closed).toBe(1000);
    await waitUntil(() => connections.listConnected().length === 0);
  });

  it('closes active connections and the listener on service shutdown', async () => {
    const socket = await connect(connections.listeningPort!, hello(device));
    const closed = waitForClose(socket);
    const port = connections.listeningPort!;
    await connections.close();
    expect(await closed).toBe(1001);
    expect(connections.listConnected()).toEqual([]);

    const replacement = new DeviceConnections(registry, port);
    await replacement.start();
    await replacement.close();
  });
});

function hello(device: PairedDevice): Record<string, unknown> {
  return {
    type: 'hello',
    protocolVersion: CONNECTION_PROTOCOL_VERSION,
    deviceId: device.id,
    deviceName: device.name,
    credential: device.credential,
  };
}

function connect(port: number, payload: Record<string, unknown>): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/connect`);
  socket.on('error', () => undefined);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for authenticated connection')), 2_000);
    socket.once('open', () => socket.send(JSON.stringify(payload)));
    socket.on('message', (data) => {
      const response = JSON.parse(data.toString()) as { type?: string };
      if (response.type !== 'hello') return;
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once('close', (code, reason) => {
      clearTimeout(timeout);
      reject(new Error(`Connection closed before authentication: ${code} ${reason.toString()}`));
    });
  });
}

function closedWithCode(port: number, payload: Record<string, unknown>): Promise<number> {
  return closedWithPayload(port, JSON.stringify(payload));
}

function closedWithPayload(port: number, payload: string): Promise<number> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/connect`);
  socket.on('error', () => undefined);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for rejected connection')), 2_000);
    socket.once('open', () => socket.send(payload));
    socket.once('close', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

function waitForMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for protocol message')), 2_000);
    socket.once('message', (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()) as unknown);
    });
  });
}

function waitForClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for socket close')), 2_000);
    socket.once('close', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(predicate()).toBe(true);
}
