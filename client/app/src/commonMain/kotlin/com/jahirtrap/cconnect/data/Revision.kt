package com.jahirtrap.cconnect.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

open class Revision {

    private val _revision = MutableStateFlow(0L)
    val revision: StateFlow<Long> = _revision.asStateFlow()

    fun bump() {
        _revision.value++
    }
}

object EnvOverrides : Revision()

object ServerDefaults : Revision()

object ChatVisibility : Revision()
