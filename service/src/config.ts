import type { SourceId } from './domain.js';

const SOURCE_IDS: SourceId[] = ['claude', 'codex', 'koda', 'local-llm', 'opencode', 'github-copilot', 'docker-claude'];
const DEFAULT_SOURCES: SourceId[] = ['claude', 'codex', 'koda', 'local-llm', 'opencode', 'github-copilot'];

export interface Config {
  sources: SourceId[];
  inactiveAfterMs: number;
  statePath: string;
  hookInboxPath: string;
  devicesPath: string;
  pairingTtlMs: number;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const sources = (environment.SESSION_NOTIFIER_SOURCES ?? DEFAULT_SOURCES.join(','))
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);
  const invalid = sources.filter((source): source is string => !SOURCE_IDS.includes(source as SourceId));
  if (invalid.length > 0) throw new Error(`SESSION_NOTIFIER_SOURCES contains unsupported sources: ${invalid.join(', ')}`);

  const inactiveAfterMs = parsePositiveInteger(environment.SESSION_NOTIFIER_IDLE_AFTER_MS ?? '300000', 'SESSION_NOTIFIER_IDLE_AFTER_MS');
  const pairingTtlMs = parsePositiveInteger(environment.SESSION_NOTIFIER_PAIRING_TTL_MS ?? '300000', 'SESSION_NOTIFIER_PAIRING_TTL_MS');
  return {
    sources: [...new Set(sources as SourceId[])],
    inactiveAfterMs,
    statePath: environment.SESSION_NOTIFIER_STATE_PATH ?? './session-notifier-state.json',
    hookInboxPath: environment.SESSION_NOTIFIER_HOOK_INBOX ?? './session-notifier-hooks.jsonl',
    devicesPath: environment.SESSION_NOTIFIER_DEVICES_PATH ?? './session-notifier-devices.json',
    pairingTtlMs,
  };
}

function parsePositiveInteger(value: string, variableName: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${variableName} must be a positive integer in milliseconds`);
  return parsed;
}
