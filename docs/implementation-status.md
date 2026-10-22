# Current Project Status and Session Handoff

This is the single current status and handoff record. See the [project roadmap](roadmap.md) for phase acceptance criteria and [project instructions](../AGENTS.md) for the approval and verification policy.

## Verified repository state

**Checked 2026-10-22:** `docs/guided-agent-workflow` is at `17273ab`, which adds the initial guided-workflow policy and resume/handoff skills on top of `e835ea0` (`main`). The working tree contains uncommitted workflow skill and documentation changes from the approved workflow tasks. Recent history includes lifecycle forwarding to connected Android devices.

The delivered-scope list below is summarized from the existing project documentation and merged history; it is not a fresh line-by-line implementation audit.

### Delivered scope (documented)

- Independent Node 22 TypeScript/ESM service with strict TypeScript checking and Vitest coverage for lifecycle behavior, source parsing, and persisted notification idempotency.
- Neutral session identity and lifecycle notifications for source-confirmed prompts, turn completion/abort, and later inactivity.
- Structured console output, atomic persistence of delivered notification keys, and incremental JSONL tailing with partial-line buffering and truncation recovery.
- File-backed Claude, Codex, Koda, and local-LLM adapters; OpenCode and GitHub Copilot hook inputs.
- Authenticated version 1 WebSocket connections for paired Android devices, with one active socket per device, nonce ping/pong keepalive, and graceful shutdown.
- Android Keystore-backed pairing data, foreground-lifecycle connection ownership, and bounded reconnect backoff.
- Test-notification delivery and forwarding of lifecycle notifications to connected authenticated Android devices, alongside console output.
- Tests covering protocol validation, acknowledgement correlation, timeout/disconnect behavior, duplicate pending IDs, Android payload validation, notification permission/channel outcomes, and Android retry backoff.
- Three shared workflow skills under `.agents/skills` for context resumption, end-to-end approved task execution, and session handoff; supported by OpenCode and GitHub Copilot CLI and linked from canonical repository instructions.

## Preserved decisions and constraints (documented)

- Android delivery is best-effort and foreground-only. It has no offline queue or automatic retry; delivery failures do not stop source processing.
- A `submitted` acknowledgement means Android accepted the notification request, not that the operating system displayed it.
- Existing session history is not replayed at startup. Missing source roots remain disabled until restart.
- Persisted state contains delivered notification keys, not active-session state; notification-key history has no retention or compaction.
- Parsers are intentionally slim lifecycle extractors and need representative fixtures as source formats evolve.
- Console delivery is awaited; a local adapter failure can stop handling the current source event.
- Docker-Claude collection is not implemented and is not enabled by default.
- Age of Agents/context-recorder UI concepts, HTTP/web UI, desktop, webhook, Slack/Discord, and email delivery remain excluded.

## Verification record

The previous status document recorded `npm run build`, `npm test`, and `.\gradlew.bat testDebugUnitTest assembleDebug` as passing for the Phase 2 test-delivery slice, but did not include a verification date. Treat that as a historical, undated report, not as a current verified result.

For the documentation correction on 2026-10-21, application tests were not run because no application code or test behavior changed. `git -c core.whitespace=cr-at-eol diff --check` passed. The OpenCode SQLite wording in `docs/operations.md` now agrees with `docs/sources.md` and `docs/roadmap.md`; Markdown links were reviewed and their targets resolve. Changed paths: `docs/operations.md` and this status file.

For the guided-task skill on 2026-10-22, application tests were not run because the change only adds workflow documentation and skill instructions. `git -c core.whitespace=cr-at-eol diff --check` passed. The shared `.agents/skills` discovery location and explicit invocation forms were checked against the OpenCode V2 Skills documentation and GitHub Copilot CLI agent-skills documentation; repository links were reviewed. Changed paths: `.agents/skills/guided-task/SKILL.md`, `AGENTS.md`, `docs/README.md`, and this status file.

## Assumptions and blockers

- **Resolved documentation discrepancies:** `docs/README.md` and `docs/pairing.md` now describe lifecycle forwarding consistently with the merged implementation. The former status recommendation for an OpenCode SQLite collector was stale; `docs/sources.md` explicitly excludes SQLite polling for this POC, and the status and roadmap now preserve that decision.
- **Assumption:** the existing delivered-scope and constraint descriptions remain accurate except where explicitly identified above; they are documented claims, not freshly retested behavior.

## Current phase and next task

**Phase 0 — Establish reliable project status: complete.**

**Next task (one task only):** Implement the Docker-Claude collector described in Phase 1 of `docs/roadmap.md`.

- **Acceptance criteria:** injectable Docker client; incremental Claude JSONL tailing; container-qualified session identity; `container-exit` terminal signal; isolated collector failures; focused tests for discovery, tailing, identity, exit, and failure behavior.
- **Checks:** focused collector tests, service type-check, and full service test suite; report actual command results.
- **Approval gate:** do not begin this task until the user explicitly approves it.

## Session handoff

**2026-10-21 — Pull request preparation:** collected the documentation and
guided-workflow changes on `docs/guided-agent-workflow`, based on `e835ea0`.
Changed paths are `AGENTS.md`, both repository-local skill files,
`docs/roadmap.md`, this status file, and the documentation index, operations,
pairing, and source guides. No application code or generated artifacts are
included. No repository PR template was found. Application tests are not
applicable to this documentation-only change; the CRLF-aware Git whitespace
check passed. The documented application results above remain historical,
not newly verified. The next task and its approval gate remain as recorded
above; no collector implementation is authorized by this PR.

**2026-10-22 — Cross-harness task workflow:** added the shared `guided-task`
skill under `.agents/skills`, supported by both OpenCode and GitHub Copilot CLI,
and linked it from `AGENTS.md` and the documentation index. It connects the
existing resume and handoff skills while preserving the task approval gate and
separate safeguards. Application tests were not applicable; the CRLF-aware Git
whitespace check passed and skill-discovery documentation was reviewed. The
Docker-Claude collector remains the single proposed project task; no collector
implementation is authorized by this workflow change.

**2026-10-22 — Shared skill discovery:** moved `resume-project` and
`session-handoff` into `.agents/skills` alongside `guided-task`, so OpenCode
and GitHub Copilot CLI use one shared skill location. Updated all active skill
references. Application tests were not applicable; discovery and repository
path checks plus the CRLF-aware Git whitespace check passed. The Docker-Claude
collector remains the single proposed project task; no collector
implementation is authorized by this workflow change.
