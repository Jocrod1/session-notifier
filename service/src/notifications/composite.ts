import type { NotificationAdapter, SessionSignal } from '../domain.js';

export class CompositeNotificationAdapter implements NotificationAdapter {
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly local: NotificationAdapter,
    private readonly remote: NotificationAdapter,
  ) {}

  async notify(signal: SessionSignal): Promise<void> {
    await this.local.notify(signal);

    let delivery: Promise<void>;
    delivery = this.remote.notify(signal)
      .catch((error: unknown) => {
        console.error(`[notification] remote delivery failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => this.pending.delete(delivery));
    this.pending.add(delivery);
  }

  async close(): Promise<void> {
    await Promise.all([this.local.close(), this.remote.close()]);
    await Promise.all(this.pending);
  }
}
