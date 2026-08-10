package com.jahirtrap.cconnect

import android.Manifest
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.ComposeFoundationFlags
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.chat.TabsController
import com.jahirtrap.cconnect.chat.ChatScreen
import com.jahirtrap.cconnect.claude.ClaudeScreen
import com.jahirtrap.cconnect.data.AppPrefs
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.files.AttachmentFile
import com.jahirtrap.cconnect.files.FileExplorerScreen
import com.jahirtrap.cconnect.files.FilePreviewScreen
import com.jahirtrap.cconnect.files.androidFilePicker
import com.jahirtrap.cconnect.files.androidSaveAs
import com.jahirtrap.cconnect.markdown.MarkdownScreen
import com.jahirtrap.cconnect.monitor.MonitorScreen
import com.jahirtrap.cconnect.service.EXTRA_OPEN_CHAT
import com.jahirtrap.cconnect.service.Notifier
import com.jahirtrap.cconnect.settings.SettingsScreen
import com.jahirtrap.cconnect.settings.androidNotificationRequest
import com.jahirtrap.cconnect.terminal.TerminalScreen
import com.jahirtrap.cconnect.ui.BackInterceptors
import com.jahirtrap.cconnect.ui.DismissStack
import com.jahirtrap.cconnect.ui.HistoryNav
import com.jahirtrap.cconnect.ui.dispatchClipboardShortcut
import com.jahirtrap.cconnect.ui.LocalMobileLayout
import com.jahirtrap.cconnect.ui.LocalRefreshTick
import com.jahirtrap.cconnect.ui.theme.CConnectTheme
import com.jahirtrap.cconnect.ui.theme.accentAt
import com.jahirtrap.cconnect.ui.theme.themeModeOf
import kotlinx.coroutines.CompletableDeferred
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Security
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private val openChatRequests = mutableIntStateOf(0)
    private val refreshRequests = mutableIntStateOf(0)
    private var pickerDeferred: CompletableDeferred<List<Uri>>? = null

    private var couldAskNotifications = false

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val canAskAgain = shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
            if (!granted && !canAskAgain && !couldAskNotifications) runCatching {
                startActivity(
                    Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
                )
            }
        }

    private val pickFilesLauncher =
        registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            pickerDeferred?.complete(uris)
            pickerDeferred = null
        }

    private var saveAsDeferred: CompletableDeferred<Uri?>? = null

    private val saveAsLauncher =
        registerForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri ->
            saveAsDeferred?.complete(uri)
            saveAsDeferred = null
        }

    @OptIn(ExperimentalFoundationApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installAppContext(this)
        val notifPrefs = AppPrefs("notif")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !NotificationManagerCompat.from(this).areNotificationsEnabled() &&
            !notifPrefs.getBoolean("requested", false)
        ) {
            notifPrefs.putBoolean("requested", true)
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        Security.removeProvider("BC")
        Security.insertProviderAt(BouncyCastleProvider(), 1)
        Notifier.init {}
        androidNotificationRequest = {
            couldAskNotifications = shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        ComposeFoundationFlags.isNewContextMenuEnabled = true
        androidFilePicker = {
            val deferred = CompletableDeferred<List<Uri>>()
            pickerDeferred = deferred
            runCatching { pickFilesLauncher.launch(arrayOf("*/*")) }
            deferred.await().map { uri ->
                runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
                AttachmentFile(uri)
            }
        }
        androidSaveAs = { filename ->
            val deferred = CompletableDeferred<Uri?>()
            saveAsDeferred = deferred
            if (runCatching { saveAsLauncher.launch(filename) }.isFailure) {
                saveAsDeferred = null
                deferred.complete(null)
            }
            deferred.await()
        }
        enableEdgeToEdge()
        handleIntent(intent)
        setContent { App() }
    }

    override fun onResume() {
        super.onResume()
        Notifier.appInForeground = true
    }

    override fun onPause() {
        super.onPause()
        Notifier.appInForeground = false
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        if (intent.getBooleanExtra(EXTRA_OPEN_CHAT, false)) {
            Notifier.routeToPendingTab()
            openChatRequests.intValue++
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (dispatchClipboardShortcut(event)) return true
        if (event.action == KeyEvent.ACTION_DOWN) {
            when {
                event.isCtrlPressed && event.keyCode == KeyEvent.KEYCODE_R -> { refreshRequests.intValue++; return true }
                event.keyCode == KeyEvent.KEYCODE_FORWARD -> if (HistoryNav.forward()) return true
                event.keyCode == KeyEvent.KEYCODE_ESCAPE -> if (DismissStack.dismissTop()) return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun App() {
        val baseContext = LocalContext.current
        val settings = remember { Settings() }
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
        var sidebarExpanded by remember { mutableStateOf(settings.sidebarExpanded) }
        LaunchedEffect(sidebarExpanded) { settings.sidebarExpanded = sidebarExpanded }

        val chatDrawerState = rememberDrawerState(DrawerValue.Closed)
        LaunchedEffect(LocalMobileLayout.current) { chatDrawerState.close() }

        LaunchedEffect(openChatRequests.intValue) {
            if (openChatRequests.intValue > 0) {
                showSettings = false
                showExplorer = false
                showClaude = false
                showMonitor = false
                showTerminal = false
                showMarkdown = false
                previewFile = null
            }
        }

        fun goBack(): Boolean {
            if (BackInterceptors.handle()) return true
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
                else -> return false
            }
            return true
        }

        BackHandler(enabled = true) {
            if (!DismissStack.dismissTop() && !HistoryNav.back() && !goBack()) moveTaskToBack(true)
        }

        LaunchedEffect(language) {
            Locale.setDefault(if (language.isBlank()) Locale.getDefault() else Locale.forLanguageTag(language))
        }

        val localizedContext = remember(language) {
            if (language.isBlank()) {
                baseContext
            } else {
                val config = Configuration(baseContext.resources.configuration)
                config.setLocale(Locale.forLanguageTag(language))
                baseContext.createConfigurationContext(config)
            }
        }

        CompositionLocalProvider(
            LocalContext provides localizedContext,
            LocalConfiguration provides localizedContext.resources.configuration,
            LocalViewModelStoreOwner provides activeTab.owner,
            LocalChatViewModelFactory provides activeTab.factory,
            LocalRefreshTick provides refreshRequests.intValue,
        ) {
            CConnectTheme(
                themeMode = themeModeOf(themeMode),
                dynamicColor = dynamicColor,
                accent = accentAt(accentIndex),
                fontStyle = fontStyle,
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
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
