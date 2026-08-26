package com.jahirtrap.cconnect.chat

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import kotlinx.browser.window
import org.w3c.dom.events.Event

private fun encodeUri(value: String): String = js("encodeURIComponent(value)")
private fun decodeUri(value: String): String = js("decodeURIComponent(value)")

private fun parseQuery(search: String): Map<String, String> {
    val raw = search.removePrefix("?")
    if (raw.isEmpty()) return emptyMap()
    return raw.split("&").mapNotNull { part ->
        val i = part.indexOf('=')
        if (i < 0) null else decodeUri(part.substring(0, i)) to decodeUri(part.substring(i + 1))
    }.toMap()
}

private fun onChatRoute(): Boolean = when (window.location.pathname) {
    "/settings", "/claude", "/monitor", "/files", "/terminal", "/markdown" -> false
    else -> true
}

actual fun readChatLocation(): ChatLocation? {
    if (!onChatRoute()) return null
    val q = parseQuery(window.location.search)
    val c = q["c"] ?: return null
    val p = q["p"] ?: return null
    val t = q["t"]?.toIntOrNull() ?: 0
    return ChatLocation(t, c, p, q["v"] == "1")
}

actual fun syncChatLocation(tab: Int, sessionId: String?, projectKey: String?, view: Boolean) {
    if (!onChatRoute()) return
    val target = if (sessionId != null && projectKey != null) {
        "/?t=" + tab + "&c=" + encodeUri(sessionId) + "&p=" + encodeUri(projectKey) + if (view) "&v=1" else ""
    } else {
        "/"
    }
    if (target != window.location.pathname + window.location.search) {
        window.history.pushState(null, "", target)
    }
}

@Composable
actual fun ChatPopstate(onLocation: (ChatLocation?) -> Unit) {
    val current by rememberUpdatedState(onLocation)
    DisposableEffect(Unit) {
        val listener: (Event) -> Unit = {
            if (onChatRoute()) current(readChatLocation())
        }
        window.addEventListener("popstate", listener)
        onDispose { window.removeEventListener("popstate", listener) }
    }
}
