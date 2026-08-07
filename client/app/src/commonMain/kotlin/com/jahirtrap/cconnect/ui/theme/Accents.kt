package com.jahirtrap.cconnect.ui.theme

import androidx.compose.ui.graphics.Color

// Material 500 palette.
val ACCENTS: List<Pair<String, Color>> = listOf(
    "Red" to Color(0xFFF44336),
    "Pink" to Color(0xFFE91E63),
    "Purple" to Color(0xFF9C27B0),
    "Deep Purple" to Color(0xFF673AB7),
    "Indigo" to Color(0xFF3F51B5),
    "Blue" to Color(0xFF2196F3),
    "Light Blue" to Color(0xFF03A9F4),
    "Cyan" to Color(0xFF00BCD4),
    "Teal" to Color(0xFF009688),
    "Green" to Color(0xFF4CAF50),
    "Light Green" to Color(0xFF8BC34A),
    "Lime" to Color(0xFFCDDC39),
    "Yellow" to Color(0xFFFFEB3B),
    "Amber" to Color(0xFFFFC107),
    "Orange" to Color(0xFFFF9800),
    "Deep Orange" to Color(0xFFFF5722),
    "Brown" to Color(0xFF795548),
    "Grey" to Color(0xFF9E9E9E),
    "Blue Grey" to Color(0xFF607D8B),
)

// Stored instead of a palette index when the accent should follow the system colour.
const val DYNAMIC_ACCENT = -1

fun accentAt(index: Int): Color = ACCENTS.getOrElse(index) { ACCENTS[4] }.second
fun accentNameAt(index: Int): String? = ACCENTS.getOrNull(index)?.first
