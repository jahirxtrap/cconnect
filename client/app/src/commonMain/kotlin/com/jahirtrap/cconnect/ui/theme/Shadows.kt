package com.jahirtrap.cconnect.ui.theme

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.dropShadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp

private const val SHADOW_ALPHA = 0.1f

private fun Modifier.layer(shape: Shape, y: Int, blur: Int, spread: Int) = dropShadow(
    shape,
    Shadow(
        radius = blur.dp,
        color = Color.Black,
        spread = spread.dp,
        offset = DpOffset(0.dp, y.dp),
        alpha = SHADOW_ALPHA,
    ),
)

fun Modifier.shadowSm(shape: Shape) = layer(shape, y = 1, blur = 3, spread = 0)
    .layer(shape, y = 1, blur = 2, spread = -1)

fun Modifier.shadowMd(shape: Shape) = layer(shape, y = 4, blur = 6, spread = -1)
    .layer(shape, y = 2, blur = 4, spread = -2)

fun Modifier.shadowLg(shape: Shape) = layer(shape, y = 10, blur = 15, spread = -3)
    .layer(shape, y = 4, blur = 6, spread = -4)

fun Modifier.shadowXl(shape: Shape) = layer(shape, y = 20, blur = 25, spread = -5)
    .layer(shape, y = 8, blur = 10, spread = -6)
