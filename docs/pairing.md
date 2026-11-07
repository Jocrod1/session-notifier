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
available while the user-started Android connection service runs, including
when the activity is backgrounded; disconnected devices do not receive queued or retried
notifications.

1. Build and install the Android debug app from `app/android` with
   `.\gradlew.bat assembleDebug`. Start the PC service from `service` with
   `npm start`.
2. In a second `service/` terminal run `npm start -- pair`, accept the Android
   device, and paste the pairing link into the app.
3. Pairing saves credentials only. Tap **Start connection** in the visible app
   and wait for **Connected to the paired computer**. On Android 13+, allow
   the notification permission prompt. **Allow notifications** and
   **Notification settings** are also available explicitly in the app.
4. In the terminal running the service, enter `test-notification`. The command
   sends only when exactly one device is connected; it refuses zero or
   multiple connected devices rather than selecting one arbitrarily.
   Normal lifecycle notifications are forwarded to each currently connected,
   authenticated Android device.
5. Confirm a native **Session Notifier test** notification appears on Android
   and the service prints `processed=true, presentation=submitted`.

The Android app creates its `Session notifications` channel on Android 8+,
separate from the ongoing low-importance `PC connection status` service
notification. Both use distinct notification identities, so events cannot
overwrite the status notice. Event notifications request public lock-screen
visibility; Android and user lock-screen/privacy/channel settings can still
conceal content. Existing channel preferences are not reset by the app.
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
channel, then send the test again while the connection service runs. The
service should print `presentation=permission-denied` or
`presentation=channel-disabled`. Android's app-wide notification toggle is
reported as `notifications-disabled`.

### User-started connection service

The `connectedDevice` service, not the activity, owns the WebSocket and bounded
exponential reconnect loop (one second to 30 seconds; reset after authentication).
Leaving the activity only removes its observer. **Stop connection**, available
in the app and the status notification, closes/cancels the socket, cancels
reconnect attempts, and removes the foreground notice. Agent-event notifications
already posted are not cleared by Stop. Stop before pairing again.

Missing, invalid, unreadable, or legacy credentials without an endpoint prevent
connection startup and show a pairing-required error. Authentication failure
stops the service instead of retrying indefinitely. No stored credentials are
deleted automatically. Pair again to repair the saved pairing, then tap Start.
If the PC LAN address changes, update the saved endpoint by pairing again;
the stable device identity and PC trust record are independent of that address.

The service is not sticky: process death, force-stop, or reboot does not
automatically reconnect. Reopen the app and tap Start. There is no boot startup,
wake lock, battery-optimization exemption, notification queue, or replay.
Foreground-service ownership permits background/locked use but does not
guarantee delivery under Doze, network suspension, OEM power policy, or user
restrictions. Recovery permits subsequent notifications; events missed while
disconnected are not delivered later.

On Android 13+, notification permission is not a prerequisite to starting a
foreground service. Denial prevents agent-event display and hides the service
notice from the notification drawer; Android still lists the foreground service
in its Task Manager / Active apps UI. Stop remains available inside the app.
If Android no longer offers the permission prompt after denial, use
**Notification settings**. Neither permission grant nor `presentation=submitted`
is proof that the OS displayed an event.

### Android requirements (checked 2026-11-05)

The app's declared SDK levels are compile/target 35 and minimum 26.

**Existing compatibility caveat:** the extra 2026-11-05 `lintDebug` check found
API-33-only `URLDecoder.decode` calls in the unchanged pairing parser despite
min SDK 26. Lower-API pairing compatibility is not verified; this separate
pre-existing issue was reported without changing pairing or the SDK here.

Manifest permissions:

- `INTERNET` for the PC WebSocket/pairing HTTP connection.
- `POST_NOTIFICATIONS` for notification prompting on Android 13+.
- `FOREGROUND_SERVICE` (required from API 28).
- `FOREGROUND_SERVICE_CONNECTED_DEVICE` for the target-34+ service type check.
- `CHANGE_NETWORK_STATE`, one of Android's documented manifest-only
  prerequisites for the network-connected `connectedDevice` type. `INTERNET`
  alone is not a qualifying prerequisite. This task does not change networks.

`ConnectionService` is not exported and declares
`android:foregroundServiceType="connectedDevice"`. The service is launched
with `startForegroundService()` from the visible app and promoted promptly,
before credential loading, using the explicit connected-device type on API
29+ (the two-argument API on 26–28). No Bluetooth, location, NFC, USB, wake-lock,
or `ACCESS_NETWORK_STATE` permission is needed by this implementation.

Authoritative references:
[connected-device requirements](https://developer.android.com/develop/background-work/services/fgs/service-types#connected-device),
[launching foreground services](https://developer.android.com/develop/background-work/services/fgs/launch),
[notification permission and denial](https://developer.android.com/develop/ui/views/notifications/notification-permission),
and [lock-screen controls](https://developer.android.com/develop/ui/compose/notifications#lock-screen).

### Physical-device acceptance checklist (Tested - All OK)

No device was connected for the 2026-11-05 implementation checks. Unit tests
and APK assembly do not verify locked-phone delivery. On a paired physical
device, record Android version, power/privacy settings, actions, PC outcomes,
and actually visible notifications:

1. Pair without tapping Start; verify there is no PC socket or ongoing status
   notice. Tap Start; verify Connected and a separate status notice with Stop.
2. Background the app and lock the phone. Send `test-notification` and a new
   agent event; verify delivery and lock-screen visibility (subject to privacy
   settings). Reopen the app and verify it observes the existing connection.
3. Use notification Stop while connected, and app Stop while reconnecting.
   Verify the PC disconnects, the status notice disappears, and no socket or
   reconnect returns after waiting beyond the 30-second maximum backoff.
4. With the service running, restart the PC service and separately disconnect
   and restore Wi-Fi. Verify reconnect and then send a new notification to
   demonstrate subsequent delivery; do not expect replay of missed events.
5. Deny notification permission on Android 13+. Verify the service can still
   connect, the PC reports `permission-denied` for an event, no drawer notice
   is claimed, and app Stop works. Restore permission and retest delivery.
6. Force-stop/reopen the app and, separately, reboot: verify no automatic
   connection; tapping Start must be necessary.
