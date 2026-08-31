package com.jahirtrap.cconnect.data

import kotlin.math.round

fun formatTokens(n: Int): String {
    if (n < 1_000) return "$n"
    val thousands = round(n / 1_000.0).toInt()
    if (thousands < 1_000) return "${thousands}K"
    val millions = round(n / 100_000.0) / 10
    return if (millions % 1.0 == 0.0) "${millions.toInt()}M" else "${millions}M"
}
