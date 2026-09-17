import qrcode from 'qrcode';

export interface PairingLink {
  deepLink: string;
  qr: string;
}

export async function createPairingLink(host: string, port: number, token: string): Promise<PairingLink> {
  const query = new URLSearchParams({ host, port: String(port), token });
  const deepLink = `session-notifier://pair?${query.toString()}`;
  return { deepLink, qr: await qrcode.toString(deepLink, { type: 'terminal', small: true }) };
}
