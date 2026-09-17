package com.aoa.sessionnotifier

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

sealed interface PairingResult {
    data class Success(val deviceId: String, val credential: String) : PairingResult
    data class Failure(val message: String) : PairingResult
}

class PairingClient {
    fun submit(link: PairingLink, deviceName: String, appVersion: String): PairingResult {
        val connection = (URL("http://${link.host}:${link.port}/pair").openConnection() as HttpURLConnection)
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            val payload = JSONObject()
                .put("token", link.token)
                .put("device", JSONObject()
                    .put("name", deviceName.ifBlank { "Android device" })
                    .put("platform", "android")
                    .put("appVersion", appVersion))
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val response = (if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(response) }.getOrNull()
            if (connection.responseCode !in 200..299) {
                PairingResult.Failure(json?.optString("message").orEmpty().ifBlank {
                    "The PC rejected the pairing request (HTTP ${connection.responseCode})."
                })
            } else {
                val deviceId = json?.optString("deviceId").orEmpty()
                val credential = json?.optString("credential").orEmpty()
                if (json == null || !json.optBoolean("accepted", false) || deviceId.isBlank() || credential.isBlank()) {
                    PairingResult.Failure("The PC returned an invalid pairing response.")
                } else {
                    PairingResult.Success(deviceId, credential)
                }
            }
        } catch (error: IOException) {
            PairingResult.Failure("Unable to connect to the PC: ${error.message ?: "network error"}")
        } finally {
            connection.disconnect()
        }
    }
}
