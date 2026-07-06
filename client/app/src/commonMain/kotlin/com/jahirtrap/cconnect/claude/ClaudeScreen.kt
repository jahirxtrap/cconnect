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
import com.jahirtrap.cconnect.ui.TextButton
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
import org.jetbrains.compose.resources.pluralStringResource
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.composables.icons.lucide.Activity
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Blocks
import com.composables.icons.lucide.Brain
import com.composables.icons.lucide.ChevronRight
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
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.ClaudeApi
import com.jahirtrap.cconnect.data.remote.CliApi
import com.jahirtrap.cconnect.data.remote.GitHubApi
import com.jahirtrap.cconnect.data.ChatListStore
import com.jahirtrap.cconnect.data.ProjectInfo
import com.jahirtrap.cconnect.settings.PreferenceRow
import com.jahirtrap.cconnect.settings.SettingsGroup
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.ui.AppBottomSheet
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.LocalIsTouch
import com.jahirtrap.cconnect.ui.CustomIcons
import com.jahirtrap.cconnect.ui.Claude
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.EnvironmentSelectDialog
import com.jahirtrap.cconnect.ui.LocalRefreshTick
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
    var serviceStatus by remember { mutableStateOf<ClaudeApi.ServiceStatus?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    var envMenu by remember { mutableStateOf(false) }
    var showChangelog by remember { mutableStateOf(false) }
    var editingPrompt by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<ClaudeKind?>(null) }
    val activeName = state.environments.firstOrNull { it.id == state.activeEnvironmentId }?.name
    val serverReady = Backend.isConfigured && state.connection == ConnectionState.Connected

    suspend fun load() {
        cliInfo = CliApi.status()
        extensions = ClaudeApi.extensions()
        skills = ClaudeApi.skills()
        mcpServers = ClaudeApi.mcp()
        userPrompt = ClaudeApi.userPrompt()
        projects = ChatListStore.forConfig(Backend.snapshot())?.projects?.value ?: emptyList()
        usage = ClaudeApi.usage()
        serviceStatus = ClaudeApi.status()
        loaded = true
        refreshing = false
    }
    LaunchedEffect(state.activeEnvironmentId) { loaded = false; load() }
    LaunchedEffect(state.connection) { if (state.connection == ConnectionState.Connected) load() }
    val refreshTick = LocalRefreshTick.current
    LaunchedEffect(refreshTick) { if (refreshTick > 0) { refreshing = true; load() } }

    detail?.let { kind ->
        BackInterceptor { detail = null; scope.launch { load() }; true }
        ClaudeDetailScreen(
            kind = kind,
            onClose = {
                detail = null
                scope.launch { load() }
            },
            onOpenPreview = onOpenPreview,
        )
        return
    }


    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(Res.string.claude),
                subtitle = if (!serverReady && loaded) stringResource(Res.string.server_unavailable) else activeName,
                subtitleLeading = if (!serverReady && loaded) ({ StatusDot(palette.red) }) else null,
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    TooltipIconButton(label = stringResource(Res.string.environment), onClick = { envMenu = true }) {
                        Icon(Lucide.Server, contentDescription = null)
                    }
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
                        ) { detail = ClaudeKind.Status }
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
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                stringResource(Res.string.usage),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.weight(1f),
                            )
                            current.plan?.let {
                                Text(it, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(24.dp))
                                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            current.windows.forEach { window ->
                                MetricBar(
                                    title = usageWindowLabel(window.id),
                                    subtitle = resetsLabel(window.resetsAt),
                                    percent = window.percent,
                                )
                            }
                        }
                    }
                    SettingsGroup(stringResource(Res.string.extensions)) {
                        val pluginList = extensions?.plugins
                        val enabledCount = pluginList?.count { it.enabled } ?: 0
                        DetailLink(
                            Lucide.Blocks,
                            stringResource(Res.string.plugins),
                            if (pluginList != null) {
                                pluralStringResource(Res.plurals.enabled_count, enabledCount, enabledCount, pluginList.size)
                            } else "—",
                            enabled = serverReady,
                        ) { detail = ClaudeKind.Plugins }
                        DetailLink(
                            Lucide.Wand,
                            stringResource(Res.string.skills),
                            skills?.size?.toString() ?: "—",
                            enabled = serverReady,
                        ) { detail = ClaudeKind.Skills }
                        DetailLink(
                            Lucide.Unplug,
                            stringResource(Res.string.mcp_servers),
                            mcpServers?.size?.toString() ?: "—",
                            enabled = serverReady,
                        ) { detail = ClaudeKind.Mcp }
                        DetailLink(
                            Lucide.Store,
                            stringResource(Res.string.marketplaces),
                            extensions?.marketplaces?.size?.toString() ?: "—",
                            enabled = serverReady,
                        ) { detail = ClaudeKind.Marketplaces }
                        DetailLink(
                            Lucide.Brain,
                            stringResource(Res.string.memories),
                            state.activeProjectKey ?: "—",
                            enabled = serverReady,
                        ) { detail = ClaudeKind.Memories }
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
        ProjectPromptDialog(
            projects = projects,
            initialProject = state.activeProjectKey ?: projects.first().projectKey,
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
    val dirty = source != info.source || (source == "custom" && customPath.trim() != (info.customPath ?: ""))

    Column(modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 10.dp)) {
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
        if (dirty) {
            Spacer(Modifier.height(12.dp))
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
            Spacer(Modifier.height(12.dp))
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
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) }
            TextButton(onClick = { onConfirm(text) }) { Text(stringResource(Res.string.save)) }
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
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) }
            TextButton(onClick = { onSave(project, text) }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        SelectField(
            label = stringResource(Res.string.project),
            selected = project,
            options = projects.map { it.projectKey to (it.name ?: it.path ?: it.projectKey) },
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
    AppBottomSheet(onDismiss = onDismiss, title = stringResource(Res.string.changelog), showClose = true) {
        val items = notes
        when {
            failed -> EmptyState(stringResource(Res.string.connection_error), Modifier.fillMaxWidth().weight(1f))
            items == null -> CenteredProgress(Modifier.fillMaxWidth().weight(1f))
            else -> LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp),
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
