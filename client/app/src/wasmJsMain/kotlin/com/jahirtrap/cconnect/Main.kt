package com.jahirtrap.cconnect

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.window.ComposeViewport
import androidx.compose.ui.text.font.FontWeight
import org.jetbrains.compose.resources.ExperimentalResourceApi
import org.jetbrains.compose.resources.preloadFont
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.cconnect_color_bold
import com.jahirtrap.cconnect.resources.cconnect_color_regular
import com.jahirtrap.cconnect.resources.cconnect_flat_bold
import com.jahirtrap.cconnect.resources.cconnect_flat_regular
import com.jahirtrap.cconnect.resources.cconnect_mono_regular
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import com.jahirtrap.cconnect.chat.ChatScreen
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.chat.TabsController
import com.jahirtrap.cconnect.claude.ClaudeScreen
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.files.FileExplorerScreen
import com.jahirtrap.cconnect.files.FilePreviewScreen
import com.jahirtrap.cconnect.markdown.MarkdownScreen
import com.jahirtrap.cconnect.monitor.MonitorScreen
import com.jahirtrap.cconnect.service.Notifier
import com.jahirtrap.cconnect.settings.SettingsScreen
import com.jahirtrap.cconnect.terminal.TerminalScreen
import com.jahirtrap.cconnect.ui.BackInterceptors
import com.jahirtrap.cconnect.ui.LocalMobileLayout
import com.jahirtrap.cconnect.ui.RouteSub
import com.jahirtrap.cconnect.ui.routeBaseOf
import com.jahirtrap.cconnect.ui.LocalRefreshTick
import com.jahirtrap.cconnect.ui.theme.CConnectTheme
import com.jahirtrap.cconnect.ui.theme.accentAt
import com.jahirtrap.cconnect.ui.theme.themeModeOf
import kotlinx.browser.document
import kotlinx.browser.window
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.Event
import org.w3c.dom.events.KeyboardEvent

@OptIn(ExperimentalComposeUiApi::class, ExperimentalResourceApi::class)
fun main() {
    ComposeViewport(document.body!!) {
        val color = remember { Settings().fontStyle == "color" }
        val regular by preloadFont(if (color) Res.font.cconnect_color_regular else Res.font.cconnect_flat_regular)
        val bold by preloadFont(if (color) Res.font.cconnect_color_bold else Res.font.cconnect_flat_bold, FontWeight.Bold)
        val mono by preloadFont(Res.font.cconnect_mono_regular)
        if (regular != null && bold != null && mono != null) App()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App() {
    val settings = remember { Settings() }
    val activeTab = TabsController.active

    var themeMode by remember { mutableStateOf(settings.themeMode) }
    var dynamicColor by remember { mutableStateOf(settings.dynamicColor) }
    var accentIndex by remember { mutableStateOf(settings.accentIndex) }
    var fontStyle by remember { mutableStateOf(settings.fontStyle) }
    var language by remember { mutableStateOf(settings.language) }
    var route by remember { mutableStateOf(if (settings.isConfigured) currentRoute() else "/settings") }
    var settingsHighlight by remember { mutableStateOf<String?>(null) }
    var explorerArchive by remember { mutableStateOf<String?>(null) }
    var previewFile by remember { mutableStateOf<PreviewRequest?>(null) }
    var sidebarExpanded by remember { mutableStateOf(settings.sidebarExpanded) }

    LaunchedEffect(Unit) {
        if (!settings.isConfigured && window.location.pathname == "/") {
            window.history.pushState(null, "", "/settings")
        }
    }

    DisposableEffect(Unit) {
        val listener: (Event) -> Unit = { route = currentRoute(); RouteSub.sync() }
        window.addEventListener("popstate", listener)
        onDispose { window.removeEventListener("popstate", listener) }
    }

    DisposableEffect(Unit) {
        val update: (Event) -> Unit = { Notifier.appInForeground = docHasFocus() }
        Notifier.appInForeground = docHasFocus()
        window.addEventListener("focus", update)
        window.addEventListener("blur", update)
        document.addEventListener("visibilitychange", update)
        onDispose {
            window.removeEventListener("focus", update)
            window.removeEventListener("blur", update)
            document.removeEventListener("visibilitychange", update)
        }
    }

    DisposableEffect(Unit) {
        val onKey: (Event) -> Unit = { e ->
            val ke = e as? KeyboardEvent
            if (ke != null) {
                val ctrl = ke.ctrlKey || ke.metaKey
                val handled = when {
                    ctrl && ke.key == "Tab" && ke.shiftKey -> { TabsController.selectPrev(); true }
                    ctrl && ke.key == "Tab" -> { TabsController.selectNext(); true }
                    ctrl && (ke.key == "t" || ke.key == "T") -> { TabsController.newTab(); true }
                    ctrl && (ke.key == "w" || ke.key == "W") -> { TabsController.closeActive(); true }
                    ke.altKey && ke.key == "ArrowRight" -> { TabsController.moveActive(1); true }
                    ke.altKey && ke.key == "ArrowLeft" -> { TabsController.moveActive(-1); true }
                    else -> false
                }
                if (handled) ke.preventDefault()
            }
        }
        window.addEventListener("keydown", onKey)
        onDispose { window.removeEventListener("keydown", onKey) }
    }

    fun navigate(target: String) {
        if (route == target && RouteSub.value.value == null) return
        RouteSub.clear()
        window.history.pushState(null, "", target)
        route = target
    }

    fun goBack() {
        if (BackInterceptors.handle()) return
        if (previewFile != null) previewFile = null else window.history.back()
    }

    CompositionLocalProvider(
        LocalViewModelStoreOwner provides activeTab.owner,
        LocalChatViewModelFactory provides activeTab.factory,
        LocalRefreshTick provides 0,
    ) {
        CConnectTheme(
            themeMode = themeModeOf(themeMode),
            dynamicColor = dynamicColor,
            accent = accentAt(accentIndex),
            fontStyle = fontStyle,
        ) {
            val frameBackground = MaterialTheme.colorScheme.background
            LaunchedEffect(frameBackground) {
                val hex = "#" + (frameBackground.toArgb() and 0xFFFFFF).toString(16).padStart(6, '0')
                document.body?.style?.backgroundColor = hex
                (document.documentElement as? HTMLElement)?.style?.backgroundColor = hex
            }
            Box(modifier = Modifier.fillMaxSize()) {
                val chatDrawerState = rememberDrawerState(DrawerValue.Closed)
                LaunchedEffect(LocalMobileLayout.current) { chatDrawerState.close() }
                when (route) {
                    "/settings" -> SettingsScreen(
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
                        onOpenSshHosts = { navigate("/terminal") },
                        highlight = settingsHighlight,
                        onClose = { settingsHighlight = null; goBack() },
                    )

                    "/claude" -> ClaudeScreen(
                        onClose = { goBack() },
                        onOpenPreview = { url, name, onDelete -> previewFile = PreviewRequest(url, name, onDelete) },
                    )

                    "/monitor" -> MonitorScreen(onClose = { goBack() })

                    "/files" -> FileExplorerScreen(
                        onClose = { explorerArchive = null; goBack() },
                        onOpenPreview = { url, name, onDelete -> previewFile = PreviewRequest(url, name, onDelete) },
                        initialArchive = explorerArchive,
                    )

                    "/terminal" -> TerminalScreen(onClose = { goBack() })

                    "/markdown" -> MarkdownScreen(onClose = { goBack() })

                    else -> key(activeTab.id) { ChatScreen(
                        onOpenSettings = { target -> settingsHighlight = target; navigate("/settings") },
                        onOpenExplorer = { target -> explorerArchive = target; navigate("/files") },
                        onOpenClaude = { navigate("/claude") },
                        onOpenMonitor = { navigate("/monitor") },
                        onOpenTerminal = { navigate("/terminal") },
                        onOpenMarkdown = { navigate("/markdown") },
                        onOpenPreview = { url, name, onDelete -> previewFile = PreviewRequest(url, name, onDelete) },
                        expanded = sidebarExpanded,
                        onExpandedChange = { sidebarExpanded = it; settings.sidebarExpanded = it },
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

private data class PreviewRequest(
    val url: String,
    val name: String,
    val onDelete: (() -> Unit)?,
)

private fun docHasFocus(): Boolean = js("document.hasFocus()")

private fun currentRoute(): String = routeBaseOf(window.location.pathname)
