# Implementation Status and Handoff

This is the single current status/handoff record. The [Product Roadmap](roadmap.md)
defines the owner-confirmed MVP and acceptance criteria; [AGENTS.md](../AGENTS.md)
defines approval and verification policy. Target requirements are not claims
about current behavior.

## Repository snapshot — 2026-11-06

- **Branch/HEAD:** `feat/android-foreground-service` at `56b95a7`, including the
  Android foreground-service implementation merged from `dbe7dc1`; tracking
  `origin/feat/android-foreground-service`.
- **Working tree at review start:** `docs/pairing.md` was the pre-existing
  user modification and remains untouched; the implementation-status changes
  in this worktree are from this update.
- **Review scope:** service/domain/hooks/pairing/transport, Android source and
  manifest, tests, examples, CI, existing documentation, and relevant history.
  This was a targeted MVP review, not a complete implementation/security audit.
- **Release evidence:** `git tag --list` returned no local tags. Remote releases
  were not independently checked. CI produces a debug APK workflow artifact,
  not evidence of a published GitHub Release or fresh public installation.

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
| M2 — Supported agent integrations     | Partial: completion-only adapters; incompatible OpenCode V1 example, missing attention categories, filtering, and successive-event correctness                                                     |
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
| M2.1/M2.2 — Copilot coverage           | Partial                               | `service/src/hooks/normalize.ts` and example configure only `agentStop`/`end_turn`; approval, clarification, and attention-requiring failures are not mapped                                    |
| M2.1/M2.2 — OpenCode coverage          | Partial                               | Example uses V1 plugin factory; normalizer expects `properties.sessionID`. V2 uses plugin definitions/subscriptions and `data.sessionID`; coverage beyond idle is absent                        |
| M2.3 — Content and filtering           | Partial/conflicting                   | `service/src/notifications/android.ts` includes source/location and lifecycle text, not the new complete attention content. Defaults include non-MVP sources and start/inactivity notifications |
| M2.4 — Independent events              | Partial; failure reproduced           | `service/src/lifecycle.ts` emits one completion for a hook-only session and suppresses subsequent turns; Android notification ID hashes also need collision-safe independence review            |
| M2.4 — Delivery isolation/reconnect    | Partial                               | Android delivery remains best-effort with no offline queue; bounded reconnect is owned by the user-started foreground service, not the activity. Broader event-isolation gaps remain. |
| M2.5 — Windows integration setup       | Partial                               | Placeholder/example commands are not verified installed integrations; shared absolute inbox paths and PowerShell stdin/path handling need validation                                            |
| M3.1 — Complete physical experience    | Partial; Android service checklist user-reported accepted | User reports pairing/start, locked delivery, Stop/retry, PC/Wi-Fi recovery, permission-denial, and no-auto-start checks passed on 2026-11-06. Device/OS, settings, and step-level evidence were not provided; repeated-event and unpair/revocation acceptance remains. |
| M3.2 — Installation/troubleshooting    | Partial                               | Source-checkout/pairing/test guides exist; public Windows background operation, firewall/ports, QR scanner, and supported-version instructions are incomplete                                   |
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

## Blockers and technical decisions

1. **Event semantics and compatibility:** identify supported agent versions,
   native attention signals, project/description fields, Windows ingestion,
   and event identity. Fixing successive-event suppression and V2 compatibility
   requires separately approved implementation; automatic permission decisions
   or recoverable errors must not be mistaken for human attention.
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
5. **Documentation alignment:** other guides still describe the implemented
   prototype. Their planned Docker/persistence wording and V1 integration
   examples are not current MVP commitments or verified V2 setup. Updating
   those guides belongs with the relevant approved work; they were not edited
   in this two-file task.

## Next proposed task

**Validate and specify the attention-event mappings for explicitly supported
Copilot CLI and OpenCode V2 versions.**

- **Scope:** bounded compatibility/event-contract investigation, not feature
  implementation. Determine native sources for the four attention categories
  and how Windows hook ingestion should preserve the required content/identity.
- **Acceptance criteria:** document supported versions, a source-to-notification
  matrix with representative sanitized payload evidence, project/description
  fields, explicit unsupported/unknown cases, and repeated-turn/duplicate-input
  semantics with a test plan. Any missing category remains an MVP gap unless
  the owner explicitly changes scope.
- **Checks:** compare official versioned contracts, repository behavior, and
  available real fixtures; validate candidate Windows invocation/inbox paths
  where safely available; review the specification for consistency/links and
  run Git whitespace checks. Report actual results and unavailable checks.
- **Risks:** installed-version differences, missing native signals, and fixtures
  that do not distinguish a real human wait from internal activity. Do not
  invent mappings or silently reduce the agreed attention categories.
- **Approval gate:** wait for explicit user approval. The product direction and
  this documentation approval do not authorize application/configuration
  changes, dependency installation, deployment, release publication, or commits.

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


### Latest handoff - 2026-11-06

Updated the implementation matrix after review of the Android foreground-service
feature on `feat/android-foreground-service` (`56b95a7`). Corrected stale M1.5,
M1.6, M1.7, M2.4 reconnect, M3.1, and Android blocker descriptions. Recorded
the user's physical checklist as tested and accepted by report, with device/OS
and step-level details explicitly marked unavailable; this does not mark M1 or
M3 complete. Preserved the existing uncommitted `docs/pairing.md` change. Only
`docs/implementation-status.md` was edited for this update. Application tests
were not applicable to this documentation-only change; `git diff --check` was
run. The sole next task remains the supported Copilot/OpenCode attention-event
mapping investigation and its existing approval gate above.
