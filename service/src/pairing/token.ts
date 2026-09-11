import { randomBytes } from 'node:crypto';

export interface PairingToken {
  value: string;
  expiresAt: number;
}

export function createPairingToken(ttlMs = 5 * 60_000, now = Date.now()): PairingToken {
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error('Pairing token TTL must be positive');
  return {
    value: randomBytes(24).toString('base64url'),
    expiresAt: now + ttlMs,
  };
}

export function isPairingTokenValid(token: PairingToken, value: string, now = Date.now()): boolean {
  return now < token.expiresAt && value === token.value;
}
