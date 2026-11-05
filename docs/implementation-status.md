# Current Project Status and Session Handoff

This is the single current status and handoff record. See the [project roadmap](roadmap.md) for phase acceptance criteria and [project instructions](../AGENTS.md) for the approval and verification policy.

## Verified repository state

**Checked 2026-11-05:** this isolated worktree is
`C:\Users\Jocro\.local\share\opencode\worktree\ba1e2a\pairing`, detached at
`4369a41` (merged guided-workflow documentation). Initial `git status --short
--branch` was clean. `git worktree list` identified the original main worktree
at `C:\Users\Jocro\Dev\aoa\session-notifier`; no edits were made there. Recent
history includes `70d5d2f`, `17273ab`, `e835ea0`, and `866c917`. No separate
repository task tracker was found; roadmap/status and the user's explicit
Android task approval define this task. The Android changes are committed on
the isolated worktree feature branch and are being integrated into a feature
branch in the original worktree under the user's explicit authorization.

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
- **Pending acceptance:** the physical checklist in `docs/pairing.md` is not
  verified. Foreground service ownership and unit tests do not prove locked
  delivery, OS notification display, Doze/OEM behavior, or Wi-Fi recovery.
- **Existing compatibility blocker:** optional Android lint is not green because
  the pairing parser calls API-33-only URL decoding on a min-26 app. Lower-API
  pairing compatibility is not established by JVM tests or successful assembly.
  This conflict was reported; no scope expansion or compatibility fix was made.
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
  be explicitly authorized. The current approval covers only the code commit and
  feature-branch integration; it does not authorize deployment, publishing, or
  any later commit. Hardware power/privacy restrictions may block reliable delivery.

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
expanded event fields, boot startup, deployment, publishing, or commits were
performed. The user subsequently authorized committing this implementation in
the isolated worktree and merging it into a feature branch in the original
worktree; that integration is in progress. The sole next task remains the
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
