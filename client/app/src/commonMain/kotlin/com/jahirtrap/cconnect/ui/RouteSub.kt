package com.jahirtrap.cconnect.ui

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** The segment after the route: a screen that lives inside one, with an entry of its own in the
 *  history. What it means is each screen's business — this only carries it to and from the URL.
 *  Off the web there is no URL, so it is plain state and back is the interceptor's job. */
object RouteSub {

    private val _value = MutableStateFlow(readRouteSub())
    val value: StateFlow<String?> = _value.asStateFlow()

    fun open(sub: String) {
        if (_value.value == sub) return
        _value.value = sub
        pushRouteSub(sub)
    }

    fun close() {
        if (_value.value == null) return
        // On the web the entry is real, so going back is what closes it — and syncs the URL.
        if (!backRouteSub()) _value.value = null
    }

    /** Re-reads the URL after the history moved on its own. */
    fun sync() {
        _value.value = readRouteSub()
    }

    fun clear() {
        _value.value = null
    }
}

expect fun readRouteSub(): String?

expect fun pushRouteSub(sub: String)

/** True when the platform owns the history and has just gone back. */
expect fun backRouteSub(): Boolean
