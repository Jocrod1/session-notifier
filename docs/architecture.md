# Architecture

## Purpose

The service converts source-specific local session records into neutral lifecycle notifications. Its design boundary is deliberately narrow:

```text
Agent storage or harness hook -> event source -> normalized fact/event -> lifecycle tracker -> notifier -> adapter
```

Each layer has one job. Source adapters understand record formats and locations. The lifecycle tracker understands session state. The notifier enforces delivery idempotency. Notification adapters decide how a user is informed.

Transcript listeners remain passive event sources. OpenCode plugins and GitHub Copilot command hooks are active event sources that currently normalize their completion callbacks to `work-finished`. The lifecycle tracker deliberately retains the existing `ended` signal with `reason: "completed"` so explicit completion and transcript completion share notification behavior.

## Domain Model

A session is identified by all three values below:

```ts
interface SessionRef {
  source: SourceId;
  id: string;
  location: string;
}
```

`location` is part of the identity, not display-only metadata. It prevents a collision when two sources reuse the same session ID, such as a host Claude transcript and a Docker container transcript.

The canonical key is:

```text
<source>:<location>:<id>
```

The current signal union is:

```ts
type SessionSignal =
  | { type: "started"; session: SessionRef; at: string; prompt: string }
  | { type: "ended"; session: SessionRef; at: string; reason: EndReason }
  | { type: "inactive"; session: SessionRef; at: string };
```

`EndReason` reserves four meanings:

- `completed`: source explicitly reports a normal terminal turn.
- `aborted`: source explicitly reports an aborted turn.
- `inferred`: a source-specific heuristic reports a terminal state without an explicit normal/abort record.
- `container-exit`: Docker-backed collection observes the container disappear.

Only `completed` and `aborted` are emitted by the present runnable collectors. The other values exist so future adapters can state their confidence honestly.

## Normalized Facts

Source parsing intentionally discards presentation data and game-specific detail. The lifecycle core only consumes:

```ts
type Fact =
  | { kind: "prompt"; text: string; ts: string }
  | { kind: "turn-end"; ts: string }
  | { kind: "turn-aborted"; ts: string }
  | { kind: "activity"; ts: string };
```

A valid user prompt starts or renews a lifecycle. A terminal fact emits an `ended` notification if that lifecycle still has an open turn. Activity moves the inactivity deadline without creating a second start notification.

## Lifecycle Semantics

The default inactivity period is five minutes, expressed as $300000$ milliseconds.

1. A source-confirmed human prompt emits `started` if no currently started lifecycle exists for that session.
2. A `turn-end` emits `ended` with `reason: "completed"` once for the current turn.
3. A `turn-aborted` emits `ended` with `reason: "aborted"` once for the current turn.
4. A hook `work-finished` event emits the same completed `ended` signal, including when no transcript prompt was observed.
5. Any known-session activity renews the inactivity deadline.
6. On a 15-second service tick, a started session with no activity for the configured period emits one `inactive` notification.
7. After `inactive`, a later real prompt begins a new lifecycle and can produce another `started` notification.

An explicit turn completion does not suppress the later inactivity notification. These are intentionally separate observations: the agent completed a response, then the session remained quiet.

Repeated terminal records are suppressed through `turnOpen`. Replayed or duplicated deliveries are suppressed through a persisted notification key. The key includes session identity, signal type, timestamp, and terminal reason when applicable.

## Delivery

`Notifier` accepts one `NotificationAdapter`. For every generated signal it:

1. Builds a deterministic notification key.
2. Skips the signal if the state store says the key was delivered.
3. Calls `adapter.notify(signal)`.
4. Records the key only after successful delivery.

The built-in `ConsoleNotificationAdapter` writes structured JSON to stdout. A future adapter can implement the same two-method interface:

```ts
interface NotificationAdapter {
  notify(signal: SessionSignal): Promise<void>;
  close(): Promise<void>;
}
```

Appropriate future adapters include webhook, Windows desktop notifications, Slack, Discord, and email. They should retain the existing signal payload and leave source/lifecycle behavior unchanged.

## State

`StateStore` persists successful notification keys in JSON. It writes a temporary file and renames it over the configured state path, reducing the risk of a partially written state file. A missing state file is normal. A malformed/unreadable file is logged and ignored, which may allow previously delivered notifications to repeat.

The implementation currently persists delivered keys only. In-memory lifecycle timing is not restored after process restart, so a process restart during an active quiet session restarts its five-minute inactivity countdown once fresh activity or a new prompt is observed. Persisting active session snapshots is planned work.

## Runtime Composition

[service/src/index.ts](../service/src/index.ts) loads configuration, restores delivery state, creates the lifecycle tracker and console adapter, starts file watchers, and schedules the 15-second inactivity tick. SIGINT and SIGTERM stop file watchers and close the notification adapter.

The generic [service/src/watcher.ts](../service/src/watcher.ts) serializes file events, tails complete JSONL lines only, and forwards facts to the composition root. It ignores historical file contents discovered at startup by registering a tail at the current end of each file. Only new appended records produce notifications.
