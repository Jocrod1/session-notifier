import type { NotificationAdapter, SessionSignal } from '../domain.js';

export class ConsoleNotificationAdapter implements NotificationAdapter {
  async notify(signal: SessionSignal): Promise<void> {
    console.log(JSON.stringify({ type: 'session-notification', signal }));
  }

  async close(): Promise<void> {}
}
