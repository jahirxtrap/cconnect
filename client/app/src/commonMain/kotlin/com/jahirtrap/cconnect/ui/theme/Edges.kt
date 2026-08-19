package com.jahirtrap.cconnect.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.floor
import kotlin.math.max

fun Density.snapPx(width: Dp): Float = max(1f, floor(width.toPx()))

@Composable
fun snapDp(width: Dp): Dp = with(LocalDensity.current) { snapPx(width).toDp() }

fun DrawScope.bottomEdge(color: Color, width: Dp = 1.dp) {
    val thickness = snapPx(width)
    drawRect(color, topLeft = Offset(0f, size.height - thickness), size = Size(size.width, thickness))
}

fun DrawScope.topEdge(color: Color, width: Dp = 1.dp) {
    drawRect(color, topLeft = Offset.Zero, size = Size(size.width, snapPx(width)))
}

fun DrawScope.endEdge(color: Color, width: Dp = 1.dp) {
    val thickness = snapPx(width)
    drawRect(color, topLeft = Offset(size.width - thickness, 0f), size = Size(thickness, size.height))
}

fun DrawScope.horizontalEdge(color: Color, y: Float, width: Dp = 1.dp) {
    drawRect(color, topLeft = Offset(0f, y), size = Size(size.width, snapPx(width)))
}
