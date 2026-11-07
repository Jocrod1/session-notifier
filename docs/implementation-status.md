# Implementation Status and Handoff

This is the single current status/handoff record. The [Product Roadmap](roadmap.md)
defines the owner-confirmed MVP and acceptance criteria; [AGENTS.md](../AGENTS.md)
defines approval and verification policy. Target requirements are not claims
about current behavior.

## Repository snapshot — 2026-11-07

- **Branch/HEAD:** `main` at `51eefd5`, the merge of the Android
  foreground-service feature; tracking `origin/main`.
- **Working tree at review start:** the event-contract pass began on a clean
  `main` worktree; at the 2026-11-07 correction pass, `docs/implementation-status.md`,
  `docs/operations.md`, `docs/sources.md`, and the OpenCode example README held
  that pass's uncommitted edits, which were revised in place (not committed).
- **Review scope:** bounded Copilot CLI/OpenCode V2 event-contract investigation,
  relevant service hooks/examples/fixtures, official documentation, release
  notes and schemas, installed-version and installed-schema checks, and local
  PowerShell/lifecycle probes. No live agent sessions were captured.
- **Versions:** installed Copilot CLI 1.0.106 (latest stable 1.0.107) and
  OpenCode V2 2.2.6. Proposed support range 1.0.106–1.0.107 / 2.2.6 awaits
  owner approval and live validation; it is not a tested claim.

## Current target and milestone state

**Target: MVP end-to-end release readiness.** The owner confirmed Windows,
Android, Copilot CLI/OpenCode, same Wi-Fi, one PC/phone pair, attention-only
notifications, QR/unpair, an Android foreground service with locked-phone
delivery, and public developer-oriented distribution on 2026-11-02. Missed
disconnected events need not be persisted or replayed. These decisions replace
the previous unresolved-priority record; no technical feature is authorized
by the documentation rewrite.

| Milestone                             | Current state                                                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 — Core notification infrastructure| Partial: pairing/transport and the user-started Android foreground service are implemented; QR scanning, revocation/single-pair enforcement, and Windows background operation remain incomplete |
| M2 — Supported agent integrations     | Partial: official event contracts reviewed against current stable reference versions in the scoped lines; no new event adapters or live-agent evidence; Windows Copilot stdin example is defective; repeated-event failure remains |
| M3 — Public MVP readiness             | Not release-ready: M1/M2 gaps and live-agent, release, and independent-installation evidence remain outstanding; Android service checklist was user-reported accepted 2026-11-06 |
| M4/M5 — Expansion                     | Deferred; not active MVP implementation commitments                                                                                                                                                |

## MVP acceptance matrix

**Classification:** "Present; unverified" means code exists, but current MVP
behavior is not sufficiently verified. "Partial" means a requirement has both
implemented and missing/conflicting parts. "Missing" means absent in inspected
source. Runtime claims remain unknown where tests were not performed; no whole
milestone is marked implemented and verified.

Android file names below refer to `app/android/app/src/main/java/com/aoa/sessionnotifier/`.

| Criteria                               | Classification                        | Evidence and remaining gap                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1.1 — Windows operation               | Partial                               | `service/src/index.ts` supports a long-running `npm start` process and shutdown; no documented background start/stop experience; resource footprint not measured                                |
| M1.2 — QR/approved pairing             | Partial                               | `service/src/pairing/qr.ts` generates QR; `session.ts` requires explicit approval. `MainActivity.kt` only accepts pasted URI; no scanner                                                        |
| M1.3 — Single-pair trust/revocation    | Partial                               | `service/src/connection/device-connections.ts` authenticates against credentials, but registry accepts multiple devices and has no removal API; no unpair UI or active-access revocation        |
| M1.4 — Common notification contract    | Partial                               | `service/src/domain.ts` models lifecycle signals and only `work-finished` input. Required attention categories/project-name/description contract is absent                                      |
| M1.5 — Android companion controls      | Partial                               | Manual foreground-service Start/Stop, status, and notification-permission explanations are present; unpair/revocation and PC/service information are missing                              |
| M1.6 — Locked-phone/service delivery   | Implemented; physical checklist user-reported tested and accepted 2026-11-06 | `ConnectionService` owns the connection; `MainActivity.onStop()` unbinds; manifest declares `connectedDevice`. User reports checklist passed; device/OS and per-check evidence were not supplied. |
| M1.7 — Trust/protocol/permission tests | Present; focused service-state tests pass | 12 new controller tests; Android unit/build and PC regression outcomes are recorded below. No Android instrumentation suite; physical behavior is user-reported, not independently witnessed. |
| M2.1/M2.2 — Copilot coverage           | Partial                               | Installed CLI 1.0.106; docs expose `notification` (`permission_prompt` since 1.0.18, prompt-shown-only since 1.0.26; `elicitation_dialog`), `agentStop`, and `errorOccurred`; current adapter only handles `agentStop`; no live payloads |
| M2.1/M2.2 — OpenCode coverage          | Partial                               | Official V2 2.2.6 schema exposes `permission.asked`, `form.created`, execution success/failure, and `session.idle`; current V1 example is incompatible; semantic mappings and runtime payloads remain unverified |
| M2.3 — Content and filtering           | Partial/conflicting                   | `service/src/notifications/android.ts` includes source/location and lifecycle text, not the new complete attention content. Defaults include non-MVP sources and start/inactivity notifications |
| M2.4 — Independent events              | Partial; failure reproduced           | Hook-only successive completion remains suppressed in `service/src/lifecycle.ts`. OpenCode event IDs can identify inputs; Copilot documents no event ID, so exact-duplicate semantics remain unresolved. Android notification ID hashes also need collision-safe independence review |
| M2.4 — Delivery isolation/reconnect    | Partial                               | Android delivery remains best-effort with no offline queue; bounded reconnect is owned by the user-started foreground service, not the activity. Broader event-isolation gaps remain. |
| M2.5 — Windows integration setup       | Partial                               | PowerShell check confirms example `Get-Content -Raw` fails without `Path`; direct child Node receives piped stdin, but end-to-end CLI, path quoting, and shared absolute inbox are unverified                    |
| M3.1 — Complete physical experience    | Partial; Android service checklist user-reported accepted | User reports pairing/start, locked delivery, Stop/retry, PC/Wi-Fi recovery, permission-denial, and no-auto-start checks passed on 2026-11-06. Device/OS, settings, and step-level evidence were not provided; repeated-event and unpair/revocation acceptance remains. |
| M3.2 — Installation/troubleshooting    | Partial                               | Source-checkout/pairing/test guides exist; public Windows background operation, firewall/ports, QR scanner, and formal supported-version range are incomplete                                  |
| M3.3 — Release artifact path           | Partial                               | `.github/workflows/ci.yml` uploads a debug APK artifact; no release workflow or published-release evidence inspected. Automation is not itself required                                         |
| M3.4 — Reproducible external setup     | Unknown                               | No fresh independent installation evidence; CI uses Ubuntu, not the target Windows platform, and does not run Android unit tests                                                                |

## Delivered foundation and retained non-MVP capabilities

Git history establishes implementation, not fresh acceptance-test success:
pairing merged in `d54fbd9`; persistent connections in `2a035c6`/`81d5b18`;
test notifications in `e84270c`/`e261c49`; lifecycle forwarding in
`866c917`/`e835ea0`. Authenticated v1 transport includes per-connection
acknowledgement correlation, timeouts/cleanup, and one active socket per device.
Android stores credentials/endpoint with Keystore-backed encryption, displays
native notifications, and now owns the bounded reconnect loop in a manually
started `connectedDevice` foreground service. The activity observes/controls it;
activity stop unbinds but does not close it.

The Node 22 TypeScript/ESM service also retains console delivery, atomic
delivered-key persistence, incremental JSONL transcript tailing with
partial-line/truncation handling, and Claude/Codex/Koda/local-LLM adapters.
Transcript history is not replayed at startup; missing transcript roots stay
disabled until restart. Active lifecycle state is not persisted and key history
is unbounded. Local hook inbox/idempotency files already exist; an MVP exclusion
of offline replay does not authorize deleting them. Docker-Claude is absent.
These retained capabilities and limits do not make them active MVP work.

## Verification record

### Repository review — 2026-11-02

- `git status --short --branch`, `git log -12 --format="%h %ad %s" --date=short --decorate`,
  `git ls-files`, and `git tag --list`: inspected baseline/history/tracked scope;
  no local release tags.
- `npm run build` in `service/`: **passed** (`tsc --noEmit`). Its include list
  covers `src`, `test`, and `scripts`, not `examples/hooks`; this does not verify
  installed plugin compatibility or produce a PC release artifact.
- Read-only inline probes via `node --import tsx --input-type=module -e` with
  `TSX_DISABLE_CACHE=1`: two completion events produced signal counts `[1, 0]`
  for both hook adapters. A direct lifecycle probe with distinct timestamps
  reproduced the same suppression. A V2-shaped idle payload with `data.sessionID`
  was rejected by the normalizer. These are observed defects, not passing tests.
- Compared source with current [OpenCode V2 plugin migration](https://opencode.ai/v2/docs/build/plugins/migrate-v1),
  [V2 API schema](https://opencode.ai/v2/openapi.json), and [Copilot hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference).
  V1 plugin code is incompatible with V2. Copilot documents native permission
  prompt/elicitation notifications and error hooks, but their MVP mapping has
  not been implemented or live-tested here.
- Full Vitest/Gradle suites, live-agent tests, physical-phone tests, Windows
  background operation, and a fresh public installation were **not run**.
  Inspected test code/CI configuration is not a new passing test result.

### Android foreground service and physical acceptance - 2026-11-05/06

- The user-started `connectedDevice` service implementation was committed as
  `dbe7dc1` and merged into this feature branch. `ConnectionService` owns the
  socket/reconnect loop; activity stop only unbinds. Start remains manual, Stop
  closes the connection and cancels retries, and the status notice is separate
  from agent-event notifications.
- From `app/android`, `.\gradlew.bat testDebugUnitTest assembleDebug` passed
  after implementation: 22 unit tests, including 12 controller tests, and debug
  APK assembly succeeded.
- From `service/`, `npm run build` passed and `npm test` passed 49 tests in 9
  files. These were regression checks; no PC service source changes were made.
- Additional `.\gradlew.bat lintDebug` did not pass: two existing API-level
  errors in unchanged `PairingLink.kt` calls to the Charset `URLDecoder.decode`
  overload (API 33, app min SDK 26). This was not changed in the Android task.
- **Physical acceptance - user-reported tested and accepted 2026-11-06:** the
  user reports completing all six checks in `docs/pairing.md` and says all were
  good: pairing without auto-start, manual service/status controls, locked-phone
  event delivery, Stop/no further retries, PC restart and Wi-Fi recovery with
  subsequent delivery, notification-permission denial, and no automatic start
  after force-stop/reboot.
- Device model, Android version, notification/privacy settings, step-level
  observations, and logs were not supplied. Record this as user-reported
  acceptance, not independent verification. It establishes the reported FGS
  checklist outcome, not all M1/MVP acceptance (for example repeated-event
  semantics, unpair/revocation, supported live-agent mappings, and fresh public
  installation remain separate gaps).

### Historical evidence — not a current test baseline

The ChatGPT handoff transferred by the user on 2026-10-22 reports 35 service
tests for an earlier connection snapshot, 45 service tests plus Android
unit/build checks for a later notification snapshot, and a successful user
foreground physical smoke test on 2026-10-14. Reported checks included pairing,
permissions, real start/completion-or-abort notifications, unchanged console
output, disconnect tolerance, and reconnect without unexpected duplicates.
Original test logs/chats were not independently reproduced. Counts refer to
different snapshots; they are not added together or presented as current.
An older status also recorded `npm run build`, `npm test`, and
`.\gradlew.bat testDebugUnitTest assembleDebug` passing without a run date.
Neither report establishes locked-phone/FGS delivery or successive hook turns.

The 2026-10-21/22 documentation/workflow tasks recorded whitespace, path/link,
skill-discovery, and old phase-criteria checks passing; application tests were
not applicable. The old 22-criterion preservation check describes the previous
reconciliation, not this explicitly approved replacement of the phase structure.

### Documentation rewrite — 2026-11-02

Only `docs/roadmap.md` and this file change. Application tests/builds were not
rerun for this rewrite because no application/test behavior changes; the
earlier same-day type-check/probes above remain separately dated review evidence.

- `git -c core.whitespace=cr-at-eol diff --check`: **passed**.
- PowerShell Markdown reference validation (`git ls-files '*.md'`,
  `Get-Content -Raw`, regex extraction, and `Test-Path`): **passed** for all
  4 local links in the changed documents and 4 inbound references from tracked
  Markdown, including any heading fragments.
- PowerShell milestone validation (`Get-Content -Raw` and regex criterion/
  heading checks): **passed** for 16 unique M1–M3 criteria, a status mapping
  for every criterion, no old active phase headings, and one next-task section.
- Manual owner-requirement review: the ten handoff acceptance checks and brief
  requirements are covered, including unpair/revocation, companion controls,
  attention-only filtering, full-content lock-screen eligibility, and release
  artifacts. Target requirements remain separate from implementation evidence.
- `git diff --name-only`: only `docs/roadmap.md` and this file changed.

### Agent event contract review — 2026-11-07

- `git status --short --branch` and `git log -3 --oneline --decorate` confirmed
  a clean `main` worktree at `51eefd5` before these documentation changes.
- Official Copilot CLI hook documentation and the GitHub release record identify
  CLI 1.0.107 (2026-11-06) as the latest stable release checked; 1.0.108 tags
  visible on 2026-11-07 were prereleases. The documented `notification` hook
  includes `permission_prompt` and `elicitation_dialog`; `permissionRequest` is
  pre-policy and is not proof of a human wait.
- OpenCode's official V2 event docs/OpenAPI and V2 release record identify
  2.2.6 (2026-11-06) as the latest non-prerelease V2 tag checked. OpenCode V1
  and V2 are parallel lines: GitHub's generic `/releases/latest` points to V1
  1.19.5. V2 events include `permission.asked`, `form.created`, execution
  success/failure, and `session.idle`. These are schema findings, not runtime
  payload captures.
- Repository review confirmed current fixtures/examples cover only Copilot
  `agentStop` and the V1 OpenCode `session.idle` shape. `service/src/hooks/cli.ts`
  reads stdin; the V1 plugin example is incompatible with V2. The current
  `Get-Content -Raw` PowerShell command failed because `Path` is mandatory;
  direct Node stdin forwarding succeeded in a local pipe check. The actual CLI,
  npx path, and inbox file were not exercised on Windows.
- Commands run: `'{}' | pwsh -NoLogo -NoProfile -Command 'Get-Content -Raw'`
  failed (missing mandatory `Path`); `'{}' | pwsh -NoLogo -NoProfile -Command
  'node -e "process.stdin.pipe(process.stdout)"'` passed and printed `{}`.
  No live harness test, application test, or dependency installation was run.
- Documentation checks: `git -c core.whitespace=cr-at-eol diff --check`
  passed; a corrected PowerShell check confirmed local Markdown link targets
  exist across all changed documents (an initial checker attempt mishandled a
  fragment-only link); JSON parsing passed for all 8 schema-derived payload
  examples. New event-contract anchors were also checked against their heading.
- The exact current-supported minimum versions, live event semantics, project
  display-name lookup, completion descriptions, and Copilot duplicate identity
  remain unknown. User-reported physical Android acceptance conflicts with the
  stale `docs/operations.md` sentence claiming acceptance is pending. That
  sentence remains unchanged; its hook-setup section was updated as part of this
  event-contract task.

### Event contract correction pass — 2026-11-07

- `copilot --version` → 1.0.106 (not 1.0.107 as earlier recorded);
  `opencode --version` → v2.2.6; `gh release list` confirmed 1.0.107 latest
  stable Copilot and 2.2.6 latest V2. Release notes via `gh release view`:
  `notification` hook added 1.0.18; permission-prompt notification only when a
  prompt is shown since 1.0.26.
- `opencode api get /openapi.json` (installed 2.2.6) matched the published V2
  schema for `permission.asked`, `form.created`, `session.execution.*`,
  `session.idle`, and `session.retry.scheduled` required fields.
- PowerShell: `Get-Content -Raw` failed (missing `Path`); `$input | node …` and
  a direct `node` child both echoed piped stdin.
- Inline `node --import tsx` probe on current `service/src`: successive Copilot
  completions `[1,0]`, successive V1-shape OpenCode idles `[1,0]`, V2-shape idle
  rejected. These are reproduced defects, not passing tests.
- Revised `docs/sources.md` (versions, release-note evidence, mapping statuses
  and filters, `exec`/`args`, relative-inbox and multi-source duplicate
  findings, proposed contract, open decisions) and this file. Application tests
  were not applicable (documentation only).

### Event contract verification pass — 2026-11-07

- Read `resume-project` and `session-handoff` skills; this status's handoff
  contains their required fields.
- `opencode api get /openapi.json` (2.2.6): `Session.Info` has `parentID` and
  `title`; `session.created` has `parentID`. The event list has no separate
  session-error event; `session.tool.failed`, `session.step.failed`, and
  `session.compaction.failed` exist and are classified as non-attention.
- `gh release view`: 1.0.107's body repeats 1.0.106 items; the 1.0.18 and
  1.0.26 notes are single dated entries, so those attributions stand.
- PowerShell re-run: `Get-Content -Raw` echoes the piped text then errors on the
  missing `Path`; `$input | node`, direct `node`, and `node "<path with
  spaces>\echo.mjs"` all received stdin (temporary probe directory removed).
- Copilot docs: subagent hook inputs add `agentId`/`agentType`/`parentAgentId`;
  `sandbox.enabled` defaults to `false`. No `%USERPROFILE%\.copilot\settings.json`
  exists locally (existence only checked).
- Code review: `notifier.ts` persists delivered keys of session/type/`at`
  without bounds; Android `NotificationPresenter` posts with
  `notificationId.hashCode()` (existing M2.4 collision review item).
- PowerShell local-link/anchor check over the four changed docs passed; all 8
  example JSON lines in `docs/sources.md` parsed;
  `git -c core.whitespace=cr-at-eol diff --check` result is recorded in the
  task summary. Application tests not applicable (documentation only).

## Blockers and technical decisions

1. **Event semantics and compatibility:** contracts were checked against
   installed Copilot CLI 1.0.106 (latest stable 1.0.107) and OpenCode V2 2.2.6
   on 2026-11-07; none were live-tested. Owner decisions pending: support range
   (proposed 1.0.106–1.0.107 / 2.2.6), project-name source, completion
   description source (fixed text or OpenCode session title), whether inactivity/shutdown interruptions are errors, and
   in-process versus CLI inbox writes for the V2 plugin. Candidate signals,
   missing fields, Copilot's lack of a native event ID, the defective Windows
   stdin example, and successive-event suppression are recorded in
   `docs/sources.md`. Automatic decisions, recoverable errors, and retries must
   not be mistaken for human attention.
2. **Android service and presentation:** the `connectedDevice` foreground
   service, manual controls, separate status notice, connection ownership, and
   public lock-screen request are implemented. The user reports the physical
   service checklist tested and accepted on 2026-11-06; device/OS and detailed
   evidence were not supplied. This is not independent verification. Remaining
   M1 gaps include unpair/revocation and broader MVP behavior; OS/user settings
   can still conceal content.
3. **Pairing/security:** QR scanning, single-pair enforcement, and actual unpair
   revocation are missing. Current pairing is HTTP and the socket is `ws://`;
   authentication does not establish LAN confidentiality. Public threat-model
   and credential/network handling need explicit technical review.
4. **Operation/distribution:** Windows background start/stop, firewall and Wi-Fi
   troubleshooting, artifact/install instructions, and a fresh independent
   setup remain incomplete. No automatic startup, polished installer, or
   automated release pipeline is required by the agreed MVP.
5. **Documentation alignment:** `docs/operations.md` still says physical-device
   acceptance is pending, while this status records the user's 2026-11-06
   accepted checklist report. The evidence distinction remains: it is
   user-reported, not independently witnessed. This unrelated guide conflict
   was not changed in the event-contract task. Other prototype docs may also
   describe V1 integrations and are not verified V2 setup instructions.

## Next proposed task

**Capture live payloads on Windows for Copilot CLI 1.0.106 and OpenCode V2
2.2.6.**

- **Scope:** with explicit approval for temporary configuration, install a
  logging-only Copilot hook and OpenCode V2 plugin, exercise all four attention
  categories plus negative cases (auto-allowed permission, recoverable error,
  retry, subagent/child completion, routine activity), sanitize captures into
  labelled `captured` fixtures, then remove the temporary configuration. No
  application code changes.
- **Acceptance criteria:** record actual harness versions and representative
  sanitized payloads; establish whether each candidate mapping fires only when
  human attention is needed; verify successive distinct same-session events
  remain distinguishable from duplicate input; record project/description
  attribution and unresolved cases. Unsupported categories remain explicit MVP
  gaps.
- **Checks:** run the documented fixtures and live harness scenarios without
  installing dependencies or modifying production resources; validate Windows
  commands from different working directories, including paths with spaces;
  compare results with `docs/sources.md`; report unavailable scenarios.
- **Risks:** captures may contain prompts, paths, or transcript references and
  must be redacted; temporary hook/plugin configuration needs separate explicit
  approval. Do not install software or treat the proposed range as tested.
- **Approval gate:** wait for explicit user approval. This proposal authorizes
  neither dependency installation, application/configuration changes,
  deployment, release publication, nor commits.

## Latest handoff and decision provenance

**2026-11-02 — Approved MVP documentation restructuring:** replaced the mixed
phase sequence with the owner's outcome-oriented M1–M3 plan, concrete acceptance
criteria, and deferred expansion. Incorporated the previous uncommitted
reconciliation's delivered-history/evidence corrections without changing code.
Changed paths: `docs/roadmap.md`, `docs/implementation-status.md`. Whitespace,
Markdown references, criterion/status mapping, requirement coverage, and diff
scope checks passed as recorded above. No application suites were rerun for
the rewrite, and no commit or release was made. Remaining blockers and the
single next task/approval gate are recorded above.

Workflow policy and shared skills were established by `17273ab` and `70d5d2f`;
the 2026-10-22 reconciliation separated reported history from verified facts.
The owner-confirmed 2026-11-02 direction resolves the former product-priority,
foreground-service, device-count, and distribution questions. It supersedes the
old Docker-Claude-first recommendation and conflicting historical phase labels,
not the delivered implementation. OpenCode SQLite remains excluded; a supported
plugin/event API is the direction. No old recommendation authorizes new work.


### Latest handoff - 2026-11-07

Completed the bounded Copilot CLI/OpenCode V2 event-contract investigation.
Updated `docs/sources.md` with current reference versions, official event
signals, schema-derived sanitized examples, attribution and event-identity
limits, a repeated-event/test plan, and verified Windows stdin findings.
Updated `docs/operations.md` and the OpenCode POC README to label V1 examples
as incompatible with the V2 MVP target. Updated this status with current branch
state, evidence, remaining runtime gaps, and one next task. Official docs and
release records identify Copilot CLI 1.0.107 and OpenCode V2 2.2.6 as latest
stable releases in the scoped lines on 2026-11-07; the installed Copilot CLI is
1.0.106 (corrected in the follow-up correction pass); neither was exercised live.
The Copilot PowerShell `Get-Content -Raw` example failed with missing mandatory
`Path`; a separate pipe check showed Node receives redirected stdin when invoked
directly. `docs/operations.md` still has a stale physical-acceptance sentence,
recorded as a documentation conflict rather than silently changed; its
event-related setup guidance was updated. Whitespace, local-link, and example
JSON checks passed. Application tests were not applicable because this task
changed documentation only. No code/configuration change, dependency install,
deployment, or commit was made.
