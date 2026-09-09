import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { NotificationAdapter, SessionSignal } from '../src/domain.js';
import { Notifier } from '../src/notifier.js';
import { StateStore } from '../src/state-store.js';

const paths: string[] = [];

afterEach(async () => {
  await Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

class RecordingAdapter implements NotificationAdapter {
  readonly signals: SessionSignal[] = [];
  async notify(signal: SessionSignal): Promise<void> { this.signals.push(signal); }
  async close(): Promise<void> {}
}

describe('Notifier', () => {
  it('does not redeliver a persisted notification', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'session-notifier-'));
    paths.push(directory);
    const statePath = join(directory, 'state.json');
    const signal: SessionSignal = {
      type: 'started',
      session: { source: 'claude', id: 'session-1', location: 'project-a' },
      at: '2026-09-02T12:00:00.000Z',
      prompt: 'Implement notifications',
    };

    const firstAdapter = new RecordingAdapter();
    const firstStore = new StateStore(statePath);
    await firstStore.load();
    await new Notifier(firstAdapter, firstStore).deliver([signal]);

    const secondAdapter = new RecordingAdapter();
    const secondStore = new StateStore(statePath);
    await secondStore.load();
    await new Notifier(secondAdapter, secondStore).deliver([signal]);

    expect(firstAdapter.signals).toEqual([signal]);
    expect(secondAdapter.signals).toEqual([]);
  });
});
