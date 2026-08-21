package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Indication
import androidx.compose.foundation.clickable as foundationClickable
import androidx.compose.foundation.combinedClickable as foundationCombinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextLayoutResult

internal fun Modifier.handCursor(enabled: Boolean = true, overrideDescendants: Boolean = true): Modifier =
    if (enabled) this.pointerHoverIcon(PointerIcon.Hand, overrideDescendants = overrideDescendants) else this

internal fun Modifier.actionCursor(enabled: Boolean): Modifier =
    pointerHoverIcon(if (enabled) PointerIcon.Hand else PointerIcon.Default, overrideDescendants = true)

fun Modifier.textHoverCursor(
    layout: () -> TextLayoutResult?,
    isLink: ((Int) -> Boolean)? = null,
): Modifier = composed {
    var icon by remember { mutableStateOf(PointerIcon.Default) }
    this
        .pointerInput(Unit) {
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Main)
                    icon = if (event.type == PointerEventType.Exit) {
                        PointerIcon.Default
                    } else {
                        val position = event.changes.lastOrNull()?.position
                        val result = layout()
                        when {
                            position == null || result == null || !isOverGlyph(result, position) -> PointerIcon.Default
                            isLink != null && isLink(result.getOffsetForPosition(position)) -> PointerIcon.Hand
                            else -> PointerIcon.Text
                        }
                    }
                }
            }
        }
        .pointerHoverIcon(icon, overrideDescendants = true)
}

fun Modifier.selectionTextCursor(): Modifier = composed {
    var selecting by remember { mutableStateOf(false) }
    this
        .pointerInput(Unit) {
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    val change = event.changes.firstOrNull()
                    selecting = when {
                        change == null || !change.pressed -> false
                        change.positionChange() != Offset.Zero -> true
                        else -> selecting
                    }
                }
            }
        }
        .then(if (selecting) Modifier.pointerHoverIcon(PointerIcon.Text, overrideDescendants = true) else Modifier)
}

private fun isOverGlyph(layout: TextLayoutResult, position: Offset): Boolean {
    val y = position.y
    if (y < 0f || y > layout.size.height.toFloat()) return false
    val line = layout.getLineForVerticalPosition(y)
    if (y < layout.getLineTop(line) || y > layout.getLineBottom(line)) return false
    val x = position.x
    return x >= layout.getLineLeft(line) && x <= layout.getLineRight(line)
}

fun Modifier.clickable(
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    onClick: () -> Unit,
): Modifier = handCursor(enabled).foundationClickable(
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    onClick = onClick,
)

fun Modifier.clickable(
    interactionSource: MutableInteractionSource?,
    indication: Indication?,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    onClick: () -> Unit,
): Modifier = handCursor(enabled).foundationClickable(
    interactionSource = interactionSource,
    indication = indication,
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    onClick = onClick,
)

@OptIn(ExperimentalFoundationApi::class)
fun Modifier.combinedClickable(
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    onLongClickLabel: String? = null,
    onLongClick: (() -> Unit)? = null,
    onDoubleClick: (() -> Unit)? = null,
    onClick: () -> Unit,
): Modifier = handCursor(enabled).foundationCombinedClickable(
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    onLongClickLabel = onLongClickLabel,
    onLongClick = onLongClick,
    onDoubleClick = onDoubleClick,
    onClick = onClick,
)
