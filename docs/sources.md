# Sources and Heuristics

## Source Status

| Source ID | Storage | Current status | Start signal | Terminal signal |
| --- | --- | --- | --- | --- |
| `claude` | JSONL under `~/.claude/projects` | Implemented | Human user record or enqueue operation | Assistant `stop_reason: "end_turn"` |
| `codex` | JSONL under `~/.codex/sessions` | Implemented | User-role message content | `turn_complete`, `task_complete`, or `turn_aborted` |
| `koda` | JSONL under `~/.koda/agent/sessions` | Implemented | User-role message content | `turn_complete` or `task_complete` |
| `local-llm` | JSONL under `LOCAL_LLM_SESSIONS_DIR` | Implemented | User-role message content | `turn_complete` |
| `opencode` | Plugin event hook | Implemented (hook POC) | Not emitted by hook POC | `session.idle` -> `work-finished` |
| `github-copilot` | CLI command hook | Implemented (hook POC) | Not emitted by hook POC | `agentStop` -> `work-finished` |
| `docker-claude` | Claude JSONL inside containers | Not implemented | Claude transcript prompt | Claude end turn or container disappearance |

## Common Parsing Rules

File-backed adapters parse newline-delimited JSON defensively. Invalid JSON records are ignored rather than crashing the process. The incremental tailer emits only complete newline-terminated records; a record being written remains buffered until its newline arrives. If a file shrinks, it is treated as truncated and tailing restarts from byte zero.

A user prompt must be non-empty and avoid obvious synthetic markers. The shared baseline rejects text beginning with `<`, text beginning with `[Request interrupted`, and text containing `<system-reminder>`. Prompt text is trimmed and limited to 240 characters.

This filtering is heuristic. Agent transcript schemas evolve and some tools place injected instructions in user-role records. A false start notification is preferable to avoiding crashes, but parser rules should be tested against real fixture records before widening them.

## Claude

Claude files are expected at:

```text
~/.claude/projects/<project>/<session>.jsonl
```

The project directory becomes the session `location`; the filename without `.jsonl` is the native session ID.

A `queue-operation` with `operation: "enqueue"` and a legitimate `content` string creates a prompt. A `user` record with string message content does the same. An `assistant` record with `message.stop_reason === "end_turn"` creates a completed terminal signal. Other assistant and user records renew activity for known sessions.

Subagent files are not monitored as independent sessions in this version.

## Codex

Codex session roots are:

```text
~/.codex/sessions
```

The adapter searches JSONL filenames for a UUID and uses the date-directory path below the root as `location`. Its generic parser reads the record `payload` when present, otherwise the record itself.

A user role with string or text-block content creates a prompt. `turn_complete`, `task_complete`, and `step-finish` are treated as normal completion. `turn_aborted` is treated as an aborted terminal event.

Codex formats are version-sensitive. The original recorder contains richer source-specific logic for injected-prompt filtering and tool data, while this notifier intentionally retains only the lifecycle-relevant subset.

## Koda

Koda sessions are expected below:

```text
~/.koda/agent/sessions
```

The first directory below the root is retained as `location`; a UUID found in the JSONL filename is used as the session ID. The generic parser handles user prompts and `turn_complete` / `task_complete` terminal records. No explicit abort mapping is currently implemented because the recorder's known Koda format does not expose one.

## Local LLM

Local-LLM sessions are expected below:

```text
$LOCAL_LLM_SESSIONS_DIR
```

When no override exists, this resolves to:

```text
~/.age-of-agents/local-llm/sessions
```

Each direct child JSONL file with a UUID filename becomes a session. User messages create starts and `turn_complete` produces a normal end. The watcher uses Node `path.relative` and `path.sep`, avoiding the forward-slash-only path handling that can break Windows source classification.

## OpenCode hook

OpenCode plugins expose the `session.idle` event. The plugin payload provides `properties.sessionID`; the plugin context `directory` supplies the session location. Forward `{ ...event, directory }` to `src/hooks/cli.ts --source=opencode`.

## GitHub Copilot hook

GitHub Copilot CLI's `agentStop` command hook provides `sessionId`, epoch-millisecond `timestamp`, `cwd`, and `stopReason: "end_turn"`. Forward its stdin to `src/hooks/cli.ts --source=github-copilot`.

Both hook adapters emit the normalized `work-finished` event and preserve `SessionRef.source`, `id`, and `location`. They do not replace transcript listeners.

## OpenCode: Planned database collector

OpenCode stores sessions in `~/.local/share/opencode/opencode.db`; SQLite polling is intentionally out of scope because the plugin hook is the supported completion input for this POC.

It must degrade gracefully if the native dependency, database, or expected schema is unavailable. Schema mismatch should log one clear health error and disable only this collector, without stopping other sources.

## Docker Claude: Planned Collector

The planned Docker adapter will poll `docker ps`, detect containers containing `~/.claude/projects/*/*.jsonl`, and tail those files with an injected Docker CLI client. It needs a source-qualified location such as the container ID/name because the same raw Claude session UUID may exist on the host and in a container.

A container disappearing can produce an `ended` signal with `reason: "container-exit"`, but this is an inferred lifecycle event, not proof that the agent completed normally. Docker availability, daemon state, shell availability inside the container, and permissions must be isolated as collector-local operational failures.
