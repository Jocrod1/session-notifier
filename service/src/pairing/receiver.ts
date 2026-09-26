import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { parsePairingPayload, PAIRING_PATH, type PairingResponse, type PairingRequestPayload } from './protocol.js';

export type PairingRequestHandler = (
  payload: PairingRequestPayload,
  address: string,
) => Promise<PairingResponse>;

export interface PairingReceiver {
  readonly port: number;
  close(): Promise<void>;
}

export async function startPairingReceiver(handler: PairingRequestHandler, port = 0): Promise<PairingReceiver> {
  const server = createServer((request, response) => void handleRequest(request, response, handler));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Pairing receiver did not expose a TCP port');
  }
  return { port: address.port, close: () => closeServer(server) };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, handler: PairingRequestHandler): Promise<void> {
  if (request.method !== 'POST' || request.url !== PAIRING_PATH) {
    sendJson(response, 404, { accepted: false, message: 'Not found' });
    return;
  }
  try {
    const payload = parsePairingPayload(JSON.parse(await readBody(request)));
    const result = await handler(payload, normalizeAddress(request.socket.remoteAddress));
    sendJson(response, result.accepted ? 200 : 403, result);
  } catch (error: unknown) {
    sendJson(response, 400, { accepted: false, message: error instanceof Error ? error.message : 'Invalid pairing request' });
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 16_384) reject(new Error('Pairing payload is too large'));
    });
    request.once('end', () => resolve(body));
    request.once('error', reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: PairingResponse): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function normalizeAddress(address: string | undefined): string {
  return address?.startsWith('::ffff:') ? address.slice(7) : address ?? 'unknown';
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
