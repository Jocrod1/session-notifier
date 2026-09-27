package com.aoa.sessionnotifier

import org.json.JSONObject
import org.json.JSONException

internal const val CONNECTION_PROTOCOL_VERSION = 1

internal fun helloMessage(credentials: PairedDeviceCredentials): String =
    JSONObject()
        .put("type", "hello")
        .put("protocolVersion", CONNECTION_PROTOCOL_VERSION)
        .put("deviceId", credentials.deviceId)
        .put("deviceName", credentials.deviceName)
        .put("credential", credentials.credential)
        .toString()

internal fun responseToServerMessage(
    value: String,
    credentials: PairedDeviceCredentials,
    connected: Boolean,
): String? {
    val message = try {
        JSONObject(value)
    } catch (_: JSONException) {
        return null
    }
    if (message.optInt("protocolVersion", -1) != CONNECTION_PROTOCOL_VERSION) return null
    return when (message.optString("type")) {
        "hello" -> if (!connected && message.optString("deviceId") == credentials.deviceId) {
            ""
        } else {
            null
        }
        "ping" -> message.optString("nonce")
            .takeIf { it.isNotBlank() && it.length <= 200 && !it.any(Char::isISOControl) }
            ?.let { nonce ->
            JSONObject()
                .put("type", "pong")
                .put("protocolVersion", CONNECTION_PROTOCOL_VERSION)
                .put("nonce", nonce)
                .toString()
        }
        else -> null
    }
}
