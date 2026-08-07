package com.jahirtrap.cconnect.terminal

import androidx.compose.foundation.background
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.jahirtrap.cconnect.ui.LocalIsTouch
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.ChevronDown
import com.composables.icons.lucide.ChevronLeft
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.ChevronUp
import com.composables.icons.lucide.Eraser
import com.composables.icons.lucide.Keyboard
import com.composables.icons.lucide.LogOut
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Pause
import com.composables.icons.lucide.Square
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.data.SshProfile
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.StatusSpinner
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.theme.palette

@OptIn(ExperimentalMaterial3Api::class)
@Composable
actual fun TerminalSession(
    profile: SshProfile,
    onClose: () -> Unit,
    onOsDetected: (String) -> Unit,
) {
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val connection = remember { SshConnection(profile, scope, onOsDetected) }
    val state by connection.state.collectAsState(initial = SshConnection.State.Idle)

    val emulator: TerminalEmulator = remember {
        lateinit var em: TerminalEmulator
        em = TerminalEmulatorFactory.create(
            initialRows = 24,
            initialCols = 80,
            defaultForeground = Color.White,
            defaultBackground = Color.Black,
            onKeyboardInput = { bytes -> connection.send(bytes) },
            onResize = { dims -> connection.resize(dims.columns, dims.rows) },
        )
        em
    }

    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    DisposableEffect(Unit) { onDispose { connection.close() } }

    LaunchedEffect(Unit) { connection.connect() }

    LaunchedEffect(emulator) {
        connection.output.collect { chunk -> emulator.writeInput(chunk) }
    }

    Scaffold(
        topBar = {
            val sshLeading: (@Composable () -> Unit)? = when (state) {
                SshConnection.State.Idle, SshConnection.State.Connecting -> ({ StatusSpinner() })
                SshConnection.State.Connected -> ({ StatusDot(palette.green, box = 8.dp) })
                else -> ({ StatusDot(palette.red, box = 8.dp) })
            }
            AppTopBar(
                title = profile.name.ifBlank { profile.host },
                subtitle = statusLabel(state),
                subtitleLeading = sshLeading,
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    TooltipIconButton(
                        label = stringResource(Res.string.ssh_disconnect),
                        onClick = { connection.close(); onClose() },
                    ) { Icon(Lucide.X, contentDescription = null) }
                },
            )
        },
    ) { pad ->
        val touch = LocalIsTouch.current
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(pad)
                .consumeWindowInsets(pad),
        ) {
            Terminal(
                terminalEmulator = emulator,
                modifier = Modifier.weight(1f).fillMaxWidth().background(Color.Black),
                backgroundColor = Color.Black,
                foregroundColor = Color.White,
                selectionBackgroundColor = MaterialTheme.colorScheme.primary,
                selectionForegroundColor = MaterialTheme.colorScheme.onPrimary,
                keyboardEnabled = true,
                showSoftKeyboard = true,
                focusRequester = focusRequester,
            )
            SoftKeyRow(
                onKey = { connection.send(it); runCatching { focusRequester.requestFocus() } },
                onShowKeyboard = { runCatching { focusRequester.requestFocus() }; keyboard?.show() },
                showKeyboard = touch,
                modifier = Modifier.imePadding(),
            )
        }
    }
}

@Composable
private fun statusLabel(state: SshConnection.State): String = when (state) {
    SshConnection.State.Idle, SshConnection.State.Connecting -> stringResource(Res.string.ssh_connecting)
    SshConnection.State.Connected -> stringResource(Res.string.ssh_connected)
    SshConnection.State.Closed -> stringResource(Res.string.ssh_closed)
    is SshConnection.State.Failed -> stringResource(Res.string.connection_error)
}

@Composable
private fun SoftKeyRow(
    onKey: (ByteArray) -> Unit,
    onShowKeyboard: () -> Unit,
    showKeyboard: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        LazyRow(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // ESC = 0x1B; arrows = ESC + "[A/B/C/D"; Ctrl+letter = letter - 64.
            val keys = listOf(
                SoftKey.Lbl("Esc", byteArrayOf(0x1B)),
                SoftKey.Lbl("Tab", byteArrayOf(0x09)),
                SoftKey.Ico(Lucide.ChevronUp, "↑", byteArrayOf(0x1B, 0x5B, 0x41)),
                SoftKey.Ico(Lucide.ChevronDown, "↓", byteArrayOf(0x1B, 0x5B, 0x42)),
                SoftKey.Ico(Lucide.ChevronLeft, "←", byteArrayOf(0x1B, 0x5B, 0x44)),
                SoftKey.Ico(Lucide.ChevronRight, "→", byteArrayOf(0x1B, 0x5B, 0x43)),
                SoftKey.Ico(Lucide.Square, "Ctrl+C", byteArrayOf(0x03)),
                SoftKey.Ico(Lucide.LogOut, "Ctrl+D", byteArrayOf(0x04)),
                SoftKey.Ico(Lucide.Eraser, "Ctrl+L", byteArrayOf(0x0C)),
                SoftKey.Ico(Lucide.Pause, "Ctrl+Z", byteArrayOf(0x1A)),
                SoftKey.Lbl("Home", byteArrayOf(0x1B, 0x5B, 0x48)),
                SoftKey.Lbl("End", byteArrayOf(0x1B, 0x5B, 0x46)),
            )
            items(keys) { key ->
                SoftBtn(onClick = { onKey(key.bytes) }) {
                    when (key) {
                        is SoftKey.Lbl -> Text(key.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface)
                        is SoftKey.Ico -> Icon(key.icon, contentDescription = key.desc, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurface)
                    }
                }
            }
        }
        if (showKeyboard) {
            Box(
                modifier = Modifier
                    .size(width = 40.dp, height = 32.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .clickable(onClick = onShowKeyboard),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Lucide.Keyboard,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

private sealed class SoftKey(val bytes: ByteArray) {
    class Lbl(val label: String, bytes: ByteArray) : SoftKey(bytes)
    class Ico(val icon: androidx.compose.ui.graphics.vector.ImageVector, val desc: String, bytes: ByteArray) : SoftKey(bytes)
}

@Composable
private fun SoftBtn(onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .height(32.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}
