import { describe, expect, it, vi } from 'vitest';
import type { NotificationAdapter, SessionSignal } from '../src/domain.js';
import type { DeviceMessaging } from '../src/connection/device-connections.js';
import type { NotificationAcknowledgement } from '../src/connection/protocol.js';
import { AndroidNotificationAdapter } from '../src/notifications/android.js';
import { CompositeNotificationAdapter } from '../src/notifications/composite.js';

const signal: SessionSignal = {
  type: 'started',
  session: { source: 'claude', id: 'session-1', location: 'project-a' },
  at: '2026-09-02T12:00:00.000Z',
  prompt: 'Implement notifications',
};

class RecordingAdapter implements NotificationAdapter {
  readonly signals: SessionSignal[] = [];
  async notify(value: SessionSignal): Promise<void> { this.signals.push(value); }
  async close(): Promise<void> {}
}

function messaging(
  connected: boolean,
  sendNotification: DeviceMessaging['sendNotification'],
): DeviceMessaging {
  return {
    isConnected: () => connected,
    listConnected: () => connected
      ? [{ id: 'device-1', name: 'Android', connectedAt: signal.at }]
      : [],
    send: () => { throw new Error('Unexpected unacknowledged send'); },
    sendNotification,
  };
}

describe('notification adapters', () => {
  it('keeps local delivery working while Android is disconnected', async () => {
    const local = new RecordingAdapter();
    const sendNotification = vi.fn<DeviceMessaging['sendNotification']>();
    const adapter = new CompositeNotificationAdapter(
      local,
      new AndroidNotificationAdapter(messaging(false, sendNotification)),
    );

    await adapter.notify(signal);
    await adapter.close();

    expect(local.signals).toEqual([signal]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it.each([
    ['transport failure', async () => { throw new Error('socket unavailable'); }],
    ['acknowledgement timeout', async () => { throw new Error('Timed out waiting for notification acknowledgement'); }],
  ])('does not let Android %s block or fail local delivery', async (_failure, send) => {
    const local = new RecordingAdapter();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = new CompositeNotificationAdapter(
      local,
      new AndroidNotificationAdapter(messaging(true, async (_deviceId, notificationId) => {
        await send();
        return acknowledgement(notificationId);
      })),
    );

    try {
      await adapter.notify(signal);
      expect(local.signals).toEqual([signal]);
      await adapter.close();
      expect(local.signals).toEqual([signal]);
      expect(errors).toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});

function acknowledgement(notificationId: string): NotificationAcknowledgement {
  return {
    type: 'notification-ack',
    protocolVersion: 1,
    notificationId,
    processed: true,
    presentation: 'submitted',
  };
}
