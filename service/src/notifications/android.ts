import { randomUUID } from 'node:crypto';
import type { SessionSignal } from '../domain.js';
import type { DeviceMessaging } from '../connection/device-connections.js';

const ACKNOWLEDGEMENT_TIMEOUT_MS = 5_000;

export class AndroidNotificationAdapter {
  constructor(private readonly devices: DeviceMessaging) {}

  async notify(signal: SessionSignal): Promise<void> {
    const connected = this.devices.listConnected();
    if (connected.length === 0) return;

    const { title, body } = formatNotification(signal);
    await Promise.all(connected.map(async (device) => {
      try {
        const acknowledgement = await this.devices.sendNotification(
          device.id,
          randomUUID(),
          title,
          body,
          ACKNOWLEDGEMENT_TIMEOUT_MS,
        );
        if (!acknowledgement.processed || acknowledgement.presentation !== 'submitted') {
          console.error(
            `[android] ${device.name}: notification ${acknowledgement.presentation} (processed=${acknowledgement.processed})`,
          );
        }
      } catch (error: unknown) {
        console.error(
          `[android] ${device.name}: notification delivery failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }));
  }

  async close(): Promise<void> {}
}

function formatNotification(signal: SessionSignal): { title: string; body: string } {
  let title: string;
  const details = [
    `Session: ${clean(signal.session.id, 128)}`,
    `Source: ${clean(signal.session.source, 32)}`,
    `Location: ${clean(signal.session.location, 240)}`,
    `At: ${clean(signal.at, 40)}`,
  ];

  if (signal.type === 'started') {
    title = 'Session started';
    details.push(`Prompt: ${clean(signal.prompt, 1_000)}`);
  } else if (signal.type === 'ended') {
    title = signal.reason === 'completed'
      ? 'Session completed'
      : signal.reason === 'aborted'
        ? 'Session aborted'
        : 'Session ended';
    details.push(`Reason: ${signal.reason}`);
  } else {
    title = 'Session inactive';
  }

  const body = details.join('\n').slice(0, 1_000);
  return { title, body };
}

function clean(value: string, maxLength: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}
