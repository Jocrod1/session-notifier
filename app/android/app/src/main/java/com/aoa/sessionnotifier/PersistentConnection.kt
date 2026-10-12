package com.aoa.sessionnotifier

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

enum class ConnectionState {
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    AUTHENTICATION_FAILED,
    DISCONNECTED,
}

class ReconnectBackoff(
    private val initialDelayMillis: Long = 1_000,
    private val maximumDelayMillis: Long = 30_000,
) {
    private var nextDelayMillis = initialDelayMillis

    init {
        require(initialDelayMillis > 0 && maximumDelayMillis >= initialDelayMillis)
    }

    fun nextDelayMillis(): Long {
        val delay = nextDelayMillis
        nextDelayMillis = (nextDelayMillis * 2).coerceAtMost(maximumDelayMillis)
        return delay
    }

    fun reset() {
        nextDelayMillis = initialDelayMillis
    }
}

class PersistentConnection(
    private val credentials: PairedDeviceCredentials,
    private val onStateChanged: (ConnectionState) -> Unit,
) {
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    private val executor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { task ->
        Thread(task, "session-notifier-connection").apply { isDaemon = true }
    }
    private val backoff = ReconnectBackoff()
    @Volatile private var running = false
    private var socket: WebSocket? = null
    private var retryTask: ScheduledFuture<*>? = null
    private var retryScheduled = false
    private var hasConnected = false
    private var authenticated = false

    fun start() {
        if (credentials.host.isNullOrBlank() || credentials.port == null) {
            onStateChanged(ConnectionState.DISCONNECTED)
            return
        }
        running = true
        enqueue { connect() }
    }

    fun stop() {
        running = false
        enqueue {
            retryTask?.cancel(false)
            retryTask = null
            socket?.close(1000, "App left foreground")
            socket = null
            onStateChanged(ConnectionState.DISCONNECTED)
            executor.shutdown()
            client.dispatcher.cancelAll()
            client.connectionPool.evictAll()
        }
    }

    private fun connect() {
        if (!running) return
        onStateChanged(if (hasConnected) ConnectionState.RECONNECTING else ConnectionState.CONNECTING)
        val request = Request.Builder()
            .url("ws://${credentials.host}:${credentials.port}${CONNECTION_PATH}")
            .build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                enqueue {
                    if (!running) {
                        webSocket.close(1000, "App left foreground")
                        return@enqueue
                    }
                    socket = webSocket
                    authenticated = false
                    if (!webSocket.send(helloMessage(credentials))) {
                        scheduleReconnect(webSocket)
                    }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                enqueue {
                    if (!running || socket !== webSocket) return@enqueue
                    val responseMessage = responseToServerMessage(text, credentials, authenticated)
                    if (responseMessage == null) {
                        webSocket.close(4400, "Invalid protocol message")
                    } else if (responseMessage.isEmpty()) {
                        authenticated = true
                        hasConnected = true
                        backoff.reset()
                        onStateChanged(ConnectionState.CONNECTED)
                    } else if (!webSocket.send(responseMessage)) {
                        scheduleReconnect(webSocket)
                    }
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                enqueue {
                    if (socket !== webSocket) return@enqueue
                    if (code == 4401 || code == 4404 || code == 4406) {
                        running = false
                        socket = null
                        onStateChanged(ConnectionState.AUTHENTICATION_FAILED)
                    } else {
                        scheduleReconnect(webSocket)
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, error: Throwable, response: Response?) {
                enqueue {
                    if (socket === webSocket) scheduleReconnect(webSocket)
                }
            }
        })
    }

    private fun scheduleReconnect(failedSocket: WebSocket) {
        if (!running || socket !== failedSocket || retryScheduled) return
        socket = null
        authenticated = false
        retryScheduled = true
        onStateChanged(ConnectionState.RECONNECTING)
        retryTask = executor.schedule({
            retryScheduled = false
            connect()
        }, backoff.nextDelayMillis(), TimeUnit.MILLISECONDS)
    }

    private fun enqueue(action: () -> Unit) {
        try {
            executor.execute(action)
        } catch (_: RejectedExecutionException) {
            // Callbacks may arrive after the foreground-owned executor has stopped.
        }
    }

    companion object {
        private const val CONNECTION_PATH = "/connect"
    }
}
