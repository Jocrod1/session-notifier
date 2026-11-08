# Implementation Status and Handoff

This is the single current status/handoff record. The [Product Roadmap](roadmap.md)
defines the owner-confirmed MVP and acceptance criteria; [AGENTS.md](../AGENTS.md)
defines approval and verification policy. Target requirements are not claims
about current behavior.

## Repository snapshot — 2026-11-08

- **Branch/HEAD:** `docs/agent-event-contracts` at `62636ed`, tracking
  `origin/docs/agent-event-contracts`; `main` remains at `51eefd5` locally.
- **Working tree at interactive follow-up start:** uncommitted changes to this
  status, `docs/sources.md`, and the four prior capture fixtures; preserved.
  The follow-up adds 14 sanitized fixtures and documentation, not application code.
- **Review scope:** isolated live Windows sessions, including user-operated
  approval/question prompts and limited negative cases. Terminal failures,
  retries, child sessions, cross-location attribution, and delivery remain open.
- **Versions:** installed Copilot CLI 1.0.107 and OpenCode V2 2.2.6 on
  2026-11-08. Proposed support range 1.0.106–1.0.107 / 2.2.6 awaits owner
  approval and fuller live validation; it is not a tested support claim.

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
| M2 — Supported agent integrations     | Partial: contracts reviewed and limited live completion evidence captured; no new event adapters, Windows Copilot stdin example is defective, and repeated-event failure remains |
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
| M2.1/M2.2 — Copilot coverage           | Partial                               | CLI 1.0.107 completion, approval and question payloads captured; prompts user-reported; terminal errors unverified; adapter only handles `agentStop` |
| M2.1/M2.2 — OpenCode coverage          | Partial                               | V2 2.2.6 completion, approval and question payloads captured; execution events lack location; V1 adapter rejects V2 success; terminal errors unverified and selected location fallback is not implemented or validated |
| M2.3 — Content and filtering           | Partial/conflicting                   | `service/src/notifications/android.ts` includes source/location and lifecycle text, not the new complete attention content. Defaults include non-MVP sources and start/inactivity notifications |
| M2.4 — Independent events              | Partial; failure reproduced           | Owner chose not to suppress Copilot inputs without a native event ID, accepting possible duplicate notifications; this is not implemented end-to-end. Hook-only successive completion remains suppressed in `service/src/lifecycle.ts`. Android notification ID hashes still need collision-safe independence review |
| M2.4 — Delivery isolation/reconnect    | Partial                               | Android delivery remains best-effort with no offline queue; bounded reconnect is owned by the user-started foreground service, not the activity. Broader event-isolation gaps remain. |
| M2.5 — Windows integration setup       | Partial                               | Captured Copilot completion worked through the existing CLI with an absolute shared inbox from two temporary Windows directories with spaces. Live harness-to-service ingestion, OpenCode V2 integration and attention mappings remain unverified |
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

### Limited live event capture — 2026-11-08

- Confirmed clean start on `docs/agent-event-contracts` at `62636ed` with
  `git status --short --branch` and `git log -5 --oneline --decorate`; `gh issue
  list --state all --limit 50 --json number,title,state,url` returned `[]`.
  `copilot --version` reported 1.0.107 and `opencode --version` 2.2.6. `gh
  release list` for the two upstream repositories showed Copilot 1.0.107 latest
  stable and OpenCode 2.2.6 latest V2 in the returned entries.
- In a temporary Git repository with spaces in its path, `copilot --trust-folder
  --disable-builtin-mcps --no-custom-instructions --no-ask-user -p ... --silent`
  captured a simple `agentStop`. A separate run with two identical `agentStop`
  hook registrations produced two identical parsed payloads. A resume attempt
  without `--trust-folder` skipped repository hooks because the folder was not
  persistently trusted; `--trust-folder` and `--session-id` cannot be combined.
  Successive Copilot events in one session therefore remain unverified. A
  separate allowed-view prompt did not provide enough evidence to classify a
  permission negative case.
- `opencode run --standalone --archived --format json ...` and a subsequent
  `opencode run --standalone --session <id> --format json ...` produced two
  successful turns with distinct event IDs in the same session. A temporary
  logging-only V2 plugin captured starts and successes; all observed execution
  events lacked `location`, contrary to the earlier assumed attribution. A
  separate `opencode run --standalone --archived --auto --format json ...` read
  a synthetic file and produced no captured permission event; whether the read
  would otherwise have prompted is unknown. The archived OpenCode and Copilot
  test sessions may remain in their normal session histories.
- The four sanitized JSON payload fixtures and provenance are under
  `service/test/fixtures/hooks/captured/`; pseudonyms preserve same-session and
  distinct-ID relationships. No live approval, clarification, recoverable or
  terminal error, retry, or child/subagent case was captured. Runtime semantics,
  exact duplicate handling, attribution, and full acceptance remain open.
- `npm run build` in `service/` passed; `npm test` passed 49 tests in 9 files.
  `npm run test:hook -- github-copilot` and `npm run test:hook -- opencode`
  passed with their existing POC fixtures. Attempts to pass the captured fixture
  through `npm run test:hook` did not forward its `--fixture` argument in this
  environment and instead ran the default fixture. Directly invoking
  `node node_modules/tsx/dist/cli.mjs scripts/test-hook.ts github-copilot
  '--fixture=test/fixtures/hooks/captured/copilot-agent-stop.json'` passed with
  session `copilot-session`; the analogous `opencode` invocation with
  `opencode-execution-succeeded-1.json` failed as expected because the V1
  normalizer requires `session.idle`, `properties.sessionID`, and `directory`.
- A Node JSON/assertion check passed for all four fixture files, same-session
  IDs, distinct success IDs, increasing timestamps/sequence numbers, absent
  OpenCode `location`, and Copilot `end_turn`. A temporary PowerShell probe
  piped the captured Copilot fixture through the actual Node/tsx ingestion CLI
  from two temporary working directories with spaces to one absolute inbox path
  with spaces; both JSONL records were written. This is not a live Copilot
  hook-to-service integration test.
- The isolated temporary repository, hooks, plugin, raw capture, probe files,
  and inbox were removed; `Test-Path` for the temporary root returned `False`.
  Existing user-level hook/plugin configuration was not changed. No dependency
  installation, application change, deployment, or commit was made.
- `git -c core.whitespace=cr-at-eol diff --check` passed with a Git LF/CRLF
  warning; `Test-Path -LiteralPath 'service/test/fixtures/hooks/captured/README.md'`
  confirmed the new local link target. `git status --short --branch` showed only
  this status, `docs/sources.md`, and the new capture fixtures changed.

Live commands ran from the temporary `project with spaces` directory; session
IDs below are placeholders for the respective synthetic test sessions:

```powershell
copilot --trust-folder --disable-builtin-mcps --no-custom-instructions --no-ask-user -p 'Respond with exactly capture one. Do not use any tools.' --silent
copilot --resume <copilot-test-session-id> --disable-builtin-mcps --no-custom-instructions --no-ask-user -p 'Respond with exactly capture two. Do not use any tools.' --silent
copilot --trust-folder --disable-builtin-mcps --no-custom-instructions --allow-tool view -p 'Use the view tool to read probe.txt, then say done. Do not modify files or use any other tool.' --silent
copilot --trust-folder --disable-builtin-mcps --no-custom-instructions --no-ask-user -p 'Respond with exactly duplicate probe. Do not use any tools.' --silent
opencode run --standalone --archived --format json --title 'notifier event capture' 'Respond with exactly capture one. Do not use tools.'
opencode run --standalone --session <opencode-test-session-id> --format json 'Respond with exactly capture two. Do not use tools.'
opencode run --standalone --archived --auto --format json --title 'notifier negative case' 'Use the read tool to read probe.txt, then say done. Do not modify files or use other tools.'
```

### Interactive live-event follow-up — 2026-11-08

- `copilot --version` reported 1.0.107 and `opencode --version` v2.2.6. A
  temporary Git project with spaces contained logging-only project hooks, a V2
  event-subscription plugin, and synthetic files. User-level configuration was
  not edited by this task. Separate smoke runs captured Copilot `agentStop` and
  OpenCode execution start/success before interactive testing.
- The user ran `copilot --disable-builtin-mcps --no-custom-instructions
  --sync-session=off` and `opencode --standalone` from that project. The user
  reports both clarification forms appeared and were answered, and both later
  approval prompts appeared and were approved once. Copilot captured
  `elicitation_dialog` and `permission_prompt`; OpenCode captured `form.created`
  and matching `form.replied`, and `permission.asked` with matching
  `permission.replied` (`once`). OpenCode's approval case used an explicit
  temporary project `shell`-`ask` rule; Copilot's requested a synthetic file edit.
- The user reports no prompt for each earlier PowerShell-read case. Copilot
  logged `permissionRequest` but no `permission_prompt` in that session;
  OpenCode logged no `permission.asked` for its question-session shell read.
  These are bounded observations, not proof about all automatic decisions.
  Three Copilot `agentStop` payloads in the same interactive session had
  distinct timestamps; two are retained. The user reports the sessions closed.
- A missing-file `view` call in Copilot (`copilot --trust-folder
  --disable-builtin-mcps --no-custom-instructions --no-ask-user --allow-tool
  view -p ... --silent`) logged `postToolUseFailure` then `agentStop`. A
  missing-file `read` in OpenCode (`opencode run --standalone --archived
  --format json --title 'notifier missing file negative' ...`) logged
  `session.tool.failed` then `session.execution.succeeded`. Both assistants
  reported the failure and completed their turns. Terminal errors, automatic
  retries, and child sessions were not captured.
- Both interactive OpenCode `session.created` events and associated form or
  permission events carried matching directories; those matched the plugin
  context in these sessions. Execution successes did not carry location. A
  standalone nested-directory run (`opencode run --standalone --archived
  --format json --title 'notifier nested location' ...`) saw a different plugin
  context directory, the same project ID, and no success-event location. This
  does not verify simultaneous multi-location or restart-safe attribution.
- `node <temporary sanitize.cjs>` created 14 new sanitized fixtures and checked
  request/form ID and session correlation, ordering and location equality.
  `node <temporary validate.cjs>` parsed all 18 captured JSON fixtures and
  checked relationships, observed negative cases, selected privacy markers,
  and the success event's missing location: **passed**. Free-text fields are
  redacted and some values intentionally no longer satisfy the native schema;
  the fixtures are evidence, not proof of adapter compatibility.
- From `service/`, `npm run build` **passed** and `npm test` **passed** (49
  tests in 9 files). These existing tests do not exercise the new V2 attention
  mappings. Android tests and physical delivery were not run because no Android
  behavior changed. After the user confirmed both sessions were closed,
  `Remove-Item -LiteralPath <temporary capture root> -Recurse -Force` and
  `Remove-Item -LiteralPath <temporary setup script> -Force` removed only this
  task's temporary files; `Test-Path` returned `False` for each. Synthetic
  Copilot/OpenCode session history may remain in their normal stores.
- `node <temporary notifier-doc-check-20261108.cjs>` **passed**: six local
  Markdown links/anchors, one next-task heading, and 18 parseable fixture JSON
  files. `git -c core.whitespace=cr-at-eol diff --check` **passed** for tracked
  changes with an LF/CRLF warning; the capture files remain untracked.

### Event identity and attribution decision brief — 2026-11-08

- Reviewed `docs/roadmap.md`, the event-contract evidence and sanitized captured
  fixtures, plus `service/src/hooks/normalize.ts`, `service/src/domain.ts`, and
  `service/src/lifecycle.ts`. The Copilot evidence includes duplicate
  registrations with identical parsed payloads and distinct observed
  timestamps, but no native event ID or established collision-free identity.
  OpenCode success fixtures have distinct native event IDs but no location;
  session-creation/interactive fixtures include location. These observations do
  not establish restart-safe or simultaneous cross-location correlation.
- Added a bounded options/tradeoffs brief and pre-implementation test cases to
  `docs/sources.md`. It does not choose a deduplication policy, attribution
  source, fallback, display-name mapping, or change adapter/product behavior.
- Documentation-only task: application tests were not applicable. From the
  repository root, `git -c core.whitespace=cr-at-eol diff --check` passed with a
  Git LF/CRLF warning. A PowerShell link/fixture check passed for 4 local
  Markdown link targets (none had fragments) and all 18 captured JSON fixtures.
  `git status --short --branch` showed only the already-edited status/source
  documents and the pre-existing untracked capture-fixture directory. No
  dependency install, application/configuration change, deployment, release,
  or commit was made.

### Owner identity/attribution choices — 2026-11-08

- The owner selected the provisional MVP behavior: do not suppress Copilot hook
  inputs without a native event ID, accepting possible duplicate notifications;
  for OpenCode, prefer event-level location and use plugin `ctx.location` when
  the event location is absent, accepting possible multi-location
  misattribution. These choices do not establish implemented or verified
  behavior.
- Updated `docs/sources.md` with the selected options, caveats, and revised test
  expectations. OpenCode native event-ID duplicate semantics and project-name
  derivation remain undecided.
- Documentation-only: application tests were not applicable. From the
  repository root, `git -c core.whitespace=cr-at-eol diff --check` passed with a
  Git LF/CRLF warning. A PowerShell check passed for 4 local Markdown link
  targets, all 18 captured JSON fixtures, and exactly one next-task heading.
  `git status --short --branch` showed only the already-edited status/source
  documents and the pre-existing untracked capture-fixture directory. No code,
  dependency install, deployment, release, or commit was made.

## Blockers and technical decisions

1. **Event semantics and compatibility:** approval, question and completion
   payloads were captured using installed Copilot CLI 1.0.107 and OpenCode V2
   2.2.6 on 2026-11-08; prompts were user-reported. Terminal errors, retries,
   child sessions and end-to-end integrations remain untested. Observed OpenCode
   execution events lacked location; creation and interactive events had it.
   Owner decisions pending: support range
   (proposed 1.0.106–1.0.107 / 2.2.6), project-name source, completion
   description source (fixed text or OpenCode session title), whether inactivity/shutdown interruptions are errors, and
   in-process versus CLI inbox writes for the V2 plugin. Candidate signals,
   missing fields, Copilot's lack of a native event ID, the defective Windows
   stdin example, and successive-event suppression are recorded in
   `docs/sources.md`, including the owner-recorded provisional choices to avoid
   suppressing Copilot inputs without a native ID and to fall back to OpenCode
   `ctx.location` when an event has no location. These choices are not yet
   implemented or runtime-validated; multi-location misattribution remains a
   known risk. OpenCode native event-ID duplicate semantics remain unresolved.
   Automatic decisions, recoverable errors, and retries must not be mistaken for
   human attention.
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

**Implement and test the recorded Copilot and OpenCode location policies.**

- **Scope:** in a separately approved implementation, preserve each Copilot
  hook input as independently eligible for notification without derived-ID
  suppression; for OpenCode, use event location when present and `ctx.location`
  only when the event lacks location. Keep passive transcript lifecycle
  behavior unchanged. Do not decide OpenCode duplicate-ID policy or project
  display-name derivation as part of this task.
- **Acceptance criteria:** repeated Copilot inputs with identical parsed
  payloads and successive same-session hook events are not suppressed; tests
  show the accepted duplicate-notification tradeoff. OpenCode tests verify
  event-location precedence and the selected fallback, while documenting that
  cross-location attribution is not guaranteed. Existing relevant service
  tests pass.
- **Checks:** focused hook/lifecycle tests, full service tests, and service build;
  validate mappings against the captured fixtures and update source/status docs
  with actual results.
- **Risks:** current lifecycle logic suppresses hook-only same-session
  completions; fixing hook independence must not change transcript behavior.
  `ctx.location` may misattribute events if an instance handles multiple project
  locations. OpenCode event-ID duplicate semantics and project-name derivation
  remain separate decisions.
- **Approval gate:** wait for explicit approval before code changes. No
  dependency installation, production changes, deployment, release publication,
  or commits are authorized.

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

### Prior handoff — 2026-11-08

The approved live-capture task produced partial evidence, not full acceptance.
Changed `docs/sources.md`, this status, and the sanitized fixtures under
`service/test/fixtures/hooks/captured/`. Live Copilot completion and duplicate
registrations and two OpenCode success turns were captured; OpenCode execution
events did not contain location. The interactive attention scenarios, safe
failure/retry cases, Copilot successive-turn identity, OpenCode project
attribution and actual V2 ingestion remain gaps. The temporary capture root was
removed; normal tool session histories may retain the synthetic sessions.
Commands and actual results are recorded in the verification section above.
No application code, user-level configuration, dependency install, deployment
or commit was made. The follow-up above was subsequently approved and performed.

### Latest handoff — interactive follow-up, 2026-11-08

Captured and sanitized user-assisted Copilot and OpenCode approval/question
events, a no-prompt case for each, same-session Copilot completions, and
recovered missing-file tool failures. Changed `docs/sources.md`, this status,
and the captured-fixtures README; added 14 files under
`service/test/fixtures/hooks/captured/`. The pre-existing uncommitted capture
work was preserved. User reports establish whether prompts appeared; they are
not independently witnessed screen recordings. Verification commands, cleanup,
and remaining gaps are recorded above. No application code, dependency install,
deployment or commit was made. The next task and approval gate are above.

### Latest handoff — event identity and attribution brief, 2026-11-08

Added the owner decision brief, bounded failure tradeoffs, and proposed tests to
`docs/sources.md`; updated this status with the task outcome and next approval-
gated task. The prior uncommitted status/source edits and captured fixtures were
preserved. No product choice or adapter implementation was made. Actual
documentation checks and outcomes, remaining identity/attribution decisions, and
the single proposed next task are recorded above. No application tests, install,
deployment, release, or commit was performed.

### Latest handoff — owner identity/attribution choices, 2026-11-08

Recorded the owner's provisional MVP choices in `docs/sources.md`: do not
suppress Copilot inputs without a native event ID, accepting possible duplicates;
prefer OpenCode event location when available and otherwise fall back to plugin
`ctx.location`, accepting multi-location misattribution risk. Updated this status
and proposed one approval-gated implementation task. These are product choices,
not evidence that behavior is implemented or validated. The previous working
tree changes and captured fixtures were preserved. No application tests were
applicable to this documentation-only update; actual link/fixture, heading-count,
and whitespace checks are recorded in the verification section. No code change,
install, deployment, release, or commit was made.
