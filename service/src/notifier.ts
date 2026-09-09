import type { NotificationAdapter, SessionSignal } from './domain.js';
import { sessionKey } from './domain.js';
import type { StateStore } from './state-store.js';

export class Notifier {
  constructor(
    private readonly adapter: NotificationAdapter,
    private readonly stateStore: StateStore,
  ) {}

  async deliver(signals: SessionSignal[]): Promise<void> {
    for (const signal of signals) {
      const key = notificationKey(signal);
      if (this.stateStore.hasDelivered(key)) continue;
      await this.adapter.notify(signal);
      await this.stateStore.markDelivered(key);
    }
  }

  close(): Promise<void> {
    return this.adapter.close();
  }
}

export function notificationKey(signal: SessionSignal): string {
  return [sessionKey(signal.session), signal.type, signal.at, signal.type === 'ended' ? signal.reason : ''].join(':');
}
