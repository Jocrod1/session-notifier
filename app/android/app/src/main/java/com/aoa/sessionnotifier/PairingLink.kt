package com.aoa.sessionnotifier

import android.net.Uri

data class PairingLink(val host: String, val port: Int, val token: String) {
    companion object {
        fun parse(uri: Uri): PairingLink? {
            if (uri.scheme != "session-notifier" || uri.host != "pair" || uri.path?.isNotEmpty() == true) {
                return null
            }
            val host = uri.getQueryParameter("host")?.trim().orEmpty()
            val token = uri.getQueryParameter("token").orEmpty()
            val port = uri.getQueryParameter("port")?.toIntOrNull()
            if (host.isEmpty() || token.isEmpty() || port == null || port !in 1..65535) return null
            if (host.any { it.isWhitespace() || it == '/' || it == '\\' || it == ':' }) return null
            return PairingLink(host, port, token)
        }
    }
}
