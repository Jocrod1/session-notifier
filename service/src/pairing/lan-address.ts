import { createSocket } from 'node:dgram';
import { networkInterfaces } from 'node:os';

export async function determineLanAddress(): Promise<string> {
  const socket = createSocket('udp4');
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.connect(80, '8.8.8.8', resolve);
    });
    const address = socket.address();
    if (typeof address !== 'string') return address.address;
  } catch {
    // The interface fallback below supports offline and restricted networks.
  } finally {
    socket.close();
  }

  for (const interfaces of Object.values(networkInterfaces())) {
    for (const address of interfaces ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  throw new Error('Unable to determine a reachable LAN IPv4 address');
}
