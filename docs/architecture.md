# Architecture

## Purpose

The service converts source-specific local session records into neutral lifecycle notifications. Its design boundary is deliberately narrow:

```text
Agent storage or harness hook -> event source -> normalized fact/event -> lifecycle tracker -> notifier -> adapter
```

Session Notifier currently has two input mechanisms feeding that same pipeline:

```text
Passive listeners
    ├── Claude
    ├── Codex
    ├── Koda
    └── local LLM

Explicit hooks
    ├── OpenCode
    └── GitHub Copilot
```

The distinction is only how source-specific input enters the service. Both
mechanisms produce source-agnostic domain events before lifecycle and
notification handling.

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

`Notifier` accepts one `NotificationAdapter`. The runtime composes the local
console adapter with an Android adapter through `CompositeNotificationAdapter`.
For every generated signal the notifier:

1. Builds a deterministic notification key.
2. Skips the signal if the state store says the key was delivered.
3. Awaits local console output, then starts Android delivery without waiting
   for its acknowledgement.
4. Records the key after local delivery and Android dispatch have been
   initiated.

The built-in `ConsoleNotificationAdapter` writes structured JSON to stdout.
`AndroidNotificationAdapter` converts the same signal into a concise title and
body, then uses `DeviceMessaging` to send it to each currently connected
authenticated device. The existing version-1 envelope carries the signal's
session, source, location, timestamp, prompt or end reason as body text.
Acknowledgements remain bounded by the transport's five-second timeout. A
disconnect, negative presentation outcome, or timeout is logged and does not
affect local delivery. There is no offline queue or retry; persisted delivery
keys therefore do not cause a later Android retry.

```ts
interface NotificationAdapter {
  notify(signal: SessionSignal): Promise<void>;
  close(): Promise<void>;
}
```

Adapters retain the existing signal payload and leave source/lifecycle
behavior unchanged.

## Paired Device Connections

Pairing, connectivity, and messaging are separate concerns. Pairing writes a
stable device ID and random credential to the JSON device registry. The
service's WebSocket connection manager authenticates those credentials and
tracks currently connected devices; temporary disconnects never remove or
modify the pairing. `DeviceMessaging` exposes connection status, connected
device listing, typed outbound messages, and bounded one-shot notification
acknowledgements without exposing WebSocket details to session/event handling.

The service listens on the configured local-network connection port (default
`43124`) at `/connect`. Protocol version 1 uses a credential-bearing `hello`
from Android, a `hello` acknowledgement from the PC, and nonce-based `ping`
and `pong` messages. The service authenticates each new socket against the
current JSON registry; it permits one active connection per device. Session
notifications use this transport through the Android adapter. A development
`test-notification` command continues to send one fixed notification only when
exactly one device is connected. Acknowledgements are correlated to the
notification ID and authenticated socket; pending requests are removed on
acknowledgement, timeout, disconnect, or connection replacement. An ID cannot
be reused on the same live connection, so late/duplicate acknowledgements
cannot satisfy a later request.

Android validates incoming notification fields, submits them through
`NotificationManager`, and acknowledges `processed` separately from the
presentation outcome. `submitted` means the native API accepted the request;
it cannot guarantee the operating system displayed it. Android 8+ uses a
notification channel and Android 13+ requires `POST_NOTIFICATIONS`. Permission
denial, app-wide notification disablement, channel disablement, and submission
failure are reported distinctly. Agent-event notifications request public
lock-screen visibility; Android and user privacy/channel settings can still
conceal their contents. An independent low-importance `PC connection status`
channel carries the ongoing foreground-service notice and its Stop action.
Event notifications use a separate tag as well as a separate channel, so an
event ID cannot replace that service notice.

Android encrypts the device ID, credential, device name, and PC endpoint
hint using Android Keystore-backed AES-GCM storage. The endpoint is connection
routing data, not device identity; the device ID and credential remain stable
if the Android device changes its own network address. `ConnectionService`
owns `PersistentConnection` and its reconnect executor. The activity binds to
observe status and issue Stop, and starts the foreground service only on an
explicit Start connection tap. Binding, pairing, activity return, and process
restart do not start a socket. Activity stop merely unbinds; it does not stop
an already user-started connection service.
Reconnect delays grow from one second to a 30-second maximum and reset after
authentication succeeds. Stop and service destruction close/cancel the socket,
cancel pending reconnect work, shut down the transport resources, and remove
the foreground notice. Missing/unreadable/invalid credentials or authentication
failure stop the started service with a visible error while the activity is
bound; no authentication-failure retry is attempted. Late callbacks from old
owners cannot overwrite current service state. `START_NOT_STICKY` requires
manual Start again after process death; there is no boot receiver or saved
auto-start flag. Android power/network restrictions still apply; this is not
a background-delivery guarantee. A changed PC LAN address requires updating
the endpoint through the pairing screen; this does not change the PC's device
identity or delete its pairing.

## State

`StateStore` persists successful notification keys in JSON. It writes a temporary file and renames it over the configured state path, reducing the risk of a partially written state file. A missing state file is normal. A malformed/unreadable file is logged and ignored, which may allow previously delivered notifications to repeat.

The implementation currently persists delivered keys only. In-memory lifecycle timing is not restored after process restart, so a process restart during an active quiet session restarts its five-minute inactivity countdown once fresh activity or a new prompt is observed. Persisting active session snapshots is planned work.

## Runtime Composition

[service/src/index.ts](../service/src/index.ts) loads configuration, restores delivery state, starts the paired-device WebSocket listener, creates the lifecycle tracker and composed console/Android adapters, starts file watchers, and schedules the 15-second inactivity tick. SIGINT and SIGTERM close device connections, stop file watchers, and close the notification adapter.

The generic [service/src/watcher.ts](../service/src/watcher.ts) serializes file events, tails complete JSONL lines only, and forwards facts to the composition root. It ignores historical file contents discovered at startup by registering a tail at the current end of each file. Only new appended records produce notifications.
