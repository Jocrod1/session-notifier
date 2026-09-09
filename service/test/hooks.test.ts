import { describe, expect, it } from 'vitest';
import { normalizeHook } from '../src/hooks/normalize.js';
import { parseEnvelope } from '../src/hooks/inbox.js';

describe('hook normalization', () => {
  it('normalizes an OpenCode session.idle plugin event', () => {
    expect(normalizeHook('opencode', {
      type: 'session.idle',
      properties: { sessionID: 'ses_123' },
      directory: '/work/project',
    })).toEqual({
      type: 'work-finished',
      session: { source: 'opencode', id: 'ses_123', location: '/work/project' },
      at: expect.any(String),
    });
  });

  it('normalizes a Copilot agentStop hook payload', () => {
    expect(normalizeHook('github-copilot', {
      sessionId: 'copilot-123',
      timestamp: 1788433200000,
      cwd: '/work/project',
      transcriptPath: '/tmp/transcript.jsonl',
      stopReason: 'end_turn',
      stop_hook_active: false,
    })).toEqual({
      type: 'work-finished',
      session: { source: 'github-copilot', id: 'copilot-123', location: '/work/project' },
      at: '2026-09-03T11:00:00.000Z',
    });
  });

  it('rejects malformed or unsupported hook input', () => {
    expect(() => normalizeHook('opencode', { type: 'session.idle', properties: {} })).toThrow();
    expect(() => normalizeHook('github-copilot', { sessionId: 'x', cwd: '/tmp', timestamp: 'not-a-date', stopReason: 'end_turn' })).toThrow();
    expect(() => parseEnvelope(JSON.stringify({ event: { type: 'started' } }))).toThrow();
  });
});
