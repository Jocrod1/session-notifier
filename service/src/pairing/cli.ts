import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import type { Config } from '../config.js';
import { JsonDeviceRegistry } from './device-registry.js';
import { determineLanAddress } from './lan-address.js';
import { createPairingLink } from './qr.js';
import { PairingSession } from './session.js';

export async function runPairCommand(config: Config): Promise<void> {
  const registry = new JsonDeviceRegistry(resolve(config.devicesPath));
  const session = new PairingSession(registry, config.pairingTtlMs);
  const input = createInterface({ input: stdin, output: stdout });
  const stop = (): void => { void session.close(); input.close(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    const info = await session.start();
    const host = await determineLanAddress();
    const link = await createPairingLink(host, info.port, info.token);
    console.log(`Pairing receiver listening on ${host}:${info.port}`);
    console.log(link.qr);
    console.log(`Pairing link: ${link.deepLink}`);
    console.log('Waiting for an Android device to connect...');

    while (true) {
      const request = await session.nextRequest();
      console.log('\nPairing request received\n');
      console.log(`Device: ${request.device.name}`);
      console.log(`Platform: ${request.device.platform}`);
      console.log(`App version: ${request.device.appVersion}`);
      console.log(`Address: ${request.address}\n`);
      const answer = (await input.question('Accept pairing? [y/N] ')).trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        const device = await session.approve(request);
        console.log(`Pairing successful: ${device.name} (${device.id})`);
        break;
      }
      session.reject(request);
      console.log('Pairing rejected. Waiting for another request...');
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    input.close();
    await session.close();
  }
}
