package com.jahirtrap.cconnect.ui

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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
        if (!backRouteSub()) _value.value = null
    }

    fun sync() {
        _value.value = readRouteSub()
    }

    fun clear() {
        _value.value = null
    }
}

expect fun readRouteSub(): String?

expect fun pushRouteSub(sub: String)

expect fun backRouteSub(): Boolean
