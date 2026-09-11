# PC Pairing

Run `session-notifier pair` from `service/` to start a temporary pairing receiver. The command chooses a reachable non-loopback IPv4 address, binds an HTTP server to `0.0.0.0` on an ephemeral port, and prints a terminal QR plus the deep link as text.

The deep link is:

```
session-notifier://pair?host=<LAN_IP>&port=<PORT>&token=<TOKEN>
```

The Android client should submit the following JSON to `POST /pair` at the host and port from the link:

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

The request is validated, including the short-lived token (five minutes by default), before it is shown to the PC user. A device is not trusted or persisted until the user explicitly accepts it. An accepted response contains `accepted`, a persistent device `deviceId`, and a generated device `credential`; a rejected request receives HTTP 403 and does not create a device.

Paired devices are stored as JSON in `session-notifier-devices.json` by default. Override this with `SESSION_NOTIFIER_DEVICES_PATH`. Override the token lifetime with `SESSION_NOTIFIER_PAIRING_TTL_MS`. The temporary receiver closes after success, expiration, cancellation, or normal termination.
