import { readFileSync } from 'node:fs';
import { appendHook } from './inbox.js';
import type { HookSource } from './normalize.js';

const source = process.env.SESSION_NOTIFIER_HOOK_SOURCE ?? process.argv.find((argument) => argument.startsWith('--source='))?.slice('--source='.length);
if (source !== 'opencode' && source !== 'github-copilot') {
  throw new Error('SESSION_NOTIFIER_HOOK_SOURCE must be opencode or github-copilot');
}
const payload = JSON.parse(readFileSync(0, 'utf8')) as unknown;
await appendHook({ source: source as HookSource, payload }, process.env.SESSION_NOTIFIER_HOOK_INBOX ?? './session-notifier-hooks.jsonl');
