package com.jahirtrap.cconnect.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember

val LocalRefreshTick = compositionLocalOf { 0 }

// The tick is global and keeps its count across screens, so reading it raw made a screen refresh
// itself on open once the button had been pressed anywhere. This only counts presses since mount.
@Composable
fun refreshRequests(): Int {
    val tick = LocalRefreshTick.current
    val mounted = remember { tick }
    return tick - mounted
}
