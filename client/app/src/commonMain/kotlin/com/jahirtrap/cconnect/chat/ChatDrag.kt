package com.jahirtrap.cconnect.chat

import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class DropTarget(val categoryId: String?, val index: Int?)

data class DragRow(
    val key: Any,
    val categoryId: String?,
    val index: Int,
    val header: Boolean,
    val spacer: Boolean = false,
    val collapsed: Boolean = false,
)

private data class Slot(val row: DragRow, val top: Float, val bottom: Float)

private data class Drop(
    val categoryId: String?,
    val index: Int,
    val slotIndex: Int,
    val y: Float,
)

data class DragTick(val scroll: Float = 0f, val springOver: String? = null)

const val SPRING_OPEN_MS = 800L

private const val EDGE = 48f
private const val EDGE_STEP = 12f

class ChatDrag {
    var sessionId by mutableStateOf<String?>(null)
        private set
    var offset by mutableStateOf(0f)
        private set
    var target by mutableStateOf<DropTarget?>(null)
        private set

    private var slots by mutableStateOf<List<Slot>>(emptyList())
    private var from by mutableStateOf(-1)
    private var to by mutableStateOf(-1)
    private var gap by mutableStateOf(false)
    private var height by mutableStateOf(0f)

    private var origin: DropTarget? = null
    private var manual = false
    private var pointer = 0f
    private var grab = 0f

    val active: Boolean get() = sessionId != null

    fun start(sessionId: String, origin: DropTarget, pointer: Float, manual: Boolean) {
        this.sessionId = sessionId
        this.origin = origin
        this.pointer = pointer
        this.manual = manual
        offset = 0f
        target = origin
        grab = 0f
        height = 0f
        from = -1
        to = -1
        gap = false
    }

    fun drag(delta: Float) {
        pointer += delta
    }

    fun tick(state: LazyListState, rows: List<DragRow>): DragTick {
        if (!active) return DragTick()
        measure(state, rows)
        val row = slots.getOrNull(from) ?: return DragTick()
        if (height == 0f) {
            height = row.bottom - row.top
            grab = pointer - row.top
        }
        follow(state, row)
        val folded = aim(row)
        return DragTick(scrollStep(state), folded)
    }

    private fun measure(state: LazyListState, rows: List<DragRow>) {
        val byKey = rows.associateBy { it.key }
        slots = state.layoutInfo.visibleItemsInfo.mapNotNull { item ->
            val row = byKey[item.key] ?: return@mapNotNull null
            Slot(row, item.offset.toFloat(), (item.offset + item.size).toFloat())
        }
        from = slots.indexOfFirst { it.row.key == sessionId }
    }

    private fun follow(state: LazyListState, row: Slot) {
        val info = state.layoutInfo
        val first = slots.firstOrNull() ?: return
        val last = slots.lastOrNull() ?: return
        val atStart = info.visibleItemsInfo.firstOrNull()?.index == 0
        val atEnd = info.visibleItemsInfo.lastOrNull()?.index == info.totalItemsCount - 1
        val ceiling = if (atStart) first.top else info.viewportStartOffset.toFloat()
        val floor = if (atEnd) last.bottom else info.viewportEndOffset.toFloat()
        val wanted = pointer - grab - row.top
        offset = max(ceiling - row.top, min(wanted, floor - row.bottom))
    }

    private fun aim(row: Slot): String? {
        val top = row.top + offset
        var drop: Drop? = null
        var nearest = Float.POSITIVE_INFINITY
        for (candidate in drops()) {
            val y = if (candidate.slotIndex > from) candidate.y - height else candidate.y
            val distance = abs(y - top)
            if (distance < nearest) {
                nearest = distance
                drop = candidate
            }
        }
        val landing = drop ?: return null
        to = landing.slotIndex
        gap = true
        target = DropTarget(landing.categoryId, if (manual) landing.index else null)
        val header = slots.getOrNull(landing.slotIndex - 1)?.row
        return if (header != null && header.header && header.collapsed && header.categoryId == landing.categoryId) {
            header.categoryId
        } else null
    }

    private fun drops(): List<Drop> {
        val drops = mutableListOf<Drop>()
        var siblings = 0
        slots.forEachIndexed { at, slot ->
            if (slot.row.spacer) return@forEachIndexed
            val next = slots.getOrNull(at + 1)
            val ends = next == null || next.row.header || next.row.spacer || next.row.categoryId != slot.row.categoryId
            if (slot.row.header) {
                siblings = 0
                if (ends) drops += Drop(slot.row.categoryId, 0, at + 1, slot.bottom)
                return@forEachIndexed
            }
            drops += Drop(slot.row.categoryId, siblings, at, slot.top)
            if (slot.row.key != sessionId) siblings++
            if (ends) drops += Drop(slot.row.categoryId, siblings, at + 1, slot.bottom)
        }
        return drops
    }

    private fun scrollStep(state: LazyListState): Float {
        val info = state.layoutInfo
        val above = pointer - info.viewportStartOffset
        val below = info.viewportEndOffset - pointer
        return when {
            above < EDGE -> -EDGE_STEP
            below < EDGE -> EDGE_STEP
            else -> 0f
        }
    }

    fun shiftFor(key: Any): Float {
        if (!active || !gap || to < 0) return 0f
        val at = slots.indexOfFirst { it.row.key == key }
        if (at < 0 || at == from) return 0f
        if (at > from && at < to) return -height
        if (at >= to && at < from) return height
        return 0f
    }

    fun highlights(categoryId: String?): Boolean = active && target?.categoryId == categoryId

    fun finish(): Pair<String, DropTarget>? {
        val sessionId = sessionId
        val target = target
        val origin = origin
        cancel()
        if (sessionId == null || target == null) return null
        val moved = target.categoryId != origin?.categoryId ||
            (target.index != null && target.index != origin?.index)
        return if (moved) sessionId to target else null
    }

    fun cancel() {
        sessionId = null
        target = null
        origin = null
        offset = 0f
        height = 0f
        grab = 0f
        from = -1
        to = -1
        gap = false
        slots = emptyList()
    }
}

@Composable
fun Modifier.dragChat(
    drag: ChatDrag,
    sessionId: String,
    origin: DropTarget,
    listState: LazyListState,
    manual: Boolean,
    touch: Boolean,
    onCommit: (String, DropTarget) -> Unit,
): Modifier {
    val onDrop by rememberUpdatedState(onCommit)
    return pointerInput(sessionId, origin, manual, touch) {
        fun begin(position: Offset) {
            val item = listState.layoutInfo.visibleItemsInfo.firstOrNull { it.key == sessionId }
            drag.start(
                sessionId = sessionId,
                origin = origin,
                pointer = (item?.offset?.toFloat() ?: 0f) + position.y,
                manual = manual,
            )
        }

        fun end(commit: Boolean) {
            val move = drag.finish()
            if (commit && move != null) onDrop(move.first, move.second)
        }

        if (touch) {
            detectDragGesturesAfterLongPress(
                onDragStart = { begin(it) },
                onDrag = { change, amount -> change.consume(); drag.drag(amount.y) },
                onDragEnd = { end(commit = true) },
                onDragCancel = { end(commit = false) },
            )
        } else {
            detectDragGestures(
                onDragStart = { begin(it) },
                onDrag = { change, amount -> change.consume(); drag.drag(amount.y) },
                onDragEnd = { end(commit = true) },
                onDragCancel = { end(commit = false) },
            )
        }
    }
}
