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

class CredentialStore(context: Context) {
    private val preferences = context.getSharedPreferences("paired-device", Context.MODE_PRIVATE)

    fun save(deviceId: String, credential: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, key())
        }
        val encrypted = cipher.doFinal(JSONObject().put("deviceId", deviceId).put("credential", credential)
            .toString().toByteArray(StandardCharsets.UTF_8))
        val saved = preferences.edit()
            .putString("credential", Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP))
            .commit()
        check(saved) { "Unable to persist the paired device credential" }
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
    }
}
