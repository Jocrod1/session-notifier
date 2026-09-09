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
| `SESSION_NOTIFIER_SOURCES`       | `claude,codex,koda,local-llm,opencode,docker-claude` | Comma-separated source IDs. Unsupported IDs fail startup.                                                  |
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

## Hook ingestion POC

Hooks are an additional event source; the Claude, Codex, Koda, and local-LLM transcript listeners remain supported. The only supported hook event is `work-finished`.

Start the service with `opencode` and/or `github-copilot` enabled:

```powershell
$env:SESSION_NOTIFIER_SOURCES = "claude,codex,koda,local-llm,opencode,github-copilot"
$env:SESSION_NOTIFIER_HOOK_INBOX = "$HOME\.session-notifier\hooks.jsonl"
npm start
```

GitHub Copilot CLI command hooks receive the documented `agentStop` JSON on stdin. Configure a command hook that forwards it:

```json
{
  "version": 1,
  "hooks": {
    "agentStop": [
      {
        "type": "command",
        "bash": "npx --prefix /path/to/session-notifier/service tsx /path/to/session-notifier/service/src/hooks/cli.ts --source=github-copilot",
        "timeoutSec": 10
      }
    ]
  }
}
```

OpenCode exposes completion through its plugin `event` hook. A plugin should forward `session.idle` and add the plugin `directory` as the project location:

```ts
export const SessionNotifier = async ({ $, directory }) => ({
  event: async ({ event }) => {
    if (event.type !== "session.idle") return
    const payload = JSON.stringify({ ...event, directory })
    await $`printf '%s' ${payload} | npx --prefix /path/to/session-notifier/service tsx /path/to/session-notifier/service/src/hooks/cli.ts --source=opencode`
  },
})
```

The CLI validates the source payload, appends a normalized event to the inbox, and the running service emits its existing console `ended` notification. Invalid input is rejected and logged without stopping other sources.

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
| `opencode` or `docker-claude` is not implemented | Those collector modules are planned but not yet present.                                  | Exclude them with `SESSION_NOTIFIER_SOURCES` until implemented.                              |
