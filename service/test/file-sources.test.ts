import { describe, expect, it } from 'vitest';
import { claudeSource, codexSource, localLlmSource } from '../src/sources/file-sources.js';

describe('file sources', () => {
  it('recognizes Claude user prompts and explicit completions', () => {
    expect(claudeSource.parseLine(JSON.stringify({ type: 'user', timestamp: '2026-09-02T12:00:00.000Z', message: { content: 'Build a notifier' } }))).toEqual([
      { kind: 'prompt', text: 'Build a notifier', ts: '2026-09-02T12:00:00.000Z' },
    ]);
    expect(claudeSource.parseLine(JSON.stringify({ type: 'assistant', timestamp: '2026-09-02T12:01:00.000Z', message: { stop_reason: 'end_turn' } }))).toEqual([
      { kind: 'turn-end', ts: '2026-09-02T12:01:00.000Z' },
    ]);
  });

  it('rejects synthetic prompts and supports generic source terminal records', () => {
    expect(claudeSource.parseLine(JSON.stringify({ type: 'user', message: { content: '<system-reminder>ignore</system-reminder>' } }))).toEqual([
      expect.objectContaining({ kind: 'activity' }),
    ]);
    expect(codexSource.parseLine(JSON.stringify({ type: 'turn_aborted', timestamp: '2026-09-02T12:01:00.000Z' }))).toEqual([
      { kind: 'turn-aborted', ts: '2026-09-02T12:01:00.000Z' },
    ]);
    expect(localLlmSource.classify('C:\\sessions\\abc.jsonl', 'C:\\sessions')).toBeUndefined();
  });
});
