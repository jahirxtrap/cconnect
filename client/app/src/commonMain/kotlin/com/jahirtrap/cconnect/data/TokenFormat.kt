package com.jahirtrap.cconnect.data

import kotlin.math.round

fun formatTokens(n: Int): String = when {
    n >= 1_000_000 -> {
        val millions = round(n / 100_000.0) / 10
        if (millions % 1.0 == 0.0) "${millions.toInt()}M" else "${millions}M"
    }
    n >= 1_000 -> "${round(n / 1_000.0).toInt()}K"
    else -> "$n"
}
