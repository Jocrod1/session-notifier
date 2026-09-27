package com.aoa.sessionnotifier

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties

data class PairedDeviceCredentials(
    val deviceId: String,
    val credential: String,
    val host: String?,
    val port: Int?,
    val deviceName: String,
)

class CredentialStore(context: Context) {
    private val preferences = context.getSharedPreferences("paired-device", Context.MODE_PRIVATE)

    fun save(deviceId: String, credential: String, host: String, port: Int, deviceName: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, key())
        }
        val encrypted = cipher.doFinal(JSONObject()
            .put("deviceId", deviceId)
            .put("credential", credential)
            .put("host", host)
            .put("port", port)
            .put("deviceName", deviceName)
            .toString().toByteArray(StandardCharsets.UTF_8))
        val saved = preferences.edit()
            .putString("credential", Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP))
            .commit()
        check(saved) { "Unable to persist the paired device credential" }
    }

    fun load(): PairedDeviceCredentials? {
        val saved = preferences.getString("credential", null) ?: return null
        val payload = Base64.decode(saved, Base64.NO_WRAP)
        require(payload.size > IV_LENGTH) { "Stored device credential is malformed" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key(), javax.crypto.spec.GCMParameterSpec(128, payload.copyOfRange(0, IV_LENGTH)))
        }
        val json = JSONObject(String(cipher.doFinal(payload.copyOfRange(IV_LENGTH, payload.size)), StandardCharsets.UTF_8))
        val deviceId = json.optString("deviceId")
        val credential = json.optString("credential")
        require(deviceId.isNotBlank() && credential.isNotBlank()) { "Stored device credential is malformed" }
        val host = json.optString("host").takeIf { it.isNotBlank() }
        val port = json.optInt("port", 0).takeIf { it in 1..65_535 }
        return PairedDeviceCredentials(
            deviceId = deviceId,
            credential = credential,
            host = host,
            port = port,
            deviceName = json.optString("deviceName", "Android device"),
        )
    }

    private fun key(): SecretKey {
        val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build())
        }.generateKey()
    }

    companion object {
        private const val KEY_ALIAS = "session-notifier-device-credential"
        private const val IV_LENGTH = 12
    }
}
