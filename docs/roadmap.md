# Project Roadmap

This roadmap records project phases and their acceptance criteria. The current phase and the one proposed next task live in [Implementation Status](implementation-status.md). A phase is complete only when its criteria are verified and recorded there.

## Phase 0: Establish reliable project status

- One canonical repository instruction file defines approval, verification, safety, and handoff rules.
- A roadmap and a single status/handoff record are available and linked from the documentation index.
- Repository-local resume and session-handoff skills describe the repeatable procedures.
- Project documentation agrees with the implemented behavior, or discrepancies are explicitly recorded as blockers.
- The status record distinguishes checked facts from assumptions and dates verification; it proposes exactly one next task.

## Phase 1: Docker-Claude collector

- Container discovery and file access use an injectable Docker client so behavior can be tested without a live daemon.
- The collector incrementally tails container Claude JSONL, including partial lines and truncation, without replaying historical content at startup.
- Session identity includes the container location so host and container sessions cannot collide.
- Container disappearance is represented as `container-exit`, never as normal completion.
- Docker, daemon, permissions, and per-container failures are isolated to this collector and do not stop other sources.
- Focused tests cover discovery, incremental parsing/tailing, identity, container exit, and isolated failures; the service type-check and full test suite pass.

## Phase 2: Restart-safe lifecycle state and bounded history

- Persisted state restores active lifecycle timestamps and flags so a restart preserves the remaining inactivity behavior without replaying old source history.
- Delivered notification-key history has a documented, bounded retention policy that does not re-enable duplicates inside its defined retention window.
- Persistence remains atomic and handles missing, malformed, and older-format state with explicit diagnostics and documented behavior.
- Focused restart, retention-boundary, and compatibility tests pass, along with the service type-check and full test suite.

## Phase 3: Notification delivery resilience

- Local delivery behavior and Android best-effort behavior are explicit and tested under adapter failures.
- Retry/backoff, if implemented, is bounded, observable, and does not block source processing or duplicate successful notifications.
- Any new adapter type or configuration surface is added only after its scope and operational requirements are explicitly approved; HTTP, desktop, webhook, Slack/Discord, and email delivery remain excluded until then.
- Focused failure, retry, and idempotency tests pass, along with the service type-check and full test suite.

## Phase 4: Source accuracy and runtime supervision

- Source-specific parsing changes are based on representative fixtures and cover relevant real-world schema variants without widening behavior on assumption alone.
- Sources whose roots appear after startup are detected and started without restarting the service, or the limitation is explicitly retained as a project decision.
- Focused fixture and root-appearance tests pass, along with the service type-check and full test suite.

## Deferred scope: OpenCode SQLite

SQLite polling is out of scope for this POC; the OpenCode plugin hook is the
supported completion input. This follows the explicit decision in
`docs/sources.md`. Revisit only if the project explicitly changes scope.
