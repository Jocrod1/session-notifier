import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SessionEvent } from '../domain.js';
import type { HookSource } from './normalize.js';
import { normalizeHook } from './normalize.js';

export interface HookEnvelope {
  source: HookSource;
  payload: unknown;
}

export async function appendHook(input: HookEnvelope, path: string): Promise<SessionEvent> {
  const event = normalizeHook(input.source, input.payload);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify({ source: input.source, event })}\n`, 'utf8');
  return event;
}

export function parseEnvelope(line: string): SessionEvent {
  const value: unknown = JSON.parse(line);
  if (typeof value !== 'object' || value === null || !('event' in value)) throw new Error('hook inbox record must contain event');
  const event = value.event;
  if (typeof event !== 'object' || event === null || (event as { type?: unknown }).type !== 'work-finished') {
    throw new Error('hook inbox record contains an unsupported event');
  }
  const session = (event as { session?: unknown }).session;
  if (typeof session !== 'object' || session === null || !isHookSource((session as { source?: unknown }).source) ||
      typeof (session as { id?: unknown }).id !== 'string' || typeof (session as { location?: unknown }).location !== 'string' ||
      typeof (event as { at?: unknown }).at !== 'string' || Number.isNaN(Date.parse((event as { at: string }).at))) {
    throw new Error('malformed normalized hook event');
  }
  return event as SessionEvent;
}

function isHookSource(value: unknown): boolean {
  return value === 'opencode' || value === 'github-copilot';
}
