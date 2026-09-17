package com.aoa.sessionnotifier

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private lateinit var action: Button
    private var pairing: PairingLink? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showHome()
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun showHome() {
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }
        status = TextView(this).apply {
            text = getString(R.string.ready_to_pair)
            textSize = 20f
        }
        action = Button(this).apply { visibility = View.GONE }
        content.addView(status)
        content.addView(action)
        setContentView(content)
    }

    private fun handleIntent(intent: Intent) {
        val data = intent.data ?: return
        val link = PairingLink.parse(data)
        if (link == null) {
            status.text = getString(R.string.invalid_pairing_link)
            action.visibility = View.GONE
            return
        }
        pairing = link
        status.text = getString(R.string.pairing_request, link.host, link.port)
        action.apply {
            text = getString(R.string.accept_pairing)
            visibility = View.VISIBLE
            setOnClickListener { submitPairing(link) }
        }
    }

    private fun submitPairing(link: PairingLink) {
        action.isEnabled = false
        action.visibility = View.GONE
        val progress = ProgressBar(this)
        content.addView(progress)
        status.text = getString(R.string.connecting)
        executor.execute {
            val result = PairingClient().submit(link, Build.MODEL, BuildConfig.VERSION_NAME)
            runOnUiThread {
                content.removeView(progress)
                if (result is PairingResult.Success) {
                    try {
                        CredentialStore(this).save(result.deviceId, result.credential)
                        status.text = getString(R.string.pairing_complete)
                    } catch (error: Exception) {
                        showFailure(getString(R.string.credential_save_failed, error.message ?: "unknown error"))
                    }
                } else {
                    val error = (result as PairingResult.Failure).message
                    showFailure(error)
                }
            }
        }
    }

    private fun showFailure(message: String) {
        status.text = getString(R.string.pairing_failed, message)
        action.apply {
            text = getString(R.string.try_again)
            visibility = View.VISIBLE
            isEnabled = true
            setOnClickListener { pairing?.let(::submitPairing) }
        }
    }
}