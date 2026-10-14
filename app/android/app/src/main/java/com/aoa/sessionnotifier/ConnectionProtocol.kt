package com.aoa.sessionnotifier

import org.json.JSONObject
import org.json.JSONException

internal const val CONNECTION_PROTOCOL_VERSION = 1

internal data class IncomingNotification(
    val notificationId: String,
    val title: String,
    val body: String,
)

internal enum class NotificationPresentation(val wireValue: String) {
    SUBMITTED("submitted"),
    PERMISSION_DENIED("permission-denied"),
    APP_NOTIFICATIONS_DISABLED("notifications-disabled"),
    CHANNEL_DISABLED("channel-disabled"),
    FAILED("failed"),
}

internal fun notificationAvailability(
    permissionGranted: Boolean,
    appNotificationsEnabled: Boolean,
    channelEnabled: Boolean,
): NotificationPresentation? = when {
    !permissionGranted -> NotificationPresentation.PERMISSION_DENIED
    !appNotificationsEnabled -> NotificationPresentation.APP_NOTIFICATIONS_DISABLED
    !channelEnabled -> NotificationPresentation.CHANNEL_DISABLED
    else -> null
}

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
    presentNotification: (IncomingNotification) -> NotificationPresentation,
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
        "notification" -> parseNotification(message)
            ?.takeIf { connected }
            ?.let { notification ->
                val presentation = presentNotification(notification)
                JSONObject()
                    .put("type", "notification-ack")
                    .put("protocolVersion", CONNECTION_PROTOCOL_VERSION)
                    .put("notificationId", notification.notificationId)
                    .put("processed", true)
                    .put("presentation", presentation.wireValue)
                    .toString()
            }
        else -> null
    }
}

private fun parseNotification(message: JSONObject): IncomingNotification? {
    val notificationId = message.opt("notificationId") as? String ?: return null
    val title = message.opt("title") as? String ?: return null
    val body = message.opt("body") as? String ?: return null
    return validatedNotification(notificationId, title, body)
}

internal fun validatedNotification(
    notificationId: String,
    title: String,
    body: String,
): IncomingNotification? {
    if (!notificationId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) return null
    if (title.isBlank() || title.length > 120 || title.any(Char::isISOControl)) return null
    if (body.isBlank() || body.length > 1_000 || body.any { it.isISOControl() && it != '\n' && it != '\t' }) return null
    return IncomingNotification(notificationId, title, body)
}
