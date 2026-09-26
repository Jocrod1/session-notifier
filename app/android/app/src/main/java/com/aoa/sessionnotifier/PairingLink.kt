package com.aoa.sessionnotifier

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

data class PairingLink(val host: String, val port: Int, val token: String) {
    companion object {
        fun parse(value: String): PairingLink {
            val uri = try {
                URI(value.trim())
            } catch (_: Exception) {
                throw PairingLinkValidationException("The pairing URI is malformed.")
            }
            if (uri.scheme != "session-notifier") {
                throw PairingLinkValidationException("The URI scheme must be session-notifier.")
            }
            if (uri.rawAuthority != "pair" || uri.rawPath.orEmpty().isNotEmpty()) {
                throw PairingLinkValidationException("The URI must target session-notifier://pair.")
            }
            if (uri.rawFragment != null) {
                throw PairingLinkValidationException("The pairing URI must not contain a fragment.")
            }
            val parameters = parseQuery(uri.rawQuery)
            val host = parameters["host"]?.trim().orEmpty()
            if (!isIpv4Address(host)) {
                throw PairingLinkValidationException("The host must be a valid IPv4 address.")
            }
            val port = parameters["port"]?.toIntOrNull()
            if (port == null || port !in 1..65535) {
                throw PairingLinkValidationException("The port must be a number from 1 to 65535.")
            }
            val token = parameters["token"].orEmpty()
            if (token.isBlank()) {
                throw PairingLinkValidationException("The pairing token is missing.")
            }
            return PairingLink(host, port, token)
        }

        private fun parseQuery(rawQuery: String?): Map<String, String> {
            if (rawQuery.isNullOrBlank()) {
                throw PairingLinkValidationException("The pairing URI is missing host, port, and token parameters.")
            }
            val parameters = mutableMapOf<String, String>()
            try {
                for (part in rawQuery.split('&')) {
                    val pieces = part.split('=', limit = 2)
                    if (pieces.size != 2) throw PairingLinkValidationException("The pairing URI contains a malformed parameter.")
                    val name = URLDecoder.decode(pieces[0], StandardCharsets.UTF_8)
                    val value = URLDecoder.decode(pieces[1], StandardCharsets.UTF_8)
                    if (name !in setOf("host", "port", "token")) {
                        throw PairingLinkValidationException("The pairing URI contains an unsupported parameter.")
                    }
                    if (parameters.put(name, value) != null) {
                        throw PairingLinkValidationException("The pairing URI contains a duplicate $name parameter.")
                    }
                }
            } catch (error: PairingLinkValidationException) {
                throw error
            } catch (_: IllegalArgumentException) {
                throw PairingLinkValidationException("The pairing URI contains invalid encoding.")
            }
            return parameters
        }

        private fun isIpv4Address(value: String): Boolean {
            val parts = value.split('.')
            return parts.size == 4 && parts.all { part ->
                val number = part.toIntOrNull()
                part.isNotEmpty() &&
                    part.all(Char::isDigit) &&
                    (part.length == 1 || part[0] != '0') &&
                    number != null &&
                    number in 0..255
            }
        }
    }
}

class PairingLinkValidationException(message: String) : IllegalArgumentException(message)
