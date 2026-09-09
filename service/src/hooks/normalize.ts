import type { SessionEvent, SessionRef, SourceId } from '../domain.js';

export type HookSource = 'opencode' | 'github-copilot';

export function normalizeHook(source: HookSource, input: unknown): SessionEvent {
  if (!isRecord(input)) throw new Error('hook payload must be an object');
  return source === 'opencode' ? normalizeOpenCode(input) : normalizeCopilot(input);
}

function normalizeOpenCode(input: Record<string, unknown>): SessionEvent {
  const properties = record(input.properties);
  const id = stringValue(properties?.sessionID);
  const location = stringValue(input.directory);
  if (input.type !== 'session.idle' || !id || !location) {
    throw new Error('OpenCode hook requires type session.idle, properties.sessionID, and directory');
  }
  return event('opencode', id, location, new Date().toISOString());
}

function normalizeCopilot(input: Record<string, unknown>): SessionEvent {
  const id = stringValue(input.sessionId);
  const location = stringValue(input.cwd);
  const timestamp = input.timestamp;
  if (input.stopReason !== 'end_turn' || !id || !location || (!Number.isSafeInteger(timestamp) && typeof timestamp !== 'string')) {
    throw new Error('Copilot agentStop hook requires sessionId, timestamp, cwd, and stopReason end_turn');
  }
  const at = typeof timestamp === 'number' ? new Date(timestamp).toISOString() : String(timestamp);
  if (Number.isNaN(Date.parse(at))) throw new Error('Copilot timestamp must be an epoch number or ISO timestamp');
  return event('github-copilot', id, location, at);
}

function event(source: SourceId, id: string, location: string, at: string): SessionEvent {
  return { type: 'work-finished', session: { source, id, location }, at };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
