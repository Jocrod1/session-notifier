import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import type { SessionRef } from './domain.js';
import type { SessionEvent } from './domain.js';
import { SessionLifecycleTracker } from './lifecycle.js';
import { Notifier } from './notifier.js';
import { ConsoleNotificationAdapter } from './notifications/console.js';
import { FILE_SOURCES } from './sources/file-sources.js';
import { StateStore } from './state-store.js';
import type { Fact } from './transcript/facts.js';
import { SourceWatcher } from './watcher.js';
import { HookInboxSource } from './hooks/source.js';

const config = loadConfig();
const stateStore = new StateStore(resolve(config.statePath));
await stateStore.load();

const notifier = new Notifier(new ConsoleNotificationAdapter(), stateStore);
const lifecycle = new SessionLifecycleTracker({ inactiveAfterMs: config.inactiveAfterMs });

async function handleFacts(session: SessionRef, facts: Fact[]): Promise<void> {
  for (const fact of facts) {
    if (fact.kind === 'prompt') {
      await notifier.deliver(lifecycle.prompt(session, fact.text, fact.ts));
    } else if (fact.kind === 'turn-end') {
      await handleEvent({ type: 'work-finished', session, at: fact.ts });
    } else if (fact.kind === 'turn-aborted') {
      await notifier.deliver(lifecycle.end(session, 'aborted', fact.ts));
    } else {
      lifecycle.activity(session, fact.ts);
    }

  }
}

async function handleEvent(event: SessionEvent): Promise<void> {
  await notifier.deliver(lifecycle.event(event));
}

const watchers = FILE_SOURCES
  .filter((source) => config.sources.includes(source.id))
  .map((source) => new SourceWatcher(source, handleFacts));

for (const watcher of watchers) watcher.start();
const hookSource = new HookInboxSource(config.hookInboxPath, handleEvent);
if (config.sources.includes('opencode') || config.sources.includes('github-copilot')) hookSource.start();
for (const source of config.sources.filter((source) => source === 'docker-claude')) {
  console.error(`[session-notifier] ${source}: collector is not implemented yet`);
}

const interval = setInterval(() => void notifier.deliver(lifecycle.tick(Date.now())), 15_000);
console.log(`[session-notifier] sources: ${config.sources.join(', ')}`);
console.log(`[session-notifier] inactive after: ${config.inactiveAfterMs}ms`);

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);
  await Promise.all(watchers.map((watcher) => watcher.stop()));
  await hookSource.stop();
  await notifier.close();
}

process.once('SIGINT', () => void stop().finally(() => process.exit(0)));
process.once('SIGTERM', () => void stop().finally(() => process.exit(0)));
