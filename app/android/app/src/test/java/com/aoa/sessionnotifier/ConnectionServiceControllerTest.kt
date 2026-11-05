package com.aoa.sessionnotifier

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConnectionServiceControllerTest {
    private val credentials = PairedDeviceCredentials("device", "secret", "192.168.1.2", 43124, "Phone")

    private class FakeConnection(val callback: (ConnectionState) -> Unit) : ManagedConnection {
        var starts = 0
        var stops = 0
        override fun start() { starts++ }
        override fun stop() { stops++ }
    }

    private class Harness(load: () -> PairedDeviceCredentials?) {
        val connections = mutableListOf<FakeConnection>()
        val states = mutableListOf<ServiceConnectionState>()
        var foregroundRemovals = 0
        val controller = ConnectionServiceController(
            loadCredentials = load,
            createConnection = { _, callback -> FakeConnection(callback).also { connections.add(it) } },
            onStateChanged = { states.add(it) },
            onStopped = { foregroundRemovals++ },
        )
    }

    @Test
    fun `creating and observing the owner does not start a connection`() {
        var loads = 0
        val harness = Harness { loads++; credentials }
        assertEquals(ServiceConnectionState.STOPPED, harness.controller.state)
        assertFalse(harness.controller.state.running)
        assertTrue(harness.connections.isEmpty())
        assertEquals(0, loads)
    }

    @Test
    fun `manual start is idempotent and connection recovery stays running`() {
        val harness = Harness { credentials }
        harness.controller.start()
        harness.controller.start()
        val connection = harness.connections.single()
        assertEquals(1, connection.starts)
        connection.callback(ConnectionState.CONNECTED)
        assertEquals(ServiceConnectionState.CONNECTED, harness.controller.state)
        connection.callback(ConnectionState.RECONNECTING)
        assertTrue(harness.controller.state.running)
        connection.callback(ConnectionState.CONNECTED)
        assertEquals(ServiceConnectionState.CONNECTED, harness.controller.state)
        assertEquals(0, connection.stops)
        assertEquals(0, harness.foregroundRemovals)
    }

    @Test
    fun `stop closes the reconnecting owner and ignores queued callbacks`() {
        val harness = Harness { credentials }
        harness.controller.start()
        val connection = harness.connections.single()
        connection.callback(ConnectionState.RECONNECTING)
        harness.controller.stop()
        connection.callback(ConnectionState.CONNECTED)
        connection.callback(ConnectionState.RECONNECTING)
        connection.callback(ConnectionState.AUTHENTICATION_FAILED)
        assertEquals(1, connection.stops)
        assertEquals(ServiceConnectionState.STOPPED, harness.controller.state)
        assertEquals(1, harness.foregroundRemovals)
        harness.controller.stop()
        assertEquals(1, connection.stops)
    }

    @Test
    fun `manual restart loads fresh credentials and rejects old owner callbacks`() {
        var loads = 0
        val harness = Harness { loads++; credentials }
        harness.controller.start()
        val previous = harness.connections.single()
        harness.controller.stop()
        harness.controller.start()
        previous.callback(ConnectionState.AUTHENTICATION_FAILED)
        assertEquals(ServiceConnectionState.CONNECTING, harness.controller.state)
        assertEquals(2, loads)
        assertEquals(2, harness.connections.size)
        harness.connections.last().callback(ConnectionState.CONNECTED)
        assertEquals(ServiceConnectionState.CONNECTED, harness.controller.state)
    }

    @Test
    fun `authentication failure closes owner and removes foreground status without retry`() {
        val harness = Harness { credentials }
        harness.controller.start()
        val connection = harness.connections.single()
        connection.callback(ConnectionState.AUTHENTICATION_FAILED)
        connection.callback(ConnectionState.RECONNECTING)
        assertEquals(ServiceConnectionState.AUTHENTICATION_FAILED, harness.controller.state)
        assertFalse(harness.controller.state.running)
        assertEquals(1, connection.stops)
        assertEquals(1, harness.foregroundRemovals)
    }

    @Test
    fun `missing credentials stop without creating a socket`() {
        val harness = Harness { null }
        harness.controller.start()
        assertEquals(ServiceConnectionState.MISSING_CREDENTIALS, harness.controller.state)
        assertTrue(harness.connections.isEmpty())
        assertEquals(1, harness.foregroundRemovals)
    }

    @Test
    fun `unreadable credentials stop with sanitized invalid state`() {
        val harness = Harness { throw IllegalStateException("sensitive stored data") }
        harness.controller.start()
        assertEquals(listOf(ServiceConnectionState.INVALID_CREDENTIALS), harness.states)
        assertTrue(harness.connections.isEmpty())
        assertEquals(1, harness.foregroundRemovals)
    }

    @Test
    fun `invalid identities and legacy or malformed endpoints cannot start`() {
        listOf(
            credentials.copy(deviceId = ""), credentials.copy(credential = " "),
            credentials.copy(host = null), credentials.copy(port = null),
            credentials.copy(port = 0), credentials.copy(port = 65_536),
            credentials.copy(host = "192.168.1.999"), credentials.copy(host = "192.168.01.2"),
            credentials.copy(host = "192.168.1.2/path"), credentials.copy(host = ""),
        ).forEach { invalid ->
            val harness = Harness { invalid }
            harness.controller.start()
            assertEquals(ServiceConnectionState.INVALID_CREDENTIALS, harness.controller.state)
            assertTrue(harness.connections.isEmpty())
            assertEquals(1, harness.foregroundRemovals)
        }
    }

    @Test
    fun `start failure cleans up the partially started owner`() {
        var closes = 0
        var removals = 0
        val controller = ConnectionServiceController(
            loadCredentials = { credentials },
            createConnection = { _, _ -> object : ManagedConnection {
                override fun start() { throw IllegalStateException("cannot start") }
                override fun stop() { closes++ }
            } },
            onStateChanged = {},
            onStopped = { removals++ },
        )
        controller.start()
        assertEquals(ServiceConnectionState.START_FAILED, controller.state)
        assertEquals(1, closes)
        assertEquals(1, removals)
    }

    @Test
    fun `foreground promotion failure is observable and never starts a socket`() {
        val harness = Harness { credentials }
        harness.controller.startFailed()
        assertEquals(ServiceConnectionState.START_FAILED, harness.controller.state)
        assertTrue(harness.connections.isEmpty())
        assertEquals(1, harness.foregroundRemovals)
    }

    @Test
    fun `terminal disconnect releases the owner and foreground state`() {
        val harness = Harness { credentials }
        harness.controller.start()
        val connection = harness.connections.single()
        connection.callback(ConnectionState.DISCONNECTED)
        assertEquals(ServiceConnectionState.STOPPED, harness.controller.state)
        assertEquals(1, connection.stops)
        assertEquals(1, harness.foregroundRemovals)
    }

    @Test
    fun `connection construction failure removes foreground state`() {
        var removals = 0
        val controller = ConnectionServiceController(
            loadCredentials = { credentials },
            createConnection = { _, _ -> throw IllegalArgumentException("invalid endpoint") },
            onStateChanged = {},
            onStopped = { removals++ },
        )
        controller.start()
        assertEquals(ServiceConnectionState.START_FAILED, controller.state)
        assertEquals(1, removals)
    }
}
