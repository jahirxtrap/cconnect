package com.jahirtrap.cconnect.claude

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import com.jahirtrap.cconnect.ui.Button
import com.jahirtrap.cconnect.ui.ButtonVariant
import com.jahirtrap.cconnect.ui.AppPullToRefresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import com.jahirtrap.cconnect.ui.BackInterceptor
import com.jahirtrap.cconnect.ui.ClearFocusOnImeHide
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.composables.icons.lucide.Activity
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Blocks
import com.composables.icons.lucide.Brain
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.CircleUser
import com.composables.icons.lucide.Eraser
import com.composables.icons.lucide.FilePen
import com.composables.icons.lucide.FileText
import com.composables.icons.lucide.FolderPen
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.RotateCw
import com.composables.icons.lucide.Server
import com.composables.icons.lucide.Store
import com.composables.icons.lucide.Unplug
import com.composables.icons.lucide.Wand
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.chat.ChatViewModel
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.chat.ConnectionState
import com.jahirtrap.cconnect.data.projectLabel
import com.jahirtrap.cconnect.data.projectNameOf
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.AccountsApi
import com.jahirtrap.cconnect.data.remote.ClaudeApi
import com.jahirtrap.cconnect.data.remote.SettingsApi
import com.jahirtrap.cconnect.data.remote.CliApi
import com.jahirtrap.cconnect.data.remote.GitHubApi
import com.jahirtrap.cconnect.data.ChatListStore
import com.jahirtrap.cconnect.data.SelectionLock
import com.jahirtrap.cconnect.data.ProjectInfo
import com.jahirtrap.cconnect.settings.PreferenceRow
import com.jahirtrap.cconnect.settings.SettingsGroup
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.LocalIsTouch
import com.jahirtrap.cconnect.ui.CustomIcons
import com.jahirtrap.cconnect.ui.Claude
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.EnvironmentSelectDialog
import com.jahirtrap.cconnect.ui.SelectDialog
import com.jahirtrap.cconnect.ui.RouteSub
import com.jahirtrap.cconnect.ui.refreshRequests
import com.jahirtrap.cconnect.ui.InputField
import com.jahirtrap.cconnect.ui.MarkdownText
import com.jahirtrap.cconnect.ui.MetricBar
import com.jahirtrap.cconnect.ui.SelectField
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.theme.palette
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ClaudeScreen(onClose: () -> Unit, onOpenPreview: (url: String, filename: String, onDelete: (() -> Unit)?) -> Unit) {
    val vm: ChatViewModel = viewModel(factory = LocalChatViewModelFactory.current)
    val state by vm.state.collectAsState()
    val scope = rememberCoroutineScope()
    ClearFocusOnImeHide()

    var cliInfo by remember { mutableStateOf<CliApi.CliInfo?>(null) }
    var extensions by remember { mutableStateOf<ClaudeApi.Extensions?>(null) }
    var skills by remember { mutableStateOf<List<ClaudeApi.Skill>?>(null) }
    var mcpServers by remember { mutableStateOf<List<ClaudeApi.McpServer>?>(null) }
    var userPrompt by remember { mutableStateOf<String?>(null) }
    var projects by remember { mutableStateOf<List<ProjectInfo>>(emptyList()) }
    var editingProjectPrompt by remember { mutableStateOf(false) }
    var usage by remember { mutableStateOf<ClaudeApi.Usage?>(null) }
    var accountsSnapshot by remember { mutableStateOf<AccountsApi.Snapshot?>(null) }
    var accountMenu by remember { mutableStateOf(false) }
    var serviceStatus by remember { mutableStateOf<ClaudeApi.ServiceStatus?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    var envMenu by remember { mutableStateOf(false) }
    val environmentLocked by SelectionLock.environment.collectAsState()
    var showChangelog by remember { mutableStateOf(false) }
    var editingPrompt by remember { mutableStateOf(false) }
    val sub by RouteSub.value.collectAsState()
    val detail = ClaudeKind.entries.firstOrNull { it.slug == sub }
    val activeEnvironment = state.environments.firstOrNull { it.id == state.activeEnvironmentId }
    val activeName = activeEnvironment?.name
    val environmentDirectory = activeEnvironment?.directory
    val serverReady = Backend.isConfigured && state.connection == ConnectionState.Connected

    suspend fun load() {
        cliInfo = CliApi.status()
        extensions = ClaudeApi.extensions()
        skills = ClaudeApi.skills()
        mcpServers = ClaudeApi.mcp()
        userPrompt = ClaudeApi.userPrompt()
        projects = ChatListStore.forConfig(Backend.snapshot())?.projects?.value ?: emptyList()
        accountsSnapshot = AccountsApi.list()
        usage = ClaudeApi.usage(accountsSnapshot?.default)
        serviceStatus = ClaudeApi.status()
        loaded = true
        refreshing = false
    }
    LaunchedEffect(state.activeEnvironmentId) { loaded = false; load() }
    LaunchedEffect(state.connection) { if (state.connection == ConnectionState.Connected) load() }
    val refreshTick = refreshRequests()
    LaunchedEffect(refreshTick) { if (refreshTick > 0) { refreshing = true; load() } }

    LaunchedEffect(detail) { if (detail == null && loaded) load() }

    detail?.let { kind ->
        BackInterceptor { RouteSub.close(); true }
        ClaudeDetailScreen(
            kind = kind,
            onClose = { RouteSub.close() },
            onOpenPreview = onOpenPreview,
        )
        return
    }


    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(Res.string.claude),
                subtitle = if (!serverReady && loaded) stringResource(Res.string.server_unavailable) else activeName,
                subtitleLeading = if (!serverReady && loaded) ({ StatusDot(palette.red, box = 8.dp) }) else null,
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    if ((accountsSnapshot?.accounts?.count { it.loggedIn } ?: 0) > 1) {
                        TooltipIconButton(label = stringResource(Res.string.account), onClick = { accountMenu = true }) {
                            Icon(Lucide.CircleUser, contentDescription = null)
                        }
                    }
                    TooltipIconButton(
                        label = stringResource(Res.string.environment),
                        onClick = { envMenu = true },
                        enabled = !environmentLocked,
                    ) { Icon(Lucide.Server, contentDescription = null) }
                    if (!LocalIsTouch.current) {
                        TooltipIconButton(label = stringResource(Res.string.refresh), onClick = { refreshing = true; scope.launch { load() } }) {
                            Icon(Lucide.RotateCw, contentDescription = null)
                        }
                    }
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
        if (accountMenu) {
            val snapshot = accountsSnapshot
            SelectDialog(
                title = stringResource(Res.string.account),
                options = snapshot?.accounts.orEmpty().filter { it.loggedIn }.map { it.id to it.label },
                selected = snapshot?.default.orEmpty(),
                onSelect = { id ->
                    accountMenu = false
                    scope.launch {
                        runCatching { SettingsApi.update(account = id) }
                        load()
                    }
                },
                onDismiss = { accountMenu = false },
            )
        }
        AppPullToRefresh(
            isRefreshing = refreshing,
            onRefresh = { refreshing = true; scope.launch { load() } },
            modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding),
        ) {
            if (!loaded) {
                CenteredProgress(Modifier.fillMaxSize())
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .imePadding()
                        .padding(horizontal = 16.dp),
                ) {
                    SettingsGroup(
                        label = stringResource(Res.string.service_status),
                        labelTrailing = {
                            val st = serviceStatus
                            StatusDot(
                                if (st != null && st.error == null) serviceIndicatorColor(st.indicator) else palette.gray,
                                box = 20.dp, dot = 12.dp,
                            )
                        },
                    ) {
                        val st = serviceStatus
                        DetailLink(
                            Lucide.Activity,
                            stringResource(Res.string.service_status),
                            when {
                                st == null -> "—"
                                st.error != null -> stringResource(Res.string.status_unknown)
                                else -> serviceIndicatorLabel(st.indicator)
                            },
                            enabled = serverReady,
                        ) { RouteSub.open(ClaudeKind.Status.slug) }
                    }
                    SettingsGroup(stringResource(Res.string.cli)) {
                        PreferenceRow(
                            CustomIcons.Claude,
                            stringResource(Res.string.cli),
                            cliInfo?.activeVersion ?: "—",
                            enabled = serverReady,
                            alert = stringResource(Res.string.compat_cli_outdated).takeIf { state.cliOutdated },
                            trailing = {
                                TooltipIconButton(label = stringResource(Res.string.changelog), onClick = { showChangelog = true }, enabled = serverReady) {
                                    Icon(Lucide.FileText, contentDescription = null)
                                }
                            },
                        )
                        cliInfo?.let { info ->
                            CliInlineControls(
                                info = info,
                                enabled = serverReady,
                                onChanged = { cliInfo = it; vm.refreshVersionInfo() },
                            )
                        }
                        PreferenceRow(
                            Lucide.FilePen,
                            stringResource(Res.string.user_prompt),
                            userPrompt?.lineSequence()?.firstOrNull { it.isNotBlank() }?.take(80)
                                ?.takeIf { it.isNotEmpty() } ?: stringResource(Res.string.user_prompt_summary),
                            enabled = serverReady,
                        ) { editingPrompt = true }
                        if (projects.isNotEmpty()) {
                            PreferenceRow(
                                Lucide.FolderPen,
                                stringResource(Res.string.project_prompt),
                                stringResource(Res.string.project_prompt_summary),
                                enabled = serverReady,
                            ) { editingProjectPrompt = true }
                        }
                    }
                    usage?.takeIf { it.error == null && it.windows.isNotEmpty() }?.let { current ->
                        val accountLabel = accountsSnapshot?.takeIf { it.accounts.size > 1 }
                            ?.let { s -> s.accounts.firstOrNull { it.id == s.default }?.label }
                        val usageLabel = listOfNotNull(accountLabel, current.plan).joinToString(" • ").ifBlank { null }
                        SettingsGroup(
                            label = stringResource(Res.string.usage),
                            labelTrailing = {
                                if (usageLabel != null) {
                                    Text(
                                        usageLabel,
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            },
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(14.dp),
                            ) {
                                current.windows.forEach { window ->
                                    MetricBar(
                                        title = usageWindowLabel(window.id),
                                        subtitle = if (window.unused) stringResource(Res.string.usage_unused)
                                        else resetsLabel(window.resetsAt),
                                        percent = window.percent,
                                    )
                                }
                            }
                        }
                    }
                    AccountsSection(enabled = serverReady, onChanged = { scope.launch { load() } })
                    SettingsGroup(stringResource(Res.string.extensions)) {
                        val pluginList = extensions?.plugins
                        val enabledCount = pluginList?.count { it.enabled } ?: 0
                        DetailLink(
                            Lucide.Blocks,
                            stringResource(Res.string.plugins),
                            if (pluginList != null) {
                                stringResource(Res.string.enabled_count, enabledCount, pluginList.size)
                            } else "—",
                            enabled = serverReady,
                        ) { RouteSub.open(ClaudeKind.Plugins.slug) }
                        DetailLink(
                            Lucide.Wand,
                            stringResource(Res.string.skills),
                            skills?.size?.toString() ?: "—",
                            enabled = serverReady,
                        ) { RouteSub.open(ClaudeKind.Skills.slug) }
                        val enabledServers = mcpServers?.count { it.enabled } ?: 0
                        DetailLink(
                            Lucide.Unplug,
                            stringResource(Res.string.mcp_servers),
                            if (mcpServers != null) {
                                stringResource(Res.string.enabled_count, enabledServers, mcpServers!!.size)
                            } else "—",
                            enabled = serverReady,
                        ) { RouteSub.open(ClaudeKind.Mcp.slug) }
                        DetailLink(
                            Lucide.Store,
                            stringResource(Res.string.marketplaces),
                            extensions?.marketplaces?.size?.toString() ?: "—",
                            enabled = serverReady,
                        ) { RouteSub.open(ClaudeKind.Marketplaces.slug) }
                        DetailLink(
                            Lucide.Brain,
                            stringResource(Res.string.memories),
                            (vm.defaultProjectKey(projects) ?: state.activeProjectKey)
                                ?.let { projectNameOf(projects, it, environmentDirectory) } ?: "—",
                            enabled = serverReady,
                        ) { RouteSub.open(ClaudeKind.Memories.slug) }
                    }
                    Spacer(Modifier.height(16.dp))
                }
            }
        }
    }

    if (editingPrompt) {
        PromptDialog(
            initial = userPrompt.orEmpty(),
            onConfirm = { text ->
                scope.launch {
                    if (ClaudeApi.setUserPrompt(text)) userPrompt = text
                    editingPrompt = false
                }
            },
            onDismiss = { editingPrompt = false },
            title = stringResource(Res.string.user_prompt),
            summary = stringResource(Res.string.user_prompt_summary),
        )
    }
    if (editingProjectPrompt && projects.isNotEmpty()) {
        val options = vm.withDefaultProject(projects)
        ProjectPromptDialog(
            projects = options,
            initialProject = vm.defaultProjectKey(projects) ?: state.activeProjectKey ?: options.first().projectKey,
            onSave = { project, text ->
                scope.launch {
                    ClaudeApi.setProjectPrompt(project, text)
                    editingProjectPrompt = false
                }
            },
            onDismiss = { editingProjectPrompt = false },
        )
    }

    if (showChangelog) {
        ClaudeChangelogSheet(
            cliVersion = cliInfo?.activeVersion,
            onDismiss = { showChangelog = false },
        )
    }
}

@Composable
private fun DetailLink(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    summary: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    PreferenceRow(
        icon,
        title,
        summary,
        enabled = enabled,
        trailing = {
            Icon(
                Lucide.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        onClick = onClick,
    )
}

@Composable
private fun CliInlineControls(
    info: CliApi.CliInfo,
    enabled: Boolean,
    onChanged: (CliApi.CliInfo) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var source by remember(info) { mutableStateOf(info.source) }
    var customPath by remember(info) { mutableStateOf(info.customPath ?: "") }
    var saving by remember { mutableStateOf(false) }
    var updating by remember { mutableStateOf(false) }

    val systemLabel = stringResource(Res.string.cli_source_system)
    val customLabel = stringResource(Res.string.custom_path)
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
    val dirty = source != info.source || (source == "custom" && customPath.trim() != (info.customPath ?: ""))

    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SelectField(stringResource(Res.string.cli_source), source, sourceOptions) { source = it }
        if (source == "custom") {
            InputField(
                value = customPath,
                onValueChange = { customPath = it },
                label = { Text(stringResource(Res.string.cli_custom_path)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (dirty) {
            ActionButton(
                text = stringResource(Res.string.save),
                enabled = enabled && !saving && (source != "custom" || customPath.isNotBlank()),
                onClick = {
                    scope.launch {
                        saving = true
                        CliApi.setSource(source, customPath.trim().ifBlank { null })?.let(onChanged)
                        saving = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
        } else if (info.source != "bundled") {
            ActionButton(
                text = stringResource(if (updating) Res.string.cli_updating else Res.string.cli_update),
                enabled = enabled && !updating,
                onClick = {
                    scope.launch {
                        updating = true
                        CliApi.update()
                        CliApi.status()?.let(onChanged)
                        updating = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
internal fun PromptDialog(
    initial: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    title: String,
    summary: String,
) {
    var text by remember { mutableStateOf(initial) }
    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        titleTrailing = {
            TooltipIconButton(label = stringResource(Res.string.clear), onClick = { text = "" }, enabled = text.isNotEmpty()) {
                Icon(Lucide.Eraser, contentDescription = null)
            }
        },
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(text) }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        Text(
            summary,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(10.dp))
        InputField(
            value = text,
            onValueChange = { text = it },
            minLines = 6,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
internal fun ProjectPromptDialog(
    projects: List<ProjectInfo>,
    initialProject: String,
    onSave: (String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    var project by remember { mutableStateOf(initialProject) }
    var text by remember { mutableStateOf("") }
    val projectLocked by SelectionLock.project.collectAsState()
    LaunchedEffect(project) { text = ClaudeApi.projectPrompt(project).orEmpty() }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.project_prompt),
        titleTrailing = {
            TooltipIconButton(label = stringResource(Res.string.clear), onClick = { text = "" }, enabled = text.isNotEmpty()) {
                Icon(Lucide.Eraser, contentDescription = null)
            }
        },
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onSave(project, text) }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        SelectField(
            label = stringResource(Res.string.project),
            selected = project,
            options = projects.map { it.projectKey to projectLabel(it) },
            enabled = !projectLocked,
            onSelect = { project = it },
        )
        Spacer(Modifier.height(10.dp))
        Text(
            stringResource(Res.string.project_prompt_summary),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(10.dp))
        InputField(
            value = text,
            onValueChange = { text = it },
            minLines = 6,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun usageWindowLabel(id: String): String = when (id) {
    "session" -> stringResource(Res.string.usage_session)
    "weekly_all" -> stringResource(Res.string.usage_all_models)
    else -> id
}

@Composable
private fun resetsLabel(resetsAt: String?): String {
    val millis = resetsAt?.let {
        com.jahirtrap.cconnect.data.parseIsoMillis(it)
    } ?: return "—"
    val remaining = millis - com.jahirtrap.cconnect.data.nowMillis()
    if (remaining <= 0) return "—"
    return if (remaining < 24 * 3_600_000L) {
        val hours = remaining / 3_600_000
        val minutes = (remaining % 3_600_000) / 60_000
        stringResource(Res.string.resets_in, if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m")
    } else {
        stringResource(Res.string.resets_on, com.jahirtrap.cconnect.data.formatDayTime(millis))
    }
}

@Composable
fun ClaudeChangelogSheet(cliVersion: String?, onDismiss: () -> Unit) {
    var notes by remember { mutableStateOf<List<GitHubApi.ReleaseNotes>?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        val result = GitHubApi.claudeChangelog(cliVersion)
        if (result != null) notes = result else failed = true
    }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.changelog),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
        },
    ) {
        val items = notes
        when {
            failed -> EmptyState(stringResource(Res.string.connection_error), Modifier.fillMaxWidth().padding(vertical = 24.dp))
            items == null -> CenteredProgress(Modifier.fillMaxWidth().padding(vertical = 24.dp))
            else -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                items.forEach { release ->
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
