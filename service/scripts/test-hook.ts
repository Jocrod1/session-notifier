#!/usr/bin/env -S npx tsx
/**
 * Manual/end-to-end hook test.
 *
 * Exercises the REAL hook ingestion path:
 *
 *   fixture payload (stdin)
 *     -> src/hooks/cli.ts (spawned as a real subprocess, same as a harness would invoke)
 *     -> normalizeHook()
 *     -> JSONL hook inbox (appendHook)
 *     -> HookInboxSource (the same class the running service uses)
 *     -> SessionLifecycleTracker
 *     -> Notifier
 *     -> ConsoleNotificationAdapter (the same adapter the running service uses)
 *
 * Usage:
 *   npm run test:hook -- opencode
 *   npm run test:hook -- github-copilot
 *   npm run test:hook -- opencode --fixture=test/fixtures/hooks/opencode-session-idle.json
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { SessionLifecycleTracker } from '../src/lifecycle.js';
import { Notifier } from '../src/notifier.js';
import { ConsoleNotificationAdapter } from '../src/notifications/console.js';
import { StateStore } from '../src/state-store.js';
import { HookInboxSource } from '../src/hooks/source.js';
import type { SessionEvent } from '../src/domain.js';

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_FIXTURES: Record<string, string> = {
  opencode: 'test/fixtures/hooks/opencode-session-idle.json',
  'github-copilot': 'test/fixtures/hooks/github-copilot-agent-stop.json',
};

function parseArgs(argv: string[]): { source: string; fixturePath: string } {
  const positional = argv.find((argument) => !argument.startsWith('--'));
  const sourceFlag = argv.find((argument) => argument.startsWith('--source='))?.slice('--source='.length);
  const source = sourceFlag ?? positional;
  if (source !== 'opencode' && source !== 'github-copilot') {
    throw new Error('Usage: npm run test:hook -- <opencode|github-copilot> [--fixture=path]');
  }
  const fixtureFlag = argv.find((argument) => argument.startsWith('--fixture='))?.slice('--fixture='.length);
  const fixturePath = resolve(serviceRoot, fixtureFlag ?? DEFAULT_FIXTURES[source]);
  return { source, fixturePath };
}

function runCli(source: string, payload: string, inboxPath: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn('npx', ['tsx', 'src/hooks/cli.ts', `--source=${source}`], {
      cwd: serviceRoot,
      env: { ...process.env, SESSION_NOTIFIER_HOOK_INBOX: inboxPath },
      stdio: ['pipe', 'inherit', 'pipe'],
      shell: process.platform === 'win32',
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.on('close', (code) => resolvePromise({ code: code ?? 1, stderr }));
    child.stdin?.end(payload);
  });
}

async function main(): Promise<void> {
  const { source, fixturePath } = parseArgs(process.argv.slice(2));
  const payload = await readFile(fixturePath, 'utf8');

  const workDir = await mkdtemp(join(tmpdir(), 'session-notifier-hook-test-'));
  const inboxPath = join(workDir, 'hooks.jsonl');
  const statePath = join(workDir, 'state.json');
  // The hook inbox watcher only attaches to an existing file, matching how the
  // real running service behaves when the inbox has never been written to yet.
  await writeFile(inboxPath, '', 'utf8');

  const stateStore = new StateStore(statePath);
  await stateStore.load();
  const notifier = new Notifier(new ConsoleNotificationAdapter(), stateStore);
  const lifecycle = new SessionLifecycleTracker({ inactiveAfterMs: 5 * 60_000 });

  let resolveReceived: (() => void) | undefined;
  const received = new Promise<void>((res) => { resolveReceived = res; });

  const hookSource = new HookInboxSource(inboxPath, async (event: SessionEvent) => {
    console.log(`Normalized event: ${event.type}`);
    console.log(`Session: ${event.session.id}`);
    const signals = lifecycle.event(event);
    await notifier.deliver(signals);
    for (const signal of signals) {
      console.log(`Notification: session ${signal.type}${signal.type === 'ended' ? ` (${signal.reason})` : ''}`);
    }
    resolveReceived?.();
  });
  hookSource.start();

  console.log(`Hook received: ${source}`);
  const { code, stderr } = await runCli(source, payload, inboxPath);
  if (code !== 0) {
    console.error(`Hook ingestion rejected the payload (exit code ${code}).`);
    if (stderr.trim()) console.error(stderr.trim());
    await hookSource.stop();
    await rm(workDir, { recursive: true, force: true });
    process.exitCode = 1;
    return;
  }
  console.log(`Hook accepted: ${source}`);

  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error('Timed out waiting for the hook inbox watcher to observe the event.')), 10_000);
  });
  try {
    await Promise.race([received, timeout]);
  } finally {
    await hookSource.stop();
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
