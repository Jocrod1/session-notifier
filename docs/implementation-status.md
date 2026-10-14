# Implementation Status

## Delivered

The initial service implementation is complete for the following scope:

- Independent Node 22 TypeScript/ESM project.
- Strict compile check with `tsc --noEmit`.
- Vitest tests for lifecycle behavior, source parsing, and persisted notification idempotency.
- Neutral session identity and lifecycle domain model.
- Start notifications from source-confirmed prompts.
- One explicit end notification per opened turn for normal completion or abort.
- One later inactivity notification after the configured quiet period, defaulting to five minutes.
- Structured console delivery through a `NotificationAdapter` interface.
- Atomic JSON persistence of successfully delivered notification keys.
- Incremental JSONL tailing, including partial-line buffering and truncation recovery.
- File-backed source adapters for Claude, Codex, Koda, and local LLM.
- Windows-safe path handling through Node path APIs.
- SIGINT/SIGTERM watcher shutdown.
- Authenticated version 1 WebSocket connections for paired Android devices,
  with one active socket per device, nonce ping/pong keepalive, and graceful
  service shutdown.
- Android Keystore-backed persistence of the paired identity and PC endpoint,
  plus foreground-lifecycle connection ownership and bounded reconnect backoff.
- PC connection/protocol tests and deterministic Android retry-backoff tests.
- Authenticated version 1 test-notification delivery from the PC service to
  Android, with native notification channels, Android 13+ runtime permission
  handling, and bounded per-message acknowledgement correlation.
- A `test-notification` command for a running service. It sends only when
  exactly one Android device is connected and reports processing separately
  from native presentation outcomes.
- Focused protocol, acknowledgement, timeout, disconnect, duplicate-ID,
  Android payload validation, and notification-availability tests.

## Intentional Exclusions

The service contains none of the following concepts from Age of Agents or the context recorder UI:

- Heroes, peons, missions, world state, buildings, map state, or game thresholds.
- Token accounting, tool visualization, transcripts for display, or UI event JSONL output.
- HTTP API, web UI, desktop delivery, webhook delivery, Slack/Discord delivery, or email delivery.

## Current Constraints

- Console remains the sole session-notification adapter. The authenticated
  Android test sender is not yet wired to normal session lifecycle
  notifications.
- The Android connection runs only while the app is foregrounded. Background
  delivery is not implemented; no Android foreground service or push provider
  is used.
- A successful `submitted` acknowledgement means `NotificationManager.notify()`
  accepted the request. Android/the user may still not visibly see it because
  of system policy or later device state.
- The PC endpoint is persisted as a routing hint. A changed PC LAN address requires updating that hint through the pairing flow; existing Android installs from before endpoint persistence must pair once after upgrading.
- The source default includes the implemented OpenCode and GitHub Copilot hook inputs. `docker-claude` remains recognized but is not enabled by default because its collector is not implemented.
- File roots missing at startup are disabled until the service is restarted.
- Existing session history is intentionally not replayed at startup.
- Persistence contains delivered notification keys only, not active-session state. A restart cannot resume a quiet period already in progress.
- Notification-key history grows without retention or compaction.
- Source parsers are intentionally slim lifecycle extractors. They require fixtures from real source versions as those formats change.
- A notification-adapter failure stops handling the current source event because delivery is awaited. It does not mark the event delivered, but automatic retry/backoff is not implemented yet.

## Recommended Next Work

1. Implement OpenCode's read-only SQLite collector with user-message start detection, part-based terminal detection, optional dependency loading, and graceful schema-mismatch behavior.
2. Implement Docker-Claude polling with an injectable Docker client, incremental container-file tailing, container-qualified identity, and a `container-exit` terminal reason.
3. Extend persisted state to include active session timestamps and lifecycle flags, restoring inactivity behavior correctly after restart.
4. Add bounded retention for delivered keys, ideally with timestamp-aware keys/state records.
5. Add retry/backoff and isolation for notification adapter failures.
6. Add a notification adapter registry driven by `SESSION_NOTIFIER_*` settings, then implement webhook and Windows desktop adapters.
7. Replace the generic Codex/Koda/local-LLM parsing subset with fixture-driven source-specific parsers where real records demonstrate a mismatch.
8. Add root-probing supervision so sources that appear after startup begin automatically.

## Verification Snapshot

The Phase 2 test-delivery slice passes:

```text
npm run build
npm test
.\gradlew.bat testDebugUnitTest assembleDebug
```

Tests cover protocol validation, per-device acknowledgement correlation,
timeouts, disconnect cleanup, duplicate pending IDs, Android notification
payload validation, and permission/channel outcomes in addition to the
existing regression suite.
