package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.offset
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun Modifier.horizontalScrollIndicator(state: ScrollState, thickness: Dp = 2.dp): Modifier {
    val color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f)
    return drawWithContent {
        drawContent()
        if (state.maxValue <= 0) return@drawWithContent
        val viewport = size.width
        val total = viewport + state.maxValue
        val thumbW = (viewport / total) * viewport
        val thumbX = (state.value.toFloat() / state.maxValue) * (viewport - thumbW)
        val px = thickness.toPx()
        drawRoundRect(
            color = color,
            topLeft = Offset(thumbX, size.height - px),
            size = Size(thumbW, px),
            cornerRadius = CornerRadius(px / 2, px / 2),
        )
    }
}

@Composable
fun Modifier.verticalScrollIndicator(state: ScrollState, thickness: Dp = 2.dp): Modifier {
    val color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f)
    return drawWithContent {
        drawContent()
        if (state.maxValue <= 0) return@drawWithContent
        val viewport = size.height
        val total = viewport + state.maxValue
        val thumbH = (viewport / total) * viewport
        val thumbY = (state.value.toFloat() / state.maxValue) * (viewport - thumbH)
        val px = thickness.toPx()
        drawRoundRect(
            color = color,
            topLeft = Offset(size.width - px, thumbY),
            size = Size(px, thumbH),
            cornerRadius = CornerRadius(px / 2, px / 2),
        )
    }
}

private val SCROLLBAR_HIT = 16.dp
private val SCROLLBAR_GAP = 2.dp

@Composable
fun Modifier.horizontalScrollbar(state: ScrollState, thickness: Dp = 4.dp, touchIndicator: Boolean = true, wheelScroll: Boolean = false): Modifier {
    val active = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f)
    val idle = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f)
    val scope = rememberCoroutineScope()
    var hovered by remember { mutableStateOf(false) }
    var dragging by remember { mutableStateOf(false) }
    val touch = LocalIsTouch.current
    val wheelTarget = remember { mutableStateOf<Float?>(null) }
    val wheelJob = remember { mutableStateOf<Job?>(null) }
    return this
        .then(if (wheelScroll) Modifier.pointerInput(state) {
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent()
                    if (event.type == PointerEventType.Scroll && state.maxValue > 0) {
                        val d = event.changes.firstOrNull()?.scrollDelta ?: Offset.Zero
                        if (abs(d.y) >= abs(d.x) && d.y != 0f) {
                            val base = wheelTarget.value ?: state.value.toFloat()
                            val tgt = (base + d.y * 64f).coerceIn(0f, state.maxValue.toFloat())
                            wheelTarget.value = tgt
                            wheelJob.value?.cancel()
                            wheelJob.value = scope.launch {
                                state.animateScrollTo(tgt.roundToInt(), tween(durationMillis = 150, easing = FastOutSlowInEasing))
                                wheelTarget.value = null
                            }
                            event.changes.forEach { it.consume() }
                        }
                    }
                }
            }
        } else Modifier)
        .pointerInput(state) {
            val hit = SCROLLBAR_HIT.toPx()
            awaitEachGesture {
                val down = awaitFirstDown(pass = PointerEventPass.Initial)
                if (state.maxValue <= 0 || down.type == PointerType.Touch || down.position.y < size.height - hit) return@awaitEachGesture
                val viewport = size.width.toFloat()
                val thumb = (viewport / (viewport + state.maxValue)) * viewport
                val track = (viewport - thumb).coerceAtLeast(1f)
                val thumbX = (state.value.toFloat() / state.maxValue) * track
                val grab = if (down.position.x in thumbX..(thumbX + thumb)) down.position.x - thumbX else thumb / 2f
                fun scrollFor(x: Float) {
                    val left = (x - grab).coerceIn(0f, track)
                    scope.launch { state.scrollTo(((left / track) * state.maxValue).roundToInt()) }
                }
                down.consume()
                dragging = true
                scrollFor(down.position.x)
                drag(down.id) { change ->
                    scrollFor(change.position.x)
                    change.consume()
                }
                dragging = false
            }
        }
        .pointerInput(Unit) {
            val hit = SCROLLBAR_HIT.toPx()
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    val change = event.changes.firstOrNull()
                    hovered = event.type != PointerEventType.Exit && change != null &&
                        change.type == PointerType.Mouse && state.maxValue > 0 &&
                        change.position.y >= size.height - hit
                }
            }
        }
        .then(if (hovered) Modifier.handCursor(overrideDescendants = false) else Modifier)
        .drawWithContent {
            drawContent()
            if (state.maxValue <= 0) return@drawWithContent
            if (touch && !touchIndicator) return@drawWithContent
            val viewport = size.width
            val thumb = (viewport / (viewport + state.maxValue)) * viewport
            val x = (state.value.toFloat() / state.maxValue) * (viewport - thumb)
            val px = (if (touch) 2.dp else thickness).toPx()
            drawRoundRect(
                color = if (!touch && (hovered || dragging)) active else idle,
                topLeft = Offset(x, size.height - px),
                size = Size(thumb, px),
                cornerRadius = CornerRadius(px / 2, px / 2),
            )
        }
        .layout { measurable, constraints ->
            val gutter = if (touch || measurable.maxIntrinsicWidth(constraints.maxHeight) <= constraints.maxWidth) 0
            else (thickness + SCROLLBAR_GAP).roundToPx()
            val placeable = measurable.measure(constraints.offset(vertical = -gutter))
            layout(placeable.width, placeable.height + gutter) { placeable.place(0, 0) }
        }
}

@Composable
fun Modifier.verticalScrollbar(state: ScrollState, thickness: Dp = 6.dp): Modifier {
    val active = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f)
    val idle = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f)
    val scope = rememberCoroutineScope()
    var hovered by remember { mutableStateOf(false) }
    var dragging by remember { mutableStateOf(false) }
    val touch = LocalIsTouch.current
    return this
        .pointerInput(state) {
            val hit = SCROLLBAR_HIT.toPx()
            awaitEachGesture {
                val down = awaitFirstDown(pass = PointerEventPass.Initial)
                if (state.maxValue <= 0 || down.type == PointerType.Touch || down.position.x < size.width - hit) return@awaitEachGesture
                val viewport = size.height.toFloat()
                val thumb = (viewport / (viewport + state.maxValue)) * viewport
                val track = (viewport - thumb).coerceAtLeast(1f)
                val thumbY = (state.value.toFloat() / state.maxValue) * track
                val grab = if (down.position.y in thumbY..(thumbY + thumb)) down.position.y - thumbY else thumb / 2f
                fun scrollFor(y: Float) {
                    val top = (y - grab).coerceIn(0f, track)
                    scope.launch { state.scrollTo(((top / track) * state.maxValue).roundToInt()) }
                }
                down.consume()
                dragging = true
                scrollFor(down.position.y)
                drag(down.id) { change ->
                    scrollFor(change.position.y)
                    change.consume()
                }
                dragging = false
            }
        }
        .pointerInput(Unit) {
            val hit = SCROLLBAR_HIT.toPx()
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    val change = event.changes.firstOrNull()
                    hovered = event.type != PointerEventType.Exit && change != null &&
                        change.type == PointerType.Mouse && state.maxValue > 0 &&
                        change.position.x >= size.width - hit
                }
            }
        }
        .then(if (hovered) Modifier.handCursor(overrideDescendants = false) else Modifier)
        .drawWithContent {
            drawContent()
            if (state.maxValue <= 0) return@drawWithContent
            val viewport = size.height
            val thumb = (viewport / (viewport + state.maxValue)) * viewport
            val y = (state.value.toFloat() / state.maxValue) * (viewport - thumb)
            val px = (if (touch) 2.dp else thickness).toPx()
            drawRoundRect(
                color = if (!touch && (hovered || dragging)) active else idle,
                topLeft = Offset(size.width - px, y),
                size = Size(px, thumb),
                cornerRadius = CornerRadius(px / 2, px / 2),
            )
        }
}
