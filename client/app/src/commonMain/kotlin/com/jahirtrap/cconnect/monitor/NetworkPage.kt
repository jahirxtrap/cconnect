package com.jahirtrap.cconnect.monitor

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.ArrowDownUp
import com.composables.icons.lucide.Cable
import com.composables.icons.lucide.Gauge
import com.composables.icons.lucide.Globe
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Wifi
import com.jahirtrap.cconnect.data.formatDecimal
import com.jahirtrap.cconnect.data.remote.NetworkApi
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.settings.PreferenceRow
import com.jahirtrap.cconnect.settings.SettingsGroup
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.ui.CompactSwitch
import com.jahirtrap.cconnect.ui.RenameDialog
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.theme.palette
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource

internal fun formatBitrate(bitsPerSecond: Double): String = when {
    bitsPerSecond >= 1_000_000_000 -> "${formatDecimal(bitsPerSecond / 1_000_000_000, 2)} Gb/s"
    bitsPerSecond >= 1_000_000 -> "${formatDecimal(bitsPerSecond / 1_000_000, 1)} Mb/s"
    bitsPerSecond >= 1_000 -> "${formatDecimal(bitsPerSecond / 1_000, 0)} kb/s"
    else -> "${formatDecimal(bitsPerSecond, 0)} b/s"
}

private fun formatMillis(value: Double?): String = value?.let { "${formatDecimal(it, 1)} ms" } ?: "—"

@Composable
internal fun NetworkPage(status: NetworkApi.Status, rxBytes: Double, txBytes: Double, onReload: () -> Unit) {
    val scope = rememberCoroutineScope()
    var networks by remember { mutableStateOf<List<NetworkApi.WifiNetwork>>(emptyList()) }
    var scanning by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var passwordFor by remember { mutableStateOf<String?>(null) }
    var sudoPrompt by remember { mutableStateOf(false) }
    var testing by remember { mutableStateOf(false) }
    var testStage by remember { mutableStateOf("") }
    var testProgress by remember { mutableStateOf(0f) }
    var result by remember { mutableStateOf<NetworkApi.SpeedtestResult?>(null) }

    val blockedLabel = stringResource(Res.string.network_action_blocked)
    val rolledBackLabel = stringResource(Res.string.network_rolled_back)
    val failedLabel = stringResource(Res.string.network_action_failed)

    suspend fun track(job: NetworkApi.Job?) {
        if (job == null) {
            notice = failedLabel
            return
        }
        if (job.status == "blocked") {
            notice = blockedLabel
            return
        }
        notice = null
        repeat(30) {
            delay(2000)
            val current = runCatching { NetworkApi.job(job.id) }.getOrNull() ?: return@repeat
            when (current.status) {
                "ok" -> { onReload(); return }
                "rolled_back" -> { notice = rolledBackLabel; onReload(); return }
                "failed" -> { notice = current.message ?: failedLabel; onReload(); return }
            }
        }
        onReload()
    }

    fun refreshScan() {
        scope.launch {
            scanning = true
            networks = runCatching { NetworkApi.scan() }.getOrDefault(emptyList())
            scanning = false
        }
    }

    LaunchedEffect(Unit) { refreshScan() }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
    ) {
        SettingsGroup(
            label = stringResource(Res.string.network_state),
            labelTrailing = {
                StatusDot(
                    color = when (status.connectivity) {
                        "full" -> palette.green
                        "portal", "limited" -> palette.orange
                        else -> palette.red
                    },
                    box = 20.dp,
                    dot = 12.dp,
                )
            },
        ) {
            PreferenceRow(
                icon = Lucide.Globe,
                title = stringResource(
                    when (status.connectivity) {
                        "full" -> Res.string.network_online
                        "portal" -> Res.string.network_portal
                        "limited" -> Res.string.network_limited
                        else -> Res.string.network_offline
                    }
                ),
                summary = status.interfaces.firstOrNull { it.internet }?.network ?: status.wifiSsid,
            )
            PreferenceRow(
                icon = Lucide.ArrowDownUp,
                title = stringResource(Res.string.network_traffic),
                summary = "↓ ${formatBitrate(rxBytes * 8)}   ↑ ${formatBitrate(txBytes * 8)}",
            )
        }

        notice?.let { message ->
            Text(
                message,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }

        SettingsGroup(label = stringResource(Res.string.network_interfaces)) {
            status.interfaces.filter { it.kind != "other" || it.up }.forEach { item ->
                val controllable = status.wiredControl && item.kind == "wired"
                fun toggleInterface() {
                    busy = item.name
                    scope.launch {
                        track(runCatching { NetworkApi.setInterface(item.name, !item.up) }.getOrNull())
                        busy = null
                    }
                }
                PreferenceRow(
                    icon = if (item.kind == "wifi") Lucide.Wifi else Lucide.Cable,
                    title = item.name,
                    summary = listOfNotNull(item.network, item.linkSpeed).joinToString(" • ").ifBlank { null },
                    trailing = {
                        when {
                            busy == item.name -> LoadingIndicator(modifier = Modifier.size(20.dp))
                            controllable -> CompactSwitch(item.up) { toggleInterface() }
                            else -> StatusDot(
                                color = if (item.internet) palette.green else if (item.up) palette.orange else MaterialTheme.colorScheme.outlineVariant,
                                box = 20.dp,
                                dot = 12.dp,
                            )
                        }
                    },
                    onClick = if (controllable && busy == null) ({ toggleInterface() }) else null,
                )
            }
        }

        SettingsGroup(
            label = stringResource(Res.string.network_wifi),
            labelTrailing = { if (scanning) LoadingIndicator(modifier = Modifier.size(20.dp)) },
        ) {
            status.wifiRadio?.let { radioOn ->
                fun toggleRadio() {
                    busy = "radio"
                    scope.launch {
                        track(runCatching { NetworkApi.setRadio(!radioOn) }.getOrNull())
                        busy = null
                    }
                }
                PreferenceRow(
                    icon = Lucide.Wifi,
                    title = stringResource(Res.string.network_wifi_radio),
                    summary = null,
                    trailing = {
                        if (busy == "radio") LoadingIndicator(modifier = Modifier.size(20.dp))
                        else CompactSwitch(radioOn) { toggleRadio() }
                    },
                    onClick = if (busy == null) ({ toggleRadio() }) else null,
                )
            }
            if (networks.isEmpty()) {
                PreferenceRow(
                    icon = Lucide.Wifi,
                    title = stringResource(Res.string.network_no_networks),
                    summary = null,
                    enabled = false,
                )
            } else {
                networks.sortedByDescending { it.signal ?: 0 }.forEach { network ->
                    PreferenceRow(
                        icon = Lucide.Wifi,
                        title = network.ssid,
                        summary = listOfNotNull(
                            network.signal?.let { stringResource(Res.string.network_signal, "$it%") },
                            network.security?.ifBlank { null },
                        ).joinToString(" • ").ifBlank { null },
                        trailing = {
                            when {
                                busy == network.ssid -> LoadingIndicator(modifier = Modifier.size(20.dp))
                                network.active -> StatusDot(palette.green, box = 20.dp, dot = 12.dp)
                                else -> Unit
                            }
                        },
                        onClick = if (network.active) null else ({
                            if (network.known) {
                                busy = network.ssid
                                scope.launch {
                                    track(runCatching { NetworkApi.connect(network.ssid, null) }.getOrNull())
                                    busy = null
                                }
                            } else {
                                passwordFor = network.ssid
                            }
                        }),
                    )
                }
            }
            ActionButton(
                text = stringResource(Res.string.refresh),
                enabled = !scanning,
                onClick = { refreshScan() },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }

        SettingsGroup(label = stringResource(Res.string.network_speed_test)) {
            if (!status.speedtest) {
                PreferenceRow(
                    icon = Lucide.Gauge,
                    title = stringResource(Res.string.network_speedtest_missing),
                    summary = null,
                    enabled = false,
                )
            } else {
                result?.let { done ->
                    PreferenceRow(Lucide.ArrowDownUp, stringResource(Res.string.network_download), done.download?.let { formatBitrate(it) } ?: "—")
                    PreferenceRow(Lucide.ArrowDownUp, stringResource(Res.string.network_upload), done.upload?.let { formatBitrate(it) } ?: "—")
                    PreferenceRow(
                        Lucide.Gauge,
                        stringResource(Res.string.network_ping),
                        "${formatMillis(done.ping)} • ${stringResource(Res.string.network_jitter)} ${formatMillis(done.jitter)}",
                    )
                    done.server?.let { PreferenceRow(Lucide.Globe, it, done.isp) }
                }
                if (testing) {
                    val stageLabel = when (testStage) {
                        "download" -> stringResource(Res.string.network_download)
                        "upload" -> stringResource(Res.string.network_upload)
                        "ping" -> stringResource(Res.string.network_ping)
                        else -> stringResource(Res.string.network_testing)
                    }
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(stageLabel, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                            Text(
                                "${formatDecimal((testProgress * 100f).toDouble(), 0)}%",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { testProgress },
                            drawStopIndicator = {},
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                } else {
                    ActionButton(
                        text = stringResource(Res.string.network_run_test),
                        onClick = {
                            testing = true
                            result = null
                            testProgress = 0f
                            testStage = ""
                            scope.launch {
                                runCatching {
                                    NetworkApi.speedtest().collect { event ->
                                        when (event) {
                                            is NetworkApi.SpeedtestEvent.Progress -> {
                                                testStage = event.stage
                                                testProgress = event.progress.coerceIn(0f, 1f)
                                            }
                                            is NetworkApi.SpeedtestEvent.Done -> { result = event.result; testing = false }
                                            is NetworkApi.SpeedtestEvent.Failed -> { notice = event.message; testing = false }
                                        }
                                    }
                                }.onFailure { notice = it.message ?: failedLabel }
                                testing = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    )
                }
            }
        }

        if (status.needsPassword) {
            SettingsGroup(label = stringResource(Res.string.network_permissions)) {
                PreferenceRow(
                    icon = Lucide.Cable,
                    title = stringResource(Res.string.network_grant),
                    summary = stringResource(Res.string.network_permissions_hint),
                    onClick = { sudoPrompt = true },
                )
            }
        }

        Spacer(Modifier.height(16.dp))
    }

    passwordFor?.let { ssid ->
        RenameDialog(
            initial = "",
            title = ssid,
            confirmLabel = stringResource(Res.string.network_connect),
            secret = true,
            onConfirm = { password ->
                passwordFor = null
                busy = ssid
                scope.launch {
                    track(runCatching { NetworkApi.connect(ssid, password) }.getOrNull())
                    busy = null
                }
            },
            onDismiss = { passwordFor = null },
        )
    }

    if (sudoPrompt) {
        RenameDialog(
            initial = "",
            title = stringResource(Res.string.network_permissions),
            confirmLabel = stringResource(Res.string.network_grant),
            secret = true,
            onConfirm = { password ->
                sudoPrompt = false
                scope.launch {
                    runCatching { NetworkApi.authorize(password) }
                    onReload()
                }
            },
            onDismiss = { sudoPrompt = false },
        )
    }
}
