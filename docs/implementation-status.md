# Current Project Status and Session Handoff

This is the single current status and handoff record. See the [project roadmap](roadmap.md) for phase acceptance criteria and [project instructions](../AGENTS.md) for the approval and verification policy.

## Verified repository state

**Checked 2026-11-05:** `main` remains at `4369a41` (merged guided-workflow
documentation). The Android implementation commit `dbe7dc1` is on
`worktree/android-foreground-service` in the isolated worktree
`C:\Users\Jocro\.local\share\opencode\worktree\ba1e2a\pairing`. It was merged
as `4af11f8` into `feat/android-foreground-service` in the original worktree
`C:\Users\Jocro\Dev\aoa\session-notifier`; a follow-up handoff/conflict
resolution commit is recorded below. The original worktree was clean before its
pre-existing status edit documenting the global Copilot delegation task; that
verified work was preserved and integrated as historical context. Its original
stash backup is retained as `stash@{0}`. No separate repository task tracker
was found; roadmap/status and explicit task approvals define this work.

The delivered-scope list below is summarized from project documentation and
merged history, except the Android service work and checks freshly verified
below; it is not a fresh line-by-line audit of every source adapter.

### Delivered scope (documented)

- Independent Node 22 TypeScript/ESM service with strict TypeScript checking and Vitest coverage for lifecycle behavior, source parsing, and persisted notification idempotency.
- Neutral session identity and lifecycle notifications for source-confirmed prompts, turn completion/abort, and later inactivity.
- Structured console output, atomic persistence of delivered notification keys, and incremental JSONL tailing with partial-line buffering and truncation recovery.
- File-backed Claude, Codex, Koda, and local-LLM adapters; OpenCode and GitHub Copilot hook inputs.
- Authenticated version 1 WebSocket connections for paired Android devices, with one active socket per device, nonce ping/pong keepalive, and graceful shutdown.
- Android Keystore-backed pairing data and a manually started `connectedDevice`
  foreground service owning the persistent socket and bounded reconnect backoff.
  The activity binds/observes/controls it; activity stop does not close an
  already started connection. Pairing never starts it automatically.
- Test-notification delivery and forwarding of lifecycle notifications to connected authenticated Android devices, alongside console output.
- Tests covering protocol validation, acknowledgement correlation, timeout/disconnect behavior, duplicate pending IDs, Android payload validation, notification permission/channel outcomes, and Android retry backoff.
- Separate low-importance ongoing PC connection status notification with Stop;
  event notifications use a distinct channel/tag and request public lock-screen
  visibility. Permission and privacy limitations are explained in the app.
- Twelve new pure JUnit controller tests cover manual/idempotent start, recovery
  state, Stop/cleanup, stale callbacks, credential failures, authentication
  failure, and startup failure. These are not physical service/device tests.
- Three shared workflow skills under `.agents/skills` for context resumption, end-to-end approved task execution, and session handoff; supported by OpenCode and GitHub Copilot CLI and linked from canonical repository instructions.

## Preserved decisions and constraints (documented)

- Android delivery is best-effort while the user-started connection service
  runs, including activity background/lock. There is no offline notification
  queue or delivery retry; connection recovery permits subsequent events, not
  replay. Delivery failures do not stop PC source processing. Android power,
  network, OEM, notification, and lock-screen privacy policy still apply.
- Approved service type is `connectedDevice`; Start is manual after pairing.
  `START_NOT_STICKY` means process death/force-stop/reboot require manual Start.
  No boot startup, wake lock, or battery exemption was added. Stop removes the
  status notice, not previously posted event notifications.
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

For the approved global OpenCode-to-Copilot delegation task on 2026-11-05, created `C:\Users\Jocro\.config\opencode\tools\delegate_to_copilot.ts`, its global helper and mocked tests under `C:\Users\Jocro\.config\opencode\lib\` and `tests\`, and `tools\README-delegate_to_copilot.md`. Copilot CLI 1.0.105 was verified with `--model auto`, `--assisted-approval`, and `--output-format json`; the successful read-only smoke test reported routed model `gpt-6-luna`, zero Copilot file changes, exit code 0, and no assisted-approval warning. Observed JSONL event types: `session.auto_mode_resolved`, `session.mcp_servers_loaded`, `session.tools_updated`, `user.message`, `assistant.turn_start`, `model.call_start`, `assistant.reasoning_delta`, `assistant.tool_call_delta`, `model.call_finished`, `assistant.message`, `assistant.reasoning`, `tool.execution_start`, `model.call_final_result`, `tool.execution_complete`, `assistant.turn_end`, `assistant.message_start`, `assistant.message_delta`, `session.background_tasks_changed`, `tool.shell_output`, `tool.execution_partial_result`, `session.usage_checkpoint`, `assistant.idle`, and `result`. `node --experimental-strip-types --test .\tests\delegate_to_copilot.test.ts` from the global OpenCode config directory passed 14/14 mocked tests. Importing the tool through Node's TypeScript stripping also succeeded. `git status --short --branch` showed only the approved status-file update; `git -c core.whitespace=cr-at-eol diff --check` passed. Application tests were not run because no application code changed. Changed paths in this repository: this status file only; global files are listed above. The smoke test is scoped to the installed CLI version and does not prove that assisted approval is a security boundary.

**Android foreground-service task, 2026-11-05 (fresh checks):**

- From `app/android`: `.\gradlew.bat testDebugUnitTest assembleDebug` passed
  twice, including after final code/test edits. XML results show **22 tests,
  zero failures/errors/skips**, including **12 new controller tests**. Debug
  APK built at `app/android/app/build/outputs/apk/debug/app-debug.apk`.
  Process-local environment: `JAVA_HOME=C:\Program Files\Android\Android
  Studio\jbr` and `ANDROID_HOME=C:\Users\Jocro\AppData\Local\Android\Sdk`.
  No local SDK configuration was copied from or written to the original worktree.
- From `service/`: `npm ci --ignore-scripts` installed the locked dependencies;
  `npm run build` passed; `npm test` passed **49 tests in 9 files**. No PC
  source, package manifest, or lockfile changes were made.
- Additional check, `.\gradlew.bat lintDebug`: **failed**, with two existing
  `NewApi` errors in unchanged `PairingLink.kt:49–50` (`URLDecoder.decode`'s
  Charset overload requires API 33; min SDK is 26). `git show HEAD:.../PairingLink.kt`
  confirmed both calls predate this task. Six warnings cover target SDK age,
  backup configuration, missing application icon, and three now-unused legacy
  UI strings. No lint baseline, suppression, SDK change, or pairing fix was made.
- `git diff --check` passed (Git emitted only line-ending conversion warnings).
- Merged debug manifest confirms min SDK 26, target SDK 35, `INTERNET`,
  `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `CHANGE_NETWORK_STATE`, and the
  non-exported `connectedDevice` service declaration. Requirements were checked
  against the authoritative Android references linked in `docs/pairing.md`.
  No Bluetooth, location, NFC/USB, `ACCESS_NETWORK_STATE`, or wake-lock
  permission was assumed necessary.
- `adb devices -l` listed **no devices**. Locked-phone delivery, actual
  activity/service lifecycle behavior, Stop with no further retries, PC restart,
  Wi-Fi recovery/subsequent delivery, and notification-permission denial remain
  **pending on hardware**, not passed. No APK was installed or deployed.

## Assumptions and blockers

- **Resolved documentation discrepancies:** `docs/README.md` and `docs/pairing.md` now describe lifecycle forwarding consistently with the merged implementation. The former status recommendation for an OpenCode SQLite collector was stale; `docs/sources.md` explicitly excludes SQLite polling for this POC, and the status and roadmap now preserve that decision.
- **Assumption:** the existing delivered-scope and constraint descriptions remain accurate except where explicitly identified above; they are documented claims, not freshly retested behavior.
- **Pending acceptance:** the physical checklist in `docs/pairing.md` is not
  verified. Foreground service ownership and unit tests do not prove locked
  delivery, OS notification display, Doze/OEM behavior, or Wi-Fi recovery.
- **Existing compatibility blocker:** optional Android lint is not green because
  the pairing parser calls API-33-only URL decoding on a min-26 app. Lower-API
  pairing compatibility is not established by JVM tests or successful assembly.
  This conflict was reported; no scope expansion or compatibility fix was made.
- **Global delegation limitation:** current GitHub documentation describes Auto using `fusion`, while installed CLI 1.0.105 help advertises `auto`; the real smoke test verified `--model auto` for this installed version only. Copilot assisted approval and CLI path checks are not an OS sandbox; shell commands run with the user's permissions. Direct Git tool rules cannot prevent indirect shell invocation, and configured external MCP servers may expose additional operations.
- **Known environment warnings:** Gradle reported deprecated features in the
  first build (future Gradle 10 compatibility). `npm ci --ignore-scripts`
  reported five audit vulnerabilities (1 moderate, 2 high, 2 critical) and an
  existing `prebuild-install` deprecation. No audit fixes or dependency upgrades
  were attempted; those are outside the approved task.
- **Preserved limitation:** authentication failure terminates the connection
  instead of retrying. Detailed terminal state is observable while the activity
  remains bound; it is not persisted across service/process destruction.

## Current phase and next task

**Phase 0 — Establish reliable project status: complete.**

**Approved Android milestone — implementation and required automated checks
complete; physical acceptance pending and additional lint blocked.** The user's explicit foreground-service approval
superseded the previous Docker collector recommendation for this session; it
did not authorize collector implementation or other deferred scope.

**Next task (one task only):** Validate the Android foreground-service milestone
on a paired physical Android 13+ device using `docs/pairing.md`'s checklist.

- **Acceptance criteria:** record device/OS and relevant power/privacy settings;
  verify pairing alone does not connect, manual Start and separate status notice,
  background/locked subsequent event delivery, both Stop paths (including while
  reconnecting) with no retry after more than 30 seconds, PC restart and Wi-Fi
  recovery followed by new delivery, permission-denial outcomes, and no automatic
  start after force-stop/reboot. Distinguish PC acknowledgements from actual
  visible notifications and privacy-dependent concealment.
- **Checks:** perform and record the manual checklist, actual PC presentation
  outcomes and visible device results; rerun automated checks only if code changes
  are separately approved. Document failures rather than assuming success.
- **Approval gate:** obtain explicit approval and an available paired test device
  before beginning; installing the debug APK or running local test services must
  be explicitly authorized. The current approval covered the implementation commit, merge, and
  handoff/conflict-resolution commit only; it does not authorize deployment,
  publishing, or any later commit. Hardware power/privacy restrictions may block reliable delivery.

## Session handoff

**2026-11-05 — Approved Android foreground service:** implemented only in the
isolated `pairing` worktree. Added `ConnectionService.kt`,
`ConnectionServiceController.kt`, and `ConnectionServiceControllerTest.kt`;
updated `MainActivity.kt`, `PersistentConnection.kt`, `NotificationPresenter.kt`,
`AndroidManifest.xml`, and `res/values/strings.xml` under
`app/android/app/src/`. Updated `docs/pairing.md`, `docs/architecture.md`,
`docs/operations.md`, `docs/README.md`, `docs/roadmap.md`, and this file.
The service owns the existing transport/reconnect behavior, exposes observed
status and manual controls, handles credential/authentication failures, and
removes foreground status on Stop. Event lock-screen visibility and Android 13+
permission caveats are explicit. Actual automated results and hardware blockers
are recorded above. No QR scanning, revocation, PC service changes, encryption,
expanded event fields, boot startup, deployment, or publishing were performed. The user subsequently authorized committing this implementation in
the isolated worktree and merging it into a feature branch in the original
worktree; that merge and follow-up status reconciliation are recorded below. The sole next task remains the
approval-gated physical validation above; the older handoffs below are
historical, not current next-task proposals.

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

**2026-11-05 - Global Copilot delegation tool:** created the global OpenCode
custom tool, helper, README, and 14 mocked tests under
`C:\Users\Jocro\.config\opencode\`. The real read-only repository summary
smoke test passed with Copilot CLI 1.0.105 (`--model auto`,
`--assisted-approval`, JSONL output); the selected model was `gpt-6-luna`, and
the CLI reported no changed files. Node's built-in test runner passed all 14
tests. Assisted approval is probabilistic, and shell execution is not
sandboxed; direct Git restrictions can be bypassed indirectly. At that time,
the proposed task was the Docker-Claude collector; the later-approved Android
task superseded it. No collector implementation was authorized by the global
tooling task.

**2026-11-05 - Android feature-branch integration:** committed the approved
implementation as `dbe7dc1` on `worktree/android-foreground-service` in the
isolated worktree. Created `feat/android-foreground-service` in the original
worktree and merged the implementation as `4af11f8`. Preserved the original
worktree's pre-existing uncommitted global Copilot status update by saving it
before merge, then reconciling its verified details into this status file
alongside the Android handoff. The reconciliation commit completes the merge
handoff. The original user-change stash is retained as a backup. No source,
configuration, or application code beyond the approved Android task was changed
by resolving the documentation overlap. Android tests and limitations remain
as recorded above; no new application checks were run for this documentation
reconciliation.