@file:OptIn(kotlin.uuid.ExperimentalUuidApi::class)

package com.jahirtrap.cconnect.settings

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import com.jahirtrap.cconnect.ui.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LoadingIndicator
import com.jahirtrap.cconnect.ui.AppPullToRefresh
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import com.jahirtrap.cconnect.ui.Button
import com.jahirtrap.cconnect.ui.ButtonVariant
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.BatteryCharging
import com.composables.icons.lucide.Bell
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.Coffee
import com.composables.icons.lucide.ExternalLink
import com.composables.icons.lucide.Eye
import com.composables.icons.lucide.X
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import com.composables.icons.lucide.Download
import com.composables.icons.lucide.History
import com.composables.icons.lucide.Upload
import com.composables.icons.lucide.Languages
import com.composables.icons.lucide.Lock
import com.composables.icons.lucide.LockOpen
import com.composables.icons.lucide.Minimize2
import com.composables.icons.lucide.CircleUser
import com.composables.icons.lucide.Clock
import com.composables.icons.lucide.Type
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Palette
import com.composables.icons.lucide.Pencil
import com.composables.icons.lucide.RotateCw
import com.composables.icons.lucide.ScanQrCode
import com.composables.icons.lucide.FileText
import com.composables.icons.lucide.Folder
import com.composables.icons.lucide.Play
import com.composables.icons.lucide.Power
import com.composables.icons.lucide.ServerCog
import androidx.compose.foundation.text.selection.SelectionContainer
import com.jahirtrap.cconnect.ui.theme.LocalMonoFontFamily
import com.composables.icons.lucide.Server
import com.composables.icons.lucide.SquareTerminal
import com.composables.icons.lucide.Shield
import com.composables.icons.lucide.Sparkles
import com.composables.icons.lucide.Terminal
import com.composables.icons.lucide.Trash
import com.composables.icons.lucide.Wand
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.data.Capabilities
import com.jahirtrap.cconnect.data.EnvironmentProfile
import com.jahirtrap.cconnect.data.QrEnvironmentPayload
import com.jahirtrap.cconnect.data.SelectionLock
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.data.SettingsBackup
import com.jahirtrap.cconnect.data.AppUpdater
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.CapabilitiesApi
import com.jahirtrap.cconnect.data.remote.CliApi
import com.jahirtrap.cconnect.data.remote.SettingsApi
import com.jahirtrap.cconnect.data.remote.AppImageLoader
import com.jahirtrap.cconnect.data.remote.GitHubApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jahirtrap.cconnect.chat.ChatViewModel
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.isAndroidPlatform
import com.jahirtrap.cconnect.isWebPlatform
import com.jahirtrap.cconnect.supportsTraySetting
import com.jahirtrap.cconnect.service.LocalServer
import com.jahirtrap.cconnect.service.LocalServerConfig
import com.jahirtrap.cconnect.service.LocalServerError
import com.jahirtrap.cconnect.service.LocalServerInfo
import com.jahirtrap.cconnect.service.LocalServerState
import com.jahirtrap.cconnect.data.remote.SystemApi
import com.jahirtrap.cconnect.service.pickDirectory
import com.jahirtrap.cconnect.service.pickExecutable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.jahirtrap.cconnect.chat.ConnectionState
import com.jahirtrap.cconnect.claude.ClaudeChangelogSheet
import coil3.compose.AsyncImage
import coil3.compose.LocalPlatformContext
import com.jahirtrap.cconnect.BuildConfig
import com.composables.icons.lucide.Github
import com.jahirtrap.cconnect.ui.AppLogo
import com.jahirtrap.cconnect.ui.Claude
import com.jahirtrap.cconnect.ui.CustomIcons
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.ColorSwatch
import com.jahirtrap.cconnect.ui.SwatchGrid
import com.jahirtrap.cconnect.ui.CompactSwitch
import com.jahirtrap.cconnect.ui.CompactDropdownItem
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.ColorDialog
import com.jahirtrap.cconnect.ui.ColorOption
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.ConfirmSelectDialog
import com.jahirtrap.cconnect.ui.DialogItemPaddingH
import com.jahirtrap.cconnect.ui.DialogItemPaddingV
import com.jahirtrap.cconnect.ui.DialogItemShape
import com.jahirtrap.cconnect.ui.DialogSelectItem
import com.jahirtrap.cconnect.ui.SecretTextField
import com.jahirtrap.cconnect.ui.InputField
import com.jahirtrap.cconnect.ui.SelectDialog
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.LocalIsTouch
import com.jahirtrap.cconnect.ui.LocalRefreshTick
import com.jahirtrap.cconnect.ui.MarkdownText
import com.jahirtrap.cconnect.ui.SelectField
import com.jahirtrap.cconnect.ui.languageLabel
import com.jahirtrap.cconnect.ui.themeIcon
import com.jahirtrap.cconnect.ui.themeLabel
import com.jahirtrap.cconnect.ui.LANGUAGE_TAGS
import com.jahirtrap.cconnect.ui.THEME_MODES
import com.jahirtrap.cconnect.ui.theme.ACCENTS
import com.jahirtrap.cconnect.ui.theme.appFontFamily
import com.jahirtrap.cconnect.ui.theme.palette
import com.jahirtrap.cconnect.ui.theme.DYNAMIC_ACCENT
import com.jahirtrap.cconnect.ui.theme.accentAt
import com.jahirtrap.cconnect.ui.theme.accentNameAt
import com.jahirtrap.cconnect.ui.theme.dynamicAccent
import com.jahirtrap.cconnect.ui.theme.systemAccent
import kotlin.uuid.Uuid
import com.jahirtrap.cconnect.ui.theme.snapDp

private const val KOFI_URL = "https://ko-fi.com/jahirtrap"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    themeMode: String,
    onThemeMode: (String) -> Unit,
    dynamicColor: Boolean,
    onDynamicColor: (Boolean) -> Unit,
    accentIndex: Int,
    onAccent: (Int) -> Unit,
    fontStyle: String,
    onFontStyle: (String) -> Unit,
    language: String,
    onLanguage: (String) -> Unit,
    onOpenSshHosts: () -> Unit,
    onClose: () -> Unit,
    highlight: String? = null,
) {
    val settings = remember { Settings() }

    var environments by remember { mutableStateOf(settings.environments) }
    var activeId by remember { mutableStateOf(settings.activeEnvironment?.id) }
    var caps by remember { mutableStateOf(Capabilities()) }
    var account by remember { mutableStateOf(caps.defaults.account) }
    var model by remember { mutableStateOf(caps.defaults.model) }
    var effort by remember { mutableStateOf(caps.defaults.effort) }
    var permissionMode by remember { mutableStateOf(caps.defaults.permissionMode) }
    var streaming by remember { mutableStateOf(true) }
    var todoTools by remember { mutableStateOf(false) }
    var showThinking by remember { mutableStateOf("full") }
    var showToolUse by remember { mutableStateOf("label") }
    var showFileChange by remember { mutableStateOf("full") }
    var showCompact by remember { mutableStateOf("full") }
    var showWorking by remember { mutableStateOf("label") }
    var cliInfo by remember { mutableStateOf<CliApi.CliInfo?>(null) }
    var serverReady by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(Backend.isConfigured) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val chatVm = viewModel<ChatViewModel>(factory = LocalChatViewModelFactory.current)
    val chatState by chatVm.state.collectAsState()

    suspend fun loadServerSettings() {
        if (!Backend.isConfigured) { serverReady = false; loading = false; cliInfo = null; return }
        loading = true
        CapabilitiesApi.capabilities()?.let { caps = it }
        val s = SettingsApi.get()
        if (s != null) {
            model = s.model; effort = s.effort; permissionMode = s.permissionMode; streaming = s.streaming
            todoTools = s.todoTools
            account = s.account.ifEmpty { caps.defaults.account }
            showThinking = s.showThinking; showToolUse = s.showToolUse
            showFileChange = s.showFileChange; showCompact = s.showCompact; showWorking = s.showWorking
        }
        cliInfo = CliApi.status()
        serverReady = s != null
        loading = false
        chatVm.refreshVersionInfo()
    }

    LaunchedEffect(activeId, environments) { loadServerSettings() }
    LaunchedEffect(chatState.connection) {
        when (chatState.connection) {
            ConnectionState.Connected -> loadServerSettings()
            ConnectionState.Disconnected -> serverReady = false
            else -> {}
        }
    }
    val refreshTick = LocalRefreshTick.current
    val isTouch = LocalIsTouch.current
    LaunchedEffect(refreshTick) { if (refreshTick > 0) { refreshing = true; loadServerSettings(); refreshing = false } }

    var dialog by remember { mutableStateOf<SettingsDialog?>(null) }
    var backup by remember { mutableStateOf("") }
    var pendingImport by remember { mutableStateOf("") }
    var importFailed by remember { mutableStateOf(false) }
    var notifyTaskDone by remember { mutableStateOf(settings.notifyTaskDone) }
    var notifyInteraction by remember { mutableStateOf(settings.notifyInteraction) }
    var showTimestamps by remember { mutableStateOf(settings.showTimestamps) }
    var minimizeToTray by remember { mutableStateOf(settings.minimizeToTray) }
    var localServerEnabled by remember { mutableStateOf(settings.localServerEnabled) }
    var notificationsEnabled by remember { mutableStateOf(notificationsEnabled()) }
    var ignoringBattery by remember { mutableStateOf(batteryOptimizationIgnored()) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                notificationsEnabled = notificationsEnabled()
                ignoringBattery = batteryOptimizationIgnored()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val scrollState = rememberScrollState()
    var aboutY by remember { mutableStateOf<Float?>(null) }
    var serverY by remember { mutableStateOf<Float?>(null) }
    val highlightFlash = remember { Animatable(0f) }
    val aboutFlashAlpha = if (highlight == "about") 0.1f * highlightFlash.value else 0f
    val cliFlashAlpha = if (highlight == "cli") 0.1f * highlightFlash.value else 0f
    LaunchedEffect(highlight) {
        val position = when (highlight) {
            "about" -> snapshotFlow { aboutY }
            "cli" -> snapshotFlow { serverY }
            else -> return@LaunchedEffect
        }
        scrollState.animateScrollTo(position.filterNotNull().first().toInt())
        repeat(2) {
            highlightFlash.animateTo(1f, tween(220))
            highlightFlash.animateTo(0f, tween(220))
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(Res.string.settings),
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    if (!isTouch) {
                        TooltipIconButton(
                            label = stringResource(Res.string.refresh),
                            onClick = { scope.launch { refreshing = true; loadServerSettings(); refreshing = false } },
                        ) { Icon(Lucide.RotateCw, contentDescription = null) }
                    }
                },
            )
        },
    ) { padding ->
        AppPullToRefresh(
            isRefreshing = refreshing,
            onRefresh = { scope.launch { refreshing = true; loadServerSettings(); refreshing = false } },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 16.dp),
            ) {
                SettingsGroup(stringResource(Res.string.settings_appearance)) {
                    PreferenceRow(themeIcon(themeMode), stringResource(Res.string.theme), themeLabel(themeMode)) { dialog = SettingsDialog.Theme }
                    PreferenceRow(Lucide.Languages, stringResource(Res.string.language), languageLabel(language)) { dialog = SettingsDialog.Language }
                    PreferenceRow(
                        icon = Lucide.Palette,
                        title = stringResource(Res.string.accent),
                        summary = if (dynamicColor) stringResource(Res.string.accent_dynamic)
                        else accentNameAt(accentIndex),
                        trailing = { AccentDot(if (dynamicColor) MaterialTheme.colorScheme.primary else accentAt(accentIndex)) },
                    ) { dialog = SettingsDialog.Accent }
                    PreferenceRow(
                        icon = Lucide.Type,
                        title = stringResource(Res.string.font),
                        summary = fontLabel(fontStyle),
                        trailing = { FontPreview(fontStyle) },
                    ) { dialog = SettingsDialog.Font }
                    PreferenceRow(
                        icon = Lucide.Clock,
                        title = stringResource(Res.string.show_timestamps),
                        summary = stringResource(Res.string.show_timestamps_summary),
                        trailing = { CompactSwitch(showTimestamps) { showTimestamps = it; settings.showTimestamps = it } },
                        onClick = { showTimestamps = !showTimestamps; settings.showTimestamps = showTimestamps },
                    )
                }
                SettingsGroup(stringResource(Res.string.background_group)) {
                    val activeCount = listOf(notifyInteraction, notifyTaskDone).count { it }
                    PreferenceRow(
                        Lucide.Bell,
                        stringResource(Res.string.notifications),
                        if (notificationsEnabled) stringResource(Res.string.notifications_state, activeCount)
                        else stringResource(Res.string.notifications_disabled),
                    ) { dialog = SettingsDialog.Notifications }
                    if (ignoringBattery != null) {
                        PreferenceRow(
                            Lucide.BatteryCharging,
                            stringResource(Res.string.battery_optimization),
                            stringResource(Res.string.battery_optimization_summary),
                            trailing = { CompactSwitch(ignoringBattery == true) { requestIgnoreBatteryOptimization() } },
                            onClick = { requestIgnoreBatteryOptimization() },
                        )
                    }
                    if (supportsTraySetting) {
                        PreferenceRow(
                            Lucide.Minimize2,
                            stringResource(Res.string.minimize_to_tray),
                            stringResource(Res.string.minimize_to_tray_summary),
                            trailing = { CompactSwitch(minimizeToTray) { minimizeToTray = it; settings.minimizeToTray = it } },
                            onClick = { minimizeToTray = !minimizeToTray; settings.minimizeToTray = minimizeToTray },
                        )
                    }
                }
                SettingsGroup(stringResource(Res.string.settings_connectivity)) {
                    PreferenceRow(
                        Lucide.Server,
                        stringResource(Res.string.environments),
                        environments.firstOrNull { it.id == activeId }?.let { "${it.name} • ${it.address}" }
                            ?: stringResource(Res.string.no_environments),
                    ) { dialog = SettingsDialog.Environments }
                    PreferenceRow(
                        Lucide.SquareTerminal,
                        stringResource(Res.string.ssh_hosts),
                        stringResource(Res.string.ssh_hosts_summary),
                        trailing = {
                            Icon(
                                Lucide.ChevronRight,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                        onClick = onOpenSshHosts,
                    )
                }
                val loadingText = stringResource(Res.string.connecting)
                val offlineText = stringResource(Res.string.server_unavailable)
                fun serverSummary(real: String) = if (serverReady) real else if (loading) loadingText else offlineText
                Box(modifier = Modifier.onGloballyPositioned { serverY = it.positionInParent().y }) {
                SettingsGroup(
                    label = stringResource(Res.string.settings_server),
                    labelTrailing = {
                        when {
                            loading -> LoadingIndicator(modifier = Modifier.size(20.dp))
                            serverReady -> StatusDot(palette.green, box = 20.dp, dot = 12.dp)
                            else -> StatusDot(palette.red, box = 20.dp, dot = 12.dp)
                        }
                    },
                ) {
                    var showCliChangelog by remember { mutableStateOf(false) }
                    if (showCliChangelog) ClaudeChangelogSheet(cliVersion = cliInfo?.activeVersion, onDismiss = { showCliChangelog = false })
                    PreferenceRow(
                        CustomIcons.Claude,
                        stringResource(Res.string.cli),
                        serverSummary(cliInfo?.activeVersion ?: "—"),
                        enabled = serverReady,
                        alert = stringResource(Res.string.compat_cli_outdated).takeIf { chatState.cliOutdated },
                        modifier = Modifier.background(MaterialTheme.colorScheme.onSurface.copy(alpha = cliFlashAlpha)),
                        trailing = {
                            TooltipIconButton(label = stringResource(Res.string.changelog), onClick = { showCliChangelog = true }, enabled = serverReady) {
                                Icon(Lucide.FileText, contentDescription = null)
                            }
                        },
                    ) { dialog = SettingsDialog.Cli }
                    PreferenceRow(Lucide.Sparkles, stringResource(Res.string.generation), serverSummary("${caps.models.firstOrNull { it.id == model }?.label ?: model} • $effort"), enabled = serverReady) { dialog = SettingsDialog.Generation }
                    PreferenceRow(Lucide.Shield, stringResource(Res.string.permissions), serverSummary(permissionLabel(caps, permissionMode)), enabled = serverReady) { dialog = SettingsDialog.Permissions }
                    PreferenceRow(Lucide.Eye, stringResource(Res.string.visibility), serverSummary(stringResource(Res.string.visibility_summary)), enabled = serverReady) { dialog = SettingsDialog.Visibility }
                    if (caps.accounts.size > 1) {
                        PreferenceRow(
                            Lucide.CircleUser,
                            stringResource(Res.string.account),
                            serverSummary(caps.accounts.firstOrNull { it.id == account }?.label ?: account),
                            enabled = serverReady,
                        ) { dialog = SettingsDialog.Account }
                    }
                }
                }
                if (!isWebPlatform && !isAndroidPlatform) {
                    val lsInfo by LocalServer.status.collectAsState()
                    val lsPort = environments.firstOrNull { it.id == activeId }?.port ?: 8723
                    val lsState = localServerStateOf(lsInfo, serverReady, loading)
                    val lsConfig = LocalServerConfig(settings.localServerDir, settings.localServerPython, settings.localServerPythonPath, settings.localServerMode, lsPort, settings.localServerPublicHost)
                    SettingsGroup(
                        label = stringResource(Res.string.local_server),
                        labelTrailing = {
                            if (lsState == LocalServerState.Starting) LoadingIndicator(modifier = Modifier.size(20.dp))
                            else StatusDot(localServerStatusColor(lsState), box = 20.dp, dot = 12.dp)
                        },
                    ) {
                        PreferenceRow(
                            Lucide.Server,
                            stringResource(Res.string.local_server),
                            if (lsState == LocalServerState.Stopped) null else localServerStatusText(lsState),
                            trailing = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    ConfirmTooltipButton(
                                        label = stringResource(Res.string.restart),
                                        confirmTitle = stringResource(Res.string.restart_server),
                                        confirmText = stringResource(Res.string.restart_server_confirm),
                                        enabled = serverReady || lsInfo.managed,
                                        onConfirm = { if (serverReady) scope.launch { SystemApi.restart() } else LocalServer.restart(lsConfig) },
                                    ) { Icon(Lucide.ServerCog, contentDescription = null) }
                                    ConfirmTooltipButton(
                                        label = stringResource(Res.string.stop),
                                        confirmTitle = stringResource(Res.string.stop_server),
                                        confirmText = stringResource(Res.string.stop_server_confirm),
                                        enabled = lsInfo.managed,
                                        onConfirm = { LocalServer.stop() },
                                    ) { Icon(Lucide.Power, contentDescription = null) }
                                    TooltipIconButton(label = stringResource(Res.string.run), onClick = { LocalServer.start(lsConfig) }, enabled = lsState == LocalServerState.Stopped || lsState == LocalServerState.Failed) {
                                        Icon(Lucide.Play, contentDescription = null)
                                    }
                                }
                            },
                            onClick = { dialog = SettingsDialog.LocalServer },
                        )
                        PreferenceRow(
                            Lucide.Play,
                            stringResource(Res.string.local_server_start),
                            null,
                            trailing = { CompactSwitch(localServerEnabled) { localServerEnabled = it; settings.localServerEnabled = it } },
                            onClick = { localServerEnabled = !localServerEnabled; settings.localServerEnabled = localServerEnabled },
                        )
                    }
                }
                SettingsGroup(label = null) {
                    PreferenceRow(
                        Lucide.Upload,
                        stringResource(Res.string.export_settings),
                        stringResource(Res.string.export_settings_summary),
                    ) {
                        backup = SettingsBackup.export()
                        dialog = SettingsDialog.Export
                    }
                    PreferenceRow(
                        Lucide.Download,
                        stringResource(Res.string.import_settings),
                        stringResource(Res.string.import_settings_summary),
                    ) { dialog = SettingsDialog.Import }
                    PreferenceRow(Lucide.History, stringResource(Res.string.reset_settings), stringResource(Res.string.reset_settings_summary)) { dialog = SettingsDialog.Reset }
                }
                Box(modifier = Modifier.onGloballyPositioned { aboutY = it.positionInParent().y }) {
                    SettingsGroup(stringResource(Res.string.about)) {
                        val uriHandler = LocalUriHandler.current
                        var showChangelog by remember { mutableStateOf(false) }
                        if (showChangelog) ChangelogSheet(onDismiss = { showChangelog = false })
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { uriHandler.openUri(chatState.latestRelease?.url ?: GitHubApi.RELEASES_URL) }
                                .background(MaterialTheme.colorScheme.onSurface.copy(alpha = aboutFlashAlpha))
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            AppLogo(28.dp)
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    stringResource(Res.string.app_name),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium,
                                )
                                Text(
                                    stringResource(Res.string.version_label, BuildConfig.VERSION_NAME),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                if (chatState.appOutdated) Text(
                                    stringResource(Res.string.compat_app_outdated),
                                    style = MaterialTheme.typography.bodySmall, color = palette.red,
                                )
                                if (chatState.serverOutdated) Text(
                                    stringResource(Res.string.compat_server_outdated),
                                    style = MaterialTheme.typography.bodySmall, color = palette.red,
                                )
                                chatState.latestRelease?.let { release ->
                                    Text(
                                        stringResource(Res.string.update_available, release.tag),
                                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary,
                                    )
                                }
                                if (!chatState.appOutdated && !chatState.serverOutdated && chatState.latestRelease == null) Text(
                                    stringResource(Res.string.up_to_date),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            TooltipIconButton(label = stringResource(Res.string.changelog), onClick = { showChangelog = true }) {
                                Icon(Lucide.FileText, contentDescription = null)
                            }
                        }
                        val release = chatState.latestRelease
                        var pending by remember { mutableStateOf(AppUpdater.pendingVersion()) }
                        var progress by remember { mutableStateOf<Float?>(null) }
                        var downloadJob by remember { mutableStateOf<Job?>(null) }
                        if (progress != null) {
                            LinearProgressIndicator(
                                progress = { progress ?: 0f },
                                drawStopIndicator = {},
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            )
                        }
                        when {
                            pending != null -> ActionButton(
                                text = stringResource(Res.string.install),
                                onClick = { AppUpdater.install() },
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            )
                            release?.installerUrl != null -> {
                                val installerUrl = release.installerUrl
                                val tag = release.tag
                                ActionButton(
                                    text = stringResource(if (progress != null) Res.string.cancel else Res.string.update_action),
                                    onClick = {
                                        if (progress != null) {
                                            downloadJob?.cancel()
                                        } else {
                                            progress = 0f
                                            downloadJob = scope.launch {
                                                try {
                                                    if (AppUpdater.download(installerUrl, tag) { progress = it }) pending = AppUpdater.pendingVersion()
                                                } finally {
                                                    progress = null
                                                    downloadJob = null
                                                }
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                                )
                            }
                            release != null && isWebPlatform -> ActionButton(
                                text = stringResource(Res.string.update_action),
                                onClick = { AppUpdater.reload() },
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            )
                            else -> {
                                var checking by remember { mutableStateOf(false) }
                                ActionButton(
                                    text = stringResource(if (checking) Res.string.checking_updates else Res.string.check_updates),
                                    enabled = !checking,
                                    onClick = {
                                        scope.launch {
                                            checking = true
                                            chatVm.checkForUpdates()
                                            checking = false
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                                )
                            }
                        }
                        var ownerProfile by remember { mutableStateOf<GitHubApi.Profile?>(null) }
                        var contributorProfile by remember { mutableStateOf<GitHubApi.Profile?>(null) }
                        LaunchedEffect(Unit) {
                            ownerProfile = GitHubApi.ownerProfile()
                            contributorProfile = GitHubApi.contributorProfile()
                        }
                        ProfileRow(ownerProfile, stringResource(Res.string.creator)) { uriHandler.openUri(it) }
                        ProfileRow(contributorProfile, stringResource(Res.string.contributor)) { uriHandler.openUri(it) }
                        PreferenceRow(
                            Lucide.Coffee,
                            stringResource(Res.string.support_creator),
                            KOFI_URL.removePrefix("https://"),
                            trailing = { ExternalIndicator() },
                        ) { uriHandler.openUri(KOFI_URL) }
                        PreferenceRow(
                            Lucide.Github,
                            stringResource(Res.string.repository),
                            GitHubApi.REPO_URL.removePrefix("https://"),
                            trailing = { ExternalIndicator() },
                        ) { uriHandler.openUri(GitHubApi.REPO_URL) }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }

    when (dialog) {
        SettingsDialog.Notifications -> {
            CompactDialog(
                onDismiss = { dialog = null },
                title = stringResource(Res.string.notifications),
                contentPadding = PaddingValues(0.dp),
                buttons = {
                    Button(onClick = { dialog = null }, variant = ButtonVariant.Outlined) {
                        Text(stringResource(Res.string.close))
                    }
                },
            ) {
                if (!notificationsEnabled) {
                    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                        Text(
                            stringResource(Res.string.notifications_disabled_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(10.dp))
                        ActionButton(
                            text = stringResource(Res.string.enable_notifications),
                            onClick = { requestEnableNotifications() },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(12.dp))
                    }
                }
                SwitchRow(
                    title = stringResource(Res.string.notify_interaction),
                    checked = notifyInteraction,
                    modifier = Modifier.padding(horizontal = 20.dp),
                    summary = stringResource(Res.string.notify_interaction_summary),
                    enabled = notificationsEnabled,
                ) {
                    notifyInteraction = it
                    settings.notifyInteraction = it
                }
                SwitchRow(
                    title = stringResource(Res.string.notify_task_done),
                    checked = notifyTaskDone,
                    modifier = Modifier.padding(horizontal = 20.dp),
                    summary = stringResource(Res.string.notify_task_done_summary),
                    enabled = notificationsEnabled,
                ) {
                    notifyTaskDone = it
                    settings.notifyTaskDone = it
                }
            }
        }

        SettingsDialog.Theme -> SelectDialog(
            title = stringResource(Res.string.theme),
            options = THEME_MODES.map { it to themeLabel(it) },
            selected = themeMode,
            onSelect = onThemeMode,
            onDismiss = { dialog = null },
        )

        SettingsDialog.Language -> ConfirmSelectDialog(
            title = stringResource(Res.string.language),
            options = (if (isWebPlatform) listOf("") else LANGUAGE_TAGS).map { it to languageLabel(it) },
            selected = language,
            onConfirm = { onLanguage(it); dialog = null },
            onDismiss = { dialog = null },
        )

        SettingsDialog.Font -> FontSelectDialog(
            selected = fontStyle,
            onSelect = onFontStyle,
            onDismiss = { dialog = null },
        )

        SettingsDialog.Accent -> AccentDialog(
            title = stringResource(Res.string.accent),
            selected = if (dynamicColor) DYNAMIC_ACCENT else accentIndex,
            systemColor = dynamicAccent(themeMode),
            showNone = false,
            onSelect = { idx ->
                if (idx == DYNAMIC_ACCENT) onDynamicColor(true)
                else if (idx != null) { onDynamicColor(false); onAccent(idx) }
            },
            onDismiss = { dialog = null },
        )

        SettingsDialog.Environments -> EnvironmentsDialog(
            environments = environments,
            activeId = activeId,
            onSetActive = { id -> chatVm.selectEnvironment(id); activeId = id },
            onSave = { profile -> settings.upsertEnvironment(profile); environments = settings.environments; activeId = settings.activeEnvironment?.id; chatVm.refreshEnvironments() },
            onDelete = { id -> settings.deleteEnvironment(id); environments = settings.environments; activeId = settings.activeEnvironment?.id; chatVm.refreshEnvironments() },
            onDismiss = { dialog = null },
        )

        SettingsDialog.Cli -> cliInfo?.let { info ->
            CliDialog(
                info = info,
                onChanged = { cliInfo = it; chatVm.refreshVersionInfo() },
                onDismiss = { dialog = null },
            )
        } ?: run { dialog = null }

        SettingsDialog.Generation -> GenerationDialog(
            caps = caps,
            model = model,
            effort = effort,
            streaming = streaming,
            todoTools = todoTools,
            onConfirm = { m, e, s, t ->
                model = m; effort = e; streaming = s; todoTools = t
                scope.launch { SettingsApi.update(model = m, effort = e, streaming = s, todoTools = t) }
                dialog = null
            },
            onDismiss = { dialog = null },
        )

        SettingsDialog.Permissions -> ConfirmSelectDialog(
            title = stringResource(Res.string.permission_mode),
            options = caps.permissionModes.map { it.id to it.label },
            selected = permissionMode,
            onConfirm = { permissionMode = it; scope.launch { SettingsApi.update(permissionMode = it) }; dialog = null },
            onDismiss = { dialog = null },
        )

        SettingsDialog.Account -> ConfirmSelectDialog(
            title = stringResource(Res.string.account),
            options = caps.accounts.map { it.id to it.label },
            selected = account,
            onConfirm = { account = it; scope.launch { SettingsApi.update(account = it) }; dialog = null },
            onDismiss = { dialog = null },
        )

        SettingsDialog.Visibility -> VisibilityDialog(
            thinking = showThinking,
            toolUse = showToolUse,
            fileChange = showFileChange,
            compact = showCompact,
            working = showWorking,
            onConfirm = { th, tu, fc, cp, wk ->
                showThinking = th; showToolUse = tu; showFileChange = fc; showCompact = cp; showWorking = wk
                scope.launch { SettingsApi.update(showThinking = th, showToolUse = tu, showFileChange = fc, showCompact = cp, showWorking = wk) }
                dialog = null
            },
            onDismiss = { dialog = null },
        )

        SettingsDialog.LocalServer -> LocalServerDialog(
            settings = settings,
            probePort = environments.firstOrNull { it.id == activeId }?.port ?: 8723,
            reachable = serverReady,
            connecting = loading,
            onClose = { dialog = null },
        )
        SettingsDialog.Reset -> ConfirmDialog(
            title = stringResource(Res.string.reset_settings),
            text = stringResource(Res.string.reset_settings_confirm),
            confirmLabel = stringResource(Res.string.accept),
            onConfirm = {
                settings.resetDefaults()
                onThemeMode(settings.themeMode); onLanguage(settings.language)
                onDynamicColor(settings.dynamicColor); onAccent(settings.accentIndex)
                scope.launch {
                    SettingsApi.reset()?.let {
                        model = it.model; effort = it.effort; permissionMode = it.permissionMode; streaming = it.streaming
                        todoTools = it.todoTools
                        showThinking = it.showThinking; showToolUse = it.showToolUse
                        showFileChange = it.showFileChange; showCompact = it.showCompact; showWorking = it.showWorking
                    }
                }
                dialog = null
            },
            onDismiss = { dialog = null },
        )

        SettingsDialog.Export -> {
            val clipboard = LocalClipboardManager.current
            BackupDialog(
                title = stringResource(Res.string.export_settings),
                hint = stringResource(Res.string.export_settings_warning),
                value = backup,
                onValueChange = null,
                error = false,
                confirmLabel = stringResource(Res.string.copy),
                confirmEnabled = true,
                onConfirm = { clipboard.setText(AnnotatedString(backup)) },
                onDismiss = { dialog = null },
            )
        }

        SettingsDialog.Import -> BackupDialog(
            title = stringResource(Res.string.import_settings),
            hint = stringResource(Res.string.import_settings_hint),
            value = pendingImport,
            onValueChange = { pendingImport = it; importFailed = false },
            error = importFailed,
            confirmLabel = stringResource(Res.string.accept),
            confirmEnabled = pendingImport.isNotBlank(),
            onConfirm = {
                if (SettingsBackup.import(pendingImport.trim())) {
                    onThemeMode(settings.themeMode); onLanguage(settings.language)
                    onDynamicColor(settings.dynamicColor); onAccent(settings.accentIndex)
                    onFontStyle(settings.fontStyle)
                    environments = settings.environments
                    activeId = settings.activeEnvironment?.id
                    chatVm.refreshEnvironments()
                    scope.launch { loadServerSettings() }
                    pendingImport = ""
                    dialog = null
                } else {
                    importFailed = true
                }
            },
            onDismiss = { pendingImport = ""; importFailed = false; dialog = null },
        )

        null -> Unit
    }
}

private enum class SettingsDialog { Theme, Language, Font, Accent, Environments, Cli, Generation, Permissions, Visibility, Notifications, Reset, LocalServer, Account, Export, Import }

@Composable
private fun BackupDialog(
    title: String,
    hint: String,
    value: String,
    onValueChange: ((String) -> Unit)?,
    error: Boolean,
    confirmLabel: String,
    confirmEnabled: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) {
                Text(stringResource(if (onValueChange == null) Res.string.close else Res.string.cancel))
            }
            Button(onClick = onConfirm, enabled = confirmEnabled) { Text(confirmLabel) }
        },
    ) {
        Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Box(Modifier.height(8.dp))
        InputField(
            value = value,
            onValueChange = onValueChange ?: {},
            minLines = 10,
            maxLines = 10,
            modifier = Modifier.fillMaxWidth(),
        )
        if (error) {
            Box(Modifier.height(6.dp))
            Text(
                stringResource(Res.string.import_settings_failed),
                style = MaterialTheme.typography.bodySmall,
                color = palette.red,
            )
        }
    }
}

@Composable
private fun LocalServerDialog(settings: Settings, probePort: Int, reachable: Boolean, connecting: Boolean, onClose: () -> Unit) {
    var dir by remember { mutableStateOf(settings.localServerDir) }
    var python by remember { mutableStateOf(settings.localServerPython) }
    var pythonPath by remember { mutableStateOf(settings.localServerPythonPath) }
    var mode by remember { mutableStateOf(settings.localServerMode) }
    var publicHost by remember { mutableStateOf(settings.localServerPublicHost) }
    val info by LocalServer.status.collectAsState()
    val scope = rememberCoroutineScope()
    val lsState = localServerStateOf(info, reachable, connecting)

    fun config() = LocalServerConfig(dir, python, pythonPath, mode, probePort, publicHost)

    CompactDialog(
        onDismiss = onClose,
        title = stringResource(Res.string.local_server),
        titleTrailing = {
            ConfirmTooltipButton(
                label = stringResource(Res.string.restart),
                confirmTitle = stringResource(Res.string.restart_server),
                confirmText = stringResource(Res.string.restart_server_confirm),
                enabled = reachable || info.managed,
                onConfirm = { if (reachable) scope.launch { SystemApi.restart() } else LocalServer.restart(config()) },
            ) { Icon(Lucide.ServerCog, contentDescription = null) }
            ConfirmTooltipButton(
                label = stringResource(Res.string.stop),
                confirmTitle = stringResource(Res.string.stop_server),
                confirmText = stringResource(Res.string.stop_server_confirm),
                enabled = info.managed,
                onConfirm = { LocalServer.stop() },
            ) { Icon(Lucide.Power, contentDescription = null) }
            TooltipIconButton(label = stringResource(Res.string.run), onClick = { LocalServer.start(config()) }, enabled = lsState == LocalServerState.Stopped || lsState == LocalServerState.Failed) {
                Icon(Lucide.Play, contentDescription = null)
            }
        },
        buttons = {
            Button(onClick = onClose, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = {
                settings.localServerDir = dir
                settings.localServerPython = python
                settings.localServerPythonPath = pythonPath
                settings.localServerMode = mode
                settings.localServerPublicHost = publicHost.trim()
                LocalServer.restart(config())
                onClose()
            }) { Text(stringResource(Res.string.accept)) }
        },
    ) {
        InputField(
            value = dir,
            onValueChange = { dir = it },
            label = { Text(stringResource(Res.string.local_server_folder)) },
            singleLine = true,
            trailingIcon = {
                PickerIcon { scope.launch(Dispatchers.Default) { pickDirectory()?.let { dir = it } } }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Box(Modifier.height(8.dp))
        SelectField(
            stringResource(Res.string.python), python,
            listOf(
                "auto" to stringResource(Res.string.python_auto),
                "system" to stringResource(Res.string.python_system),
                "custom" to stringResource(Res.string.python_custom),
            ),
        ) { python = it }
        if (python == "custom") {
            Box(Modifier.height(8.dp))
            InputField(
                value = pythonPath,
                onValueChange = { pythonPath = it },
                label = { Text(stringResource(Res.string.python_path)) },
                singleLine = true,
                trailingIcon = {
                    PickerIcon { scope.launch(Dispatchers.Default) { pickExecutable()?.let { pythonPath = it } } }
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Box(Modifier.height(8.dp))
        SelectField(
            stringResource(Res.string.run_mode), mode,
            listOf(
                "local" to stringResource(Res.string.mode_local),
                "tailscale" to stringResource(Res.string.mode_tailscale),
                "caddy" to stringResource(Res.string.mode_caddy),
            ),
        ) { mode = it }
        if (mode == "caddy") {
            Box(Modifier.height(8.dp))
            InputField(
                value = publicHost,
                onValueChange = { publicHost = it },
                label = { Text(stringResource(Res.string.public_host)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        val localLabel = stringResource(Res.string.local_url)
        val publicLabel = stringResource(Res.string.public_url)
        val tokenLabel = stringResource(Res.string.token)
        val failureText: String? = when (info.error) {
            LocalServerError.BadDir -> stringResource(Res.string.local_server_bad_dir)
            LocalServerError.NoPython -> stringResource(Res.string.local_server_no_python)
            LocalServerError.LaunchFailed -> stringResource(Res.string.local_server_launch_failed)
            LocalServerError.Crashed -> info.errorDetail ?: stringResource(Res.string.local_server_stopped)
            null -> null
        }
        val panel: String? = when {
            failureText != null -> failureText
            lsState == LocalServerState.RunningExternal -> null
            else -> buildString {
                appendLine("$localLabel: http://localhost:$probePort")
                if (mode != "local") {
                    info.publicUrl?.let { appendLine("$publicLabel: $it") }
                    info.token?.let { appendLine("$tokenLabel: $it") }
                }
            }.trimEnd()
        }
        if (panel != null) {
            Box(Modifier.height(12.dp))
            SelectionContainer {
                Text(
                    panel,
                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = LocalMonoFontFamily.current),
                    color = if (failureText != null) palette.red else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(snapDp(2.dp), if (failureText != null) palette.red else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun ConfirmTooltipButton(
    label: String,
    confirmTitle: String,
    confirmText: String,
    enabled: Boolean,
    onConfirm: () -> Unit,
    icon: @Composable () -> Unit,
) {
    var asking by remember { mutableStateOf(false) }
    TooltipIconButton(label = label, onClick = { asking = true }, enabled = enabled, icon = icon)
    if (asking) {
        ConfirmDialog(
            title = confirmTitle,
            text = confirmText,
            confirmLabel = stringResource(Res.string.confirm),
            onConfirm = { asking = false; onConfirm() },
            onDismiss = { asking = false },
        )
    }
}

private fun localServerStateOf(info: LocalServerInfo, reachable: Boolean, connecting: Boolean): LocalServerState = when {
    info.error != null -> LocalServerState.Failed
    (info.ready || reachable) && info.managed -> LocalServerState.RunningManaged
    info.ready || reachable -> LocalServerState.RunningExternal
    info.managed || connecting -> LocalServerState.Starting
    else -> LocalServerState.Stopped
}

@Composable
private fun localServerStatusText(state: LocalServerState): String = stringResource(
    when (state) {
        LocalServerState.Stopped -> Res.string.server_stopped
        LocalServerState.Starting -> Res.string.server_starting
        LocalServerState.RunningManaged -> Res.string.server_running
        LocalServerState.RunningExternal -> Res.string.server_running_external
        LocalServerState.Failed -> Res.string.server_failed
    },
)

@Composable
private fun localServerStatusColor(state: LocalServerState): Color = when (state) {
    LocalServerState.RunningManaged, LocalServerState.RunningExternal -> palette.green
    LocalServerState.Failed -> palette.red
    LocalServerState.Starting -> MaterialTheme.colorScheme.primary
    LocalServerState.Stopped -> MaterialTheme.colorScheme.onSurfaceVariant
}

@Composable
private fun fontLabel(style: String): String = when (style) {
    "color" -> stringResource(Res.string.font_color)
    "flat" -> stringResource(Res.string.font_flat)
    else -> stringResource(Res.string.font_system)
}

@Composable
private fun FontPreview(style: String) {
    Box(modifier = Modifier.width(36.dp).height(28.dp), contentAlignment = Alignment.Center) {
        Text("😃", fontFamily = appFontFamily(style), fontSize = 22.sp)
    }
}

@Composable
private fun FontSelectDialog(
    selected: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val options = buildList {
        if (!isWebPlatform) add("system")
        add("flat"); add("color")
    }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.font),
        contentPadding = PaddingValues(0.dp),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
        },
    ) {
        options.forEach { value ->
            DialogSelectItem(
                label = fontLabel(value),
                selected = value == selected,
                onClick = { onSelect(value); onDismiss() },
                labelFontFamily = appFontFamily(value),
                trailing = { FontPreview(value) },
            )
        }
    }
}

@Composable
private fun permissionLabel(caps: Capabilities, mode: String): String =
    caps.permissionModes.firstOrNull { it.id == mode }?.label ?: mode

@Composable
private fun SwitchRow(
    title: String,
    checked: Boolean,
    modifier: Modifier = Modifier,
    summary: String? = null,
    enabled: Boolean = true,
    leading: (@Composable () -> Unit)? = null,
    onChange: (Boolean) -> Unit,
) {
    val alpha = if (enabled) 1f else 0.38f
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .clip(DialogItemShape)
            .clickable(enabled = enabled) { onChange(!checked) }
            .padding(horizontal = DialogItemPaddingH, vertical = DialogItemPaddingV),
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(12.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha),
            )
            if (summary != null) {
                Text(
                    summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha),
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        CompactSwitch(checked, enabled = enabled, onCheckedChange = onChange)
    }
}

@Composable
private fun ProfileRow(profile: GitHubApi.Profile?, role: String, onOpen: (String) -> Unit) {
    val context = LocalPlatformContext.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = profile != null) { profile?.let { onOpen(it.url) } }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val avatar = profile?.avatarUrl
        if (avatar != null) {
            AsyncImage(
                model = avatar,
                imageLoader = AppImageLoader.get(context),
                contentDescription = null,
                modifier = Modifier.size(28.dp).clip(CircleShape),
            )
        } else {
            Box(Modifier.size(28.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                profile?.let { it.name ?: it.login } ?: "…",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
            Text(role, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(12.dp))
        ExternalIndicator()
    }
}

@Composable
private fun ExternalIndicator() {
    Box(modifier = Modifier.size(36.dp), contentAlignment = Alignment.Center) {
        Icon(
            Lucide.ExternalLink,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun AccentDot(color: Color) {
    Box(modifier = Modifier.width(36.dp).height(28.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(20.dp).background(color, CircleShape))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AccentDialog(
    title: String,
    selected: Int?,
    systemColor: Color,
    showNone: Boolean,
    closeOnPick: Boolean = false,
    onSelect: (Int?) -> Unit,
    onDismiss: () -> Unit,
) {
    var picked by remember { mutableStateOf(selected) }
    var lastIndex by remember { mutableStateOf(selected?.takeIf { it != DYNAMIC_ACCENT } ?: 4) }
    val dynamic = picked == DYNAMIC_ACCENT

    fun apply(value: Int?) {
        picked = value
        onSelect(value)
    }

    fun setDynamic(on: Boolean) = apply(if (on) DYNAMIC_ACCENT else if (showNone) null else lastIndex)

    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        buttons = { ActionButton(text = stringResource(Res.string.close), onClick = onDismiss) },
    ) {
        SwitchRow(
            title = stringResource(Res.string.accent_dynamic),
            checked = dynamic,
            leading = { Box(Modifier.size(20.dp).clip(CircleShape).background(systemColor)) },
        ) { setDynamic(it) }
        Spacer(Modifier.height(16.dp))
        SwatchGrid(
            count = ACCENTS.size + if (showNone) 1 else 0,
            modifier = Modifier.alpha(if (dynamic) 0.4f else 1f),
        ) { slot ->
            if (showNone && slot == 0) {
                ColorSwatch(
                    color = null,
                    selected = picked == null,
                    onClick = { apply(null); if (closeOnPick) onDismiss() },
                    icon = Lucide.X,
                )
            } else {
                val index = if (showNone) slot - 1 else slot
                ColorSwatch(
                    color = ACCENTS[index].second,
                    selected = !dynamic && picked == index,
                    onClick = { lastIndex = index; apply(index); if (closeOnPick) onDismiss() },
                )
            }
        }
    }
}

@Composable
private fun PickerIcon(onClick: () -> Unit) {
    TooltipIconButton(label = stringResource(Res.string.choose), onClick = onClick, size = 24.dp) {
        Icon(
            Lucide.Folder,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun LockToggle(locked: Boolean, onToggle: (Boolean) -> Unit, size: Dp = 36.dp) {
    TooltipIconButton(
        label = stringResource(if (locked) Res.string.unlock_selection else Res.string.lock_selection),
        onClick = { onToggle(!locked) },
        size = size,
    ) {
        Icon(
            if (locked) Lucide.Lock else Lucide.LockOpen,
            contentDescription = null,
            tint = if (locked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun EnvironmentsDialog(
    environments: List<EnvironmentProfile>,
    activeId: String?,
    onSetActive: (String) -> Unit,
    onSave: (EnvironmentProfile) -> Unit,
    onDelete: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val qrAvailable = remember { QrScan.isAvailable() }
    var editing by remember { mutableStateOf<EnvironmentProfile?>(null) }
    var adding by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<EnvironmentProfile?>(null) }
    var scanned by remember { mutableStateOf<EnvironmentProfile?>(null) }

    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.environments),
        contentPadding = PaddingValues(0.dp),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.back)) }
        },
        titleTrailing = if (qrAvailable) ({
            IconButton(
                onClick = {
                    QrScan.scan { raw ->
                        raw?.let(::profileFromQrPayload)?.let { scanned = it }
                    }
                },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(Lucide.ScanQrCode, contentDescription = stringResource(Res.string.scan_qr), modifier = Modifier.size(20.dp))
            }
        }) else null,
    ) {
        environments.forEach { c ->
            DialogSelectItem(
                label = c.name,
                subtitle = c.address,
                selected = c.id == activeId,
                onClick = { onSetActive(c.id) },
                trailing = {
                    if (c.id == activeId) {
                        val locked by SelectionLock.environment.collectAsState()
                        LockToggle(locked = locked, onToggle = { SelectionLock.setEnvironment(it) })
                    }
                    TooltipIconButton(label = stringResource(Res.string.edit_environment), onClick = { editing = c }) {
                        Icon(Lucide.Pencil, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                    TooltipIconButton(label = stringResource(Res.string.delete), onClick = { deleting = c }) {
                        Icon(Lucide.Trash, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                },
            )
        }
        Spacer(Modifier.height(8.dp))
        ActionButton(
            text = stringResource(Res.string.add_environment),
            onClick = { adding = true },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
        )
    }

    if (adding) {
        EnvironmentEditDialog(initial = null, onConfirm = { onSave(it); adding = false }, onDismiss = { adding = false })
    }
    editing?.let { c ->
        EnvironmentEditDialog(initial = c, onConfirm = { onSave(it); editing = null }, onDismiss = { editing = null })
    }
    scanned?.let { c ->
        EnvironmentEditDialog(
            initial = c,
            focusName = true,
            onConfirm = { onSave(it); onSetActive(it.id); scanned = null },
            onDismiss = { scanned = null },
        )
    }
    deleting?.let { c ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_environment_confirm, c.name),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { onDelete(c.id); deleting = null },
            onDismiss = { deleting = null },
        )
    }
}

@Composable
private fun EnvironmentEditDialog(
    initial: EnvironmentProfile?,
    onConfirm: (EnvironmentProfile) -> Unit,
    onDismiss: () -> Unit,
    focusName: Boolean = false,
) {
    val qrAvailable = remember { QrScan.isAvailable() }
    var kind by remember { mutableStateOf(initial?.kind ?: if (isWebPlatform) "https" else "http") }
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var host by remember { mutableStateOf(initial?.host ?: "") }
    var port by remember { mutableStateOf(initial?.port?.toString() ?: "8723") }
    var directory by remember { mutableStateOf(initial?.directory ?: "") }
    var authKind by remember { mutableStateOf(initial?.authKind ?: "none") }
    var authToken by remember { mutableStateOf(initial?.authToken ?: "") }
    var authUser by remember { mutableStateOf(initial?.authUser ?: "") }
    var authPassword by remember { mutableStateOf(initial?.authPassword ?: "") }
    var authHeaderName by remember { mutableStateOf(initial?.authHeaderName ?: "") }
    var authHeaderValue by remember { mutableStateOf(initial?.authHeaderValue ?: "") }
    var accentIndex by remember { mutableStateOf(initial?.accentIndex) }
    var picking by remember { mutableStateOf(false) }
    val systemColor = systemAccent() ?: MaterialTheme.colorScheme.primary
    val dynamicLabel = stringResource(Res.string.accent_dynamic)

    fun defaultPortFor(k: String) = if (k == "https") "443" else "8723"

    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(if (initial == null) Res.string.add_environment else Res.string.edit_environment),
        titleTrailing = if (qrAvailable) ({
            IconButton(
                onClick = {
                    QrScan.scan { raw ->
                        val payload = raw?.let(QrEnvironmentPayload::parse) ?: return@scan
                        val parsed = parseHostInput(payload.url) ?: return@scan
                        kind = parsed.kind
                        host = parsed.host
                        port = if (parsed.kind == "https") "" else parsed.port
                        authKind = "bearer"
                        authToken = payload.token
                    }
                },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(Lucide.ScanQrCode, contentDescription = stringResource(Res.string.scan_qr), modifier = Modifier.size(20.dp))
            }
        }) else null,
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(
                onClick = {
                    var finalKind = kind
                    var finalHost = host.trim().trimEnd('/')
                    var finalPort = port.trim()
                    val parsed = parseHostInput(finalHost)
                    if (parsed != null) {
                        finalKind = parsed.kind
                        finalHost = parsed.host
                        finalPort = parsed.port
                    }
                    val portInt: Int? = if (finalKind == "https") null else (finalPort.toIntOrNull() ?: 8723)
                    onConfirm(
                        EnvironmentProfile(
                            id = initial?.id ?: Uuid.random().toString(),
                            name = name.trim().ifBlank { finalHost },
                            kind = finalKind,
                            host = finalHost,
                            port = portInt,
                            authKind = authKind,
                            authToken = authToken.trim(),
                            authUser = authUser.trim(),
                            authPassword = authPassword,
                            authHeaderName = authHeaderName.trim(),
                            authHeaderValue = authHeaderValue.trim(),
                            directory = directory.trim(),
                            accentIndex = accentIndex,
                        )
                    )
                },
                enabled = host.isNotBlank(),
            ) { Text(stringResource(Res.string.save)) }
        },
    ) {
        SelectField(
            label = stringResource(Res.string.environment_kind),
            selected = kind,
            options = if (isWebPlatform) listOf("https" to "HTTPS") else listOf("http" to "HTTP", "https" to "HTTPS"),
            onSelect = { newKind ->
                if (newKind != kind) {
                    port = defaultPortFor(newKind)
                    kind = newKind
                }
            },
        )
        Spacer(Modifier.height(8.dp))
        val nameFocus = remember { FocusRequester() }
        InputField(value = name, onValueChange = { name = it }, label = { Text(stringResource(Res.string.environment_name)) }, singleLine = true, modifier = Modifier.fillMaxWidth().focusRequester(nameFocus))
        LaunchedEffect(focusName) { if (focusName) nameFocus.requestFocus() }
        Spacer(Modifier.height(8.dp))
        InputField(
            value = host,
            onValueChange = { input ->
                val parsed = parseHostInput(input)
                if (parsed != null) {
                    host = parsed.host
                    port = parsed.port
                    kind = parsed.kind
                } else {
                    host = input
                }
            },
            label = { Text(stringResource(Res.string.host)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        if (kind == "http") {
            InputField(value = port, onValueChange = { port = it.filter(Char::isDigit) }, label = { Text(stringResource(Res.string.port)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
        }
        SelectField(
            label = stringResource(Res.string.environment_auth),
            selected = authKind,
            options = listOf(
                "none" to stringResource(Res.string.auth_none),
                "bearer" to stringResource(Res.string.auth_bearer),
                "basic" to stringResource(Res.string.auth_basic),
                "header" to stringResource(Res.string.auth_header),
            ),
            onSelect = { authKind = it },
        )
        Spacer(Modifier.height(8.dp))
        when (authKind) {
            "bearer" -> SecretTextField(value = authToken, onValueChange = { authToken = it }, label = stringResource(Res.string.environment_token), modifier = Modifier.fillMaxWidth())
            "basic" -> {
                InputField(value = authUser, onValueChange = { authUser = it }, label = { Text(stringResource(Res.string.auth_user)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                SecretTextField(value = authPassword, onValueChange = { authPassword = it }, label = stringResource(Res.string.auth_password), modifier = Modifier.fillMaxWidth())
            }
            "header" -> {
                InputField(value = authHeaderName, onValueChange = { authHeaderName = it }, label = { Text(stringResource(Res.string.auth_header_name)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                SecretTextField(value = authHeaderValue, onValueChange = { authHeaderValue = it }, label = stringResource(Res.string.auth_header_value), modifier = Modifier.fillMaxWidth())
            }
        }
        if (authKind != "none") Spacer(Modifier.height(8.dp))
        InputField(
            value = directory,
            onValueChange = { directory = it },
            label = { Text(stringResource(Res.string.environment_directory)) },
            singleLine = true,
            trailingIcon = {
                val locked by SelectionLock.project.collectAsState()
                LockToggle(locked = locked, onToggle = { SelectionLock.setProject(it) }, size = 24.dp)
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        SelectField(
            label = stringResource(Res.string.environment_accent),
            selected = when (val picked = accentIndex) {
                null -> stringResource(Res.string.color_none)
                DYNAMIC_ACCENT -> dynamicLabel
                else -> accentNameAt(picked).orEmpty()
            },
            trailing = {
                accentIndex?.let {
                    Box(Modifier.size(20.dp).clip(CircleShape).background(if (it == DYNAMIC_ACCENT) systemColor else accentAt(it)))
                }
            },
            onClick = { picking = true },
        )
    }

    if (picking) {
        AccentDialog(
            title = stringResource(Res.string.environment_accent),
            selected = accentIndex,
            systemColor = systemColor,
            showNone = true,
            closeOnPick = true,
            onSelect = { accentIndex = it },
            onDismiss = { picking = false },
        )
    }
}

@Composable
private fun GenerationDialog(
    caps: Capabilities,
    model: String,
    effort: String,
    streaming: Boolean,
    todoTools: Boolean,
    onConfirm: (String, String, Boolean, Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    var m by remember { mutableStateOf(model) }
    var e by remember { mutableStateOf(effort) }
    var s by remember { mutableStateOf(streaming) }
    var t by remember { mutableStateOf(todoTools) }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.generation),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(m, e, s, t) }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        SelectField(stringResource(Res.string.model), m, caps.models.map { it.id to it.label }) { m = it }
        Spacer(Modifier.height(14.dp))
        SelectField(stringResource(Res.string.effort), e, caps.effortLevels.map { it to it }) { e = it }
        Spacer(Modifier.height(6.dp))
        SwitchRow(
            title = stringResource(Res.string.streaming),
            checked = s,
            summary = stringResource(Res.string.streaming_desc),
        ) { s = it }
        SwitchRow(
            title = stringResource(Res.string.task_tools),
            checked = t,
            summary = stringResource(Res.string.task_tools_desc),
        ) { t = it }
    }
}

@Composable
private fun VisibilityDialog(
    thinking: String,
    toolUse: String,
    fileChange: String,
    compact: String,
    working: String,
    onConfirm: (String, String, String, String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    var th by remember { mutableStateOf(thinking) }
    var tu by remember { mutableStateOf(toolUse) }
    var fc by remember { mutableStateOf(fileChange) }
    var cp by remember { mutableStateOf(compact) }
    var wk by remember { mutableStateOf(working) }
    val three = listOf(
        "full" to stringResource(Res.string.show_full),
        "label" to stringResource(Res.string.show_label),
        "off" to stringResource(Res.string.show_off),
    )
    val two = listOf(
        "full" to stringResource(Res.string.show_full),
        "label" to stringResource(Res.string.show_label),
    )
    val labelOff = listOf(
        "label" to stringResource(Res.string.show_label),
        "off" to stringResource(Res.string.show_off),
    )
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.visibility),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(th, tu, fc, cp, wk) }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        SelectField(stringResource(Res.string.thinking), th, three) { th = it }
        Spacer(Modifier.height(14.dp))
        SelectField(stringResource(Res.string.tools), tu, three) { tu = it }
        Spacer(Modifier.height(14.dp))
        SelectField(stringResource(Res.string.file_changes), fc, three) { fc = it }
        Spacer(Modifier.height(14.dp))
        SelectField(stringResource(Res.string.compacted), cp, two) { cp = it }
        Spacer(Modifier.height(14.dp))
        SelectField(stringResource(Res.string.working), wk, labelOff) { wk = it }
    }
}

@Composable
private fun CliDialog(
    info: CliApi.CliInfo,
    onChanged: (CliApi.CliInfo) -> Unit,
    onDismiss: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var source by remember { mutableStateOf(info.source) }
    var customPath by remember { mutableStateOf(info.customPath ?: "") }
    var updating by remember { mutableStateOf(false) }

    val systemLabel = stringResource(Res.string.cli_source_system)
    val customLabel = stringResource(Res.string.cli_source_custom)
    val bundledLabel = stringResource(Res.string.cli_source_bundled)
    fun labelFor(src: String) = when (src) {
        "system" -> systemLabel
        "custom" -> customLabel
        "bundled" -> bundledLabel
        else -> src
    }
    val sourceOptions = info.sources.map { src ->
        val version = when (src) {
            "system" -> info.systemVersion
            "bundled" -> info.bundledVersion
            else -> null
        }
        src to (labelFor(src) + (version?.let { " - $it" } ?: ""))
    }
    val canUpdate = source != "bundled"

    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.cli),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = {
                scope.launch {
                    CliApi.setSource(source, customPath.trim().ifBlank { null })?.let(onChanged)
                    onDismiss()
                }
            }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        SelectField(stringResource(Res.string.cli_source), source, sourceOptions) { source = it }
        if (source == "custom") {
            Spacer(Modifier.height(10.dp))
            InputField(
                value = customPath,
                onValueChange = { customPath = it },
                label = { Text(stringResource(Res.string.cli_custom_path)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (canUpdate) {
            Spacer(Modifier.height(12.dp))
            ActionButton(
                text = if (updating) stringResource(Res.string.cli_updating) else stringResource(Res.string.cli_update),
                onClick = {
                    scope.launch {
                        updating = true
                        CliApi.update(source, customPath.trim().ifBlank { null })
                        CliApi.status()?.let(onChanged)
                        updating = false
                    }
                },
                enabled = !updating,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

private fun profileFromQrPayload(raw: String): EnvironmentProfile? {
    val payload = QrEnvironmentPayload.parse(raw) ?: return null
    val parsed = parseHostInput(payload.url) ?: return null
    val port: Int? = if (parsed.kind == "https") null else parsed.port.toIntOrNull()
    return EnvironmentProfile(
        id = Uuid.random().toString(),
        name = "",
        kind = parsed.kind,
        host = parsed.host,
        port = port,
        authKind = "bearer",
        authToken = payload.token,
    )
}

private data class ParsedHost(val host: String, val port: String, val kind: String)

private fun parseHostInput(input: String): ParsedHost? {
    val raw = input.trim()
    val sep = raw.indexOf("://")
    if (sep <= 0) return null
    val parsedKind = when (raw.substring(0, sep).lowercase()) {
        "https", "wss" -> "https"
        "http", "ws" -> "http"
        else -> return null
    }
    val secure = parsedKind == "https"
    val rest = raw.substring(sep + 3).substringBefore('/').substringBefore('?')
    val colon = rest.indexOf(':')
    val host: String
    val port: String
    if (colon >= 0) {
        host = rest.substring(0, colon)
        port = rest.substring(colon + 1).filter(Char::isDigit).ifEmpty { if (secure) "443" else "80" }
    } else {
        host = rest
        port = if (secure) "443" else "80"
    }
    return ParsedHost(host, port, parsedKind)
}

@Composable
private fun ChangelogSheet(onDismiss: () -> Unit) {
    var notes by remember { mutableStateOf<List<GitHubApi.ReleaseNotes>?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        val result = GitHubApi.releaseNotes()
        if (result != null) notes = result else failed = true
    }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.changelog),
        contentPadding = PaddingValues(horizontal = 20.dp),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.close)) }
        },
    ) {
        val items = notes
        when {
            failed -> EmptyState(stringResource(Res.string.connection_error), Modifier.fillMaxWidth().padding(vertical = 24.dp))
            items == null -> CenteredProgress(Modifier.fillMaxWidth().padding(vertical = 24.dp))
            else -> LazyColumn(
                modifier = Modifier.heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                items(items, key = { it.tag }) { release ->
                    Column {
                        Text(
                            release.tag,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(4.dp))
                        MarkdownText(release.body, modifier = Modifier.fillMaxWidth(), selectable = true)
                    }
                }
            }
        }
    }
}
