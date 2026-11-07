# Product Roadmap

This document records the product direction confirmed by the owner on
2026-11-02. Current implementation, evidence, blockers, and the single proposed
next task live in [Implementation Status](implementation-status.md). Milestones
are complete only when their acceptance criteria are verified there. Task
approval and safety rules remain in [AGENTS.md](../AGENTS.md).

## Product purpose and primary workflow

Session Notifier is notification infrastructure for AI agents: it receives
attention-worthy events, normalizes them, and delivers notifications to a
paired device. A developer starts agent work on a PC, steps away, receives a
phone notification when human attention is needed, and returns to the PC.
It is not an agent-management, session-dashboard, or remote-control application.

The target is a publicly available, developer-oriented MVP: the owner can use
it personally and another developer can install and reproduce the setup.

## Confirmed MVP scope

| Area               | Required MVP scope                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platforms          | Windows PC and native Android companion application                                                                                                                |
| Agent integrations | GitHub Copilot CLI and OpenCode; explicitly documented supported versions                                                                                          |
| Connectivity       | PC and phone on the same Wi-Fi network; persistent authenticated LAN connection                                                                                    |
| Pairing            | QR reader on Android, explicit PC approval, one PC paired with one Android phone, and unpairing that revokes access                                                |
| PC operation       | Lightweight background service, manually started/stopped, basic troubleshooting logs; no desktop GUI or automatic startup                                          |
| Android operation  | Pair/unpair, connection status, foreground-service start/stop controls, notification permission requests/explanations, and basic PC/service connection information |
| Delivery           | Receive while the phone is locked and the user-started Android foreground service is running                                                                       |
| Distribution       | GitHub Releases, installable APK, Windows service installation/operation instructions, and manual agent-integration configuration                                  |

The Windows background-operation mechanism is an implementation choice, not a
requirement for a polished installer or a particular service wrapper.

## Notification and delivery requirements

### Attention-only events

| Event category          | Notify when                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Approval required       | The agent is actually awaiting human approval, not merely evaluating an automatically allowed permission |
| Clarification/question  | The agent needs a human response                                                                         |
| Task completed          | The agent has completed its work and is awaiting further instructions                                    |
| Error/blocked execution | Human attention is required; a recoverable error or automatic retry alone is insufficient                |

Routine work starting or continuing must not notify. Inactivity or an aborted
turn is not automatically an attention event. Errors have lower conceptual
priority, but all four categories use the same Android notification behavior
in the MVP. The foreground service's ongoing status notification is separate
from agent-event notifications.

Every notification contains the agent/tool name, project/repository name,
event type, and short description. The complete notification content must be
eligible for lock-screen display; this does not mean sending a full transcript.
Android/user privacy and channel settings still control actual visibility and
must be explained and included in physical-device validation.

Every distinct event generates an independent notification, including
successive turns in the same agent session. No app-level aggregation or
grouping is required. Duplicate-input handling must not suppress distinct
events. No agent interaction or reply action on mobile is required.

### Trust, disconnection, and acknowledgements

- Only the paired phone can receive notifications. Rejected/expired pairing
  attempts do not create trust. Unpairing revokes PC authorization and closes
  any active authorized connection; forgetting local credentials alone is not
  sufficient.
- No guaranteed delivery while disconnected, event persistence/replay, or
  survival after the user explicitly stops/kills the Android service is
  required. Reconnection restores delivery for subsequent events. Disconnection
  must not interrupt PC event handling.
- A `submitted` acknowledgement means Android accepted a notification request,
  not that the OS displayed it or the user saw it. Permission/channel failures
  and bounded acknowledgement waits remain observable.
- The public setup must accurately describe authentication and transport
  security. A same-Wi-Fi deployment does not by itself establish encryption.

## M1 — Core notification infrastructure

**Outcome:** a developer can pair one phone and receive a common notification
over the LAN while away from the PC.

Acceptance criteria:

- **M1.1:** A Windows user can manually start/stop the lightweight background
  service with documented configuration, logs, and clean connection shutdown.
- **M1.2:** Android scans the PC QR and completes expiring, explicitly approved
  pairing; invalid, rejected, and expired attempts persist no device trust.
- **M1.3:** A single PC/phone pair is enforced. Unpaired, revoked, or additional
  devices cannot receive events; unpairing also terminates active access.
- **M1.4:** A common notification contract preserves event identity, agent,
  project, event category, and short description. Independent events remain
  independent without an offline delivery guarantee.
- **M1.5:** Android exposes pair/unpair, connection status, PC/service information,
  notification permission explanations, and foreground-service start/stop.
- **M1.6:** With required permissions/settings and the foreground service
  running, a real phone receives notifications while locked. Stop, disconnect,
  and reconnect behavior follows the agreed limitations; full-content
  lock-screen eligibility is explicitly configured and tested.
- **M1.7:** Focused tests cover trust/revocation, the notification contract,
  permissions, connection/service lifecycle, and failure isolation; service
  type-check and relevant automated suites pass. Physical delivery is verified
  separately from acknowledgement acceptance.

## M2 — Supported agent integrations

**Outcome:** Copilot CLI and OpenCode produce useful, correctly attributed
attention notifications rather than routine lifecycle noise.

Acceptance criteria:

- **M2.1:** Supported Copilot CLI and OpenCode versions and their native event
  sources are documented, with representative payload evidence for each
  applicable attention category. Missing source coverage is an explicit gap,
  not a silently satisfied requirement.
- **M2.2:** Both integrations map applicable approval, clarification, completion,
  and attention-requiring failure events into the common contract. They do not
  grant permissions, answer questions, or otherwise control the agents.
- **M2.3:** Notifications contain the correct agent and repository/project plus
  a useful short description. Routine starts/continuations, automatic permission
  decisions, and recovered errors produce no attention notification.
- **M2.4:** Successive distinct events in the same session and across both agents
  are delivered independently; duplicate-input suppression has explicit tested
  semantics. Event forwarding does not wait for Android acknowledgements or
  fail because the phone is disconnected.
- **M2.5:** Manual Windows integration instructions work from different project
  directories with explicit paths/configuration. Fixture-based mapping,
  filtering, repeated-event, and integration tests pass, with live-agent checks
  against the supported versions.

## M3 — Public MVP readiness

**Outcome:** the owner and another developer can use the complete MVP from a
public release. The current target is **MVP end-to-end release readiness**;
this includes unfinished M1/M2 implementation, not just packaging.

Acceptance criteria:

- **M3.1:** All M1/M2 criteria have recorded evidence; both agents reach a real
  locked Android phone with the foreground service running and required
  settings enabled. Repeated events, unpair/revocation, permission denial,
  service stop, disconnection, and subsequent-event reconnect are exercised.
- **M3.2:** Windows installation, dependencies, configuration, manual start/stop,
  QR pairing/unpairing, Android APK installation, permission/privacy settings,
  and supported integration setup are documented. Troubleshooting covers
  Windows firewall, pairing/connection ports, Wi-Fi isolation, and PC addresses.
- **M3.3:** A versioned GitHub Release provides the APK and PC installation/setup
  instructions with documented artifact provenance. Google Play, a polished
  installer, and an automated release pipeline are not prerequisites.
- **M3.4:** A different developer performs a fresh installation using only the
  public documentation; failures and required fixes are recorded. Windows
  checks, relevant automated tests/builds, and real-device validation are dated
  and reported as actual results, not inferred from old CI or chat summaries.

## Deferred expansion and non-goals

- **M4 — User-driven expansion:** consider additional agent integrations only
  when actual user demand establishes their priority.
- **M5 — Expanded delivery:** evaluate Firebase, remote connectivity, or other
  delivery channels later. These are evaluation ideas, not MVP commitments.
- MVP excludes Docker-Claude, additional agent integrations, multiple-device
  support, Linux/macOS, automatic Windows startup, guaranteed disconnected
  delivery, offline event persistence/replay, notification aggregation,
  dashboards, mobile agent interaction, commercial packaging, and Google Play.
- OpenCode SQLite polling remains excluded; the integration direction is a
  supported plugin/event API, not database polling. Revisit only through an
  explicit scope decision.
- Restart-safe active-session persistence, key-history retention, delivery
  retries, parser expansion, and root supervision are retained technical ideas,
  not scheduled MVP phases. Existing local inbox/idempotency state and delivered
  non-MVP adapters are not authorized for removal by this plan.
- Age of Agents UI/gamification and HTTP/web UI, desktop, webhook, Slack/Discord,
  and email delivery remain outside MVP. This does not exclude existing console
  output, temporary HTTP pairing, or WebSocket transport.

## Decision provenance

The owner's 2026-11-02 product-direction handoff and subsequent approval of this
restructuring supersede the earlier mixed product/workflow phase numbering
and Docker-Claude-first recommendation. Foreground-service delivery, one phone,
attention-only events, and developer-oriented public distribution are now
confirmed requirements; offline replay is not. Previous implementation and
historical validation remain recorded in Implementation Status. Repository
workflow setup is infrastructure, not an MVP product phase. No release date,
npm publication, or 1.0.0 commitment is implied.
