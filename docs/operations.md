# Operations

## Requirements

- Node.js 22 or newer.
- `npm`.
- Read access to the selected agent's local transcript directory.
- `better-sqlite3` is optional and currently unused until the OpenCode collector is implemented.
- Docker is optional and currently unused until the Docker-Claude collector is implemented.

## Commands

Run these from the repository's `service/` directory:

```powershell
npm install
npm start
npm run dev
npm run build
npm test
```

`npm start` runs the process once. `npm run dev` starts it through `tsx watch`. `npm run build` performs a strict TypeScript type check without emitting JavaScript. `npm test` runs Vitest.

## Configuration

Configuration is environment-only. No config file is read.

| Variable                         | Default                                              | Meaning                                                                                                    |
| -------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `SESSION_NOTIFIER_SOURCES`       | `claude,codex,koda,local-llm,opencode,github-copilot` | Comma-separated source IDs. Unsupported IDs fail startup.                                                  |
| `SESSION_NOTIFIER_IDLE_AFTER_MS` | `300000`                                             | Positive integer inactivity threshold in milliseconds.                                                     |
| `SESSION_NOTIFIER_STATE_PATH`    | `./session-notifier-state.json`                      | Path for persisted delivered-notification keys. Relative paths resolve from the process working directory. |
| `SESSION_NOTIFIER_HOOK_INBOX`    | `./session-notifier-hooks.jsonl`                    | Local JSONL inbox used by OpenCode and GitHub Copilot hook commands. |
| `LOCAL_LLM_SESSIONS_DIR`         | `~/.age-of-agents/local-llm/sessions`                | Override root for local-LLM JSONL session files.                                                           |

Examples:

```powershell
$env:SESSION_NOTIFIER_SOURCES = "claude,codex"
$env:SESSION_NOTIFIER_IDLE_AFTER_MS = "600000"
$env:SESSION_NOTIFIER_STATE_PATH = "$HOME\.session-notifier\state.json"
npm start
```

For Claude-only operation:

```powershell
$env:SESSION_NOTIFIER_SOURCES = "claude"
npm start
```

## Testing hooks locally

Hooks are an additional input mechanism; the Claude, Codex, Koda, and
local-LLM passive listeners remain supported. OpenCode and GitHub Copilot
explicit hooks all produce the same normalized `work-finished` event and use
the existing lifecycle and console notification pipeline.

Run these commands from `service/`:

```bash
npm install
SESSION_NOTIFIER_SOURCES=opencode,github-copilot npm start
```

In another terminal, run the complete manual flow for either source:

```bash
npm run test:hook -- opencode
npm run test:hook -- github-copilot
```

Each command invokes `src/hooks/cli.ts` as a subprocess, appends to a
temporary JSONL inbox, starts the same `HookInboxSource` used by the service,
and delivers through the normal lifecycle/notifier/console adapter chain.
Expected output includes:

```text
Hook received: opencode
Hook accepted: opencode
Normalized event: work-finished
Session: ses_fixture_opencode_1
{"type":"session-notification","signal":{"type":"ended",...,"reason":"completed"}}
Notification: session ended (completed)
```

The Copilot command has the same shape with `github-copilot` and
`copilot-fixture-1`.

To inject a fixture into the persistent JSONL inbox used by an already
running service, set the same inbox path in both terminals:

```bash
export SESSION_NOTIFIER_HOOK_INBOX="$HOME/.session-notifier/hooks.jsonl"
npm start
```

Then, from `service/`, use the same CLI ingestion entry point as a real
harness hook:

```bash
npm run hook:emit -- --source=opencode --fixture=test/fixtures/hooks/opencode-session-idle.json
npm run hook:emit -- --source=github-copilot --fixture=test/fixtures/hooks/github-copilot-agent-stop.json
```

The default inbox is `./session-notifier-hooks.jsonl`, relative to the
service process working directory. The `SESSION_NOTIFIER_HOOK_INBOX` variable
can place it elsewhere. The emitter only simulates the harness by reading a
fixture; it still invokes `src/hooks/cli.ts`, which validates and normalizes
the payload before appending the record. An actual OpenCode plugin or Copilot
CLI hook supplies the same JSON on stdin.

The reference integrations and their payload examples are in
`service/examples/hooks/opencode/` and
`service/examples/hooks/github-copilot/`. Automated inputs are kept separate
in `service/test/fixtures/hooks/`.

The official harness configuration is documented by each reference folder:
OpenCode loads plugins from `.opencode/plugins/` or
`~/.config/opencode/plugins/`; GitHub Copilot CLI loads repository hooks from
`.github/hooks/*.json` and user hooks from `~/.copilot/hooks/*.json` (or
`$COPILOT_HOME/hooks`). The OpenCode adapter receives `session.idle` after the
plugin adds `directory`; the Copilot adapter receives camelCase `agentStop`
with `sessionId`, `timestamp`, `cwd`, `transcriptPath`, `stopReason`, and
`stop_hook_active`.

## Output

The console adapter writes a JSON object per notification to stdout:

```json
{
  "type": "session-notification",
  "signal": {
    "type": "ended",
    "session": {
      "source": "codex",
      "id": "session-id",
      "location": "2026/09/02"
    },
    "at": "2026-09-02T12:01:00.000Z",
    "reason": "completed"
  }
}
```

Startup, missing source roots, malformed state, watcher failures, and unavailable pending collectors go to stderr. This lets a process manager or log pipeline separate notifications from operational diagnostics.

## Startup and Historical Data

The watcher does not replay existing transcripts on startup. When it discovers a pre-existing JSONL session file, it begins tailing from its current end. This prevents a startup burst of notifications for old conversations. Only records appended while the process runs are processed.

If a source root does not exist when the service starts, that source logs `no transcript root found` and remains disabled for that process run. Restart after installing or opening an agent that creates the directory.

## State File and Restart Behavior

The state file is created after the first successful delivery. Do not delete it during normal operation: doing so makes prior notification keys unknown and permits duplicate notifications on replayed records.

A corrupted state file is deliberately ignored after a stderr warning, keeping the service available. Restore a backup or remove the file only when accepting the possibility of duplicate delivery.

## Shutdown

Use Ctrl+C or send SIGTERM. The service clears its inactivity interval, closes active file watchers, and closes the notification adapter. The console adapter has no buffered work. Future remote adapters must flush or cancel their work in `close()`.

## Troubleshooting

| Symptom                                          | Likely cause                                                                              | Action                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `no transcript root found`                       | Agent has not created its storage directory or the selected source is unavailable.        | Start a session in the agent, then restart the service; or limit `SESSION_NOTIFIER_SOURCES`. |
| No notification for an existing conversation     | The process begins at the end of existing files.                                          | Send a new prompt after starting the service.                                                |
| No start notification                            | The parser rejected synthetic/system content or does not yet recognize the source schema. | Check the source support notes and test with a normal human prompt.                          |
| Duplicate notifications after restart            | State file is missing, corrupt, or points to a different path.                            | Set a stable `SESSION_NOTIFIER_STATE_PATH`.                                                  |
| `docker-claude` is not implemented                     | The Docker collector is planned but not yet present.                                  | Exclude it from `SESSION_NOTIFIER_SOURCES`.                                                    |
