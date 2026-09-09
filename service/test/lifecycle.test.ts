import { describe, expect, it } from 'vitest';
import type { SessionRef } from '../src/domain.js';
import { SessionLifecycleTracker } from '../src/lifecycle.js';

const session: SessionRef = { source: 'claude', id: 'session-1', location: 'project-a' };
const startedAt = '2026-09-02T12:00:00.000Z';

describe('SessionLifecycleTracker', () => {
  it('emits one start, an explicit end, and one inactivity signal after renewed activity', () => {
    const tracker = new SessionLifecycleTracker({ inactiveAfterMs: 5 * 60_000 });

    expect(tracker.prompt(session, 'Implement notifications', startedAt)).toEqual([
      { type: 'started', session, at: startedAt, prompt: 'Implement notifications' },
    ]);
    expect(tracker.end(session, 'completed', '2026-09-02T12:01:00.000Z')).toEqual([
      { type: 'ended', session, at: '2026-09-02T12:01:00.000Z', reason: 'completed' },
    ]);

    expect(tracker.tick(Date.parse('2026-09-02T12:06:00.000Z'))).toEqual([
      { type: 'inactive', session, at: '2026-09-02T12:06:00.000Z' },
    ]);
    expect(tracker.prompt(session, 'Follow up', '2026-09-02T12:07:00.000Z')).toEqual([
      { type: 'started', session, at: '2026-09-02T12:07:00.000Z', prompt: 'Follow up' },
    ]);
    expect(tracker.tick(Date.parse('2026-09-02T12:12:00.000Z'))).toEqual([
      { type: 'inactive', session, at: '2026-09-02T12:12:00.000Z' },
    ]);
    expect(tracker.tick(Date.parse('2026-09-02T12:13:00.000Z'))).toEqual([]);
  });

  it('does not duplicate terminal notifications', () => {
    const tracker = new SessionLifecycleTracker({ inactiveAfterMs: 5 * 60_000 });
    tracker.prompt(session, 'Do work', startedAt);

    expect(tracker.end(session, 'aborted', '2026-09-02T12:01:00.000Z')).toHaveLength(1);
    expect(tracker.end(session, 'aborted', '2026-09-02T12:01:01.000Z')).toEqual([]);
  });

  it('delivers an explicit completion even when no transcript start was observed', () => {
    const tracker = new SessionLifecycleTracker({ inactiveAfterMs: 5 * 60_000 });
    expect(tracker.event({
      type: 'work-finished',
      session: { source: 'opencode', id: 'ses-1', location: '/work/project' },
      at: '2026-09-02T12:01:00.000Z',
    })).toEqual([{
      type: 'ended',
      session: { source: 'opencode', id: 'ses-1', location: '/work/project' },
      at: '2026-09-02T12:01:00.000Z',
      reason: 'completed',
    }]);
  });
});
