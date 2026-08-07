package com.jahirtrap.cconnect.chat

import androidx.compose.animation.core.animateOffsetAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Plus
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.horizontalScrollbar
import androidx.compose.ui.draw.drawWithContent
import com.jahirtrap.cconnect.ui.theme.sessionColorOf
import kotlin.math.abs
import org.jetbrains.compose.resources.stringResource
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.jahirtrap.cconnect.ui.LocalIsTouch
import com.jahirtrap.cconnect.data.ChatListStore
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.toBackendConfig

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TabStrip() {
    val tabs = TabsController.tabs
    val activeId = TabsController.activeId
    val scroll = TabsController.stripScroll
    val density = LocalDensity.current
    val spacingPx = with(density) { 6.dp.toPx() }
    val widths = remember { mutableStateMapOf<String, Float>() }
    val centers = remember { mutableStateMapOf<String, Float>() }
    var draggingId by remember { mutableStateOf<String?>(null) }
    var dragDx by remember { mutableStateOf(0f) }
    var plusLeft by remember { mutableStateOf(0f) }
    val isTouch = LocalIsTouch.current

    fun reorder(id: String) {
        val from = tabs.indexOfFirst { it.id == id }
        if (from !in 0..tabs.lastIndex) return
        if (dragDx > 0f && from < tabs.lastIndex) {
            val w = widths[tabs[from + 1].id] ?: 0f
            if (w > 0f && dragDx > w / 2f + spacingPx) {
                TabsController.moveTab(id, from + 1)
                dragDx -= w + spacingPx
            }
        } else if (dragDx < 0f && from > 0) {
            val w = widths[tabs[from - 1].id] ?: 0f
            if (w > 0f && dragDx < -(w / 2f + spacingPx)) {
                TabsController.moveTab(id, from - 1)
                dragDx += w + spacingPx
            }
        }
    }

    LaunchedEffect(draggingId) {
        val id = draggingId ?: return@LaunchedEffect
        val edge = with(density) { 56.dp.toPx() }
        val step = with(density) { 12.dp.toPx() }
        while (draggingId == id) {
            withFrameNanos { }
            val vp = scroll.viewportSize
            if (vp > 0) {
                val visible = (centers[id] ?: 0f) + dragDx - scroll.value
                val dir = when {
                    visible < edge && scroll.value > 0 -> -1f
                    visible > vp - edge && scroll.value < scroll.maxValue -> 1f
                    else -> 0f
                }
                if (dir != 0f) {
                    val before = scroll.value
                    scroll.scrollBy(dir * step)
                    dragDx += (scroll.value - before)
                    reorder(id)
                }
            }
        }
    }

    LaunchedEffect(activeId, tabs.size, centers[activeId], scroll.viewportSize) {
        if (draggingId != null) return@LaunchedEffect
        val center = centers[activeId] ?: return@LaunchedEffect
        val vp = scroll.viewportSize
        if (vp <= 0) return@LaunchedEffect
        scroll.animateScrollTo((center - vp / 2f).toInt().coerceIn(0, scroll.maxValue))
    }
    val edge = MaterialTheme.colorScheme.outlineVariant
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .drawWithContent {
                drawContent()
                drawLine(
                    edge,
                    androidx.compose.ui.geometry.Offset(0f, size.height),
                    androidx.compose.ui.geometry.Offset(size.width, size.height),
                    1.dp.toPx(),
                )
            }
            .statusBarsPadding()
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.End))
            .horizontalScrollbar(scroll, touchIndicator = false, wheelScroll = true)
            .horizontalScroll(scroll)
            .padding(horizontal = 4.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        tabs.forEach { tab ->
            key(tab.id) {
                val dragging = tab.id == draggingId
                TabChip(
                    modifier = Modifier
                        .onGloballyPositioned { coords ->
                            widths[tab.id] = coords.size.width.toFloat()
                            centers[tab.id] = coords.positionInParent().x + coords.size.width / 2f
                        }
                        .zIndex(if (dragging) 1f else 0f)
                        .graphicsLayer { translationX = if (dragging) dragDx else 0f }
                        .pointerInput(tab.id, isTouch) {
                            if (isTouch) {
                                val onStart: (Offset) -> Unit = {
                                    draggingId = tab.id
                                    dragDx = 0f
                                }
                                val onMove: (PointerInputChange, Offset) -> Unit = { ch, amt ->
                                    ch.consume()
                                    dragDx += amt.x
                                    reorder(tab.id)
                                }
                                val onEnd = {
                                    draggingId = null
                                    dragDx = 0f
                                }
                                val onCancel = {
                                    draggingId = null
                                    dragDx = 0f
                                }
                                detectDragGesturesAfterLongPress(onDragStart = onStart, onDrag = onMove, onDragEnd = onEnd, onDragCancel = onCancel)
                            } else {
                                val threshold = 8.dp.toPx()
                                awaitEachGesture {
                                    val down = awaitFirstDown(requireUnconsumed = false)
                                    var started = false
                                    var clickedUp = false
                                    while (true) {
                                        val event = awaitPointerEvent()
                                        val change = event.changes.firstOrNull { it.id == down.id }
                                        if (change == null) break
                                        if (!change.pressed) {
                                            clickedUp = !change.isConsumed
                                            break
                                        }
                                        if (!started) {
                                            val dx = change.position.x - down.position.x
                                            val dy = change.position.y - down.position.y
                                            if (abs(dx) > threshold && abs(dx) >= abs(dy)) {
                                                started = true
                                                draggingId = tab.id
                                                dragDx = 0f
                                            }
                                        }
                                        if (started) {
                                            dragDx += change.positionChange().x
                                            change.consume()
                                            reorder(tab.id)
                                        }
                                    }
                                    if (started) {
                                        draggingId = null
                                        dragDx = 0f
                                    } else if (clickedUp) {
                                        TabsController.selectTab(tab.id)
                                    }
                                }
                            }
                        },
                    label = tab.title ?: stringResource(Res.string.new_chat),
                    dot = sessionColorOf(tab.color),
                    active = tab.id == activeId,
                    showClose = true,
                    onClick = { TabsController.selectTab(tab.id) },
                    onClose = { TabsController.closeTab(tab.id) },
                )
            }
        }
        Box(
            modifier = Modifier
                .onGloballyPositioned { plusLeft = it.positionInParent().x }
                .graphicsLayer {
                    val d = draggingId
                    translationX = if (d != null && plusLeft > 0f) {
                        val right = (centers[d] ?: 0f) + (widths[d] ?: 0f) / 2f + dragDx
                        (right + spacingPx - plusLeft).coerceAtLeast(0f)
                    } else 0f
                },
        ) {
            TooltipIconButton(label = stringResource(Res.string.new_tab), size = 32.dp, onClick = { TabsController.newTab() }) {
                Icon(Lucide.Plus, contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
fun TabTitleSync() {
    val settings = remember { Settings() }
    val envIds = TabsController.tabs.map { it.ctx.environmentId }.distinct()
    envIds.forEach { envId ->
        key(envId ?: "__default__") {
            val env = settings.environments.firstOrNull { it.id == envId } ?: settings.activeEnvironment
            val backend = ChatListStore.forConfig(env?.toBackendConfig() ?: Backend.snapshot())
            if (backend != null) {
                val sessions by backend.sessions.collectAsState()
                LaunchedEffect(sessions) { TabsController.applyLiveSessions(sessions) }
            }
        }
    }
}

@Composable
private fun TabChip(
    modifier: Modifier = Modifier,
    label: String,
    dot: Color?,
    active: Boolean,
    showClose: Boolean,
    onClick: () -> Unit,
    onClose: () -> Unit,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (active) MaterialTheme.colorScheme.surfaceVariant else Color.Transparent)
            .clickable(onClick = onClick)
            .pointerHoverIcon(PointerIcon.Hand)
            .heightIn(min = 32.dp)
            .padding(start = 10.dp, end = if (showClose) 4.dp else 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(dot ?: MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)))
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = if (active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.widthIn(max = 170.dp),
        )
        if (showClose) {
            Box(
                modifier = Modifier.size(20.dp).clip(CircleShape).clickable(onClick = onClose).pointerHoverIcon(PointerIcon.Hand),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Lucide.X,
                    contentDescription = stringResource(Res.string.close_tab),
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun TabSwitcher() {
    var open by remember { mutableStateOf(false) }
    val tabs = TabsController.tabs
    TooltipIconButton(label = stringResource(Res.string.tabs), onClick = { open = true }) {
        Box(
            modifier = Modifier
                .size(22.dp)
                .clip(RoundedCornerShape(6.dp))
                .border(1.5.dp, LocalContentColor.current, RoundedCornerShape(6.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text("${tabs.size}", style = MaterialTheme.typography.labelMedium, color = LocalContentColor.current)
        }
    }
    if (open) TabSwitcherSheet(onDismiss = { open = false })
}

@Composable
private fun TabSwitcherSheet(onDismiss: () -> Unit) {
    val tabs = TabsController.tabs
    val activeId = TabsController.activeId
    val isTouch = LocalIsTouch.current
    val centers = remember { mutableStateMapOf<String, Offset>() }
    var draggingId by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }
    var dragTarget by remember { mutableStateOf(-1) }
    val draggingFrom = draggingId?.let { id -> tabs.indexOfFirst { it.id == id } } ?: -1
    var releaseReq by remember { mutableStateOf<Pair<String, Int>?>(null) }
    LaunchedEffect(releaseReq) {
        val req = releaseReq ?: return@LaunchedEffect
        val id = req.first
        val to = req.second
        val from = tabs.indexOfFirst { it.id == id }
        val gridFrom = centers[id]
        val gridTo = tabs.getOrNull(to)?.id?.let { centers[it] }
        if (from in tabs.indices && gridFrom != null && gridTo != null) {
            val start = dragOffset
            val target = gridTo - gridFrom
            var elapsed = 0f
            var last = 0L
            while (elapsed < 140f) {
                withFrameNanos { now ->
                    if (last != 0L) elapsed += (now - last) / 1_000_000f
                    last = now
                }
                val t = (elapsed / 140f).coerceIn(0f, 1f)
                val e = 1f - (1f - t) * (1f - t)
                dragOffset = Offset(start.x + (target.x - start.x) * e, start.y + (target.y - start.y) * e)
            }
        }
        if (from in tabs.indices) TabsController.moveTab(id, to)
        draggingId = null
        dragOffset = Offset.Zero
        dragTarget = -1
        releaseReq = null
    }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
            Column(modifier = Modifier.fillMaxSize().systemBarsPadding()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onDismiss) {
                        Icon(Lucide.X, contentDescription = null, modifier = Modifier.size(24.dp))
                    }
                    Text(
                        stringResource(Res.string.tabs),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.weight(1f).padding(start = 6.dp),
                    )
                    TooltipIconButton(label = stringResource(Res.string.new_tab), onClick = { TabsController.newTab(); onDismiss() }) {
                        Icon(Lucide.Plus, contentDescription = null, modifier = Modifier.size(24.dp))
                    }
                }
                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    tabs.chunked(2).forEach { rowTabs ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            rowTabs.forEach { tab ->
                                val weightMod = Modifier.weight(1f)
                                key(tab.id) {
                                    val i = tabs.indexOfFirst { it.id == tab.id }
                                    val isDragged = tab.id == draggingId
                                    val shiftTo = when {
                                        draggingFrom < 0 || isDragged -> i
                                        dragTarget >= draggingFrom && i > draggingFrom && i <= dragTarget -> i - 1
                                        dragTarget in 0 until draggingFrom && i < draggingFrom && i >= dragTarget -> i + 1
                                        else -> i
                                    }
                                    val shift = if (shiftTo != i && shiftTo in tabs.indices) {
                                        val a = centers[tabs[shiftTo].id]
                                        val b = centers[tab.id]
                                        if (a != null && b != null) a - b else Offset.Zero
                                    } else Offset.Zero
                                    val animShift by animateOffsetAsState(shift, label = "tabShift")
                                    val effShift = if (draggingId != null) animShift else shift
                                    TabCard(
                                        modifier = weightMod
                                            .onGloballyPositioned { c ->
                                                val b = c.boundsInRoot()
                                                centers[tab.id] = Offset(b.left + b.width / 2f, b.top + b.height / 2f)
                                            }
                                            .zIndex(if (isDragged) 1f else 0f)
                                            .graphicsLayer {
                                                if (isDragged) {
                                                    translationX = dragOffset.x
                                                    translationY = dragOffset.y
                                                } else {
                                                    translationX = effShift.x
                                                    translationY = effShift.y
                                                }
                                            }
                                            .pointerInput(tab.id, isTouch) {
                                                val onStart: (Offset) -> Unit = {
                                                    draggingId = tab.id
                                                    dragOffset = Offset.Zero
                                                    dragTarget = tabs.indexOfFirst { it.id == tab.id }
                                                }
                                                val onMove: (PointerInputChange, Offset) -> Unit = { ch, amt ->
                                                    ch.consume()
                                                    dragOffset += amt
                                                    val origin = centers[tab.id]
                                                    if (origin != null) {
                                                        val pos = origin + dragOffset
                                                        var best = -1
                                                        var bestD = Float.MAX_VALUE
                                                        tabs.forEachIndexed { idx, t ->
                                                            val c = centers[t.id]
                                                            if (c != null) {
                                                                val d = (c - pos).getDistanceSquared()
                                                                if (d < bestD) { bestD = d; best = idx }
                                                            }
                                                        }
                                                        if (best >= 0) dragTarget = best
                                                    }
                                                }
                                                val onEnd = {
                                                    val from = tabs.indexOfFirst { it.id == tab.id }
                                                    if (from >= 0 && dragTarget >= 0 && dragTarget != from) {
                                                        releaseReq = tab.id to dragTarget
                                                    } else {
                                                        draggingId = null
                                                        dragOffset = Offset.Zero
                                                        dragTarget = -1
                                                    }
                                                }
                                                val onCancel = {
                                                    draggingId = null
                                                    dragOffset = Offset.Zero
                                                    dragTarget = -1
                                                }
                                                if (isTouch) {
                                                    detectDragGesturesAfterLongPress(onDragStart = onStart, onDrag = onMove, onDragEnd = onEnd, onDragCancel = onCancel)
                                                } else {
                                                    detectDragGestures(onDragStart = onStart, onDrag = onMove, onDragEnd = onEnd, onDragCancel = onCancel)
                                                }
                                            },
                                        label = tab.title ?: stringResource(Res.string.new_chat),
                                        dot = sessionColorOf(tab.color),
                                        active = tab.id == activeId,
                                        onClick = { TabsController.selectTab(tab.id); onDismiss() },
                                        onClose = { TabsController.closeTab(tab.id) },
                                    )
                                }
                            }
                            if (rowTabs.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TabCard(
    modifier: Modifier = Modifier,
    label: String,
    dot: Color?,
    active: Boolean,
    onClick: () -> Unit,
    onClose: () -> Unit,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (active) MaterialTheme.colorScheme.surfaceVariant else Color.Transparent)
            .border(
                if (active) 1.5.dp else 1.dp,
                if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                RoundedCornerShape(8.dp),
            )
            .clickable(onClick = onClick)
            .pointerHoverIcon(PointerIcon.Hand)
            .heightIn(min = 40.dp)
            .padding(start = 10.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(dot ?: MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)))
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = if (active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier = Modifier.size(28.dp).clip(CircleShape).clickable(onClick = onClose).pointerHoverIcon(PointerIcon.Hand),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.X, contentDescription = stringResource(Res.string.close_tab), modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
