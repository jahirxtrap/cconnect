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

private data class Block(val categoryId: String, val top: Float, val bottom: Float)

private data class CategoryDrop(val beforeId: String?, val blockIndex: Int, val y: Float)

private const val EDGE = 48f
private const val EDGE_STEP = 12f

class CategoryDrag {
    var categoryId by mutableStateOf<String?>(null)
        private set
    var offset by mutableStateOf(0f)
        private set

    private var blocks by mutableStateOf<List<Block>>(emptyList())
    private var from by mutableStateOf(-1)
    private var to by mutableStateOf(-1)
    private var height by mutableStateOf(0f)
    private var before: String? = null
    private var pointer = 0f
    private var grab = 0f

    val active: Boolean get() = categoryId != null

    fun start(categoryId: String, pointer: Float) {
        this.categoryId = categoryId
        this.pointer = pointer
        offset = 0f
        height = 0f
        grab = 0f
        from = -1
        to = -1
        before = null
    }

    fun drag(delta: Float) {
        pointer += delta
    }

    fun tick(state: LazyListState, rows: List<DragRow>): Float {
        if (!active) return 0f
        measure(state, rows)
        val block = blocks.getOrNull(from) ?: return 0f
        if (height == 0f) {
            height = block.bottom - block.top
            grab = pointer - block.top
        }
        follow(state, block)
        aim(block)
        val info = state.layoutInfo
        val above = pointer - info.viewportStartOffset
        val below = info.viewportEndOffset - pointer
        return when {
            above < EDGE -> -EDGE_STEP
            below < EDGE -> EDGE_STEP
            else -> 0f
        }
    }

    private fun measure(state: LazyListState, rows: List<DragRow>) {
        val byKey = rows.associateBy { it.key }
        val found = mutableListOf<Block>()
        var current: Block? = null
        for (item in state.layoutInfo.visibleItemsInfo) {
            val row = byKey[item.key] ?: continue
            val top = item.offset.toFloat()
            val bottom = (item.offset + item.size).toFloat()
            if (row.header) {
                current = Block(row.categoryId.orEmpty(), top, bottom)
                found += current
                continue
            }
            val open = current
            current = if (open != null && row.categoryId == open.categoryId) {
                found[found.lastIndex] = open.copy(bottom = bottom)
                found.last()
            } else {
                null
            }
        }
        blocks = found
        from = found.indexOfFirst { it.categoryId == categoryId }
    }

    private fun follow(state: LazyListState, block: Block) {
        val info = state.layoutInfo
        val first = blocks.firstOrNull() ?: return
        val last = blocks.lastOrNull() ?: return
        val atStart = info.visibleItemsInfo.firstOrNull()?.index == 0
        val atEnd = info.visibleItemsInfo.lastOrNull()?.index == info.totalItemsCount - 1
        val ceiling = if (atStart) first.top else info.viewportStartOffset.toFloat()
        val floor = if (atEnd) last.bottom else info.viewportEndOffset.toFloat()
        val wanted = pointer - grab - block.top
        offset = max(ceiling - block.top, min(wanted, floor - block.bottom))
    }

    private fun aim(block: Block) {
        val top = block.top + offset
        val drops = blocks.mapIndexed { at, item -> CategoryDrop(item.categoryId, at, item.top) } +
            listOfNotNull(blocks.lastOrNull()?.let { CategoryDrop(null, blocks.size, it.bottom) })
        var drop: CategoryDrop? = null
        var nearest = Float.POSITIVE_INFINITY
        for (candidate in drops) {
            val y = if (candidate.blockIndex > from) candidate.y - height else candidate.y
            val distance = abs(y - top)
            if (distance < nearest) {
                nearest = distance
                drop = candidate
            }
        }
        val landing = drop ?: return
        to = landing.blockIndex
        before = landing.beforeId
    }

    fun shiftFor(categoryId: String?): Float {
        if (!active || categoryId == null || to < 0) return 0f
        val at = blocks.indexOfFirst { it.categoryId == categoryId }
        if (at < 0 || at == from) return 0f
        if (at > from && at < to) return -height
        if (at >= to && at < from) return height
        return 0f
    }

    fun dragging(categoryId: String?): Boolean = active && categoryId != null && categoryId == this.categoryId

    fun finish(): Pair<String, String?>? {
        val moved = categoryId
        val beforeId = before
        cancel()
        if (moved == null || beforeId == moved) return null
        return moved to beforeId
    }

    fun cancel() {
        categoryId = null
        offset = 0f
        height = 0f
        grab = 0f
        from = -1
        to = -1
        before = null
        blocks = emptyList()
    }
}

@Composable
fun Modifier.dragCategory(
    drag: CategoryDrag,
    categoryId: String,
    listState: LazyListState,
    touch: Boolean,
    onCommit: (String, String?) -> Unit,
): Modifier {
    val onDrop by rememberUpdatedState(onCommit)
    return pointerInput(categoryId, touch) {
        fun begin(position: Offset) {
            val item = listState.layoutInfo.visibleItemsInfo.firstOrNull { it.key == "cat-$categoryId" }
            drag.start(categoryId, (item?.offset?.toFloat() ?: 0f) + position.y)
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
