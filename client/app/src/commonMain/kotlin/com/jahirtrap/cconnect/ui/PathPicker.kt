package com.jahirtrap.cconnect.ui

import com.jahirtrap.cconnect.isAndroidPlatform
import com.jahirtrap.cconnect.isWebPlatform
import com.jahirtrap.cconnect.service.pickDirectory
import com.jahirtrap.cconnect.service.pickExecutable

/** Result of asking for a path: a chosen one, nothing, or "show [PathPickerDialog] instead". */
sealed interface PathChoice {
    data class Chosen(val path: String) : PathChoice
    data object Cancelled : PathChoice
    data object Fallback : PathChoice
}

/**
 * One way in for every path field. Desktop opens the OS dialog; web and Android browse the PC's
 * folders through the backend instead, since neither can hand out a real filesystem path.
 */
fun pickPath(files: Boolean): PathChoice {
    if (isWebPlatform || isAndroidPlatform) return PathChoice.Fallback
    val chosen = if (files) pickExecutable() else pickDirectory()
    return if (chosen != null) PathChoice.Chosen(chosen) else PathChoice.Cancelled
}
