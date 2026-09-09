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

## Intentional Exclusions

The service contains none of the following concepts from Age of Agents or the context recorder UI:

- Heroes, peons, missions, world state, buildings, map state, or game thresholds.
- Token accounting, tool visualization, transcripts for display, or UI event JSONL output.
- HTTP API, web UI, desktop delivery, webhook delivery, Slack/Discord delivery, or email delivery.

## Current Constraints

- Console is the sole notification adapter. The adapter boundary is ready, but no remote or desktop transport is registered.
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

At the initial implementation milestone, the service passed:

```text
npm run build
npm test
```

The suite contains five tests in three files:

- `test/lifecycle.test.ts`: starts, explicit terminal events, inactivity, and terminal deduplication.
- `test/notifier.test.ts`: persisted delivery idempotency across a simulated restart.
- `test/file-sources.test.ts`: Claude prompt/end parsing, synthetic prompt rejection, Codex abort parsing, and Windows local-LLM path classification.

Use the current test suite as the narrow regression gate while extending one collector or adapter at a time.
