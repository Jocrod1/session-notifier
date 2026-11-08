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
below were the most recent non-prerelease releases found in the scoped product
lines during the 2026-11-07 review, and are reference baselines for follow-up
compatibility testing, not a minimum-version range. Later limited live runs are
recorded below. OpenCode V1 and V2 are parallel release lines: V2
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
| Approval required | CLI-only `notification` hook with `notification_type: "permission_prompt"`; payload has `sessionId`, `timestamp`, `cwd`, `message`, optional `title` | `permission.asked`; `data` has the pending request `id`, `sessionID`, `action`, `resources`, and optional `message` | Candidate mappings; each was captured with a user-reported real prompt on 2026-11-08. Do not map Copilot `permissionRequest`: it also fired for an action the user reports did not prompt. OpenCode's captured permission event contained location; whether plugin `evaluate` hooks suppress it remains unverified. Status: partial. |
| Clarification/question | CLI-only `notification` hook with `notification_type: "elicitation_dialog"` (`ask_user`); payload has `sessionId`, `timestamp`, `cwd`, `message`, optional `title` | `form.created`; `data.form` has a form ID, `sessionID`, title, and fields | Each was captured with a user-reported answered question on 2026-11-08. OpenCode's observed `metadata.kind` was `question`; whether other forms emit `form.created` and how to filter them remains open. Status: partial. |
| Task completed / awaiting instructions | `agentStop` reports the main agent finished a turn (`stopReason: "end_turn"`); exclude `subagentStop` and `notification` types `agent_idle`/`agent_completed`/`shell_*` | Prefer `session.execution.succeeded`; do not use `session.idle` alone | Copilot fires every turn, including a turn ending with a plain-text question, and provides no description. OpenCode child/subagent sessions must be excluded: installed 2.2.6 exposes `parentID` on `Session.Info` and `session.created`, and `Session.Info.title` can supply a description (runtime behavior unverified). Status: partial. |
| Error requiring attention | `errorOccurred` with `recoverable: false`; drop `recoverable: true` and `postToolUseFailure` | `session.execution.failed` (the only terminal-failure event in 2.2.6); `session.retry.scheduled`, `session.tool.failed`, `session.step.failed`, `session.compaction.failed`, and `session.execution.interrupted` do not notify (interruption handling is an owner decision) | Copilot: unknown whether `agentStop` also fires after a terminal error (double notification risk) — status unknown. OpenCode: partial. |

### Attribution, identity, and representative payloads

Copilot hooks fired inside a subagent add `agentId`, `agentType`, and
`parentAgentId`. A subagent's permission prompt or question still waits for a
human and should notify. OpenCode V2 `ctx.location` is the plugin instance's
location, not necessarily that of every event it receives. Event-level
`location.directory` cannot be assumed: see the live captures below.

Copilot payloads provide `sessionId` and `cwd`, but do not provide a repository
display name or a unique event ID. The `notification` payload includes the
human-readable `message` and optional `title`; `agentStop` includes a
`transcriptPath`, but reading transcripts is not required by this contract.
Project-name derivation and stable duplicate handling remain unresolved.

OpenCode V2 events provide an event `id`, `created` timestamp, and session ID in
event-specific `data`. These support event-level deduplication; project-location
attribution requires further validation. They do not generally include
a project display name or useful completion description: `permission.asked`
may include `message`, and `form.created` includes a title and fields. A
directory-to-project-name lookup and completion-description source need
separate validation; do not silently substitute a full transcript.

The following are sanitized, **schema-derived examples**, not captures from a
live harness. Copilot fields follow the official CLI hook reference; OpenCode
fields follow the V2 OpenAPI event schemas. Separate sanitized live captures
and their limitations are documented below and in the captured-fixtures README.

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
event, `notification_type`, millisecond `timestamp`, and `message`. This remains
unvalidated: timestamps alone cannot guarantee uniqueness for same-millisecond
distinct events, and Copilot duplicate identity remains an open decision.

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

No live Copilot CLI or OpenCode V2 session was available in the 2026-11-07
review, so those examples and most event mappings remain contract-derived and
runtime-unverified. The limited later evidence is recorded below.

### Limited live captures — 2026-11-08

On Windows, a temporary logging-only project hook captured Copilot CLI 1.0.107
`agentStop` after a simple successful turn. A V2 2.2.6 plugin subscription
captured `session.execution.started` and two `session.execution.succeeded`
events across consecutive turns of the same session. Sanitized payloads and
provenance are in [`service/test/fixtures/hooks/captured/`](../service/test/fixtures/hooks/captured/README.md).
The OpenCode events carried distinct IDs and `durable` sequence metadata, but
**none contained `location`**. The schema-derived examples above include
`location.directory`, but these plugin captures do not establish its presence;
project attribution and multi-location behavior remain open. The two observed
successes do not prove that every success means a human is waiting or that
child-session completions can be filtered correctly.

In a separate Copilot run, two identical `agentStop` registrations produced
identical parsed payloads. This establishes one duplicate-input source,
not safe general duplicate identity or successive Copilot-turn semantics. An
OpenCode run with `--auto` read a synthetic local file; its capture contained no
permission events, but no explicit proof was obtained that this read would
otherwise have required approval. Permission prompts, questions, terminal or
recoverable errors, retries and child-session behavior were not captured.
Two distinct OpenCode successes establish distinct IDs for this case only; no
notification delivery or duplicate suppression was tested with those events.
The existing OpenCode V1 normalizer rejects the captured V2 success payload.

### Interactive follow-up — 2026-11-08

In isolated temporary Windows project configuration, Copilot CLI 1.0.107 and
OpenCode V2 2.2.6 each produced a candidate approval event and question event.
The user reports the approval prompts were shown and approved once, and both
questions were shown and answered. OpenCode's `permission.replied` carried
`once`; `form.replied` matched the form ID. The OpenCode shell prompt used an
explicit temporary `ask` rule. In an earlier shell-read case the user reports
no prompt: Copilot nevertheless emitted `permissionRequest`, but no captured
`permission_prompt`; OpenCode emitted no captured permission event. These are
specific negative cases, not proof of every auto-approval policy.

Three Copilot `agentStop` payloads in the same interactive session had
different timestamps; two are retained. They show distinct observed turns, not
collision-free duplicate semantics or independent notification delivery. A
missing-file tool call produced Copilot `postToolUseFailure` and OpenCode
`session.tool.failed`; both agents then completed the turn. No terminal error,
retry, or child-session behavior was established.

The two interactive OpenCode `session.created` events and their permission/form
events contained `location.directory`; their directories matched each session's
creation location and the local plugin context. Execution events still lacked
location. A separate nested-directory standalone run had a different plugin
context directory but the same project ID and no execution-event location.
This suggests session-creation correlation as a candidate, not a verified
multi-location or restart-safe attribution solution. Sanitized payloads and
provenance are in the [captured fixtures](../service/test/fixtures/hooks/captured/README.md).

### Owner decision brief: event identity and attribution — 2026-11-08

The MVP requires every distinct event to remain independently notifiable. The
captures establish that Copilot can deliver identical parsed duplicate hook
payloads from repeated registrations, while some observed same-session turns
had different timestamps. Copilot's reviewed hook payload has no native event
ID, so a receiver cannot always distinguish a redelivery from two distinct
events whose available fields happen to match. A digest makes a chosen
fingerprint compact; it cannot add identity information or guarantee that two
distinct events will not share that fingerprint.

| Copilot option | Benefit | Failure/tradeoff |
| --- | --- | --- |
| Do not suppress Copilot inputs without a native ID — **selected for MVP** | Cannot coalesce distinct events based on session or timestamp; preserves the MVP independence requirement | Repeated hook registrations can create duplicate notifications, as observed |
| Deduplicate a deterministic payload fingerprint (for example source, session/agent IDs, hook subtype, timestamp and selected content) | Suppresses identical registrations when the chosen fields match | Can also suppress distinct events with the same selected fields, including same-millisecond events; omitting fields increases false matches, while adding fields can make duplicate copies differ. A cryptographic hash does not remove this ambiguity |
| Assign an ID when each input is received, without deduplication | Gives each received invocation a distinct internal key | Cannot recognize duplicate registrations or retries; it is an ingestion ID, not native event identity |

**Owner decision recorded 2026-11-08:** for the MVP, do not suppress Copilot
inputs using a derived fingerprint when there is no native event ID. Preserve
each received hook input as independently eligible for notification. This
intentionally accepts possible duplicate notifications from repeated hook
registrations rather than risking suppression of a distinct event. It does not
claim that the source payloads have unique identities; revisit if users report
meaningful duplicate-notification problems. Do not treat timestamp hashing as
collision-free or as proof of event identity.

OpenCode supplies a native event ID and a session ID, but the captured
`session.execution.succeeded` events did not include `location`; captured
`session.created` and interactive events did. The following bounded attribution
options have different failure modes:

| OpenCode option | Benefit | Failure/tradeoff |
| --- | --- | --- |
| Correlate `session.created` by session ID and retain its location/project ID | Uses observed session-specific metadata rather than plugin-global context | Can lack a mapping if creation was missed, predates plugin startup, or process state was lost; simultaneous and restart-safe multi-location behavior is unverified |
| Look up session metadata when handling an event | Could resolve events even when creation was missed | Must first verify that the supported API returns authoritative location/project data, its availability and latency, and behavior after a session is unavailable |
| Use an event's own location when present; otherwise fall back to the plugin instance's `ctx.location` — **selected for MVP** | Uses event-specific attribution where available and the simplest context value for events such as execution success that lack location | `ctx.location` is the plugin instance context, not guaranteed to be the session's working directory; it can misattribute events if one instance receives events from other locations |
| Preserve attribution as unknown when no session mapping is available | Avoids inventing a potentially incorrect project | Does not meet the MVP's correct-project attribution requirement until an authoritative source is established |

**Owner decision recorded 2026-11-08:** prefer an event's own location when it
is present, and use the plugin instance's `ctx.location` when it is absent. This
is a provisional MVP fallback for speed and simplicity, not a verified
per-session attribution guarantee. The owner accepts the possibility of
misattribution when one plugin instance handles multiple project locations;
revisit if that case matters to users. Session-creation correlation and metadata
lookup remain alternatives, not selected approaches. Project display-name
derivation (for example Git top-level name versus directory basename) remains a
separate owner choice from directory attribution.

OpenCode event-ID deduplication can use the native event ID, scoped by source;
tests still need to confirm duplicate delivery of one ID is suppressed while
different IDs in one session remain independent. This is not a decision about
session/project attribution.

**Decision tests before implementation:**

- Copilot: two same-session events with different timestamps and repeated
  inputs with identical parsed payloads must each remain independently
  deliverable under the selected no-suppression policy; include distinct events
  sharing a millisecond and document that no source identity is available.
- OpenCode: duplicate delivery of one native event ID versus distinct IDs in
  one session; success after `session.created`; success with creation absent,
  after plugin restart, and from multiple project directories; verify behavior
  when event location is present versus missing; confirm the selected fallback
  to `ctx.location` and exercise a multi-location case to make its possible
  misattribution visible rather than claiming the fallback is authoritative.
- Both: verify project display-name mapping separately from location, and test
  that any child-session filtering does not discard an attention event awaiting
  the human.

These owner choices record behavior preferences only; no adapter implementation
or event-identity guarantee is established. OpenCode native event-ID duplicate
semantics, project display-name source, and the proposed supported-version range
remain separate open decisions.

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
