package com.aoa.sessionnotifier

internal interface ManagedConnection {
    fun start()
    fun stop()
}

internal enum class ServiceConnectionState {
    STOPPED, CONNECTING, CONNECTED, RECONNECTING,
    MISSING_CREDENTIALS, INVALID_CREDENTIALS, AUTHENTICATION_FAILED, START_FAILED;

    val running: Boolean
        get() = this == CONNECTING || this == CONNECTED || this == RECONNECTING
}

// All decisions run on the service's main thread. Socket callbacks are marshalled there.
internal class ConnectionServiceController(
    private val loadCredentials: () -> PairedDeviceCredentials?,
    private val createConnection: (PairedDeviceCredentials, (ConnectionState) -> Unit) -> ManagedConnection,
    private val onStateChanged: (ServiceConnectionState) -> Unit,
    private val onStopped: () -> Unit,
) {
    var state = ServiceConnectionState.STOPPED
        private set
    private var connection: ManagedConnection? = null
    private var generation = 0

    fun start() {
        if (state.running) return
        val credentials = try {
            loadCredentials()
        } catch (_: Exception) {
            finish(ServiceConnectionState.INVALID_CREDENTIALS)
            return
        }
        if (credentials == null) {
            finish(ServiceConnectionState.MISSING_CREDENTIALS)
            return
        }
        if (!validCredentials(credentials)) {
            finish(ServiceConnectionState.INVALID_CREDENTIALS)
            return
        }
        val currentGeneration = ++generation
        update(ServiceConnectionState.CONNECTING)
        try {
            connection = createConnection(credentials) { next ->
                if (generation == currentGeneration && state.running) {
                    when (next) {
                        ConnectionState.CONNECTING -> update(ServiceConnectionState.CONNECTING)
                        ConnectionState.CONNECTED -> update(ServiceConnectionState.CONNECTED)
                        ConnectionState.RECONNECTING -> update(ServiceConnectionState.RECONNECTING)
                        ConnectionState.AUTHENTICATION_FAILED -> finish(ServiceConnectionState.AUTHENTICATION_FAILED)
                        ConnectionState.DISCONNECTED -> finish(ServiceConnectionState.STOPPED)
                    }
                }
            }
            connection?.start()
        } catch (_: Exception) {
            finish(ServiceConnectionState.START_FAILED)
        }
    }

    fun stop() = finish(ServiceConnectionState.STOPPED)

    fun startFailed() = finish(ServiceConnectionState.START_FAILED)

    private fun finish(next: ServiceConnectionState) {
        generation++ // Ignore queued callbacks from a stopped or replaced socket owner.
        connection?.stop()
        connection = null
        update(next)
        onStopped()
    }

    private fun update(next: ServiceConnectionState) {
        state = next
        onStateChanged(next)
    }

    private fun validCredentials(credentials: PairedDeviceCredentials): Boolean {
        if (credentials.deviceId.isBlank() || credentials.credential.isBlank()) return false
        val host = credentials.host ?: return false
        val parts = host.split('.')
        // Pairing supports IPv4 only; reject malformed stored endpoints before opening a socket.
        return parts.size == 4 && parts.all { part ->
            part.isNotEmpty() && part.all { it in '0'..'9' } &&
                (part.length == 1 || part[0] != '0') && part.toIntOrNull() in 0..255
        } && credentials.port != null && credentials.port in 1..65_535
    }
}
