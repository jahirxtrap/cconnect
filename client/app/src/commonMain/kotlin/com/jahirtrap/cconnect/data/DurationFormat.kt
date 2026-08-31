package com.jahirtrap.cconnect.data

import kotlin.math.roundToInt
import kotlin.math.roundToLong

fun formatDuration(millis: Long): String {
    if (millis < 1_000) return "$millis ms"
    if (millis < 60_000) {
        val seconds = (millis / 100.0).roundToLong() / 10.0
        return if (seconds % 1.0 == 0.0) "${seconds.toInt()} s" else "$seconds s"
    }
    val minutes = millis / 60_000
    val seconds = ((millis % 60_000) / 1000.0).roundToInt()
    return if (seconds > 0) "$minutes min $seconds s" else "$minutes min"
}
