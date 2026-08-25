package com.jahirtrap.cconnect.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember

val LocalRefreshTick = compositionLocalOf { 0 }

@Composable
fun refreshRequests(): Int {
    val tick = LocalRefreshTick.current
    val mounted = remember { tick }
    return tick - mounted
}
