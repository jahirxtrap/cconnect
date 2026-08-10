package com.jahirtrap.cconnect.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object SelectionLock {

    private val _environment = MutableStateFlow(Settings().environmentLocked)
    val environment: StateFlow<Boolean> = _environment.asStateFlow()

    private val _project = MutableStateFlow(Settings().projectLocked)
    val project: StateFlow<Boolean> = _project.asStateFlow()

    fun setEnvironment(locked: Boolean) {
        Settings().environmentLocked = locked
        _environment.value = locked
    }

    fun setProject(locked: Boolean) {
        Settings().projectLocked = locked
        _project.value = locked
    }

    fun reload() {
        val settings = Settings()
        _environment.value = settings.environmentLocked
        _project.value = settings.projectLocked
    }
}
