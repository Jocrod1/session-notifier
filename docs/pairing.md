# PC Pairing

Run `session-notifier pair` from `service/` to start a temporary pairing receiver. The command chooses a reachable non-loopback IPv4 address, binds an HTTP server to `0.0.0.0` on an ephemeral port, and prints a terminal QR plus the deep link as text.

The deep link is:

```
session-notifier://pair?host=<LAN_IP>&port=<PORT>&token=<TOKEN>
```

The Android client submits the following JSON to `POST /pair` at the host and port from the link:

```json
{
  "token": "the-token-from-the-link",
  "device": {
    "name": "Pixel 9",
    "platform": "android",
    "appVersion": "0.1.0"
  }
}
```

For now, the Android client accepts the URI through a text field on its pairing screen. Paste the complete URI and select **Pair**. QR scanning, deep-link handling, and Android App Links are not implemented.

The request is validated, including the short-lived token (five minutes by default), before it is shown to the PC user. A device is not trusted or persisted until the user explicitly accepts it. An accepted response contains `accepted`, a persistent device `deviceId`, a generated device `credential`, and the configured `connectionPort`; a rejected request receives HTTP 403 and does not create a device. Pairing is a one-time trust decision. The Android app encrypts the returned identity/credential and the PC endpoint hint in Android Keystore-backed storage. Reconnecting does not issue a new pairing token or mutate the PC registry.

Paired devices are stored as JSON in `session-notifier-devices.json` by default. Override this with `SESSION_NOTIFIER_DEVICES_PATH`. Override the token lifetime with `SESSION_NOTIFIER_PAIRING_TTL_MS`. The temporary receiver closes after success, expiration, cancellation, or normal termination.

Android installs paired by the earlier app version stored the device ID and
credential but not the PC endpoint. They must complete pairing once after
upgrading so the endpoint can be securely persisted; subsequent restarts and
temporary connection failures do not require pairing. The PC registry no
longer treats the Android client's observed IP address as persistent device
data.

## Persistent connection

While the PC service is running, it accepts WebSocket connections on
`ws://<PC_LAN_IP>:<SESSION_NOTIFIER_CONNECTION_PORT>/connect` (port `43124`
by default). `session-notifier pair` prints this endpoint and includes the
port in the accepted `/pair` response. The pairing URI's port remains the
temporary HTTP pairing receiver port; it is not reused for the persistent
connection.

The version 1 text-message protocol is:

```json
{"type":"hello","protocolVersion":1,"deviceId":"<paired-id>","deviceName":"Pixel 9","credential":"<paired-credential>"}
{"type":"hello","protocolVersion":1,"deviceId":"<paired-id>"}
{"type":"ping","protocolVersion":1,"nonce":"<random-nonce>"}
{"type":"pong","protocolVersion":1,"nonce":"<same-nonce>"}
```

The first message is Android's authentication hello; the second is the PC's
acknowledgement. The PC validates the schema, protocol version, device ID,
and credential against the JSON registry. The credential is never included
in PC connection logs. The PC initiates nonce-based pings and expects matching
pongs; unresponsive sockets are closed. Binary messages, malformed JSON,
oversized payloads, unknown message types, and unsupported versions are
rejected. A second socket for the same device replaces the previous one. The
connection exists only while the Android activity is in the foreground;
returning to the app reconnects with bounded exponential backoff.

To manually test, start the service with `npm start`, run
`npm start -- pair` in another `service/` terminal, accept the Android device,
and paste the pairing link into the app. Confirm the PC prints
`[device] <name> connected` and the app shows **Connected**. Background the
app to observe the PC's disconnected log, then return to the app and confirm
it reconnects. Stop and restart the PC service to verify reconnect behavior;
the pairing record remains in `session-notifier-devices.json`. Force-stop and
reopen the Android app to verify startup reconnect. These logs do not contain
credentials.

Android does not maintain the socket while the app is backgrounded or force
stopped. This milestone has no background notification delivery, so it does
not add a foreground service. If the PC's LAN address changes, the saved
endpoint hint must be updated by pairing again; the stable device ID and PC
trust record are independent from that address.
