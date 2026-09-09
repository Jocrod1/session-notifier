# GitHub Copilot CLI hook integration

## Supported hook/event

Session Notifier only supports the GitHub Copilot CLI `agentStop`
command hook, and only payloads where `stopReason === "end_turn"`
(see `service/src/hooks/normalize.ts`). Other stop reasons are rejected.

## How the hook is configured

GitHub Copilot CLI command hooks are configured in the CLI's hooks
configuration file (see GitHub Copilot CLI documentation for the exact
config file location for your install). A command hook of type
`"command"` runs a shell command and receives the hook payload as JSON
on stdin.

See [`hooks.json`](./hooks.json) for a minimal `agentStop` hook
configuration.

## Command that invokes Session Notifier

```bash
npx --prefix /path/to/session-notifier/service tsx \
  /path/to/session-notifier/service/src/hooks/cli.ts --source=github-copilot
```

The CLI hook runner pipes the `agentStop` JSON payload to this
command's stdin. `src/hooks/cli.ts` parses it, validates it with
`normalizeHook('github-copilot', payload)`, and appends the normalized
`work-finished` event to the JSONL inbox at `SESSION_NOTIFIER_HOOK_INBOX`.

## Example `agentStop` payload

See [`agent-stop-event.json`](./agent-stop-event.json):

```json
{
  "sessionId": "copilot-a1b2c3",
  "timestamp": 1788433200000,
  "cwd": "/home/user/projects/my-app",
  "transcriptPath": "/tmp/copilot-transcript.jsonl",
  "stopReason": "end_turn",
  "stop_hook_active": false
}
```

This mirrors the automated test fixture at
`service/test/fixtures/hooks/github-copilot-agent-stop.json` (same
shape, different sample IDs).

### Relevant fields

| Field | Meaning | Required by adapter |
| --- | --- | --- |
| `sessionId` | Copilot's session identifier | yes, non-empty string -> `SessionRef.id` |
| `cwd` | Working directory the session ran in | yes, non-empty string -> `SessionRef.location` |
| `stopReason` | Why the agent stopped | yes, must equal `"end_turn"` |
| `timestamp` | Epoch milliseconds or ISO string | yes, must parse to a valid date -> event `at` |
| `transcriptPath` | Path to the Copilot transcript | ignored by the adapter |
| `stop_hook_active` | Copilot-internal recursion guard | ignored by the adapter |

## How the payload is normalized

`normalizeCopilot` (in `src/hooks/normalize.ts`) produces:

```json
{
  "type": "work-finished",
  "session": {
    "source": "github-copilot",
    "id": "copilot-a1b2c3",
    "location": "/home/user/projects/my-app"
  },
  "at": "2026-09-03T11:00:00.000Z"
}
```

This event is appended to the JSONL inbox. The running service's
`HookInboxSource` tails that file and feeds each normalized event into
the same `SessionLifecycleTracker` used by transcript listeners, which
emits an `ended` signal with `reason: "completed"`.

## Assumptions and limitations

- Only `stopReason: "end_turn"` is treated as a completion. Other
  Copilot stop reasons (for example a user-cancelled turn) are rejected
  by the adapter rather than guessed at, because no other mapping is
  currently documented in this project.
- `timestamp` may be an epoch-millisecond number or an ISO string; the
  adapter accepts both because Copilot CLI versions have been observed
  to differ here. Anything that does not parse to a valid date is
  rejected.
- No other Copilot CLI hook events (for example a hypothetical
  `agentStart`) are consumed by this project yet.
