package com.aoa.sessionnotifier

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
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
    private var connection: PersistentConnection? = null

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
        loadPairedDevice()
    }

    override fun onStop() {
        connection?.stop()
        connection = null
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
        setContentView(content)
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
        progress.visibility = View.VISIBLE
        status.text = getString(R.string.waiting_for_response)
        executor.execute {
            val result = PairingClient().submit(link, deviceName(), BuildConfig.VERSION_NAME)
            runOnUiThread {
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
            }
        }
    }

    private fun loadPairedDevice() {
        val credentials = try {
            CredentialStore(this).load()
        } catch (error: GeneralSecurityException) {
            status.text = getString(R.string.credential_load_failed, error.message ?: "stored data is invalid")
            return
        } catch (error: JSONException) {
            status.text = getString(R.string.credential_load_failed, error.message ?: "stored data is invalid")
            return
        } catch (error: IllegalArgumentException) {
            status.text = getString(R.string.credential_load_failed, error.message ?: "stored data is invalid")
            return
        } ?: return
        if (credentials.host.isNullOrBlank() || credentials.port == null) {
            status.text = getString(R.string.pairing_endpoint_missing)
            return
        }
        connection?.stop()
        lateinit var candidate: PersistentConnection
        candidate = PersistentConnection(credentials) { state ->
            runOnUiThread {
                if (connection !== candidate) return@runOnUiThread
                status.text = when (state) {
                    ConnectionState.CONNECTING -> getString(R.string.connection_connecting)
                    ConnectionState.CONNECTED -> getString(R.string.connection_connected, credentials.deviceName)
                    ConnectionState.RECONNECTING -> getString(R.string.connection_reconnecting)
                    ConnectionState.AUTHENTICATION_FAILED -> getString(R.string.connection_authentication_failed)
                    ConnectionState.DISCONNECTED -> getString(R.string.connection_disconnected)
                }
            }
        }
        connection = candidate
        candidate.start()
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
}