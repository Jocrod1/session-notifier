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
{"type":"notification","protocolVersion":1,"notificationId":"<unique-id>","title":"Session Notifier test","body":"Test notification sent from the PC service."}
{"type":"notification-ack","protocolVersion":1,"notificationId":"<same-id>","processed":true,"presentation":"submitted"}
```

The first message is Android's authentication hello; the second is the PC's
acknowledgement. The PC validates the schema, protocol version, device ID,
and credential against the JSON registry. The credential is never included
in PC connection logs. The PC initiates nonce-based pings and expects matching
pongs; unresponsive sockets are closed. Binary messages, malformed JSON,
oversized payloads, unknown message types, and unsupported versions are
rejected. An older Android build treats the `notification` type as unknown
and closes that socket with code `4400`; it does not silently ignore messages
or negotiate a fallback. Update Android before using notification delivery.
A second socket for the same device replaces the previous one.

### Notification delivery

Both `test-notification` and normal lifecycle events use the authenticated
socket and native Android notification handling. Lifecycle notifications
continue to be written to the console. Android delivery is best-effort and
foreground-only; disconnected devices do not receive queued or retried
notifications.

1. Build and install the Android debug app from `app/android` with
   `.\gradlew.bat assembleDebug`. Start the PC service from `service` with
   `npm start`.
2. In a second `service/` terminal run `npm start -- pair`, accept the Android
   device, and paste the pairing link into the app.
3. Keep the Android app open in the foreground and wait for **Connected**.
   On Android 13+, allow the notification permission prompt.
4. In the terminal running the service, enter `test-notification`. The command
   sends only when exactly one device is connected; it refuses zero or
   multiple connected devices rather than selecting one arbitrarily.
   Normal lifecycle notifications are forwarded to each currently connected,
   authenticated Android device.
5. Confirm a native **Session Notifier test** notification appears on Android
   and the service prints `processed=true, presentation=submitted`.

The Android app creates its `Session notifications` channel on Android 8+.
Android 13+ requires runtime `POST_NOTIFICATIONS` permission. The
acknowledgement distinguishes processing (`processed`) from presentation:
`submitted` means `NotificationManager.notify()` accepted the request, not
that the OS guaranteed it was visible. Other outcomes are
`permission-denied`, `notifications-disabled` (app-level notifications
switched off), `channel-disabled`, and `failed`. The service reports a missing
acknowledgement after five seconds as a timeout; disconnecting or replacing
the authenticated socket fails pending acknowledgements immediately. No
notification queue or retry is used.

To verify permission/channel reporting, revoke notification permission in
Android settings (Android 13+) or disable the app's `Session notifications`
channel, reconnect by returning to the app, then send the test again. The
service should print `presentation=permission-denied` or
`presentation=channel-disabled`. Android's app-wide notification toggle is
reported as `notifications-disabled`.

The connection exists only while the Android activity is in the foreground;
backgrounding the app closes it, and returning reconnects with bounded
exponential backoff. To verify lifecycle behavior, background and reopen the
app, then stop and restart the PC service. The pairing record remains in
`session-notifier-devices.json`. Force-stop and reopen the Android app to
verify startup reconnect. These logs do not contain credentials.

Android does not maintain the socket while the app is backgrounded or force
stopped. This milestone has no background notification delivery, so it does
not add a foreground service. If the PC's LAN address changes, the saved
endpoint hint must be updated by pairing again; the stable device ID and PC
trust record are independent from that address.
