#!/usr/bin/env -S npx tsx
/**
 * Inject a fixture payload into the same JSONL hook inbox mechanism used by
 * real hook integrations, via the same `src/hooks/cli.ts` ingestion entry
 * point a real harness invokes. Intended to be used against an already
 * running `npm start` process (or `npm run dev`) so you can watch its
 * console notification output.
 *
 * Usage:
 *   npm run hook:emit -- --source=opencode --fixture=test/fixtures/hooks/opencode-session-idle.json
 *   npm run hook:emit -- --source=github-copilot --fixture=test/fixtures/hooks/github-copilot-agent-stop.json
 *
 * Set SESSION_NOTIFIER_HOOK_INBOX beforehand to match the running service's
 * inbox path (or pass --inbox=path); otherwise both default to
 * ./session-notifier-hooks.jsonl relative to the current working directory.
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function flag(argv: string[], name: string): string | undefined {
  return argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const source = flag(argv, 'source');
  const fixture = flag(argv, 'fixture');
  const inbox = flag(argv, 'inbox') ?? process.env.SESSION_NOTIFIER_HOOK_INBOX ?? './session-notifier-hooks.jsonl';

  if (source !== 'opencode' && source !== 'github-copilot') {
    throw new Error('Usage: npm run hook:emit -- --source=<opencode|github-copilot> --fixture=<path> [--inbox=<path>]');
  }
  if (!fixture) {
    throw new Error('--fixture=<path> is required, e.g. test/fixtures/hooks/opencode-session-idle.json');
  }

  const payload = await readFile(resolve(process.cwd(), fixture), 'utf8');

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn('npx', ['tsx', 'src/hooks/cli.ts', `--source=${source}`], {
      cwd: serviceRoot,
      env: { ...process.env, SESSION_NOTIFIER_HOOK_INBOX: resolve(process.cwd(), inbox) },
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
    });
    child.stdin?.end(payload);
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`Appended ${source} fixture to ${resolve(process.cwd(), inbox)}`);
        resolvePromise();
      } else {
        rejectPromise(new Error(`hook ingestion CLI exited with code ${code}`));
      }
    });
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
