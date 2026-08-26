package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.ui.theme.Radius

private val MARGIN = 4.dp
private val WIDTH = 2.dp
private const val FILL_ALPHA = 0.12f
private const val BORDER_ALPHA = 0.85f
private const val ENTER_MS = 90

@Composable
fun Modifier.dropOverlay(visible: Boolean, color: Color): Modifier {
    val progress by animateFloatAsState(if (visible) 1f else 0f, tween(ENTER_MS))
    if (progress <= 0f) return this
    val density = LocalDensity.current
    val margin = with(density) { MARGIN.toPx() }
    val width = with(density) { WIDTH.toPx() }
    val radius = with(density) { Radius.lg.toPx() }
    return drawWithContent {
        drawContent()
        val area = Size(size.width - margin * 2, size.height - margin * 2)
        if (area.width <= 0f || area.height <= 0f) return@drawWithContent
        drawRoundRect(
            color = color.copy(alpha = FILL_ALPHA * progress),
            topLeft = Offset(margin, margin),
            size = area,
            cornerRadius = CornerRadius(radius),
        )
        val half = width / 2
        drawRoundRect(
            color = color.copy(alpha = BORDER_ALPHA * progress),
            topLeft = Offset(margin + half, margin + half),
            size = Size(area.width - width, area.height - width),
            cornerRadius = CornerRadius(radius - half),
            style = Stroke(width = width),
        )
    }
}
