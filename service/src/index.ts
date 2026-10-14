import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { stdin } from 'node:process';
import { loadConfig } from './config.js';
import type { SessionRef } from './domain.js';
import type { SessionEvent } from './domain.js';
import { SessionLifecycleTracker } from './lifecycle.js';
import { Notifier } from './notifier.js';
import { ConsoleNotificationAdapter } from './notifications/console.js';
import { AndroidNotificationAdapter } from './notifications/android.js';
import { CompositeNotificationAdapter } from './notifications/composite.js';
import { FILE_SOURCES } from './sources/file-sources.js';
import { StateStore } from './state-store.js';
import type { Fact } from './transcript/facts.js';
import { SourceWatcher } from './watcher.js';
import { HookInboxSource } from './hooks/source.js';
import { runPairCommand } from './pairing/cli.js';
import { JsonDeviceRegistry } from './pairing/device-registry.js';
import { DeviceConnections, selectSingleConnectedDevice } from './connection/device-connections.js';

const config = loadConfig();
if (process.argv[2] === 'pair') {
  await runPairCommand(config);
  process.exit(0);
}
const stateStore = new StateStore(resolve(config.statePath));
await stateStore.load();

const deviceConnections = new DeviceConnections(
  new JsonDeviceRegistry(resolve(config.devicesPath)),
  config.connectionPort,
);
await deviceConnections.start();

const notifier = new Notifier(
  new CompositeNotificationAdapter(
    new ConsoleNotificationAdapter(),
    new AndroidNotificationAdapter(deviceConnections),
  ),
  stateStore,
);
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
console.log(`[session-notifier] device connections listening on 0.0.0.0:${deviceConnections.listeningPort}`);
const commandInput = createInterface({ input: stdin });
commandInput.on('line', (line) => {
  void runDevelopmentCommand(line).catch((error: unknown) => {
    console.error(`[session-notifier] command failed: ${error instanceof Error ? error.message : String(error)}`);
  });
});

async function runDevelopmentCommand(line: string): Promise<void> {
  const [command, ...extra] = line.trim().split(/\s+/);
  if (command !== 'test-notification') return;
  if (extra.length > 0) {
    console.error('Usage: test-notification');
    return;
  }
  const connected = deviceConnections.listConnected();
  const target = selectSingleConnectedDevice(connected);
  if (!target) {
    console.error(connected.length === 0
      ? 'No paired Android device is connected.'
      : 'More than one device is connected; test-notification requires exactly one.');
    return;
  }
  console.log(`[session-notifier] sending test notification to ${target.name} (${target.id})`);
  const acknowledgement = await deviceConnections.sendTestNotification(target.id);
  console.log(`[session-notifier] notification ${acknowledgement.notificationId}: processed=${acknowledgement.processed}, presentation=${acknowledgement.presentation}`);
}

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);
  commandInput.close();
  await deviceConnections.close();
  await Promise.all(watchers.map((watcher) => watcher.stop()));
  await hookSource.stop();
  await notifier.close();
}

process.once('SIGINT', () => void stop().finally(() => process.exit(0)));
process.once('SIGTERM', () => void stop().finally(() => process.exit(0)));
