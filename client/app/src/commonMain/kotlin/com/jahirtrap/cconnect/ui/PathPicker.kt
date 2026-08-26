package com.jahirtrap.cconnect.ui

import com.jahirtrap.cconnect.isAndroidPlatform
import com.jahirtrap.cconnect.isWebPlatform
import com.jahirtrap.cconnect.service.pickDirectory
import com.jahirtrap.cconnect.service.pickExecutable

sealed interface PathChoice {
    data class Chosen(val path: String) : PathChoice
    data object Cancelled : PathChoice
    data object Fallback : PathChoice
}

fun pickPath(files: Boolean): PathChoice {
    if (isWebPlatform || isAndroidPlatform) return PathChoice.Fallback
    val chosen = if (files) pickExecutable() else pickDirectory()
    return if (chosen != null) PathChoice.Chosen(chosen) else PathChoice.Cancelled
}
