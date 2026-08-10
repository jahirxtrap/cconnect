package com.jahirtrap.cconnect.data.remote

import org.w3c.dom.WebSocket
import org.w3c.dom.MessageEvent
import org.w3c.dom.CloseEvent
import org.w3c.dom.events.Event

actual class WsConnection(private val ws: WebSocket) {
    actual fun send(text: String) {
        if (ws.readyState != WebSocket.OPEN) return
        runCatching { ws.send(text) }
    }
    actual fun cancel() { runCatching { ws.close() } }
    actual fun close(code: Int, reason: String?) { runCatching { ws.close(code.toShort(), reason ?: "") } }
}

actual fun openWebSocket(url: String, headers: List<Pair<String, String>>, listener: WsListener, pingSeconds: Long): WsConnection {
    val token = headers.firstOrNull { it.first == "Authorization" }?.second?.removePrefix("Bearer ")
    val full = if (token != null) url + (if ('?' in url) "&" else "?") + "token=$token" else url
    val ws = WebSocket(full)
    ws.onopen = { _: Event -> listener.onOpen() }
    ws.onmessage = { event: Event -> listener.onMessage(messageText(event as MessageEvent)) }
    ws.onclose = { event: Event -> listener.onClosed((event as? CloseEvent)?.reason?.ifBlank { "closed" } ?: "closed") }
    ws.onerror = { _: Event -> listener.onFailure("connection failed") }
    return WsConnection(ws)
}

private fun messageText(e: MessageEvent): String = js("e.data")
