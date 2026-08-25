package com.jahirtrap.cconnect.monitor

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.selection.DisableSelection
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import org.jetbrains.compose.resources.pluralStringResource
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontFamily
import com.jahirtrap.cconnect.ui.theme.LocalMonoFontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.ServerCog
import com.composables.icons.lucide.Server
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.chat.ChatViewModel
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.data.SelectionLock
import com.jahirtrap.cconnect.data.remote.NetworkApi
import com.jahirtrap.cconnect.data.remote.SystemApi
import com.jahirtrap.cconnect.files.formatSize
import com.jahirtrap.cconnect.terminal.colorForOs
import com.jahirtrap.cconnect.terminal.iconForOs
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.EnvironmentSelectDialog
import com.jahirtrap.cconnect.ui.handCursor
import com.jahirtrap.cconnect.settings.SettingsGroup
import com.jahirtrap.cconnect.ui.MetricBar
import com.jahirtrap.cconnect.ui.MetricHeader
import androidx.compose.foundation.BorderStroke
import com.jahirtrap.cconnect.ui.theme.Radius
import com.jahirtrap.cconnect.ui.theme.snapDp
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.theme.palette
import com.jahirtrap.cconnect.ui.verticalScrollIndicator
import kotlin.math.abs
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val RECONNECT_MS = 3000L
private const val LOG_CAP = 300
private const val HISTORY_CAP = 90

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonitorScreen(onClose: () -> Unit) {
    val vm: ChatViewModel = viewModel(factory = LocalChatViewModelFactory.current)
    val state by vm.state.collectAsState()
    var info by remember { mutableStateOf<SystemApi.SystemInfo?>(null) }
    var gpu by remember { mutableStateOf<SystemApi.GpuInfo?>(null) }
    var failed by remember { mutableStateOf(false) }
    var cpuHistory by remember { mutableStateOf<List<Float>>(emptyList()) }
    var gpuHistory by remember { mutableStateOf<List<Float>>(emptyList()) }
    var memHistory by remember { mutableStateOf<List<Float>>(emptyList()) }
    var vramHistory by remember { mutableStateOf<List<Float>>(emptyList()) }
    var logs by remember { mutableStateOf<List<LogItem>>(emptyList()) }
    var followLogs by remember { mutableStateOf(true) }
    var envMenu by remember { mutableStateOf(false) }
    val environmentLocked by SelectionLock.environment.collectAsState()
    var confirmingRestart by remember { mutableStateOf(false) }
    var netStatus by remember { mutableStateOf<NetworkApi.Status?>(null) }
    var netReload by remember { mutableStateOf(0) }
    LaunchedEffect(netReload) { netStatus = runCatching { NetworkApi.status() }.getOrNull() }
    val scope = rememberCoroutineScope()
    val logScroll = rememberScrollState()
    val activeName = state.environments.firstOrNull { it.id == state.activeEnvironmentId }?.name

    LaunchedEffect(state.activeEnvironmentId) {
        info = null
        gpu = null
        failed = false
        cpuHistory = emptyList()
        gpuHistory = emptyList()
        memHistory = emptyList()
        vramHistory = emptyList()
        logs = emptyList()
        followLogs = true
        var nextId = 0L
        while (isActive) {
            runCatching {
                SystemApi.stream().collect { event ->
                    failed = false
                    when (event) {
                        is SystemApi.Event.Info -> {
                            val snapshot = event.info
                            info = snapshot
                            cpuHistory = (cpuHistory + snapshot.cpuPercent).takeLast(HISTORY_CAP)
                            memHistory = (memHistory + snapshot.memoryPercent).takeLast(HISTORY_CAP)
                            snapshot.gpu?.let {
                                gpu = it
                                gpuHistory = (gpuHistory + it.percent).takeLast(HISTORY_CAP)
                                vramHistory = (vramHistory + it.memPercent).takeLast(HISTORY_CAP)
                            }
                        }

                        is SystemApi.Event.Logs -> {
                            followLogs = logScroll.value >= logScroll.maxValue - 24
                            logs = (logs + event.items.map { LogItem(nextId++, it) }).takeLast(LOG_CAP)
                        }
                    }
                }
            }
            failed = true
            delay(RECONNECT_MS)
        }
    }

    LaunchedEffect(Unit) {
        snapshotFlow { logScroll.maxValue }.collectLatest { max ->
            if (followLogs && max > 0) logScroll.animateScrollTo(max)
        }
    }


    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(Res.string.monitor),
                subtitle = if (failed) stringResource(Res.string.server_unavailable) else activeName,
                subtitleLeading = if (failed) ({ StatusDot(palette.red, box = 8.dp) }) else null,
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    TooltipIconButton(
                        label = stringResource(Res.string.restart_server),
                        onClick = { confirmingRestart = true },
                        enabled = !failed && info != null,
                    ) { Icon(Lucide.ServerCog, contentDescription = null) }
                    TooltipIconButton(
                        label = stringResource(Res.string.environment),
                        onClick = { envMenu = true },
                        enabled = !environmentLocked,
                    ) { Icon(Lucide.Server, contentDescription = null) }
                },
            )
        },
    ) { padding ->
        if (envMenu) {
            EnvironmentSelectDialog(
                environments = state.environments,
                activeId = state.activeEnvironmentId,
                onSelect = { if (it != state.activeEnvironmentId) vm.selectEnvironment(it) },
                onDismiss = { envMenu = false },
            )
        }
        if (confirmingRestart) {
            ConfirmDialog(
                title = stringResource(Res.string.restart_server),
                text = stringResource(Res.string.restart_server_confirm),
                confirmLabel = stringResource(Res.string.confirm),
                onConfirm = {
                    confirmingRestart = false
                    scope.launch { SystemApi.restart() }
                },
                onDismiss = { confirmingRestart = false },
            )
        }
        val current = info
        when {
            current == null && failed -> EmptyState(stringResource(Res.string.connection_error), Modifier.fillMaxSize().padding(padding))
            current == null -> CenteredProgress(Modifier.fillMaxSize().padding(padding))
            else -> Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                val hasNetwork = netStatus?.supported == true
                val pagerState = rememberPagerState(pageCount = { if (hasNetwork) 3 else 2 })
                val labels = listOfNotNull(
                    stringResource(Res.string.resources),
                    if (hasNetwork) stringResource(Res.string.network) else null,
                    stringResource(Res.string.server_logs),
                )
                val segmentBorder = snapDp(2.dp)
                SingleChoiceSegmentedButtonRow(
                    space = segmentBorder,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                ) {
                    labels.forEachIndexed { i, label ->
                        SegmentedButton(
                            selected = i == pagerState.currentPage,
                            onClick = {
                                scope.launch {
                                    if (abs(i - pagerState.currentPage) > 1) pagerState.scrollToPage(i)
                                    else pagerState.animateScrollToPage(i)
                                }
                            },
                            shape = SegmentedButtonDefaults.itemShape(
                                index = i,
                                count = labels.size,
                                baseShape = RoundedCornerShape(Radius.sm),
                            ),
                            modifier = Modifier.handCursor(),
                            icon = {},
                            border = BorderStroke(segmentBorder, MaterialTheme.colorScheme.outlineVariant),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            colors = SegmentedButtonDefaults.colors(
                                activeContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.18f),
                                activeContentColor = MaterialTheme.colorScheme.primary,
                                activeBorderColor = MaterialTheme.colorScheme.outlineVariant,
                                inactiveContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                inactiveBorderColor = MaterialTheme.colorScheme.outlineVariant,
                            ),
                        ) {
                            Text(
                                label,
                                style = MaterialTheme.typography.labelLarge,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
                HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                    when {
                        page == 0 -> ResourcesPage(current, gpu, cpuHistory, gpuHistory, memHistory, vramHistory)
                        hasNetwork && page == 1 -> netStatus?.let {
                            NetworkPage(it, current.netRx, current.netTx, onReload = { netReload++ })
                        }
                        else -> LogsPage(logs, logScroll)
                    }
                }
            }
        }
    }
}

@Composable
private fun ResourcesPage(
    current: SystemApi.SystemInfo,
    gpu: SystemApi.GpuInfo?,
    cpuHistory: List<Float>,
    gpuHistory: List<Float>,
    memHistory: List<Float>,
    vramHistory: List<Float>,
) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
            GraphMetric(
                title = "CPU",
                subtitle = pluralStringResource(Res.plurals.cores_count, current.cpuCores, current.cpuCores),
                percent = current.cpuPercent,
                history = cpuHistory,
                modifier = Modifier.weight(1f),
            )
            if (gpu != null) {
                Spacer(Modifier.width(12.dp))
                GraphMetric(
                    title = "GPU",
                    subtitle = listOfNotNull(
                        gpu.name.removePrefix("NVIDIA GeForce ").ifBlank { null },
                        gpu.temp?.let { "$it°C" },
                    ).joinToString(" • "),
                    percent = gpu.percent,
                    history = gpuHistory,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        GraphMetric(
            title = stringResource(Res.string.memory),
            subtitle = "${formatSize(current.memoryUsed)} / ${formatSize(current.memoryTotal)}",
            percent = current.memoryPercent,
            history = memHistory,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )
        if (gpu != null) {
            GraphMetric(
                title = "VRAM",
                subtitle = "${formatSize(gpu.memUsed)} / ${formatSize(gpu.memTotal)}",
                percent = gpu.memPercent,
                history = vramHistory,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
        current.battery?.let { battery ->
            MetricBar(
                title = stringResource(Res.string.battery),
                subtitle = if (battery.plugged) stringResource(Res.string.battery_plugged)
                else battery.secsLeft?.let { stringResource(Res.string.battery_remaining, formatUptime(it.toDouble())) }
                    ?: stringResource(Res.string.battery_on_battery),
                percent = battery.percent,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                color = if (battery.percent < 20f && !battery.plugged) palette.red else MaterialTheme.colorScheme.primary,
            )
        }
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            SettingsGroup(stringResource(Res.string.storage)) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    current.disks.forEach { disk ->
                        MetricBar(
                            title = disk.mount,
                            subtitle = "${formatSize(disk.used)} / ${formatSize(disk.total)}",
                            percent = disk.percent,
                        )
                    }
                }
            }
        }
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            SettingsGroup(stringResource(Res.string.information)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        iconForOs(current.osId),
                        contentDescription = null,
                        tint = colorForOs(current.osId) ?: MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.size(34.dp),
                    )
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(current.os, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            "${current.hostname} • ${formatUptime(current.uptime)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                current.cpuName?.let { InfoRow("CPU", it) }
                gpu?.let { InfoRow("GPU", it.name) }
                InfoRow(stringResource(Res.string.memory), formatSize(current.memoryTotal))
                gpu?.let { InfoRow("VRAM", formatSize(it.memTotal)) }
                if (current.arch.isNotBlank()) InfoRow(stringResource(Res.string.architecture), current.arch)
            }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun LogsPage(logs: List<LogItem>, scroll: ScrollState) {
    LaunchedEffect(Unit) {
        snapshotFlow { scroll.maxValue }.first { it > 0 }.let { scroll.scrollTo(it) }
    }
    SelectionContainer(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp)
                .clip(RoundedCornerShape(Radius.md))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .verticalScrollIndicator(scroll)
                .verticalScroll(scroll)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            if (logs.isEmpty()) {
                DisableSelection {
                    Text(
                        stringResource(Res.string.no_logs),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            logs.forEach { item -> LogRow(item) }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(12.dp))
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun GraphMetric(title: String, subtitle: String, percent: Float, history: List<Float>, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        MetricBar(title, subtitle, percent)
        Spacer(Modifier.height(8.dp))
        Sparkline(
            points = history,
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .clip(RoundedCornerShape(Radius.panel))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        )
    }
}

@Composable
private fun Sparkline(points: List<Float>, modifier: Modifier = Modifier) {
    val lineColor = MaterialTheme.colorScheme.primary
    val fillColor = lineColor.copy(alpha = 0.15f)
    Canvas(modifier) {
        if (points.size < 2) return@Canvas
        val stepX = size.width / (HISTORY_CAP - 1)
        val startX = size.width - (points.size - 1) * stepX
        val inset = 2.dp.toPx()
        val span = size.height - inset * 2
        fun yOf(value: Float) = inset + span * (1f - (value / 100f).coerceIn(0f, 1f))
        val line = Path()
        points.forEachIndexed { index, value ->
            val x = startX + index * stepX
            if (index == 0) line.moveTo(x, yOf(value)) else line.lineTo(x, yOf(value))
        }
        val fill = Path().apply {
            addPath(line)
            lineTo(size.width, size.height)
            lineTo(startX, size.height)
            close()
        }
        drawPath(fill, fillColor)
        drawPath(line, lineColor, style = Stroke(width = 1.dp.toPx()))
    }
}

private data class LogItem(val id: Long, val entry: SystemApi.LogEntry)

@Composable
private fun LogRow(item: LogItem) {
    val entry = item.entry
    val time = remember(item.id) {
        com.jahirtrap.cconnect.data.formatClock((entry.ts * 1000).toLong())
    }
    val color = when (entry.level) {
        "ERROR", "CRITICAL" -> palette.red
        "WARNING" -> palette.yellow
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(
            time,
            style = MaterialTheme.typography.bodySmall,
            fontFamily = LocalMonoFontFamily.current,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            entry.message,
            style = MaterialTheme.typography.bodySmall,
            fontFamily = LocalMonoFontFamily.current,
            color = color,
        )
    }
}

private fun formatUptime(seconds: Double): String {
    val total = seconds.toLong()
    val days = total / 86_400
    val hours = (total % 86_400) / 3_600
    val minutes = (total % 3_600) / 60
    return when {
        days > 0 -> "${days}d ${hours}h"
        hours > 0 -> "${hours}h ${minutes}m"
        else -> "${minutes}m"
    }
}
