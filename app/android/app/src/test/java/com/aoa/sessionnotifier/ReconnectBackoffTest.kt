package com.aoa.sessionnotifier

import org.junit.Assert.assertEquals
import org.junit.Test

class ReconnectBackoffTest {
    @Test
    fun `delay doubles to a fixed maximum without overflowing`() {
        val backoff = ReconnectBackoff(initialDelayMillis = 1_000, maximumDelayMillis = 30_000)

        assertEquals(1_000, backoff.nextDelayMillis())
        assertEquals(2_000, backoff.nextDelayMillis())
        assertEquals(4_000, backoff.nextDelayMillis())
        assertEquals(8_000, backoff.nextDelayMillis())
        assertEquals(16_000, backoff.nextDelayMillis())
        assertEquals(30_000, backoff.nextDelayMillis())
        assertEquals(30_000, backoff.nextDelayMillis())
    }

    @Test
    fun `successful connection reset starts retry delay at one second`() {
        val backoff = ReconnectBackoff()
        repeat(5) { backoff.nextDelayMillis() }

        backoff.reset()

        assertEquals(1_000, backoff.nextDelayMillis())
    }
}
