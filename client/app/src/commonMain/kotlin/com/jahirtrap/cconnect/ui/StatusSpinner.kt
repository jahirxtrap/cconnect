package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.withInfiniteAnimationFrameMillis
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.sqrt

private const val MORPH_MS = 650f
private const val ROTATION_MS = 4666f
private const val QUARTER = 90f
private const val DAMPING = 0.6f
private const val STIFFNESS = 200f
private const val FULL_TURN = 360f

private val Natural = sqrt(STIFFNESS)
private val Damped = Natural * sqrt(1f - DAMPING * DAMPING)
private val Decay = DAMPING * Natural

private fun spring(millis: Float): Float {
    val t = millis / 1000f
    val envelope = exp(-Decay * t)
    return 1f - envelope * (cos(Damped * t) + (Decay / Damped) * sin(Damped * t))
}

private class Morph(val path: Path, val extent: Float)

private fun morphPath(index: Int, progress: Float): Morph {
    val (start, end) = MORPHS[index % MORPHS.size]
    val points = FloatArray(start.size)
    var minX = Float.MAX_VALUE
    var maxX = -Float.MAX_VALUE
    var minY = Float.MAX_VALUE
    var maxY = -Float.MAX_VALUE
    var i = 0
    while (i < start.size) {
        val x = start[i] + (end[i] - start[i]) * progress
        val y = start[i + 1] + (end[i + 1] - start[i + 1]) * progress
        points[i] = x
        points[i + 1] = y
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        i += 2
    }
    val centerX = (minX + maxX) / 2f
    val centerY = (minY + maxY) / 2f
    val path = Path()
    path.moveTo(points[0] - centerX, points[1] - centerY)
    var cubic = 0
    while (cubic < points.size) {
        path.cubicTo(
            points[cubic + 2] - centerX, points[cubic + 3] - centerY,
            points[cubic + 4] - centerX, points[cubic + 5] - centerY,
            points[cubic + 6] - centerX, points[cubic + 7] - centerY,
        )
        cubic += 8
    }
    path.close()
    return Morph(path, maxOf(maxX - minX, maxY - minY))
}

@Composable
fun StatusSpinner(size: Dp = 8.dp, color: Color = MaterialTheme.colorScheme.primary) {
    val elapsed by produceState(0f) {
        val origin = withInfiniteAnimationFrameMillis { it }
        while (true) {
            withInfiniteAnimationFrameMillis { value = (it - origin).toFloat() }
        }
    }
    val step = (elapsed / MORPH_MS).toInt()
    val progress = spring(elapsed % MORPH_MS)
    val angle = (elapsed / ROTATION_MS) * FULL_TURN + (step + progress) * QUARTER
    val morph = morphPath(step, progress)
    Canvas(modifier = Modifier.size(size)) {
        translate(this.size.width / 2f, this.size.height / 2f) {
            rotate(angle, Offset.Zero) {
                scale(this.size.minDimension / morph.extent, Offset.Zero) {
                    drawPath(morph.path, color)
                }
            }
        }
    }
}
