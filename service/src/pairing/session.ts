import { randomBytes } from 'node:crypto';
import type { DeviceRegistry, PairedDevice } from './device-registry.js';
import { startPairingReceiver, type PairingReceiver } from './receiver.js';
import { isPairingTokenValid, createPairingToken, type PairingToken } from './token.js';
import { parsePairingPayload, type PairingRequest, type PairingRequestPayload, type PairingResponse } from './protocol.js';

export interface PairingSessionInfo {
  token: string;
  expiresAt: number;
  port: number;
}

export class PairingSession {
  private readonly token: PairingToken;
  private receiver?: PairingReceiver;
  private pending?: PendingRequest;
  private waitingForRequest?: {
    resolve: (request: PairingRequest) => void;
    reject: (error: Error) => void;
  };
  private expiryTimer?: NodeJS.Timeout;
  private closed = false;

  constructor(
    private readonly registry: DeviceRegistry,
    private readonly ttlMs = 5 * 60_000,
    private readonly now: () => number = Date.now,
  ) {
    this.token = createPairingToken(ttlMs, now());
  }

  async start(): Promise<PairingSessionInfo> {
    this.receiver = await startPairingReceiver((payload, address) => this.receive(payload, address));
    this.expiryTimer = setTimeout(() => void this.close(), Math.max(0, this.token.expiresAt - this.now()));
    this.expiryTimer.unref();
    return { token: this.token.value, expiresAt: this.token.expiresAt, port: this.receiver.port };
  }

  async nextRequest(): Promise<PairingRequest> {
    if (this.closed || this.now() >= this.token.expiresAt) throw new Error('Pairing session expired');
    if (this.pending) return this.pending.request;
    if (this.waitingForRequest) throw new Error('A pairing request is already being awaited');
    return new Promise((resolve, reject) => { this.waitingForRequest = { resolve, reject }; });
  }

  async approve(request: PairingRequest): Promise<PairedDevice> {
    this.assertPending(request);
    const device = await this.registry.add({
      ...request.device,
      address: request.address,
      credential: randomBytes(32).toString('base64url'),
    });
    this.resolvePending({ accepted: true, deviceId: device.id, credential: device.credential });
    return device;
  }

  reject(request: PairingRequest): void {
    this.assertPending(request);
    this.resolvePending({ accepted: false, message: 'Pairing rejected by user' });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.pending?.reject(new Error('Pairing session cancelled'));
    this.waitingForRequest?.reject(new Error('Pairing session cancelled'));
    this.pending = undefined;
    this.waitingForRequest = undefined;
    await this.receiver?.close();
  }

  private async receive(payload: PairingRequestPayload, address: string): Promise<PairingResponse> {
    if (this.closed || !isPairingTokenValid(this.token, payload.token, this.now())) {
      throw new Error('Invalid or expired pairing token');
    }
    if (this.pending) throw new Error('A pairing request is already awaiting approval');
    const request: PairingRequest = { device: parsePairingPayload(payload).device, address };
    const waiting = this.waitingForRequest;
    this.waitingForRequest = undefined;
    waiting?.resolve(request);
    const result = await new Promise<PairingResponse>((resolve, reject) => {
      this.pending = { resolve, reject, request };
    });
    return result;
  }

  private assertPending(request: PairingRequest): asserts request is PairingRequest {
    if (!this.pending || this.pending.request !== request) throw new Error('Pairing request is no longer pending');
  }

  private resolvePending(response: PairingResponse): void {
    const pending = this.pending;
    this.pending = undefined;
    pending?.resolve(response);
  }
}

interface PendingRequest {
  resolve: (value: PairingResponse) => void;
  reject: (error: Error) => void;
  request: PairingRequest;
}
