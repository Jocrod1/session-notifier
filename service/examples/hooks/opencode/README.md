# OpenCode hook integration

## Supported hook/event

Session Notifier only supports OpenCode's `session.idle` plugin event
(see `service/src/hooks/normalize.ts`). No other OpenCode plugin event
is normalized. `session.idle` is the closest documented signal to "the
agent finished responding and is waiting on the user again" that
OpenCode currently exposes to plugins; it is not a dedicated
"work finished" event from OpenCode itself.

## How the hook is configured

OpenCode plugins are TypeScript/JavaScript modules placed in a
project's `.opencode/plugins/` directory (or the global
`~/.config/opencode/plugins/` directory).
A plugin factory function receives a context object (including `$` for
shell execution and `directory` for the current project directory) and
returns hook implementations, including an `event` hook that receives
every OpenCode event.

See [`plugin-example.ts`](./plugin-example.ts) for a minimal plugin that
only reacts to `session.idle`.

## What command/script invokes Session Notifier

The plugin shells out to the hook ingestion CLI, piping a JSON payload
on stdin:

```bash
printf '%s' "$PAYLOAD" | npx --prefix /path/to/session-notifier/service \
  tsx /path/to/session-notifier/service/src/hooks/cli.ts --source=opencode
```

`src/hooks/cli.ts` reads the JSON payload from stdin, validates it with
`normalizeHook('opencode', payload)`, and appends the normalized
`work-finished` event to the JSONL inbox at `SESSION_NOTIFIER_HOOK_INBOX`
(default `./session-notifier-hooks.jsonl`).

## Example payload received by Session Notifier

See [`session-idle-event.json`](./session-idle-event.json). This is the
payload after the plugin merges `directory` into the raw OpenCode event,
which is what the CLI actually receives on stdin:

```json
{
  "type": "session.idle",
  "properties": {
    "sessionID": "ses_a1b2c3"
  },
  "directory": "/home/user/projects/my-app"
}
```

This mirrors the automated test fixture at
`service/test/fixtures/hooks/opencode-session-idle.json` (same shape,
different sample IDs).

## How the payload is normalized

`normalizeOpenCode` (in `src/hooks/normalize.ts`) requires:

- `type === "session.idle"`
- a non-empty string at `properties.sessionID`
- a non-empty string at `directory`

It produces:

```json
{
  "type": "work-finished",
  "session": {
    "source": "opencode",
    "id": "ses_a1b2c3",
    "location": "/home/user/projects/my-app"
  },
  "at": "<ISO timestamp captured at ingestion time>"
}
```

This event is appended to the JSONL inbox. The running service's
`HookInboxSource` tails that file and feeds each normalized event into
the same `SessionLifecycleTracker` used by transcript listeners, which
emits an `ended` signal with `reason: "completed"`.

## Assumptions and limitations

- OpenCode does not natively call an external command on `session.idle`;
  a plugin must be installed to bridge the event to Session Notifier.
  This is the only supported integration path for OpenCode in this POC.
- `at` is captured as "now" during ingestion, not sourced from the
  OpenCode event itself, because `session.idle` does not carry its own
  timestamp field.
- `session.idle` fires when the session becomes idle, not necessarily
  the exact moment the last turn completed. Treat this as a "best
  available" completion signal, not a precise measurement.
- A native OpenCode database collector (polling `opencode.db`) is
  intentionally out of scope; see `docs/sources.md`.
