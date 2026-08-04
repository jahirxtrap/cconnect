package com.jahirtrap.cconnect

import androidx.compose.foundation.ComposeFoundationFlags
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.isBackPressed
import androidx.compose.ui.input.pointer.isForwardPressed
import androidx.compose.ui.awt.awtEventOrNull
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import androidx.compose.ui.awt.ComposeWindow
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.WindowPlacement
import androidx.compose.ui.window.WindowPosition
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.app_icon
import com.jahirtrap.cconnect.resources.`open`
import com.jahirtrap.cconnect.resources.tray_exit
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.chat.TabsController
import com.jahirtrap.cconnect.chat.tabShortcut
import com.jahirtrap.cconnect.chat.ChatScreen
import com.jahirtrap.cconnect.claude.ClaudeScreen
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.files.FileExplorerScreen
import com.jahirtrap.cconnect.files.FilePreviewScreen
import com.jahirtrap.cconnect.markdown.MarkdownScreen
import com.jahirtrap.cconnect.monitor.MonitorScreen
import com.jahirtrap.cconnect.service.LocalServer
import com.jahirtrap.cconnect.service.LocalServerConfig
import com.jahirtrap.cconnect.service.Notifier
import com.jahirtrap.cconnect.service.configureTrayMenu
import com.jahirtrap.cconnect.service.isTrayActive
import com.jahirtrap.cconnect.settings.SettingsScreen
import com.jahirtrap.cconnect.terminal.TerminalScreen
import com.jahirtrap.cconnect.ui.BackInterceptors
import com.jahirtrap.cconnect.ui.dispatchClipboardShortcut
import com.jahirtrap.cconnect.ui.DismissStack
import com.jahirtrap.cconnect.ui.HistoryNav
import com.jahirtrap.cconnect.ui.LocalMobileLayout
import com.jahirtrap.cconnect.ui.LocalRefreshTick
import com.jahirtrap.cconnect.ui.theme.CConnectTheme
import com.jahirtrap.cconnect.ui.theme.ThemeMode
import com.jahirtrap.cconnect.ui.theme.accentAt
import com.jahirtrap.cconnect.ui.theme.themeModeOf
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.awt.event.WindowEvent
import java.awt.event.WindowFocusListener
import java.security.Security
import java.util.Locale

private object SingleInstance {
    private const val PORT = 53117
    private var server: java.net.ServerSocket? = null

    fun acquire(onShow: () -> Unit): Boolean = try {
        val socket = java.net.ServerSocket(PORT, 1, java.net.InetAddress.getLoopbackAddress())
        server = socket
        Thread {
            while (true) {
                val client = runCatching { socket.accept() }.getOrNull() ?: break
                client.close()
                javax.swing.SwingUtilities.invokeLater { onShow() }
            }
        }.apply { isDaemon = true; name = "cconnect-single-instance" }.start()
        true
    } catch (_: java.io.IOException) {
        runCatching { java.net.Socket(java.net.InetAddress.getLoopbackAddress(), PORT).close() }
        false
    }
}

@OptIn(ExperimentalFoundationApi::class)
fun main() {
    if (!SingleInstance.acquire { bringAppToFront() }) return
    ComposeFoundationFlags.isNewContextMenuEnabled = true
    // The JVM ships a stripped BC provider; swap it for the full BouncyCastle so sshj
    // has curve25519, ed25519, chacha20-poly1305, etc. Modern OpenSSH defaults need this.
    Security.removeProvider("BC")
    Security.insertProviderAt(BouncyCastleProvider(), 1)
    runCatching {
        val toolkit = java.awt.Toolkit.getDefaultToolkit()
        toolkit.javaClass.getDeclaredField("awtAppClassName").apply {
            isAccessible = true
            set(toolkit, "CConnect")
        }
    }
    val systemLocale = Locale.getDefault()
    val settings = Settings()
    if (settings.localServerEnabled && settings.localServerDir.isNotBlank()) {
        LocalServer.start(
            LocalServerConfig(
                dir = settings.localServerDir,
                python = settings.localServerPython,
                pythonPath = settings.localServerPythonPath,
                mode = settings.localServerMode,
                probePort = settings.activeEnvironment?.port ?: 8723,
                publicHost = settings.localServerPublicHost,
            )
        )
    }
    Runtime.getRuntime().addShutdownHook(Thread { LocalServer.stop() })
    val screen = java.awt.Toolkit.getDefaultToolkit().screenSize
    application {
        val windowState = rememberWindowState(
            placement = if (settings.windowMaximized) WindowPlacement.Maximized else WindowPlacement.Floating,
            size = DpSize((screen.width * 0.8f).dp, (screen.height * 0.85f).dp),
            position = WindowPosition(Alignment.Center),
        )
        var fullscreen by remember { mutableStateOf(false) }
        var prevPlacement by remember { mutableStateOf(WindowPlacement.Floating) }
        var prevSize by remember { mutableStateOf(windowState.size) }
        var prevPosition by remember { mutableStateOf(windowState.position) }
        LaunchedEffect(windowState.placement) {
            if (!fullscreen) settings.windowMaximized = windowState.placement == WindowPlacement.Maximized
        }
        var refreshTick by remember { mutableIntStateOf(0) }
        var windowVisible by remember { mutableStateOf(true) }
        key(fullscreen) {
            Window(
                onCloseRequest = {
                    if (settings.minimizeToTray && isTrayActive()) windowVisible = false
                    else exitApplication()
                },
                visible = windowVisible,
                state = windowState,
                undecorated = fullscreen,
                title = "CConnect",
                icon = painterResource(Res.drawable.app_icon),
                onPreviewKeyEvent = { event ->
                    if (event.type == KeyEventType.KeyDown && event.isCtrlPressed && event.key == Key.R) {
                        refreshTick++
                        true
                    } else if (event.type == KeyEventType.KeyDown && event.key == Key.F11) {
                        if (fullscreen) {
                            fullscreen = false
                            windowState.placement = prevPlacement
                            if (prevPlacement != WindowPlacement.Maximized) {
                                windowState.size = prevSize
                                windowState.position = prevPosition
                            }
                        } else {
                            prevPlacement = windowState.placement
                            prevSize = windowState.size
                            prevPosition = windowState.position
                            fullscreen = true
                            windowState.placement = WindowPlacement.Maximized
                        }
                        true
                    } else if (tabShortcut(event)) true
                    else dispatchClipboardShortcut(event)
                },
            ) {
                val showLabel = stringResource(Res.string.`open`)
                val exitLabel = stringResource(Res.string.tray_exit)
                DisposableEffect(window) {
                    window.setFocusTraversalKeys(
                        java.awt.KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS,
                        setOf(java.awt.AWTKeyStroke.getAWTKeyStroke(java.awt.event.KeyEvent.VK_TAB, 0)),
                    )
                    window.setFocusTraversalKeys(
                        java.awt.KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS,
                        setOf(java.awt.AWTKeyStroke.getAWTKeyStroke(java.awt.event.KeyEvent.VK_TAB, java.awt.event.InputEvent.SHIFT_DOWN_MASK)),
                    )
                    val listener = object : WindowFocusListener {
                        override fun windowGainedFocus(e: WindowEvent?) { Notifier.appInForeground = true }
                        override fun windowLostFocus(e: WindowEvent?) { Notifier.appInForeground = false }
                    }
                    window.addWindowFocusListener(listener)
                    Notifier.init { windowVisible = true; window.toFront(); window.requestFocus() }
                    configureTrayMenu(showLabel, exitLabel) { exitApplication() }
                    desktopWindowToFront = { windowVisible = true; window.toFront(); window.requestFocus() }
                    onDispose { window.removeWindowFocusListener(listener); desktopWindowToFront = null }
                }
                App(systemLocale, refreshTick, window)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App(systemLocale: Locale, refreshTick: Int, window: ComposeWindow) {
    val settings = remember { Settings() }
    val focusManager = LocalFocusManager.current
    val activeTab = TabsController.active

    var themeMode by remember { mutableStateOf(settings.themeMode) }
    var dynamicColor by remember { mutableStateOf(settings.dynamicColor) }
    var accentIndex by remember { mutableStateOf(settings.accentIndex) }
    var fontStyle by remember { mutableStateOf(settings.fontStyle) }
    var language by remember { mutableStateOf(settings.language) }
    var showSettings by remember { mutableStateOf(!settings.isConfigured) }
    var settingsHighlight by remember { mutableStateOf<String?>(null) }
    var showExplorer by remember { mutableStateOf(false) }
    var explorerArchive by remember { mutableStateOf<String?>(null) }
    var showClaude by remember { mutableStateOf(false) }
    var showMonitor by remember { mutableStateOf(false) }
    var previewFile by remember { mutableStateOf<PreviewRequest?>(null) }
    var showTerminal by remember { mutableStateOf(false) }
    var terminalFromSettings by remember { mutableStateOf(false) }
    var showMarkdown by remember { mutableStateOf(false) }
    // Hoisted so the open/collapsed state survives navigating to settings and back.
    var sidebarExpanded by remember { mutableStateOf(settings.sidebarExpanded) }
    LaunchedEffect(sidebarExpanded) { settings.sidebarExpanded = sidebarExpanded }

    fun goBack() {
        if (BackInterceptors.handle()) return
        when {
            previewFile != null -> previewFile = null
            showSettings -> { showSettings = false; settingsHighlight = null }
            showExplorer -> { showExplorer = false; explorerArchive = null }
            showClaude -> showClaude = false
            showMonitor -> showMonitor = false
            showTerminal -> {
                showTerminal = false
                if (terminalFromSettings) { terminalFromSettings = false; showSettings = true }
            }
            showMarkdown -> showMarkdown = false
        }
    }

    // Override the locale in-place so changing language recomposes instead of recreating the window.
    LaunchedEffect(language) {
        Locale.setDefault(if (language.isBlank()) systemLocale else Locale.forLanguageTag(language))
    }

    val systemDark = isSystemInDarkTheme()
    LaunchedEffect(themeMode, systemDark) {
        val dark = when (themeModeOf(themeMode)) {
            ThemeMode.LIGHT -> false
            ThemeMode.DARK -> true
            ThemeMode.SYSTEM -> systemDark
        }
        WindowTitleBar.apply(window, dark)
    }

    CompositionLocalProvider(
        LocalViewModelStoreOwner provides activeTab.owner,
        LocalChatViewModelFactory provides activeTab.factory,
        LocalRefreshTick provides refreshTick,
    ) {
        CConnectTheme(
            themeMode = themeModeOf(themeMode),
            dynamicColor = dynamicColor,
            accent = accentAt(accentIndex),
            fontStyle = fontStyle,
        ) {
            val frameBackground = MaterialTheme.colorScheme.background
            LaunchedEffect(frameBackground) {
                val awtColor = java.awt.Color(frameBackground.toArgb())
                window.background = awtColor
                window.contentPane.background = awtColor
            }
            key(language) {
                Box(
                    modifier = Modifier.fillMaxSize().pointerInput(Unit) {
                        awaitPointerEventScope {
                            var backDown = false
                            var forwardDown = false
                            while (true) {
                                val event = awaitPointerEvent(PointerEventPass.Initial)
                                val awtButton = (event.awtEventOrNull as? java.awt.event.MouseEvent)?.button
                                val isBack = event.buttons.isBackPressed || awtButton == 4
                                val isForward = event.buttons.isForwardPressed || awtButton == 5
                                if (isBack && !backDown) { if (!DismissStack.dismissTop() && !HistoryNav.back()) goBack() }
                                if (isForward && !forwardDown) HistoryNav.forward()
                                backDown = isBack
                                forwardDown = isForward
                            }
                        }
                    }.pointerInput(Unit) {
                        detectTapGestures(onTap = { focusManager.clearFocus() })
                    },
                ) {
                val chatDrawerState = rememberDrawerState(DrawerValue.Closed)
                LaunchedEffect(LocalMobileLayout.current) { chatDrawerState.close() }
                when {
                    showSettings -> SettingsScreen(
                        themeMode = themeMode,
                        onThemeMode = { themeMode = it; settings.themeMode = it },
                        dynamicColor = dynamicColor,
                        onDynamicColor = { dynamicColor = it; settings.dynamicColor = it },
                        accentIndex = accentIndex,
                        onAccent = { accentIndex = it; settings.accentIndex = it },
                        fontStyle = fontStyle,
                        onFontStyle = { fontStyle = it; settings.fontStyle = it },
                        language = language,
                        onLanguage = { language = it; settings.language = it },
                        onOpenSshHosts = {
                            terminalFromSettings = true
                            showSettings = false
                            showTerminal = true
                        },
                        highlight = settingsHighlight,
                        onClose = { showSettings = false; settingsHighlight = null },
                    )

                    showExplorer -> FileExplorerScreen(
                        onClose = { showExplorer = false; explorerArchive = null },
                        onOpenPreview = { url, name, onDelete -> previewFile = PreviewRequest(url, name, onDelete) },
                        initialArchive = explorerArchive,
                    )

                    showClaude -> ClaudeScreen(
                        onClose = { showClaude = false },
                        onOpenPreview = { url, name, onDelete -> previewFile = PreviewRequest(url, name, onDelete) },
                    )

                    showMonitor -> MonitorScreen(onClose = { showMonitor = false })

                    showTerminal -> TerminalScreen(onClose = {
                        showTerminal = false
                        if (terminalFromSettings) {
                            terminalFromSettings = false
                            showSettings = true
                        }
                    })

                    showMarkdown -> MarkdownScreen(onClose = { showMarkdown = false })

                    else -> key(activeTab.id) { ChatScreen(
                        onOpenSettings = { target -> settingsHighlight = target; showSettings = true },
                        onOpenExplorer = { target -> explorerArchive = target; showExplorer = true },
                        onOpenClaude = { showClaude = true },
                        onOpenMonitor = { showMonitor = true },
                        onOpenTerminal = { showTerminal = true },
                        onOpenMarkdown = { showMarkdown = true },
                        onOpenPreview = { url, name, onDelete -> previewFile = PreviewRequest(url, name, onDelete) },
                        expanded = sidebarExpanded,
                        onExpandedChange = { sidebarExpanded = it },
                        drawerState = chatDrawerState,
                    ) }
                }
                previewFile?.let { request ->
                    FilePreviewScreen(
                        url = request.url,
                        filename = request.name,
                        onClose = { previewFile = null },
                        onDelete = request.onDelete,
                    )
                }
                }
            }
        }
    }
}

private data class PreviewRequest(
    val url: String,
    val name: String,
    val onDelete: (() -> Unit)?,
)
