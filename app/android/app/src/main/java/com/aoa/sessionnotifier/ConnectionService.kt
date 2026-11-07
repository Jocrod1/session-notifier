package com.aoa.sessionnotifier

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

class ConnectionService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val listeners = mutableSetOf<(ServiceConnectionState) -> Unit>()
    private lateinit var controller: ConnectionServiceController
    private lateinit var manager: NotificationManager
    private var foreground = false
    private val binder = LocalBinder()

    internal inner class LocalBinder : Binder() {
        val state: ServiceConnectionState
            get() = controller.state

        fun observe(listener: (ServiceConnectionState) -> Unit) {
            listeners.add(listener)
            listener(controller.state)
        }

        fun removeObserver(listener: (ServiceConnectionState) -> Unit) {
            listeners.remove(listener)
        }

        fun stop() = controller.stop()
    }

    override fun onCreate() {
        super.onCreate()
        manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(
            STATUS_CHANNEL_ID,
            getString(R.string.connection_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ))
        val presenter = NotificationPresenter(this)
        controller = ConnectionServiceController(
            loadCredentials = { CredentialStore(this).load() },
            createConnection = { credentials, callback ->
                PersistentConnection(credentials, { next -> handler.post { callback(next) } }, presenter::present)
            },
            onStateChanged = { state ->
                if (foreground && state.running) {
                    try {
                        manager.notify(STATUS_NOTIFICATION_ID, statusNotification(state))
                    } catch (_: RuntimeException) {
                        // Status refresh is best-effort; permissions can change while running.
                    }
                }
                listeners.toList().forEach { it(state) }
            },
            onStopped = {
                stopForeground(STOP_FOREGROUND_REMOVE)
                foreground = false
                stopSelf()
            },
        )
    }

    override fun onBind(intent: Intent): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                if (!controller.state.running) {
                    try {
                        val notification = statusNotification(ServiceConnectionState.CONNECTING)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            startForeground(STATUS_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
                        } else {
                            startForeground(STATUS_NOTIFICATION_ID, notification)
                        }
                        foreground = true
                        controller.start()
                    } catch (_: RuntimeException) {
                        controller.startFailed()
                    }
                }
            }
            ACTION_STOP -> controller.stop()
            else -> if (!controller.state.running) stopSelf()
        }
        // No automatic start after process death, force-stop, reboot, or pairing.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        controller.stop()
        listeners.clear()
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun statusNotification(state: ServiceConnectionState): Notification {
        val openApp = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stop = PendingIntent.getService(this, 0, Intent(this, ConnectionService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, STATUS_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(getString(R.string.connection_notification_title))
            .setContentText(getString(state.messageResource()))
            .setContentIntent(openApp)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(Notification.Action.Builder(null, getString(R.string.stop_connection), stop).build())
            .build()
    }

    internal companion object {
        const val ACTION_START = "com.aoa.sessionnotifier.START_CONNECTION"
        const val ACTION_STOP = "com.aoa.sessionnotifier.STOP_CONNECTION"
        const val STATUS_CHANNEL_ID = "connection_status"
        const val STATUS_NOTIFICATION_ID = 1
    }
}

internal fun ServiceConnectionState.messageResource(): Int = when (this) {
    ServiceConnectionState.STOPPED -> R.string.service_stopped
    ServiceConnectionState.CONNECTING -> R.string.connection_connecting
    ServiceConnectionState.CONNECTED -> R.string.service_connected
    ServiceConnectionState.RECONNECTING -> R.string.connection_reconnecting
    ServiceConnectionState.MISSING_CREDENTIALS -> R.string.service_missing_credentials
    ServiceConnectionState.INVALID_CREDENTIALS -> R.string.service_invalid_credentials
    ServiceConnectionState.AUTHENTICATION_FAILED -> R.string.connection_authentication_failed
    ServiceConnectionState.START_FAILED -> R.string.service_start_failed
}
