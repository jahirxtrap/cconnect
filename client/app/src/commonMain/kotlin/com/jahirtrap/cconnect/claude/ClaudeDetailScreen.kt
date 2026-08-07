package com.jahirtrap.cconnect.claude

import com.jahirtrap.cconnect.ui.AppDropdownMenu
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import com.jahirtrap.cconnect.ui.Button
import com.jahirtrap.cconnect.ui.ButtonVariant
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import com.jahirtrap.cconnect.ui.ClearFocusOnImeHide
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.CirclePlus
import com.composables.icons.lucide.ExternalLink
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Store
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.files.FilePreviewScreen
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.chat.ChatViewModel
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.data.formatDateShort
import com.jahirtrap.cconnect.data.parseIsoMillis
import com.jahirtrap.cconnect.data.remote.ClaudeApi
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.DialogItemInset
import com.jahirtrap.cconnect.ui.DialogItemPaddingH
import com.jahirtrap.cconnect.ui.DialogItemPaddingV
import com.jahirtrap.cconnect.ui.DialogItemShape
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.CompactDropdownItem
import com.jahirtrap.cconnect.ui.CompactSwitch
import com.jahirtrap.cconnect.ui.InputField
import com.jahirtrap.cconnect.ui.OutlinedPanel
import com.jahirtrap.cconnect.ui.RenameDialog
import com.jahirtrap.cconnect.ui.SelectField
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.theme.palette
import kotlinx.coroutines.launch

enum class ClaudeKind { Plugins, Skills, Mcp, Marketplaces, Memories, Status }

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ClaudeDetailScreen(
    kind: ClaudeKind,
    onClose: () -> Unit,
    onOpenPreview: (url: String, filename: String, onDelete: (() -> Unit)?) -> Unit,
) {
    val vm: ChatViewModel = viewModel(factory = LocalChatViewModelFactory.current)
    val state by vm.state.collectAsState()
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current
    ClearFocusOnImeHide()

    var extensions by remember { mutableStateOf<ClaudeApi.Extensions?>(null) }
    var skills by remember { mutableStateOf<List<ClaudeApi.Skill>?>(null) }
    var skillQuery by remember { mutableStateOf("") }
    var skillSheet by remember { mutableStateOf<ClaudeApi.Skill?>(null) }
    var skillFiles by remember { mutableStateOf<List<String>?>(null) }
    var skillPreview by remember { mutableStateOf<Pair<String, String>?>(null) }
    var mcpServers by remember { mutableStateOf<List<ClaudeApi.McpServer>?>(null) }
    var memories by remember { mutableStateOf<ClaudeApi.Memories?>(null) }
    var memoriesProject by remember { mutableStateOf<String?>(null) }
    var serviceStatus by remember { mutableStateOf<ClaudeApi.ServiceStatus?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }

    var pluginMenu by remember { mutableStateOf<ClaudeApi.Plugin?>(null) }
    var confirmUninstall by remember { mutableStateOf<ClaudeApi.Plugin?>(null) }
    var marketMenu by remember { mutableStateOf<ClaudeApi.Marketplace?>(null) }
    var confirmMarketRemove by remember { mutableStateOf<ClaudeApi.Marketplace?>(null) }
    var addingMarket by remember { mutableStateOf(false) }
    var dialogBusy by remember { mutableStateOf<String?>(null) }
    var catalogMarket by remember { mutableStateOf<String?>(null) }
    var catalog by remember { mutableStateOf<List<ClaudeApi.CatalogPlugin>?>(null) }
    var installCandidate by remember { mutableStateOf<ClaudeApi.CatalogPlugin?>(null) }
    var mcpMenu by remember { mutableStateOf<ClaudeApi.McpServer?>(null) }
    var confirmMcpRemove by remember { mutableStateOf<ClaudeApi.McpServer?>(null) }
    var addingMcp by remember { mutableStateOf(false) }

    suspend fun load() {
        when (kind) {
            ClaudeKind.Plugins, ClaudeKind.Marketplaces -> extensions = ClaudeApi.extensions()
            ClaudeKind.Skills -> skills = ClaudeApi.skills()
            ClaudeKind.Mcp -> mcpServers = ClaudeApi.mcp()
            ClaudeKind.Memories -> memories = ClaudeApi.memories(memoriesProject)
            ClaudeKind.Status -> serviceStatus = ClaudeApi.status()
        }
        loaded = true
    }
    LaunchedEffect(kind) {
        if (kind == ClaudeKind.Memories) {
            memoriesProject = memoriesProject ?: state.activeProjectKey
            vm.ensureHistoryLoaded()
        }
        load()
    }

    LaunchedEffect(skillSheet) {
        skillFiles = null
        skillSheet?.let { skillFiles = ClaudeApi.skillFiles(it.plugin, it.id) }
    }

    fun runAction(block: suspend () -> ClaudeApi.ActionResult?) {
        scope.launch {
            busy = true
            val result = block()
            if (result != null && !result.ok) actionError = result.message.ifBlank { "Error" }
            load()
            catalogMarket?.let { catalog = ClaudeApi.catalog(it) }
            pluginMenu = pluginMenu?.let { current ->
                extensions?.plugins?.firstOrNull { it.name == current.name && it.marketplace == current.marketplace }
            }
            mcpMenu = mcpMenu?.let { current -> mcpServers?.firstOrNull { it.name == current.name } }
            dialogBusy = null
            busy = false
        }
    }

    fun openCatalog(market: String) {
        catalogMarket = market
        catalog = null
        scope.launch { catalog = ClaudeApi.catalog(market) }
    }


    val title = when (kind) {
        ClaudeKind.Plugins -> stringResource(Res.string.plugins)
        ClaudeKind.Skills -> stringResource(Res.string.skills)
        ClaudeKind.Mcp -> stringResource(Res.string.mcp_servers)
        ClaudeKind.Marketplaces -> stringResource(Res.string.marketplaces)
        ClaudeKind.Memories -> stringResource(Res.string.memories)
        ClaudeKind.Status -> stringResource(Res.string.service_status)
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = title,
                subtitle = if (kind == ClaudeKind.Memories) {
                    memoriesProject?.let { key -> state.historyProjects.firstOrNull { it.projectKey == key }?.path ?: key }
                } else null,
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    when (kind) {
                        ClaudeKind.Plugins -> TooltipIconButton(label = stringResource(Res.string.install), onClick = {
                            extensions?.marketplaces.orEmpty().firstOrNull()?.let { openCatalog(it.name) }
                        }) { Icon(Lucide.CirclePlus, contentDescription = null) }
                        ClaudeKind.Marketplaces -> TooltipIconButton(label = stringResource(Res.string.add), onClick = { addingMarket = true }) {
                            Icon(Lucide.CirclePlus, contentDescription = null)
                        }
                        ClaudeKind.Mcp -> TooltipIconButton(label = stringResource(Res.string.add), onClick = { addingMcp = true }) {
                            Icon(Lucide.CirclePlus, contentDescription = null)
                        }
                        ClaudeKind.Status -> TooltipIconButton(
                            label = stringResource(Res.string.status_open_page),
                            onClick = { uriHandler.openUri("https://status.claude.com") },
                        ) { Icon(Lucide.ExternalLink, contentDescription = null) }
                        else -> {}
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (kind == ClaudeKind.Memories) {
                val projects = state.historyProjects.map { it.projectKey to (it.name ?: it.path ?: it.projectKey) }
                if (projects.isNotEmpty()) {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        SelectField(stringResource(Res.string.all_projects), memoriesProject.orEmpty(), projects) { key ->
                            memoriesProject = key
                            scope.launch { memories = ClaudeApi.memories(key) }
                        }
                    }
                }
            }
            if (kind == ClaudeKind.Skills && loaded) {
                InputField(
                    value = skillQuery,
                    onValueChange = { skillQuery = it },
                    singleLine = true,
                    label = { Text(stringResource(Res.string.search)) },
                    trailingIcon = if (skillQuery.isNotEmpty()) {
                        {
                            Icon(
                                Lucide.X,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.clip(CircleShape).clickable { skillQuery = "" }.size(18.dp),
                            )
                        }
                    } else null,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }
            if (!loaded) {
                CenteredProgress(Modifier.fillMaxSize())
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    when (kind) {
                        ClaudeKind.Plugins -> items(extensions?.plugins.orEmpty(), key = { "${it.name}@${it.marketplace}" }) { plugin ->
                            DetailRow(
                                title = plugin.name,
                                subtitle = listOfNotNull(plugin.marketplace, plugin.version, plugin.scope).joinToString(" • "),
                                enabled = plugin.enabled,
                                onClick = { pluginMenu = plugin },
                            )
                        }
                        ClaudeKind.Skills -> {
                            val filtered = skills.orEmpty().filter {
                                skillQuery.isBlank() || it.name.contains(skillQuery, ignoreCase = true) ||
                                    it.description?.contains(skillQuery, ignoreCase = true) == true ||
                                    it.pluginName?.contains(skillQuery, ignoreCase = true) == true
                            }
                            items(filtered, key = { "${it.plugin}/${it.id}" }) { skill ->
                                DetailRow(
                                    title = skill.name,
                                    subtitle = skill.description ?: skill.pluginName,
                                    enabled = skill.enabled,
                                    onClick = { skillSheet = skill },
                                )
                            }
                        }
                        ClaudeKind.Mcp -> items(mcpServers.orEmpty(), key = { it.name }) { server ->
                            DetailRow(
                                title = server.name,
                                subtitle = listOfNotNull(
                                    stringResource(Res.string.disabled_state).takeIf { !server.enabled },
                                    server.type,
                                    server.detail,
                                ).joinToString(" • "),
                                enabled = true,
                                onClick = { mcpMenu = server },
                            )
                        }
                        ClaudeKind.Marketplaces -> items(extensions?.marketplaces.orEmpty(), key = { it.name }) { market ->
                            DetailRow(title = market.name, subtitle = market.repo, enabled = true, onClick = { marketMenu = market })
                        }
                        ClaudeKind.Memories -> {
                            val all = memories?.global.orEmpty() + memories?.project.orEmpty()
                            if (all.isEmpty()) {
                                item { EmptyState(stringResource(Res.string.no_files), Modifier.fillParentMaxSize()) }
                            }
                            items(all, key = { "${it.scope}/${it.name}" }) { memory ->
                                DetailRow(
                                    title = memory.name,
                                    subtitle = memory.description ?: memoryScopeLabel(memory.scope),
                                    enabled = true,
                                    onClick = {
                                        val project = if (memory.scope == "global") null else memoriesProject
                                        onOpenPreview(ClaudeApi.memoryUrl(memory.scope, project, memory.name), memory.name) {
                                            scope.launch {
                                                ClaudeApi.deleteMemory(memory.scope, project, memory.name)
                                                memories = ClaudeApi.memories(memoriesProject)
                                            }
                                        }
                                    },
                                )
                            }
                        }
                        ClaudeKind.Status -> {
                            val st = serviceStatus
                            if (st == null || st.error != null) {
                                item { EmptyState(stringResource(Res.string.status_unknown), Modifier.fillParentMaxSize()) }
                            } else {
                                item {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        StatusDot(serviceIndicatorColor(st.indicator), box = 18.dp, dot = 12.dp)
                                        Spacer(Modifier.width(12.dp))
                                        Text(
                                            serviceIndicatorLabel(st.indicator),
                                            style = MaterialTheme.typography.titleMedium,
                                            color = MaterialTheme.colorScheme.onSurface,
                                        )
                                    }
                                }
                                items(st.components, key = { it.name }) { component ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Text(
                                            component.name,
                                            style = MaterialTheme.typography.bodyLarge,
                                            color = MaterialTheme.colorScheme.onSurface,
                                            modifier = Modifier.weight(1f),
                                        )
                                        Spacer(Modifier.width(12.dp))
                                        Text(
                                            componentStatusLabel(component.status),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                        Spacer(Modifier.width(10.dp))
                                        StatusDot(componentStatusColor(component.status), box = 16.dp, dot = 10.dp)
                                    }
                                }
                                item {
                                    Text(
                                        stringResource(Res.string.status_incidents),
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
                                    )
                                }
                                if (st.incidents.isEmpty()) {
                                    item {
                                        Text(
                                            stringResource(Res.string.status_no_incidents),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                                        )
                                    }
                                } else {
                                    items(st.incidents) { incident ->
                                        val color = serviceIndicatorColor(incident.impact)
                                        val statusLabel = if (incident.status.isNotBlank()) incidentStatusLabel(incident.status) else null
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .then(if (incident.shortlink != null) Modifier.clickable { incident.shortlink?.let(uriHandler::openUri) } else Modifier)
                                                .padding(horizontal = 16.dp, vertical = 8.dp),
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                StatusDot(color, box = 14.dp, dot = 9.dp)
                                                Spacer(Modifier.width(8.dp))
                                                Text(
                                                    incident.name,
                                                    style = MaterialTheme.typography.bodyLarge,
                                                    color = MaterialTheme.colorScheme.onSurface,
                                                    modifier = Modifier.weight(1f),
                                                )
                                            }
                                            incident.latest?.let { body ->
                                                Spacer(Modifier.height(4.dp))
                                                Text(
                                                    buildAnnotatedString {
                                                        if (statusLabel != null) {
                                                            withStyle(SpanStyle(color = color, fontWeight = FontWeight.Bold)) { append(statusLabel) }
                                                            append(" • ")
                                                        }
                                                        append(body)
                                                    },
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                    maxLines = 4,
                                                    overflow = TextOverflow.Ellipsis,
                                                )
                                            }
                                            incident.updatedAt?.let { iso ->
                                                parseIsoMillis(iso)?.let { millis ->
                                                    Spacer(Modifier.height(2.dp))
                                                    Text(
                                                        formatDateShort(millis),
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                                item { Spacer(Modifier.height(16.dp)) }
                            }
                        }
                    }
                }
            }
        }
    }

    catalogMarket?.let { market ->
        CompactDialog(
            onDismiss = { catalogMarket = null },
            title = market,
            contentPadding = PaddingValues(0.dp),
            titleTrailing = {
                Box {
                    var marketPicker by remember { mutableStateOf(false) }
                    TooltipIconButton(label = stringResource(Res.string.marketplaces), onClick = { marketPicker = true }) {
                        Icon(Lucide.Store, contentDescription = null, modifier = Modifier.size(20.dp))
                    }
                    AppDropdownMenu(expanded = marketPicker, onDismissRequest = { marketPicker = false }) {
                        extensions?.marketplaces.orEmpty().forEach { entry ->
                            CompactDropdownItem(
                                text = entry.name,
                                selected = entry.name == market,
                                onClick = { marketPicker = false; openCatalog(entry.name) },
                            )
                        }
                    }
                }
            },
            buttons = {
                Button(onClick = { catalogMarket = null }, variant = ButtonVariant.Outlined) {
                    Text(stringResource(Res.string.close))
                }
            },
        ) {
            var query by remember(market) { mutableStateOf("") }
            InputField(
                value = query,
                onValueChange = { query = it },
                singleLine = true,
                label = { Text(stringResource(Res.string.search)) },
                trailingIcon = if (query.isNotEmpty()) {
                    {
                        Icon(
                            Lucide.X,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.clip(CircleShape).clickable { query = "" }.size(18.dp),
                        )
                    }
                } else null,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            )
            Spacer(Modifier.height(8.dp))
            if (busy) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp))
            }
            val list = catalog
            if (list == null) {
                CenteredProgress(Modifier.fillMaxWidth().padding(vertical = 24.dp))
            } else {
                list.filter {
                    query.isBlank() || it.name.contains(query, ignoreCase = true) ||
                        it.description?.contains(query, ignoreCase = true) == true
                }.forEach { entry ->
                    DetailRow(
                        title = entry.name + (entry.version?.let { " - $it" } ?: ""),
                        subtitle = entry.description,
                        enabled = entry.installed,
                        onClick = {
                            if (entry.installed) {
                                pluginMenu = extensions?.plugins?.firstOrNull { it.name == entry.name && it.marketplace == market }
                                catalogMarket = null
                            } else {
                                installCandidate = entry
                            }
                        },
                    )
                }
            }
        }
    }

    if (skillPreview == null) skillSheet?.let { skill ->
        CompactDialog(
            onDismiss = { skillSheet = null },
            title = skill.name,
            buttons = {
                Button(onClick = { skillSheet = null }, variant = ButtonVariant.Outlined) {
                    Text(stringResource(Res.string.close))
                }
            },
        ) {
            val files = skillFiles
            if (files == null) {
                CenteredProgress(Modifier.fillMaxWidth().padding(vertical = 24.dp))
            } else {
                if (!skill.description.isNullOrBlank()) {
                    OutlinedPanel(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            skill.description!!,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                }
                OutlinedPanel(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { skillPreview = ClaudeApi.skillFileUrl(skill.plugin, skill.id, "SKILL.md") to "${skill.id} - SKILL.md" },
                ) {
                    Text("SKILL.md", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
                }
                val refs = files.filter { it != "SKILL.md" }
                if (refs.isNotEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        stringResource(Res.string.references),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(6.dp))
                    refs.forEach { f ->
                        OutlinedPanel(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                            onClick = { skillPreview = ClaudeApi.skillFileUrl(skill.plugin, skill.id, f) to f.substringAfterLast('/') },
                        ) {
                            Text(f.substringAfterLast('/'), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                            Text(f, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }

    skillPreview?.let { (purl, pname) ->
        FilePreviewScreen(url = purl, filename = pname, onClose = { skillPreview = null })
    }

    pluginMenu?.let { plugin ->
        val key = "${plugin.name}@${plugin.marketplace}"
        CompactDialog(
            onDismiss = { if (dialogBusy == null) pluginMenu = null },
            title = plugin.name,
            titleTrailing = {
                CompactSwitch(plugin.enabled, enabled = dialogBusy == null) {
                    dialogBusy = "toggle"
                    runAction { ClaudeApi.pluginAction(if (plugin.enabled) "disable" else "enable", key) }
                }
            },
            buttons = {
                Button(onClick = { pluginMenu = null }, variant = ButtonVariant.Outlined, enabled = dialogBusy == null) {
                    Text(stringResource(Res.string.close))
                }
            },
        ) {
            if (!plugin.description.isNullOrBlank() || plugin.version != null) {
                OutlinedPanel(modifier = Modifier.fillMaxWidth()) {
                    if (!plugin.description.isNullOrBlank()) {
                        Text(
                            plugin.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    plugin.version?.let { version ->
                        Text(
                            stringResource(Res.string.version_label, version),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
            if (dialogBusy == "toggle") {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
            }
            if (dialogBusy == "update") {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
            }
            ActionButton(
                text = stringResource(Res.string.update_action),
                enabled = dialogBusy == null,
                onClick = {
                    dialogBusy = "update"
                    runAction { ClaudeApi.pluginAction("update", key) }
                },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            if (dialogBusy == "uninstall") {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
            }
            ActionButton(
                text = stringResource(Res.string.uninstall),
                enabled = dialogBusy == null,
                onClick = { confirmUninstall = plugin },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    confirmUninstall?.let { plugin ->
        ConfirmDialog(
            title = stringResource(Res.string.uninstall),
            text = stringResource(Res.string.delete_file_confirm, plugin.name),
            confirmLabel = stringResource(Res.string.uninstall),
            onConfirm = {
                confirmUninstall = null
                dialogBusy = "uninstall"
                runAction { ClaudeApi.pluginAction("uninstall", "${plugin.name}@${plugin.marketplace}") }
            },
            onDismiss = { confirmUninstall = null },
        )
    }

    installCandidate?.let { entry ->
        CompactDialog(
            onDismiss = { installCandidate = null },
            title = entry.name,
            buttons = {
                Button(onClick = { installCandidate = null }, variant = ButtonVariant.Outlined) {
                    Text(stringResource(Res.string.cancel))
                }
                Button(onClick = {
                    installCandidate = null
                    runAction { ClaudeApi.pluginAction("install", "${entry.name}@${catalogMarket.orEmpty()}") }
                }) { Text(stringResource(Res.string.install)) }
            },
        ) {
            OutlinedPanel(modifier = Modifier.fillMaxWidth()) {
                Text(
                    entry.description ?: entry.name,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                entry.version?.let { version ->
                    Text(
                        stringResource(Res.string.version_label, version),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
    }

    marketMenu?.let { market ->
        CompactDialog(
            onDismiss = { if (dialogBusy == null) marketMenu = null },
            title = market.name,
            buttons = {
                Button(onClick = { marketMenu = null }, variant = ButtonVariant.Outlined, enabled = dialogBusy == null) {
                    Text(stringResource(Res.string.close))
                }
            },
        ) {
            market.repo?.let {
                OutlinedPanel(modifier = Modifier.fillMaxWidth()) {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(12.dp))
            }
            if (dialogBusy == "update") {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
            }
            ActionButton(
                text = stringResource(Res.string.update_action),
                enabled = dialogBusy == null,
                onClick = {
                    dialogBusy = "update"
                    runAction { ClaudeApi.marketplaceAction("update", market.name) }
                },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            ActionButton(
                text = stringResource(Res.string.delete),
                enabled = dialogBusy == null,
                onClick = { confirmMarketRemove = market },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    confirmMarketRemove?.let { market ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_file_confirm, market.name),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = {
                confirmMarketRemove = null
                runAction { ClaudeApi.marketplaceAction("remove", market.name) }
            },
            onDismiss = { confirmMarketRemove = null },
        )
    }

    if (addingMarket) {
        RenameDialog(
            initial = "",
            title = stringResource(Res.string.marketplaces),
            confirmLabel = stringResource(Res.string.add),
            onConfirm = { source ->
                addingMarket = false
                runAction { ClaudeApi.marketplaceAction("add", source.trim()) }
            },
            onDismiss = { addingMarket = false },
        )
    }

    mcpMenu?.let { server ->
        CompactDialog(
            onDismiss = { if (dialogBusy == null) mcpMenu = null },
            title = server.name,
            titleTrailing = {
                CompactSwitch(server.enabled, enabled = dialogBusy == null) { enabled ->
                    dialogBusy = "toggle"
                    runAction { ClaudeApi.mcpToggle(server.name, enabled) }
                }
            },
            buttons = {
                Button(onClick = { mcpMenu = null }, variant = ButtonVariant.Outlined, enabled = dialogBusy == null) {
                    Text(stringResource(Res.string.close))
                }
            },
        ) {
            server.detail?.let {
                OutlinedPanel(modifier = Modifier.fillMaxWidth()) {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(12.dp))
            }
            if (dialogBusy == "toggle") {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
            }
            ActionButton(
                text = stringResource(Res.string.delete),
                enabled = dialogBusy == null,
                onClick = { confirmMcpRemove = server },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    confirmMcpRemove?.let { server ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_file_confirm, server.name),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = {
                confirmMcpRemove = null
                mcpMenu = null
                runAction { ClaudeApi.mcpRemove(server.name) }
            },
            onDismiss = { confirmMcpRemove = null },
        )
    }

    if (addingMcp) {
        McpAddDialog(
            onConfirm = { name, target, transport ->
                addingMcp = false
                runAction { ClaudeApi.mcpAdd(name, target, transport) }
            },
            onDismiss = { addingMcp = false },
        )
    }

    actionError?.let { message ->
        CompactDialog(
            onDismiss = { actionError = null },
            title = stringResource(Res.string.connection_error),
            buttons = { Button(onClick = { actionError = null }) { Text(stringResource(Res.string.accept)) } },
        ) {
            Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun McpAddDialog(onConfirm: (String, String, String) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var target by remember { mutableStateOf("") }
    var transport by remember { mutableStateOf("stdio") }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.mcp_servers),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(
                onClick = { onConfirm(name.trim(), target.trim(), transport) },
                enabled = name.isNotBlank() && target.isNotBlank(),
            ) { Text(stringResource(Res.string.add)) }
        },
    ) {
        InputField(
            value = name,
            onValueChange = { name = it },
            label = { Text(stringResource(Res.string.environment_name)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        SelectField(
            stringResource(Res.string.transport),
            transport,
            listOf("stdio" to "stdio", "http" to "http", "sse" to "sse"),
        ) { transport = it }
        Spacer(Modifier.height(10.dp))
        InputField(
            value = target,
            onValueChange = { target = it },
            label = { Text(stringResource(Res.string.command_or_url)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
internal fun memoryScopeLabel(scope: String): String = when (scope) {
    "global" -> stringResource(Res.string.memory_global)
    "repo" -> "CLAUDE.md"
    else -> stringResource(Res.string.memories)
}

@Composable
private fun DetailRow(title: String, subtitle: String?, enabled: Boolean, onClick: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = DialogItemInset)
            .clip(DialogItemShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = DialogItemPaddingH, vertical = DialogItemPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        StatusDot(if (enabled) palette.green else MaterialTheme.colorScheme.outlineVariant, box = 16.dp, dot = 10.dp)
    }
}
