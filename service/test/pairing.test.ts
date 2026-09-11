import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonDeviceRegistry } from '../src/pairing/device-registry.js';
import { createPairingLink } from '../src/pairing/qr.js';
import { PairingSession } from '../src/pairing/session.js';
import { createPairingToken, isPairingTokenValid } from '../src/pairing/token.js';
import { parsePairingPayload } from '../src/pairing/protocol.js';

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function registryPath(): string {
  const path = join(tmpdir(), `session-notifier-pairing-${Date.now()}-${Math.random()}`, 'devices.json');
  temporaryPaths.push(path);
  return path;
}

const validDevice = { name: 'Pixel 9', platform: 'android' as const, appVersion: '0.1.0' };

describe('pairing tokens and protocol', () => {
  it('generates random tokens and rejects expired tokens', () => {
    const token = createPairingToken(100, 1_000);
    expect(token.value).toHaveLength(32);
    expect(isPairingTokenValid(token, token.value, 1_099)).toBe(true);
    expect(isPairingTokenValid(token, token.value, 1_100)).toBe(false);
    expect(isPairingTokenValid(token, 'wrong', 1_001)).toBe(false);
  });

  it('rejects invalid pairing payloads', () => {
    expect(() => parsePairingPayload({ token: 'x', device: { name: '', platform: 'android', appVersion: '0.1.0' } })).toThrow();
    expect(() => parsePairingPayload({ token: 'x', device: { name: 'Phone', platform: 'ios', appVersion: '0.1.0' } })).toThrow();
    expect(() => parsePairingPayload({ token: 'x', device: { name: 'Phone', platform: 'android' } })).toThrow();
  });

  it('creates a QR deep link with host, port, and token', async () => {
    const link = await createPairingLink('192.168.1.10', 43123, 'abc123');
    expect(link.deepLink).toBe('session-notifier://pair?host=192.168.1.10&port=43123&token=abc123');
    expect(link.qr).toContain('\u001b');
  });
});

describe('PairingSession', () => {
  it('rejects an invalid token without persisting a device', async () => {
    const path = registryPath();
    const registry = new JsonDeviceRegistry(path);
    const session = new PairingSession(registry);
    const info = await session.start();
    const response = await fetch(`http://127.0.0.1:${info.port}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'wrong', device: validDevice }),
    });
    expect(response.status).toBe(400);
    expect(await registry.list()).toEqual([]);
    await session.close();
  });

  it('accepts and persists a valid pairing request', async () => {
    const path = registryPath();
    const registry = new JsonDeviceRegistry(path);
    const session = new PairingSession(registry);
    const info = await session.start();
    const requestPromise = session.nextRequest();
    const responsePromise = fetch(`http://127.0.0.1:${info.port}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: info.token, device: validDevice }),
    });
    const request = await requestPromise;
    const device = await session.approve(request);
    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true, deviceId: device.id, credential: device.credential });
    expect(await registry.list()).toEqual([device]);
    await session.close();
  });

  it('rejects a request without persisting a device and remains available', async () => {
    const registry = new JsonDeviceRegistry(registryPath());
    const session = new PairingSession(registry);
    const info = await session.start();
    const requestPromise = session.nextRequest();
    const responsePromise = fetch(`http://127.0.0.1:${info.port}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: info.token, device: validDevice }),
    });
    session.reject(await requestPromise);
    expect((await responsePromise).status).toBe(403);
    expect(await registry.list()).toEqual([]);
    const secondRequest = session.nextRequest();
    const secondResponse = fetch(`http://127.0.0.1:${info.port}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: info.token, device: { ...validDevice, name: 'Tablet' } }),
    });
    expect((await secondRequest).device.name).toBe('Tablet');
    session.reject(await secondRequest);
    expect((await secondResponse).status).toBe(403);
    await session.close();
  });

  it('shuts down its temporary receiver cleanly', async () => {
    const session = new PairingSession(new JsonDeviceRegistry(registryPath()));
    const info = await session.start();
    await session.close();
    await expect(fetch(`http://127.0.0.1:${info.port}/pair`)).rejects.toThrow();
  });
});
