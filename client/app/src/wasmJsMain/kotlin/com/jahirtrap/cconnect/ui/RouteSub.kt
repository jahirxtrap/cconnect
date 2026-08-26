package com.jahirtrap.cconnect.ui

import kotlinx.browser.window

private val ROUTES = listOf("/settings", "/claude", "/monitor", "/files", "/terminal", "/markdown")

private fun encodeUri(value: String): String = js("encodeURIComponent(value)")
private fun decodeUri(value: String): String = js("decodeURIComponent(value)")

/** The route a path belongs to, whether or not it carries a segment after it. */
fun routeBaseOf(path: String): String =
    ROUTES.firstOrNull { path == it || path.startsWith("$it/") } ?: "/"

actual fun readRouteSub(): String? {
    val path = window.location.pathname
    val base = ROUTES.firstOrNull { path.startsWith("$it/") } ?: return null
    return decodeUri(path.substring(base.length + 1)).ifEmpty { null }
}

actual fun pushRouteSub(sub: String) {
    val base = routeBaseOf(window.location.pathname)
    if (base == "/") return
    window.history.pushState(null, "", "$base/" + encodeUri(sub))
}

actual fun backRouteSub(): Boolean {
    if (readRouteSub() == null) return false
    window.history.back()
    return true
}
