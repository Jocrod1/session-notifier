package com.aoa.sessionnotifier

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PairingLinkTest {
    @Test
    fun parsesDocumentedPairingUri() {
        val link = PairingLink.parse(
            "session-notifier://pair?host=192.168.1.133&port=49847&token=hIdYyoVB0YnKVNCUYCssia56QrJ8_rTl",
        )

        assertEquals("192.168.1.133", link.host)
        assertEquals(49847, link.port)
        assertEquals("hIdYyoVB0YnKVNCUYCssia56QrJ8_rTl", link.token)
    }

    @Test
    fun rejectsWrongSchemeOrTarget() {
        assertInvalid("https://pair?host=192.168.1.2&port=1234&token=abc")
        assertInvalid("session-notifier://other?host=192.168.1.2&port=1234&token=abc")
        assertInvalid("session-notifier://pair/path?host=192.168.1.2&port=1234&token=abc")
    }

    @Test
    fun rejectsMissingParameters() {
        assertInvalid("session-notifier://pair?port=1234&token=abc")
        assertInvalid("session-notifier://pair?host=192.168.1.2&token=abc")
        assertInvalid("session-notifier://pair?host=192.168.1.2&port=1234")
    }

    @Test
    fun rejectsInvalidHostAndPort() {
        assertInvalid("session-notifier://pair?host=example.com&port=1234&token=abc")
        assertInvalid("session-notifier://pair?host=999.168.1.2&port=1234&token=abc")
        assertInvalid("session-notifier://pair?host=192.168.1.2&port=0&token=abc")
        assertInvalid("session-notifier://pair?host=192.168.1.2&port=65536&token=abc")
        assertInvalid("session-notifier://pair?host=192.168.1.2&port=not-a-port&token=abc")
    }

    @Test
    fun rejectsUnexpectedOrDuplicateParameters() {
        assertInvalid("session-notifier://pair?host=192.168.1.2&port=1234&token=abc&other=value")
        assertInvalid("session-notifier://pair?host=192.168.1.2&host=192.168.1.3&port=1234&token=abc")
    }

    private fun assertInvalid(value: String) {
        assertThrows(PairingLinkValidationException::class.java) {
            PairingLink.parse(value)
        }
    }
}
