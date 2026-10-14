package com.aoa.sessionnotifier

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log

internal class NotificationPresenter(context: Context) {
    private val applicationContext = context.applicationContext
    private val manager = applicationContext.getSystemService(NotificationManager::class.java)

    init {
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                applicationContext.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT,
            ),
        )
    }

    fun present(message: IncomingNotification): NotificationPresentation {
        val permissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            applicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val availability = notificationAvailability(
            permissionGranted = permissionGranted,
            appNotificationsEnabled = manager.areNotificationsEnabled(),
            channelEnabled = manager.getNotificationChannel(CHANNEL_ID)?.importance?.let {
                it != NotificationManager.IMPORTANCE_NONE
            } == true,
        )
        if (availability != null) return availability

        return try {
            val notification = Notification.Builder(applicationContext, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(message.title)
                .setContentText(message.body)
                .setStyle(Notification.BigTextStyle().bigText(message.body))
                .setAutoCancel(true)
                .setShowWhen(false)
                .build()
            manager.notify(message.notificationId.hashCode(), notification)
            NotificationPresentation.SUBMITTED
        } catch (error: SecurityException) {
            Log.e(TAG, "Android denied notification submission", error)
            NotificationPresentation.PERMISSION_DENIED
        } catch (error: RuntimeException) {
            Log.e(TAG, "Unable to submit Android notification", error)
            NotificationPresentation.FAILED
        }
    }

    private companion object {
        const val CHANNEL_ID = "session_notifications"
        const val TAG = "SessionNotifier"
    }
}
