export const CONNECTION_PROTOCOL_VERSION = 1;
export const CONNECTION_PATH = '/connect';

export interface HelloMessage {
  type: 'hello';
  protocolVersion: 1;
  deviceId: string;
  deviceName: string;
  credential: string;
}

export interface PingMessage {
  type: 'ping';
  protocolVersion: 1;
  nonce: string;
}

export interface PongMessage {
  type: 'pong';
  protocolVersion: 1;
  nonce: string;
}

export interface ConnectedMessage {
  type: 'hello';
  protocolVersion: 1;
  deviceId: string;
}

export type ClientMessage = HelloMessage | PongMessage;
export type ServerMessage = ConnectedMessage | PingMessage;

const MAX_FIELD_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 16_384;

export class ProtocolError extends Error {
  constructor(message: string, readonly closeCode: number) {
    super(message);
  }
}

export function parseClientMessage(value: unknown): ClientMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new ProtocolError('Malformed connection message', 4400);
  }
  if (value.protocolVersion !== CONNECTION_PROTOCOL_VERSION) {
    throw new ProtocolError('Unsupported protocol version', 4406);
  }

  if (value.type === 'hello') {
    if (
      typeof value.deviceId !== 'string' ||
      !isCredential(value.deviceId) ||
      typeof value.deviceName !== 'string' ||
      !value.deviceName.trim() ||
      value.deviceName.length > MAX_FIELD_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(value.deviceName) ||
      typeof value.credential !== 'string' ||
      !isCredential(value.credential)
    ) {
      throw new ProtocolError('Malformed hello message', 4400);
    }
    return {
      type: 'hello',
      protocolVersion: CONNECTION_PROTOCOL_VERSION,
      deviceId: value.deviceId,
      deviceName: value.deviceName.trim(),
      credential: value.credential,
    };
  }

  if (value.type === 'pong' && typeof value.nonce === 'string' && value.nonce.length > 0 && value.nonce.length <= MAX_FIELD_LENGTH) {
    return { type: 'pong', protocolVersion: CONNECTION_PROTOCOL_VERSION, nonce: value.nonce };
  }

  throw new ProtocolError('Unsupported connection message', 4400);
}

export function parseClientJson(data: string): ClientMessage {
  if (Buffer.byteLength(data, 'utf8') > MAX_MESSAGE_LENGTH) {
    throw new ProtocolError('Connection message is too large', 4400);
  }
  try {
    return parseClientMessage(JSON.parse(data) as unknown);
  } catch (error: unknown) {
    if (error instanceof ProtocolError) throw error;
    throw new ProtocolError('Malformed JSON connection message', 4400);
  }
}

function isCredential(value: string): boolean {
  return value.length >= 16 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
