package com.aoa.sessionnotifier

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.security.GeneralSecurityException
import org.json.JSONException

class MainActivity : Activity() {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private lateinit var content: LinearLayout
    private lateinit var pairingUri: EditText
    private lateinit var status: TextView
    private lateinit var action: Button
    private lateinit var progress: ProgressBar
    private lateinit var connectionStatus: TextView
    private lateinit var startConnection: Button
    private lateinit var stopConnection: Button
    private lateinit var notificationStatus: TextView
    private var service: ConnectionService.LocalBinder? = null
    private var bound = false
    private var pairing = false
    private val observer: (ServiceConnectionState) -> Unit = { state ->
        connectionStatus.text = getString(state.messageResource())
        startConnection.isEnabled = !state.running && !pairing
        stopConnection.isEnabled = state.running
        action.isEnabled = !state.running && !pairing
        pairingUri.isEnabled = !state.running && !pairing
    }
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            service = binder as ConnectionService.LocalBinder
            service?.observe(observer)
        }

        override fun onServiceDisconnected(name: ComponentName) {
            service = null
            startConnection.isEnabled = false
            stopConnection.isEnabled = false
            connectionStatus.text = getString(R.string.service_unavailable)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showHome()
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onStart() {
        super.onStart()
        if (!pairing) loadPairedDevice()
        updateNotificationStatus()
        bound = bindService(Intent(this, ConnectionService::class.java), serviceConnection, BIND_AUTO_CREATE)
    }

    override fun onStop() {
        service?.removeObserver(observer)
        service = null
        if (bound) unbindService(serviceConnection)
        bound = false
        startConnection.isEnabled = false
        stopConnection.isEnabled = false
        super.onStop()
    }

    private fun showHome() {
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }
        val title = TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 24f
        }
        val heading = TextView(this).apply {
            text = getString(R.string.pair_with_computer)
            textSize = 20f
        }
        pairingUri = EditText(this).apply {
            hint = getString(R.string.pairing_uri_hint)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            isSingleLine = true
        }
        action = Button(this).apply {
            text = getString(R.string.pair)
            setOnClickListener { startPairing() }
        }
        val statusLabel = TextView(this).apply {
            text = getString(R.string.status_label)
        }
        status = TextView(this).apply {
            text = getString(R.string.ready_to_pair)
        }
        progress = ProgressBar(this).apply {
            visibility = View.GONE
        }
        content.addView(title)
        content.addView(heading)
        content.addView(pairingUri)
        content.addView(action)
        content.addView(statusLabel)
        content.addView(status)
        content.addView(progress)
        connectionStatus = TextView(this).apply { text = getString(R.string.service_stopped) }
        startConnection = Button(this).apply {
            text = getString(R.string.start_connection)
            isEnabled = false
            setOnClickListener {
                try {
                    startForegroundService(Intent(this@MainActivity, ConnectionService::class.java).setAction(ConnectionService.ACTION_START))
                    requestNotificationPermissionIfNeeded()
                } catch (_: RuntimeException) {
                    connectionStatus.text = getString(R.string.service_start_failed)
                }
            }
        }
        stopConnection = Button(this).apply {
            text = getString(R.string.stop_connection)
            isEnabled = false
            setOnClickListener { service?.stop() }
        }
        content.addView(TextView(this).apply { text = getString(R.string.service_explanation) })
        content.addView(connectionStatus)
        content.addView(startConnection)
        content.addView(stopConnection)
        content.addView(TextView(this).apply { text = getString(R.string.notification_explanation) })
        notificationStatus = TextView(this)
        content.addView(notificationStatus)
        content.addView(Button(this).apply {
            text = getString(R.string.allow_notifications)
            setOnClickListener { requestNotificationPermissionIfNeeded() }
        })
        content.addView(Button(this).apply {
            text = getString(R.string.notification_settings)
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
            }
        })
        setContentView(ScrollView(this).apply { addView(content) })
    }

    private fun startPairing() {
        val link = try {
            PairingLink.parse(pairingUri.text.toString())
        } catch (error: PairingLinkValidationException) {
            status.text = getString(R.string.validation_failed, error.message)
            return
        }
        pairingUri.isEnabled = false
        action.isEnabled = false
        pairing = true
        startConnection.isEnabled = false
        progress.visibility = View.VISIBLE
        status.text = getString(R.string.waiting_for_response)
        executor.execute {
            val result = PairingClient().submit(link, deviceName(), BuildConfig.VERSION_NAME)
            runOnUiThread {
                if (isDestroyed) return@runOnUiThread
                pairing = false
                startConnection.isEnabled = service != null
                progress.visibility = View.GONE
                if (result is PairingResult.Success) {
                    try {
                        CredentialStore(this).save(
                            result.deviceId,
                            result.credential,
                            link.host,
                            result.connectionPort,
                            deviceName(),
                        )
                        status.text = getString(R.string.pairing_complete)
                        loadPairedDevice()
                    } catch (_: GeneralSecurityException) {
                        showFailure(getString(R.string.credential_save_failed))
                    } catch (_: JSONException) {
                        showFailure(getString(R.string.credential_save_failed))
                    } catch (_: IllegalArgumentException) {
                        showFailure(getString(R.string.credential_save_failed))
                    } catch (_: IllegalStateException) {
                        showFailure(getString(R.string.credential_save_failed))
                    }
                } else {
                    showFailure((result as PairingResult.Failure).message)
                }
                service?.let { observer(it.state) }
            }
        }
    }

    private fun loadPairedDevice() {
        val credentials = try {
            CredentialStore(this).load()
        } catch (_: Exception) {
            status.text = getString(R.string.service_invalid_credentials)
            return
        }
        if (credentials == null) {
            status.text = getString(R.string.ready_to_pair)
            return
        }
        if (credentials.host.isNullOrBlank() || credentials.port == null) {
            status.text = getString(R.string.pairing_endpoint_missing)
            return
        }
        status.text = getString(R.string.pairing_complete)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATION_PERMISSION)
        }
        updateNotificationStatus()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATION_PERMISSION) updateNotificationStatus()
    }

    private fun updateNotificationStatus() {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val enabled = getSystemService(NotificationManager::class.java).areNotificationsEnabled()
        notificationStatus.text = getString(if (granted && enabled) R.string.notifications_allowed else R.string.notifications_not_allowed)
    }

    private fun showFailure(message: String) {
        status.text = getString(R.string.pairing_failed, message)
        pairingUri.isEnabled = true
        action.isEnabled = true
    }

    private fun deviceName(): String {
        val manufacturer = Build.MANUFACTURER.trim()
        val model = Build.MODEL.trim()
        return if (model.startsWith(manufacturer, ignoreCase = true)) model else "$manufacturer $model".trim()
    }

    private companion object {
        const val REQUEST_NOTIFICATION_PERMISSION = 1
    }
}
