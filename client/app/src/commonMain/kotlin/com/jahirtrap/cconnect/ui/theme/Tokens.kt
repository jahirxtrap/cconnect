package com.jahirtrap.cconnect.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

data class SurfaceTokens(
    val background: Color,
    val onBackground: Color,
    val surface: Color,
    val surfaceVariant: Color,
    val onSurfaceVariant: Color,
    val outline: Color,
    val outlineVariant: Color,
    val error: Color,
    val onAccent: Color,
)

val LightTokens = SurfaceTokens(
    background = Color(0xFFFFFFFF),
    onBackground = Color(0xFF0A0A0A),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFF4F4F5),
    onSurfaceVariant = Color(0xFF71717A),
    outline = Color(0xFFD4D4D8),
    outlineVariant = Color(0xFFE4E4E7),
    error = Color(0xFFB3261E),
    onAccent = Color(0xFFFFFFFF),
)

val DarkTokens = SurfaceTokens(
    background = Color(0xFF0A0A0A),
    onBackground = Color(0xFFEDEDED),
    surface = Color(0xFF0F0F0F),
    surfaceVariant = Color(0xFF1A1A1A),
    onSurfaceVariant = Color(0xFFA3A3A3),
    outline = Color(0xFF3F3F46),
    outlineVariant = Color(0xFF262626),
    error = Color(0xFFFFB4AB),
    onAccent = Color(0xFF000000),
)

fun tokensFor(dark: Boolean) = if (dark) DarkTokens else LightTokens

object Radius {
    val xs = 6.dp
    val sm = 6.dp
    val md = 8.dp
    val lg = 12.dp
    val xl = 16.dp
    val item = 8.dp
    val panel = 8.dp
    val group = 12.dp
}
