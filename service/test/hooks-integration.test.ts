import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SessionEvent, SessionSignal } from '../src/domain.js';
import { appendHook } from '../src/hooks/inbox.js';
import { HookInboxSource } from '../src/hooks/source.js';
import { SessionLifecycleTracker } from '../src/lifecycle.js';
import { Notifier } from '../src/notifier.js';
import { StateStore } from '../src/state-store.js';

/**
 * These tests exercise the real hook ingestion path used in production:
 *
 *   appendHook() (the same function src/hooks/cli.ts calls)
 *     -> normalizeHook()
 *     -> JSONL inbox file
 *     -> HookInboxSource (the same class the running service starts)
 *     -> SessionLifecycleTracker
 *     -> Notifier (with real duplicate-suppression via StateStore)
 *
 * They intentionally do not call normalizeHook() directly and assert on its
 * return value; src/hooks/normalize.ts already has unit coverage in
 * test/hooks.test.ts.
 */

class RecordingAdapter {
  readonly signals: SessionSignal[] = [];
  async notify(signal: SessionSignal): Promise<void> {
    this.signals.push(signal);
  }
  async close(): Promise<void> {}
}

let workDir: string;
let inboxPath: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'session-notifier-hooks-'));
  inboxPath = join(workDir, 'hooks.jsonl');
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

function openCodePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'session.idle',
    properties: { sessionID: 'ses_int_1' },
    directory: '/work/integration',
    ...overrides,
  };
}

function copilotPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: 'copilot-int-1',
    timestamp: 1788433200000,
    cwd: '/work/integration',
    stopReason: 'end_turn',
    ...overrides,
  };
}

async function runInboxOnce(): Promise<SessionEvent[]> {
  const events: SessionEvent[] = [];
  const source = new HookInboxSource(inboxPath, async (event) => {
    events.push(event);
  });
  source.start();
  // ignoreInitial:false makes chokidar emit an 'add' event as soon as it
  // finishes its initial scan; give it a short window to do so.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  await source.stop();
  return events;
}

describe('hook ingestion integration', () => {
  it('ingests a valid OpenCode session.idle payload end-to-end into a work-finished event', async () => {
    await appendHook({ source: 'opencode', payload: openCodePayload() }, inboxPath);
    const events = await runInboxOnce();
    expect(events).toEqual([{
      type: 'work-finished',
      session: { source: 'opencode', id: 'ses_int_1', location: '/work/integration' },
      at: expect.any(String),
    }]);
  });

  it('continues watching when the inbox does not exist at service startup', async () => {
    const events: SessionEvent[] = [];
    const source = new HookInboxSource(inboxPath, async (event) => {
      events.push(event);
    });
    source.start();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));

    await appendHook({ source: 'opencode', payload: openCodePayload({ properties: { sessionID: 'ses_created_later' } }) }, inboxPath);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_500));
    await source.stop();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'work-finished',
      session: { source: 'opencode', id: 'ses_created_later' },
    });
  });

  it('ingests a valid GitHub Copilot agentStop payload end-to-end into a work-finished event', async () => {
    await appendHook({ source: 'github-copilot', payload: copilotPayload() }, inboxPath);
    const events = await runInboxOnce();
    expect(events).toEqual([{
      type: 'work-finished',
      session: { source: 'github-copilot', id: 'copilot-int-1', location: '/work/integration' },
      at: '2026-09-03T11:00:00.000Z',
    }]);
  });

  it('rejects a malformed OpenCode payload before it reaches the inbox', async () => {
    await expect(appendHook({ source: 'opencode', payload: openCodePayload({ properties: {} }) }, inboxPath))
      .rejects.toThrow();
    const events = await runInboxOnce();
    expect(events).toEqual([]);
  });

  it('rejects a malformed GitHub Copilot payload before it reaches the inbox', async () => {
    await expect(appendHook({ source: 'github-copilot', payload: copilotPayload({ stopReason: 'cancelled' }) }, inboxPath))
      .rejects.toThrow();
    const events = await runInboxOnce();
    expect(events).toEqual([]);
  });

  it('does not produce a duplicate notification for a duplicate hook event', async () => {
    await appendHook({ source: 'github-copilot', payload: copilotPayload() }, inboxPath);
    await appendHook({ source: 'github-copilot', payload: copilotPayload() }, inboxPath);

    const statePath = join(workDir, 'state.json');
    const stateStore = new StateStore(statePath);
    await stateStore.load();
    const adapter = new RecordingAdapter();
    const notifier = new Notifier(adapter, stateStore);
    const lifecycle = new SessionLifecycleTracker({ inactiveAfterMs: 5 * 60_000 });

    const source = new HookInboxSource(inboxPath, async (event) => {
      await notifier.deliver(lifecycle.event(event));
    });
    source.start();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
    await source.stop();

    expect(adapter.signals).toHaveLength(1);
    expect(adapter.signals[0]).toMatchObject({ type: 'ended', reason: 'completed' });
  });

  it('produces ended/completed even when no prior started event was observed', async () => {
    await appendHook({ source: 'opencode', payload: openCodePayload({ properties: { sessionID: 'ses_no_start' } }) }, inboxPath);

    const lifecycle = new SessionLifecycleTracker({ inactiveAfterMs: 5 * 60_000 });
    const events = await runInboxOnce();
    expect(events).toHaveLength(1);
    const signals = lifecycle.event(events[0]!);
    expect(signals).toEqual([{
      type: 'ended',
      session: { source: 'opencode', id: 'ses_no_start', location: '/work/integration' },
      at: events[0]!.at,
      reason: 'completed',
    }]);
  });
});
