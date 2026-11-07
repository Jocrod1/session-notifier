# Sources and Heuristics

## Source Status

| Source ID | Storage | Current status | Start signal | Terminal signal |
| --- | --- | --- | --- | --- |
| `claude` | JSONL under `~/.claude/projects` | Implemented | Human user record or enqueue operation | Assistant `stop_reason: "end_turn"` |
| `codex` | JSONL under `~/.codex/sessions` | Implemented | User-role message content | `turn_complete`, `task_complete`, or `turn_aborted` |
| `koda` | JSONL under `~/.koda/agent/sessions` | Implemented | User-role message content | `turn_complete` or `task_complete` |
| `local-llm` | JSONL under `LOCAL_LLM_SESSIONS_DIR` | Implemented | User-role message content | `turn_complete` |
| `opencode` | V2 plugin event stream; current adapter example is a V1 POC | Partial; V2 event contract reviewed, adapter is incompatible | Not emitted by current POC | V2 exposes permission, form, execution, and idle events; no attention mapping implemented |
| `github-copilot` | CLI command hooks | Partial; current adapter only accepts completion | Not emitted by current POC | `agentStop` -> `work-finished`; notification/error hooks are not consumed |
| `docker-claude` | Claude JSONL inside containers | Not implemented | Claude transcript prompt | Claude end turn or container disappearance |

## MVP harness event contract reviewed 2026-11-07

The MVP harnesses are **GitHub Copilot CLI** and **OpenCode V2**. The versions
below are the most recent non-prerelease releases found in the scoped product
lines during this review, and are reference baselines for follow-up
compatibility testing—not a claim that the repository has been run against them,
nor a minimum-version range. OpenCode V1 and V2 are parallel release lines: V2
2.2.6 is the latest V2 release found, while GitHub's generic
`/releases/latest` endpoint still points to V1 1.19.5. The MVP scope here is
specifically V2:

- GitHub Copilot CLI: **1.0.106 installed** locally (`copilot --version`,
  2026-11-07); 1.0.107 (2026-11-06) is the latest stable release; 1.0.108
  builds were prereleases. Release notes show the `notification` hook was added
  in 1.0.18, and since 1.0.26 "Permission prompt notification hook only fires
  when a prompt is actually shown to the user". The 1.0.107 release body repeats
  1.0.106's items, so individual bullets there cannot be attributed to one of
  the two versions. The hooks reference is unversioned (current docs only).
- OpenCode **V2 2.2.6**, installed locally (`opencode --version`) and released
  2026-11-06. The installed server's `/openapi.json` matched the published V2
  schema for every candidate event and required field below (2026-11-07).

**Proposed support range (owner decision pending):** Copilot CLI
1.0.106–1.0.107 and OpenCode 2.2.6, subject to live validation. 1.0.26 is the
documented contract floor only, not a tested claim; older V2 schemas were not
compared. Until real runs verify the mappings below, runtime behavior remains
unverified.
The current Copilot POC covers only `agentStop`; the current OpenCode example is
a V1 plugin and does not run on V2. Neither example currently implements this
contract.

| MVP category | Copilot CLI native signal | OpenCode V2 native signal | Contract conclusion / caution |
| --- | --- | --- | --- |
| Approval required | CLI-only `notification` hook with `notification_type: "permission_prompt"`; payload has `sessionId`, `timestamp`, `cwd`, `message`, optional `title` | `permission.asked`; `data` has the pending request `id`, `sessionID`, `action`, `resources`, and optional `message`; `location.directory` identifies the working location | Candidate direct mappings. Do not map Copilot `permissionRequest`: it fires before rules and may lead to auto-allow/auto-deny rather than a human prompt; the 1.0.26 release note states `permission_prompt` fires only when a prompt is shown. OpenCode `permission.asked` represents a pending request; whether plugin `evaluate` hooks suppress it is unverified. Status: partial (no live capture). |
| Clarification/question | CLI-only `notification` hook with `notification_type: "elicitation_dialog"` (`ask_user`); payload has `sessionId`, `timestamp`, `cwd`, `message`, optional `title` | `form.created`; `data.form` has a form ID, `sessionID`, title, and fields | Candidate mappings. OpenCode docs say the `question` tool "presents an interactive form"; whether non-agent forms (for example integration sign-in) also emit `form.created` is unknown. Status: partial. |
| Task completed / awaiting instructions | `agentStop` reports the main agent finished a turn (`stopReason: "end_turn"`); exclude `subagentStop` and `notification` types `agent_idle`/`agent_completed`/`shell_*` | Prefer `session.execution.succeeded`; do not use `session.idle` alone | Copilot fires every turn, including a turn ending with a plain-text question, and provides no description. OpenCode child/subagent sessions must be excluded: installed 2.2.6 exposes `parentID` on `Session.Info` and `session.created`, and `Session.Info.title` can supply a description (runtime behavior unverified). Status: partial. |
| Error requiring attention | `errorOccurred` with `recoverable: false`; drop `recoverable: true` and `postToolUseFailure` | `session.execution.failed` (the only terminal-failure event in 2.2.6); `session.retry.scheduled`, `session.tool.failed`, `session.step.failed`, `session.compaction.failed`, and `session.execution.interrupted` do not notify (interruption handling is an owner decision) | Copilot: unknown whether `agentStop` also fires after a terminal error (double notification risk) — status unknown. OpenCode: partial. |

### Attribution, identity, and representative payloads

Copilot hooks fired inside a subagent add `agentId`, `agentType`, and
`parentAgentId`. A subagent's permission prompt or question still waits for a
human and should notify. OpenCode V2 `ctx.location` is the plugin instance's
location, not that of every event it receives; attribute each event by its own
`location.directory`.

Copilot payloads provide `sessionId` and `cwd`, but do not provide a repository
display name or a unique event ID. The `notification` payload includes the
human-readable `message` and optional `title`; `agentStop` includes a
`transcriptPath`, but reading transcripts is not required by this contract.
Project-name derivation and stable duplicate handling remain unresolved.

OpenCode V2 events provide an event `id`, `created` timestamp, session ID in
event-specific `data`, and `location.directory`. These support event-level
deduplication and project-location attribution. They do not generally include
a project display name or useful completion description: `permission.asked`
may include `message`, and `form.created` includes a title and fields. A
directory-to-project-name lookup and completion-description source need
separate validation; do not silently substitute a full transcript.

The following are sanitized, **schema-derived examples**, not captures from a
live harness. Copilot fields follow the official CLI hook reference; OpenCode
fields follow the V2 OpenAPI event schemas. The repository currently has real
fixtures only for the older Copilot `agentStop` and OpenCode V1 `session.idle`
POCs.

```json
{"sessionId":"copilot-session","timestamp":1793990000000,"cwd":"C:\\work\\sample","hook_event_name":"Notification","notification_type":"permission_prompt","title":"Permission needed","message":"A tool is waiting for approval."}
{"sessionId":"copilot-session","timestamp":1793990001000,"cwd":"C:\\work\\sample","hook_event_name":"Notification","notification_type":"elicitation_dialog","title":"Question","message":"The agent needs more information."}
{"sessionId":"copilot-session","timestamp":1793990002000,"cwd":"C:\\work\\sample","transcriptPath":"C:\\temp\\transcript.jsonl","stopReason":"end_turn","stop_hook_active":false}
{"sessionId":"copilot-session","timestamp":1793990003000,"cwd":"C:\\work\\sample","error":{"name":"ToolError","message":"A required operation failed."},"errorContext":"tool_execution","recoverable":false}
```

```json
{"id":"evt_permission","created":1793990000000,"type":"permission.asked","location":{"directory":"C:\\work\\sample"},"data":{"id":"perm_1","sessionID":"ses_example","action":"write","resources":["src/example.ts"],"message":"Write access is required."}}
{"id":"evt_form","created":1793990001000,"type":"form.created","location":{"directory":"C:\\work\\sample"},"data":{"form":{"id":"form_1","sessionID":"ses_example","title":"A question for the user","fields":[]}}}
{"id":"evt_success","created":1793990002000,"type":"session.execution.succeeded","location":{"directory":"C:\\work\\sample"},"data":{"sessionID":"ses_example"}}
{"id":"evt_failure","created":1793990003000,"type":"session.execution.failed","location":{"directory":"C:\\work\\sample"},"data":{"sessionID":"ses_example","error":{"type":"ExecutionError","message":"Execution could not continue."}}}
```

### Repeated events, Windows ingestion, and verification plan

- OpenCode event IDs are the natural input-deduplication key. Preserve every
  distinct ID, including successive events for the same session. Copilot's
  documented payload has no event ID; a key based only on session ID would
  suppress distinct turns. Define and test exact-duplicate semantics without
  coalescing distinct notifications. The current lifecycle tracker emits only
  one hook-only completion for a session until another prompt is observed; this
  is an existing M2.4 failure, not evidence that repeated events are handled.
- Copilot runs every matching hook from every configuration source (policy,
  user, repository, plugin). The same hook installed at user and repository
  level therefore delivers identical payloads twice — a real duplicate-input
  source.
- The service CLI reads JSON from stdin (`readFileSync(0, 'utf8')`). Local
  PowerShell checks (2026-11-07) confirmed the current example's
  `Get-Content -Raw` fails without a `Path` (PowerShell echoes the piped text,
  then raises the error), while both `$input | node …` and a directly launched
  `node` child received redirected stdin, including a script path containing
  spaces. Copilot CLI also
  supports `exec` + `args` command hooks that run an executable without a shell,
  avoiding quoting of paths with spaces, plus `cwd` and `env` fields. The CLI's
  default inbox (`./session-notifier-hooks.jsonl`) is relative to the hook's
  working directory, not the service's; set an absolute shared inbox explicitly.
  Copilot hooks run inside the session sandbox only when `sandbox.enabled` is
  true (default `false`); then inbox writes outside granted paths may fail
  (unverified).
  The Windows hook command has not been validated end-to-end.
- A fresh 2026-11-07 inline `tsx` probe against current `service/src` reproduced
  `[1, 0]` signal counts for two successive Copilot completions and for two
  V1-shaped OpenCode idles; a V2-shaped `session.idle` was rejected. The
  OpenCode normalizer stamps ingestion time, so it cannot detect duplicates.

### Proposed common attention-event contract (not implemented)

```ts
AttentionEvent {
  schemaVersion: 1
  eventId: string             // OpenCode native evt_ id; Copilot derived hash
  eventIdSource: 'native' | 'derived'
  category: 'approval' | 'question' | 'completed' | 'error'
  agent: 'github-copilot' | 'opencode'
  sessionId: string
  occurredAt: string          // ISO from native timestamp/created, never ingestion time
  project: { name: string; directory: string }
  description: string         // short, sanitized, never transcript content
  native: { event: string; subtype?: string }
}
```

Suppress duplicates only on identical `eventId`, never on session ID. The
Copilot derived ID hashes source, `sessionId`, `agentId` when present, hook
event, `notification_type`, millisecond `timestamp`, and `message`; successive turns differ by timestamp.

Open owner decisions: confirm the proposed support range; project-name source
(Git top-level vs `cwd` basename; OpenCode `ctx.location.project`); completion
description (fixed text, or OpenCode `Session.Info.title` where available); whether inactivity/shutdown
interruptions are attention errors; whether the V2 plugin writes the inbox
in-process or spawns the CLI.
- Fixture/live test plan: on the reference versions, record sanitized payloads
  for actual permission prompts versus auto-decisions, questions/forms,
  successful completion, recoverable and terminal errors, and retries. Exercise
  successive same-session turns, exact duplicate hook inputs, same-millisecond
  inputs, routine idle/start/tool activity, and multiple hook registrations.
  On Windows, test stdin forwarding, executable/path quoting with spaces, and a
  shared absolute inbox from different working directories. Assert only the
  four attention categories notify; automatic decisions, retries, routine
  activity, and non-attention failures do not.

No live Copilot CLI or OpenCode V2 session was available in this review, so the
examples and event mappings remain contract-derived and runtime-unverified.

### Upstream references

- [Copilot CLI hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference)
- [Copilot CLI 1.0.107 release](https://github.com/github/copilot-cli/releases/tag/v1.0.107)
- [OpenCode V2 plugin events](https://opencode.ai/v2/docs/build/plugins/server/)
- [OpenCode V2 OpenAPI schema](https://opencode.ai/v2/openapi.json)
- [OpenCode V2 2.2.6 release](https://github.com/anomalyco/opencode/releases/tag/v2.2.6)
- [OpenCode V1-to-V2 plugin migration](https://opencode.ai/v2/docs/build/plugins/migrate-v1)

## Common Parsing Rules

The service has two input mechanisms: passive transcript listeners for Claude,
Codex, Koda, and local LLM sessions, plus explicit harness hooks for OpenCode
and GitHub Copilot. All source adapters converge on the same normalized domain
events and notification pipeline; hooks do not implement a separate
notification system.

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

The MVP target is OpenCode V2's plugin event stream (`ctx.event.subscribe()`),
not the V1 plugin factory shown in `service/examples/hooks/opencode/`. V2 uses
`Plugin.define({ id, setup(ctx) })`; its event envelopes include `id`,
`created`, `type`, and event-specific `data`. Relevant V2 event names and
unverified attention mappings are recorded in the [MVP harness event
contract](#mvp-harness-event-contract-reviewed-2026-11-07). V1 plugin
implementations do not run in V2. The current POC's expected
`properties.sessionID` shape is not the V2 event schema.

## GitHub Copilot hook

The MVP target is Copilot CLI's command-hook interface. The current POC consumes
only camelCase `agentStop`; attention-oriented candidates also include the
CLI-only `notification` hook (`permission_prompt`, `elicitation_dialog`) and
`errorOccurred`. Their event fields, matching cautions, and current reference
version are recorded in the [MVP harness event
contract](#mvp-harness-event-contract-reviewed-2026-11-07). Repository hooks
live in `.github/hooks/*.json`; Windows user hooks live in
`%USERPROFILE%\.copilot\hooks\` (or `$COPILOT_HOME/hooks`). The current
example's PowerShell `Get-Content -Raw` command does not read hook stdin because
it supplies no `Path`; the Windows ingestion path is not yet verified.

Both hook adapters emit the normalized `work-finished` event and preserve `SessionRef.source`, `id`, and `location`. They do not replace transcript listeners.

## OpenCode SQLite collector: deferred

OpenCode stores sessions in `~/.local/share/opencode/opencode.db`. SQLite
polling is out of scope for this POC; the plugin event hook is the supported
OpenCode completion input. Revisit a database collector only if the project
explicitly changes this scope decision.

## Docker Claude: Planned Collector

The planned Docker adapter will poll `docker ps`, detect containers containing `~/.claude/projects/*/*.jsonl`, and tail those files with an injected Docker CLI client. It needs a source-qualified location such as the container ID/name because the same raw Claude session UUID may exist on the host and in a container.

A container disappearing can produce an `ended` signal with `reason: "container-exit"`, but this is an inferred lifecycle event, not proof that the agent completed normally. Docker availability, daemon state, shell availability inside the container, and permissions must be isolated as collector-local operational failures.
