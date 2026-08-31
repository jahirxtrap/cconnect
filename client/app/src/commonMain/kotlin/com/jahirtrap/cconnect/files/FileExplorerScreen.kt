package com.jahirtrap.cconnect.files

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import com.jahirtrap.cconnect.ui.AppDropdownMenu
import com.jahirtrap.cconnect.ui.clickable
import com.jahirtrap.cconnect.ui.secondaryClick
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import com.jahirtrap.cconnect.ui.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import com.jahirtrap.cconnect.ui.Button
import com.jahirtrap.cconnect.ui.ButtonVariant
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import org.jetbrains.compose.resources.pluralStringResource
import androidx.compose.ui.text.AnnotatedString
import org.jetbrains.compose.resources.stringResource
import org.jetbrains.compose.resources.StringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.composables.icons.lucide.ArrowDown
import com.composables.icons.lucide.ArrowDownUp
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.ArrowUp
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.ClipboardCopy
import com.composables.icons.lucide.Copy
import com.composables.icons.lucide.Download
import com.composables.icons.lucide.EllipsisVertical
import com.composables.icons.lucide.ExternalLink
import com.composables.icons.lucide.Eye
import com.composables.icons.lucide.File
import com.composables.icons.lucide.Folder
import com.composables.icons.lucide.FolderArchive
import com.composables.icons.lucide.FolderInput
import com.composables.icons.lucide.FolderPlus
import com.composables.icons.lucide.House
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.PackageOpen
import com.composables.icons.lucide.Pencil
import com.composables.icons.lucide.Plus
import com.composables.icons.lucide.Save
import com.composables.icons.lucide.Search
import com.composables.icons.lucide.Server
import com.composables.icons.lucide.Share2
import com.composables.icons.lucide.Trash
import com.composables.icons.lucide.Upload
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.chat.ChatViewModel
import com.jahirtrap.cconnect.chat.LocalChatViewModelFactory
import com.jahirtrap.cconnect.isWebPlatform
import com.jahirtrap.cconnect.data.SelectionLock
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.data.SharedEntry
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.SharedApi
import com.jahirtrap.cconnect.data.remote.SharedWatchSocket
import com.jahirtrap.cconnect.ui.AbovePopupMenu
import com.jahirtrap.cconnect.ui.theme.Radius
import com.jahirtrap.cconnect.ui.theme.topEdge
import androidx.compose.foundation.layout.RowScope
import androidx.compose.ui.draw.drawBehind
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.BackInterceptor
import com.jahirtrap.cconnect.ui.HistoryNavHandler
import com.jahirtrap.cconnect.ui.horizontalScrollbar
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.ClipKey
import com.jahirtrap.cconnect.ui.ClipboardShortcutHandler
import com.jahirtrap.cconnect.ui.PreviewOverlay
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.CompactDropdownItem
import com.jahirtrap.cconnect.ui.CompactDropdownSubMenu
import com.jahirtrap.cconnect.ui.CompactSwitch
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.LocalIsTouch
import com.jahirtrap.cconnect.ui.DialogActionItem
import com.jahirtrap.cconnect.ui.InputField
import com.jahirtrap.cconnect.ui.SelectField
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.EnvironmentSelectDialog
import com.jahirtrap.cconnect.ui.ListRow
import com.jahirtrap.cconnect.ui.LocalMobileLayout
import com.jahirtrap.cconnect.ui.RenameDialog
import com.jahirtrap.cconnect.ui.SelectionDot
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.theme.palette
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.jahirtrap.cconnect.ui.theme.snapDp
import com.jahirtrap.cconnect.ui.dropOverlay

private enum class TransferKind { Move, Copy, Extract }

private data class TransferOp(
    val kind: TransferKind,
    val paths: List<String>,
    val sourceDir: String,
    val folders: List<String>,
    val members: List<String>? = null,
    val base: String = "",
)

private data class ExtractRequest(
    val archive: String,
    val members: List<String>?,
    val base: String,
    val stem: String,
)

private fun archiveStem(name: String): String {
    val low = name.lowercase()
    val suffix = ARCHIVE_SUFFIXES.sortedByDescending { it.length }.firstOrNull { low.endsWith(it) } ?: return name
    return name.dropLast(suffix.length)
}

private enum class SortField(val key: String, val label: StringResource) {
    Name("name", Res.string.sort_name),
    Date("date", Res.string.sort_date),
    Type("type", Res.string.sort_type),
    Size("size", Res.string.sort_size);

    companion object {
        fun from(key: String): SortField = entries.firstOrNull { it.key == key } ?: Name
    }
}

private fun sortEntries(entries: List<SharedEntry>, field: SortField, ascending: Boolean): List<SharedEntry> {
    val comparator: Comparator<SharedEntry> = when (field) {
        SortField.Name -> compareBy(String.CASE_INSENSITIVE_ORDER) { it.name }
        SortField.Date -> compareBy { it.modified }
        SortField.Type -> compareBy({ it.name.substringAfterLast('.', "").lowercase() }, { it.name.lowercase() })
        SortField.Size -> compareBy { if (it.isDir) it.items.toLong() else it.size }
    }
    val directed = if (ascending) comparator else comparator.reversed()
    return entries.sortedWith(compareByDescending<SharedEntry> { it.isDir }.then(directed))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileExplorerScreen(
    onClose: () -> Unit,
    onOpenPreview: (url: String, filename: String, onDelete: (() -> Unit)?) -> Unit,
    initialArchive: String? = null,
) {
    val vm: ChatViewModel = viewModel(factory = LocalChatViewModelFactory.current)
    val state by vm.state.collectAsState()
    val scope = rememberCoroutineScope()
    val watcher = remember(state.activeEnvironmentId) { SharedWatchSocket(scope) { Backend.snapshot() } }
    DisposableEffect(watcher) {
        watcher.connect()
        onDispose { watcher.close() }
    }
    val listState = rememberLazyListState()
    val haptics = LocalHapticFeedback.current
    val clipboard = LocalClipboardManager.current

    val urlLoc = remember { readFilesLocation() }
    val hasUrlLoc = urlLoc != null && (urlLoc.first.isNotEmpty() || urlLoc.second != null)
    var path by remember { mutableStateOf(if (hasUrlLoc) urlLoc!!.first else initialArchive?.substringBeforeLast('/', "") ?: "") }
    var archive by remember { mutableStateOf(if (hasUrlLoc) urlLoc!!.second else initialArchive) }
    var archiveDir by remember { mutableStateOf(if (hasUrlLoc) urlLoc!!.third else "") }
    val histBack = remember { mutableStateListOf<Triple<String, String?, String>>() }
    val histFwd = remember { mutableStateListOf<Triple<String, String?, String>>() }
    var histCurrent by remember { mutableStateOf<Triple<String, String?, String>?>(null) }
    var histNavigating by remember { mutableStateOf(false) }
    var extractRequest by remember { mutableStateOf<ExtractRequest?>(null) }
    var compressing by remember { mutableStateOf<List<String>?>(null) }
    var entries by remember { mutableStateOf<List<SharedEntry>>(emptyList()) }
    var loaded by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var selecting by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<Set<String>>(emptySet()) }
    var marking by remember { mutableStateOf(false) }
    var transfer by remember { mutableStateOf<TransferOp?>(null) }
    var confirmingDelete by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf<SharedEntry?>(null) }
    var creatingFolder by remember { mutableStateOf(false) }
    var envMenu by remember { mutableStateOf(false) }
    val environmentLocked by SelectionLock.environment.collectAsState()
    var barMenu by remember { mutableStateOf(false) }
    var sortMenu by remember { mutableStateOf(false) }
    val settings = remember { Settings() }
    var sortField by remember { mutableStateOf(SortField.from(settings.fileSortField)) }
    var sortAscending by remember { mutableStateOf(settings.fileSortAscending) }
    val activeName = state.environments.firstOrNull { it.id == state.activeEnvironmentId }?.name
    var searching by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<SharedEntry>?>(null) }
    LaunchedEffect(searchQuery, path, searching) {
        if (!searching || searchQuery.isBlank()) {
            searchResults = null
            return@LaunchedEffect
        }
        delay(300)
        searchResults = SharedApi.search(path, searchQuery.trim())
    }
    val ordered = remember(entries, sortField, sortAscending, searchResults) {
        sortEntries(searchResults ?: entries, sortField, sortAscending)
    }

    var pendingUploads by remember { mutableStateOf<List<AttachmentFile>>(emptyList()) }
    var dropOver by remember { mutableStateOf(false) }
    ClipboardPasteEffect(enabled = archive == null && !PreviewOverlay.open) { pendingUploads = it }

    fun child(name: String) = if (path.isEmpty()) name else "$path/$name"
    fun innerChild(name: String) = if (archiveDir.isEmpty()) name else "$archiveDir/$name"

    fun exitSelection() {
        selecting = false
        selected = emptySet()
    }

    fun reload() {
        val arc = archive
        if (arc == null) {
            watcher.refresh()
            return
        }
        scope.launch {
            entries = runCatching { SharedApi.archiveList(arc, archiveDir) }.getOrNull() ?: emptyList()
            loaded = true
        }
    }
    LaunchedEffect(watcher) {
        watcher.entries.collect { live ->
            if (live == null) return@collect
            if (archive == null) {
                entries = live
                loaded = true
                failed = false
            } else {
                reload()
            }
        }
    }
    LaunchedEffect(state.activeEnvironmentId, path, archive, archiveDir) {
        exitSelection(); loaded = false; entries = emptyList()
        val arc = archive
        if (arc != null) watcher.watch(arc.substringBeforeLast('/', "")) else watcher.watch(path)
    }
    LaunchedEffect(state.activeEnvironmentId) { transfer = null }
    LaunchedEffect(path) {
        var seen = UploadManager.uploads.value.filter { it.status != UploadManager.Status.Uploading }.map { it.id }.toSet()
        UploadManager.uploads.collect { list ->
            val finished = list.filter { it.status != UploadManager.Status.Uploading }
            val fresh = finished.filter { it.id !in seen }
            seen = finished.map { it.id }.toSet()
            if (fresh.any { it.dir == path && it.status == UploadManager.Status.Done }) reload()
        }
    }
    LaunchedEffect(path, archive, archiveDir) { syncFilesLocation(path, archive, archiveDir) }
    FilesPopstate { p, a, ad -> path = p; archive = a; archiveDir = ad }
    LaunchedEffect(path, archive, archiveDir) {
        val loc = Triple(path, archive, archiveDir)
        when {
            histCurrent == null -> histCurrent = loc
            loc == histCurrent -> {}
            histNavigating -> { histNavigating = false; histCurrent = loc }
            else -> { histCurrent?.let { histBack.add(it) }; histFwd.clear(); histCurrent = loc }
        }
    }

    fun goUp() {
        when {
            archive != null && archiveDir.isNotEmpty() -> archiveDir = archiveDir.substringBeforeLast('/', "")
            archive != null -> { archive = null; archiveDir = "" }
            path.isEmpty() -> onClose()
            else -> path = path.substringBeforeLast('/', "")
        }
    }
    fun handleBack(): Boolean = when {
        selecting -> { exitSelection(); true }
        searching -> { searching = false; searchQuery = ""; true }
        archive != null || path.isNotEmpty() -> { goUp(); true }
        transfer != null -> { transfer = null; true }
        else -> false
    }
    val selectedEntries = entries.filter { it.name in selected }
    val single = if (selected.size == 1) selectedEntries.firstOrNull() else null
    val canShare = selectedEntries.isNotEmpty() && selectedEntries.none { it.isDir }
    val allSelected = entries.isNotEmpty() && selected.size == entries.size
    val currentTransfer = transfer
    val transferAllowed = currentTransfer != null && archive == null &&
        currentTransfer.folders.none { path == it || path.startsWith("$it/") } &&
        (currentTransfer.kind != TransferKind.Move || path != currentTransfer.sourceDir)

    val shortcutsEnabled = !searching && renaming == null && !creatingFolder &&
        !confirmingDelete && extractRequest == null && compressing == null && !PreviewOverlay.open
    ClipboardShortcutHandler(enabled = shortcutsEnabled) { key ->
        when (key) {
            ClipKey.Copy -> if (archive == null && selected.isNotEmpty()) {
                transfer = TransferOp(
                    kind = TransferKind.Copy,
                    paths = selectedEntries.map { child(it.name) },
                    sourceDir = path,
                    folders = selectedEntries.filter { it.isDir }.map { child(it.name) },
                )
                exitSelection()
                true
            } else false
            ClipKey.Cut -> if (archive == null && selected.isNotEmpty()) {
                transfer = TransferOp(
                    kind = TransferKind.Move,
                    paths = selectedEntries.map { child(it.name) },
                    sourceDir = path,
                    folders = selectedEntries.filter { it.isDir }.map { child(it.name) },
                )
                exitSelection()
                true
            } else false
            ClipKey.Paste -> {
                val op = transfer
                if (op != null && transferAllowed) {
                    scope.launch {
                        when (op.kind) {
                            TransferKind.Move -> SharedApi.move(op.paths, path)
                            TransferKind.Copy -> SharedApi.copy(op.paths, path)
                            TransferKind.Extract -> SharedApi.extract(
                                op.paths.first(), dest = path, intoFolder = false,
                                members = op.members, base = op.base,
                            )
                        }
                        transfer = null
                        reload()
                    }
                    true
                } else if (archive == null && clipboardHasFiles()) {
                    scope.launch { readClipboardFiles().takeIf { it.isNotEmpty() }?.let { pendingUploads = it } }
                    true
                } else false
            }
            ClipKey.Cancel -> if (transfer != null) { transfer = null; true } else false
        }
    }

    var shownCount by remember { mutableStateOf(0) }
    var shownSingle by remember { mutableStateOf<SharedEntry?>(null) }
    var shownCanShare by remember { mutableStateOf(false) }
    var shownFiles by remember { mutableStateOf<List<SharedEntry>>(emptyList()) }
    var shownSelection by remember { mutableStateOf<List<SharedEntry>>(emptyList()) }
    var shownTransfer by remember { mutableStateOf<TransferOp?>(null) }
    if (selected.isNotEmpty()) {
        shownCount = selected.size
        shownSingle = single
        shownCanShare = canShare
        shownFiles = if (canShare) selectedEntries else emptyList()
        shownSelection = selectedEntries
    }
    if (currentTransfer != null) shownTransfer = currentTransfer
    var suppressClick by remember { mutableStateOf<String?>(null) }

    val screenFocus = remember { FocusRequester() }
    BackInterceptor { handleBack() }
    HistoryNavHandler(
        enabled = !isWebPlatform,
        onBack = {
            if (selecting && selected.isNotEmpty()) false
            else if (histBack.isEmpty()) false
            else {
                val prev = histBack.removeAt(histBack.lastIndex)
                histCurrent?.let { histFwd.add(it) }
                histNavigating = true
                path = prev.first; archive = prev.second; archiveDir = prev.third
                true
            }
        },
        onForward = {
            if (histFwd.isEmpty()) false
            else {
                val next = histFwd.removeAt(histFwd.lastIndex)
                histCurrent?.let { histBack.add(it) }
                histNavigating = true
                path = next.first; archive = next.second; archiveDir = next.third
                true
            }
        },
    )
    LaunchedEffect(searching, renaming, confirmingDelete, creatingFolder) {
        if (!searching && renaming == null && !confirmingDelete && !creatingFolder) runCatching { screenFocus.requestFocus() }
    }

    Scaffold(
        topBar = {
            Crossfade(targetState = selecting, label = "files-topbar") { inSelection ->
                if (inSelection) {
                    AppTopBar(
                        title = pluralStringResource(Res.plurals.item_count, shownCount, shownCount),
                        navigationIcon = {
                            TooltipIconButton(
                                label = stringResource(Res.string.select_all),
                                onClick = { selected = if (allSelected) emptySet() else entries.map { it.name }.toSet() },
                            ) { SelectionDot(allSelected) }
                        },
                        actions = {
                            TooltipIconButton(label = stringResource(Res.string.cancel), onClick = ::exitSelection) {
                                Icon(Lucide.X, contentDescription = null)
                            }
                        },
                    )
                } else {
                    AppTopBar(
                        title = stringResource(Res.string.files),
                        subtitle = if (failed) stringResource(Res.string.server_unavailable) else activeName,
                        subtitleLeading = if (failed) ({ StatusDot(palette.red, box = 8.dp) }) else null,
                        navigationIcon = {
                            TooltipIconButton(label = stringResource(Res.string.back), onClick = ::goUp) {
                                Icon(Lucide.ArrowLeft, contentDescription = null)
                            }
                        },
                        actions = {
                            UploadIndicator()
                            if (!selecting && currentTransfer == null && archive == null) {
                                TooltipIconButton(
                                    label = stringResource(Res.string.upload_files),
                                    onClick = {
                                        scope.launch {
                                            val picked = pickFiles()
                                            if (picked.isNotEmpty()) pendingUploads = picked
                                        }
                                    },
                                ) { Icon(Lucide.Upload, contentDescription = null) }
                            }
                            TooltipIconButton(
                                label = stringResource(Res.string.environment),
                                onClick = { envMenu = true },
                                enabled = !environmentLocked,
                            ) { Icon(Lucide.Server, contentDescription = null) }
                            Box {
                                TooltipIconButton(label = stringResource(Res.string.more_options), onClick = { barMenu = true }) {
                                    Icon(Lucide.EllipsisVertical, contentDescription = null)
                                }
                                AppDropdownMenu(
                                    expanded = barMenu,
                                    onDismissRequest = { barMenu = false; sortMenu = false },
                                ) {
                                    CompactDropdownSubMenu(
                                        text = stringResource(Res.string.sort_by),
                                        expanded = sortMenu,
                                        onExpandedChange = { sortMenu = it },
                                        leadingIcon = {
                                            Icon(
                                                Lucide.ArrowDownUp,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.size(16.dp),
                                            )
                                        },
                                    ) {
                                        SortField.entries.forEach { field ->
                                            CompactDropdownItem(
                                                text = stringResource(field.label),
                                                selected = field == sortField,
                                                onClick = {
                                                    sortField = field
                                                    settings.fileSortField = field.key
                                                },
                                            )
                                        }
                                        val toggleDirection = {
                                            sortAscending = !sortAscending
                                            settings.fileSortAscending = sortAscending
                                        }
                                        CompactDropdownItem(
                                            text = stringResource(Res.string.sort_ascending),
                                            trailing = { CompactSwitch(checked = sortAscending) { toggleDirection() } },
                                            onClick = toggleDirection,
                                        )
                                    }
                                    if (archive == null) CompactDropdownItem(
                                        text = stringResource(Res.string.new_folder),
                                        leadingIcon = {
                                            Icon(
                                                Lucide.FolderPlus,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.size(16.dp),
                                            )
                                        },
                                        onClick = { barMenu = false; sortMenu = false; creatingFolder = true },
                                    )
                                }
                            }
                        },
                    )
                }
            }
        },
        bottomBar = {
            Box {
                Spacer(Modifier.navigationBarsPadding())
                AnimatedVisibility(
                    visible = currentTransfer != null,
                    enter = expandVertically(expandFrom = Alignment.Top) + fadeIn(),
                    exit = shrinkVertically(shrinkTowards = Alignment.Top) + fadeOut(),
                ) {
                    shownTransfer?.let { op ->
                        TransferBar(
                            kind = op.kind,
                            enabled = transferAllowed,
                            onCancel = { transfer = null },
                            onConfirm = {
                                scope.launch {
                                    when (op.kind) {
                                        TransferKind.Move -> SharedApi.move(op.paths, path)
                                        TransferKind.Copy -> SharedApi.copy(op.paths, path)
                                        TransferKind.Extract -> SharedApi.extract(
                                            op.paths.first(), dest = path, intoFolder = false,
                                            members = op.members, base = op.base,
                                        )
                                    }
                                    transfer = null
                                    reload()
                                }
                            },
                        )
                    }
                }
                AnimatedVisibility(
                    visible = currentTransfer == null && selecting && selected.isNotEmpty() && !marking && archive != null,
                    enter = expandVertically(expandFrom = Alignment.Top) + fadeIn(),
                    exit = shrinkVertically(shrinkTowards = Alignment.Top) + fadeOut(),
                ) {
                    val currentArchive = archive
                    ArchiveSelectionToolbar(
                        onExtract = {
                            if (currentArchive != null) extractRequest = ExtractRequest(
                                archive = currentArchive,
                                members = shownSelection.map { innerChild(it.name) },
                                base = archiveDir,
                                stem = archiveStem(currentArchive.substringAfterLast('/')),
                            )
                        },
                        onView = shownSingle?.takeIf { !it.isDir && isPreviewable(it.name) }?.let { entry ->
                            {
                                if (currentArchive != null) onOpenPreview(SharedApi.archiveFileUrl(currentArchive, innerChild(entry.name)), entry.name, null)
                                exitSelection()
                            }
                        },
                        onSave = shownSelection.takeIf { sel -> sel.isNotEmpty() && sel.none { it.isDir } }?.let { files ->
                            {
                                if (currentArchive != null) scope.launch {
                                    files.forEach {
                                        downloadShared(SharedApi.archiveFileUrl(currentArchive, innerChild(it.name)), it.name)
                                    }
                                }
                                exitSelection()
                            }
                        },
                    )
                }
                AnimatedVisibility(
                    visible = currentTransfer == null && selecting && selected.isNotEmpty() && !marking && archive == null,
                    enter = expandVertically(expandFrom = Alignment.Top) + fadeIn(),
                    exit = shrinkVertically(shrinkTowards = Alignment.Top) + fadeOut(),
                ) {
                    SelectionToolbar(
                        canShare = shownCanShare,
                    onMove = {
                        transfer = TransferOp(
                            kind = TransferKind.Move,
                            paths = selectedEntries.map { child(it.name) },
                            sourceDir = path,
                            folders = selectedEntries.filter { it.isDir }.map { child(it.name) },
                        )
                        exitSelection()
                    },
                    onCopy = {
                        transfer = TransferOp(
                            kind = TransferKind.Copy,
                            paths = selectedEntries.map { child(it.name) },
                            sourceDir = path,
                            folders = selectedEntries.filter { it.isDir }.map { child(it.name) },
                        )
                        exitSelection()
                    },
                    onShare = {
                        scope.launch {
                            val files = selectedEntries.map { SharedApi.downloadUrl(child(it.name)) to it.name }
                            openAllSharedExternally(files)
                            exitSelection()
                        }
                    },
                        onDelete = { confirmingDelete = true },
                        onView = shownSingle?.takeIf { !it.isDir && isPreviewable(it.name) }?.let { entry ->
                            {
                                val rel = child(entry.name)
                                onOpenPreview(SharedApi.downloadUrl(rel), entry.name) { scope.launch { SharedApi.delete(rel); reload() } }
                                exitSelection()
                            }
                        },
                        onOpenInBrowser = shownSingle?.takeIf { !it.isDir && previewKindOf(it.name) == PreviewKind.Html }?.let { entry ->
                            {
                                scope.launch { openSharedInBrowser(SharedApi.downloadUrl(child(entry.name)), entry.name) }
                                exitSelection()
                            }
                        },
                        onRename = shownSingle?.let { entry -> { renaming = entry } },
                        onSave = shownFiles.takeIf { it.isNotEmpty() }?.let { files ->
                            {
                                scope.launch { files.forEach { downloadShared(SharedApi.downloadUrl(child(it.name)), it.name) } }
                                exitSelection()
                            }
                        },
                        onSaveAs = shownFiles.takeIf { it.isNotEmpty() }?.let { files ->
                            {
                                if (files.size == 1) {
                                    scope.launch { saveSharedAs(SharedApi.downloadUrl(child(files.first().name)), files.first().name) }
                                } else {
                                    scope.launch { saveAllShared(files.map { SharedApi.downloadUrl(child(it.name)) to it.name }) }
                                }
                                exitSelection()
                            }
                        },
                        onCopyPath = shownSelection.takeIf { it.isNotEmpty() }?.let { sel ->
                            {
                                scope.launch {
                                    SharedApi.absolutePaths(sel.map { child(it.name) })?.let { paths ->
                                        clipboard.setText(AnnotatedString(paths.joinToString("\n")))
                                    }
                                    exitSelection()
                                }
                            }
                        },
                        onCompress = shownSelection.takeIf { it.isNotEmpty() }?.let { sel ->
                            { compressing = sel.map { child(it.name) } }
                        },
                        onExtract = shownSingle
                            ?.takeIf { !it.isDir && isArchive(it.name) }
                            ?.let { entry ->
                                {
                                    extractRequest = ExtractRequest(
                                        archive = child(entry.name),
                                        members = null,
                                        base = "",
                                        stem = archiveStem(entry.name),
                                    )
                                }
                            },
                    )
                }
            }
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
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding).imePadding()
                .fileDropTarget(enabled = archive == null, onDragChange = { dropOver = it }) { pendingUploads = it }
                .dropOverlay(dropOver, MaterialTheme.colorScheme.primary)
                .focusRequester(screenFocus).focusable()
                .onPreviewKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) false
                    else when (e.key) {
                        Key.Escape -> handleBack()
                        Key.Delete -> if (selected.isNotEmpty() && !confirmingDelete) { confirmingDelete = true; true } else false
                        else -> false
                    }
                },
        ) {
            val displayPath = archive?.let { listOf(it, archiveDir).filter { s -> s.isNotEmpty() }.joinToString("/") } ?: path
            PathBar(
                path = displayPath,
                searching = searching,
                query = searchQuery,
                searchable = archive == null,
                onQueryChange = { searchQuery = it },
                onToggleSearch = { searching = !searching; if (!searching) searchQuery = "" },
                onNavigate = { target ->
                    val current = archive
                    if (current != null && (target == current || target.startsWith("$current/"))) {
                        archiveDir = target.removePrefix(current).trim('/')
                    } else {
                        archive = null
                        archiveDir = ""
                        path = target
                    }
                },
            )
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                fun itemIndexAt(y: Float): Int? = listState.layoutInfo.visibleItemsInfo
                    .firstOrNull { y >= it.offset && y < it.offset + it.size }?.index
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(ordered) {
                            var anchor = -1
                            var base = emptySet<String>()
                            detectDragGesturesAfterLongPress(
                                onDragStart = { offset ->
                                    if (transfer != null) return@detectDragGesturesAfterLongPress
                                    itemIndexAt(offset.y)?.let { idx ->
                                        anchor = idx
                                        base = if (selecting) selected else emptySet()
                                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                        marking = true
                                        selecting = true
                                        ordered.getOrNull(idx)?.let {
                                            selected = base + it.name
                                            suppressClick = it.name
                                        }
                                    }
                                },
                                onDrag = { change, _ ->
                                    if (anchor < 0) return@detectDragGesturesAfterLongPress
                                    suppressClick = null
                                    itemIndexAt(change.position.y)?.let { idx ->
                                        val range = if (idx >= anchor) anchor..idx else idx..anchor
                                        selected = base + range.mapNotNull { ordered.getOrNull(it)?.name }
                                    }
                                    val edge = 96.dp.toPx()
                                    when {
                                        change.position.y > size.height - edge -> scope.launch { listState.scrollBy(24.dp.toPx()) }
                                        change.position.y < edge -> scope.launch { listState.scrollBy(-24.dp.toPx()) }
                                    }
                                },
                                onDragEnd = { anchor = -1; marking = false },
                                onDragCancel = { anchor = -1; marking = false },
                            )
                        },
                ) {
                    when {
                        ordered.isNotEmpty() -> items(ordered, key = { it.name }) { entry ->
                            val isSelected = entry.name in selected
                            EntryRow(
                                entry = entry,
                                selecting = selecting,
                                selected = isSelected,
                                onSecondaryClick = {
                                    if (currentTransfer == null) {
                                        selecting = true
                                        selected = if (isSelected) selected - entry.name else selected + entry.name
                                    }
                                },
                                onClick = {
                                    when {
                                        suppressClick == entry.name -> suppressClick = null
                                        selecting -> selected = if (isSelected) selected - entry.name else selected + entry.name
                                        entry.isDir -> {
                                            if (archive != null) {
                                                archiveDir = innerChild(entry.name)
                                            } else {
                                                path = child(entry.name)
                                                searching = false
                                                searchQuery = ""
                                            }
                                        }
                                        archive != null -> {
                                            if (isPreviewable(entry.name)) {
                                                onOpenPreview(SharedApi.archiveFileUrl(archive!!, innerChild(entry.name)), entry.name, null)
                                            } else if (currentTransfer == null) {
                                                selecting = true; selected = setOf(entry.name)
                                            }
                                        }
                                        isArchive(entry.name) -> {
                                            archive = child(entry.name)
                                            archiveDir = ""
                                            searching = false
                                            searchQuery = ""
                                        }
                                        isPreviewable(entry.name) -> {
                                            val rel = child(entry.name)
                                            onOpenPreview(SharedApi.downloadUrl(rel), entry.name) { scope.launch { SharedApi.delete(rel); reload() } }
                                        }
                                        currentTransfer == null -> { selecting = true; selected = setOf(entry.name) }
                                        else -> {}
                                    }
                                },
                            )
                        }
                        !loaded -> item { CenteredProgress(Modifier.fillParentMaxSize()) }
                        else -> item { EmptyState(stringResource(Res.string.no_files), Modifier.fillParentMaxSize()) }
                    }
                }
            }
        }
    }

    if (pendingUploads.isNotEmpty()) {
        ConfirmDialog(
            title = stringResource(Res.string.upload_files),
            text = pluralStringResource(Res.plurals.upload_confirm, pendingUploads.size, pendingUploads.size),
            confirmLabel = stringResource(Res.string.upload),
            onConfirm = {
                pendingUploads.forEach { UploadManager.enqueue(it, path) }
                pendingUploads = emptyList()
            },
            onDismiss = { pendingUploads = emptyList() },
        )
    }

    if (confirmingDelete && selectedEntries.isNotEmpty()) {
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = if (selectedEntries.size == 1) stringResource(Res.string.delete_file_confirm, selectedEntries.first().name)
            else stringResource(Res.string.delete_items_confirm, selectedEntries.size),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = {
                scope.launch {
                    selectedEntries.forEach { SharedApi.delete(child(it.name)) }
                    confirmingDelete = false
                    exitSelection()
                    reload()
                }
            },
            onDismiss = { confirmingDelete = false },
        )
    }

    renaming?.let { entry ->
        val extension = if (entry.isDir) "" else entry.name.substringAfterLast('.', "")
        val base = if (extension.isNotEmpty()) entry.name.dropLast(extension.length + 1) else entry.name
        val duplicateMessage = stringResource(Res.string.already_exists)
        fun fullName(input: String) = input.trim().let { if (extension.isNotEmpty()) "$it.$extension" else it }
        RenameDialog(
            initial = base,
            suffix = if (extension.isNotEmpty()) ".$extension" else null,
            errorOf = { input ->
                val newName = fullName(input)
                if (newName != entry.name && entries.any { it.name.equals(newName, ignoreCase = true) }) duplicateMessage else null
            },
            onConfirm = { input ->
                scope.launch {
                    SharedApi.rename(child(entry.name), fullName(input))
                    renaming = null
                    exitSelection()
                    reload()
                }
            },
            onDismiss = { renaming = null },
        )
    }

    if (creatingFolder) {
        val duplicateMessage = stringResource(Res.string.already_exists)
        RenameDialog(
            initial = "",
            title = stringResource(Res.string.new_folder),
            confirmLabel = stringResource(Res.string.create),
            errorOf = { input -> if (entries.any { it.name.equals(input.trim(), ignoreCase = true) }) duplicateMessage else null },
            onConfirm = { name ->
                scope.launch { SharedApi.mkdir(child(name.trim())); creatingFolder = false; reload() }
            },
            onDismiss = { creatingFolder = false },
        )
    }

    compressing?.let { paths ->
        CompressDialog(
            defaultName = if (paths.size == 1) archiveStem(paths.first().substringAfterLast('/'))
            else path.substringAfterLast('/', "").ifEmpty { stringResource(Res.string.files).lowercase() },
            onConfirm = { name, format ->
                compressing = null
                scope.launch {
                    SharedApi.compress(paths, format, name)
                    exitSelection()
                    reload()
                }
            },
            onDismiss = { compressing = null },
        )
    }

    extractRequest?.let { request ->
        CompactDialog(
            onDismiss = { extractRequest = null },
            title = stringResource(Res.string.extract),
            contentPadding = PaddingValues(0.dp),
            buttons = {
                Button(onClick = { extractRequest = null }, variant = ButtonVariant.Outlined) {
                    Text(stringResource(Res.string.cancel))
                }
            },
        ) {
            fun run(intoFolder: Boolean) {
                extractRequest = null
                scope.launch {
                    SharedApi.extract(request.archive, intoFolder = intoFolder, members = request.members, base = request.base)
                    exitSelection()
                    if (archive != null) { archive = null; archiveDir = "" } else reload()
                }
            }
            DialogActionItem(stringResource(Res.string.extract_to_folder, request.stem), Lucide.Folder) { run(intoFolder = true) }
            DialogActionItem(stringResource(Res.string.extract_here), Lucide.PackageOpen) { run(intoFolder = false) }
            DialogActionItem(stringResource(Res.string.extract_to), Lucide.FolderInput) {
                extractRequest = null
                transfer = TransferOp(
                    kind = TransferKind.Extract,
                    paths = listOf(request.archive),
                    sourceDir = path,
                    folders = emptyList(),
                    members = request.members,
                    base = request.base,
                )
                if (archive != null) {
                    path = request.archive.substringBeforeLast('/', "")
                    archive = null
                    archiveDir = ""
                }
                exitSelection()
            }
        }
    }
}

@Composable
private fun PathBar(
    path: String,
    searching: Boolean,
    query: String,
    searchable: Boolean,
    onQueryChange: (String) -> Unit,
    onToggleSearch: () -> Unit,
    onNavigate: (String) -> Unit,
) {
    val segments = path.split("/").filter { it.isNotEmpty() }
    val scroll = rememberScrollState()
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(path, searching) { if (!searching) scroll.animateScrollTo(scroll.maxValue) }
    LaunchedEffect(searching) { if (searching) runCatching { focusRequester.requestFocus() } }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .height(40.dp)
            .clip(RoundedCornerShape(Radius.md))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (searching) {
            Box(modifier = Modifier.size(32.dp), contentAlignment = Alignment.Center) {
                Icon(
                    Lucide.Search,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
            Box(modifier = Modifier.weight(1f).padding(horizontal = 4.dp)) {
                if (query.isEmpty()) {
                    Text(
                        stringResource(Res.string.search),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
                )
            }
            PathBarButton(Lucide.X, stringResource(Res.string.close)) {
                if (query.isEmpty()) onToggleSearch() else onQueryChange("")
            }
        } else {
            PathBarButton(
                icon = Lucide.House,
                contentDescription = "/",
                active = segments.isEmpty(),
                onClick = { onNavigate("") },
            )
            Row(
                modifier = Modifier
                    .weight(1f)
                    .horizontalScrollbar(scroll, touchIndicator = false, wheelScroll = true)
                    .horizontalScroll(scroll),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                var cumulative = ""
                segments.forEachIndexed { i, seg ->
                    cumulative = if (cumulative.isEmpty()) seg else "$cumulative/$seg"
                    val target = cumulative
                    val isLast = i == segments.lastIndex
                    Icon(
                        Lucide.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                        modifier = Modifier.padding(horizontal = 2.dp).size(14.dp),
                    )
                    Text(
                        seg,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isLast) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = if (isLast) FontWeight.Medium else FontWeight.Normal,
                        maxLines = 1,
                        modifier = Modifier
                            .clip(RoundedCornerShape(Radius.sm))
                            .clickable { onNavigate(target) }
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
            if (searchable) {
                PathBarButton(Lucide.Search, stringResource(Res.string.search), onClick = onToggleSearch)
            }
        }
    }
}

@Composable
private fun PathBarButton(
    icon: ImageVector,
    contentDescription: String,
    active: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = if (active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun EntryRow(
    entry: SharedEntry,
    selecting: Boolean,
    selected: Boolean,
    onClick: () -> Unit,
    onSecondaryClick: () -> Unit,
) {
    val detail = if (entry.isDir) pluralStringResource(Res.plurals.item_count, entry.items, entry.items) else formatSize(entry.size)
    val slot by animateFloatAsState(if (selecting) 1f else 0f, label = "selection-slot")
    ListRow(
        modifier = Modifier.secondaryClick(onSecondaryClick),
        icon = when {
            entry.isDir -> Lucide.Folder
            isArchive(entry.name) -> Lucide.FolderArchive
            else -> Lucide.File
        },
        title = entry.name,
        subtitle = formatDate(entry.modified),
        leading = if (slot > 0f) ({
            Box(modifier = Modifier.width(34.dp * slot), contentAlignment = Alignment.CenterStart) {
                SelectionDot(selected, Modifier.scale(slot))
            }
        }) else null,
        onClick = onClick,
        subtitleTrailing = {
            Text(
                detail,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 8.dp, end = 8.dp),
            )
        },
    )
}

@Composable
private fun TransferBar(kind: TransferKind, enabled: Boolean, onCancel: () -> Unit, onConfirm: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainer) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Button(onClick = onCancel, modifier = Modifier.weight(1f), variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = onConfirm, enabled = enabled, modifier = Modifier.weight(1f)) {
                Text(
                    stringResource(
                        when (kind) {
                            TransferKind.Move -> Res.string.move_here
                            TransferKind.Copy -> Res.string.copy_here
                            TransferKind.Extract -> Res.string.extract_here
                        }
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun CompressDialog(defaultName: String, onConfirm: (String, String) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf(defaultName) }
    var format by remember { mutableStateOf("zip") }
    var formats by remember { mutableStateOf(listOf("zip")) }
    LaunchedEffect(Unit) { SharedApi.compressFormats()?.let { formats = it } }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.compress),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(name.trim(), format) }, enabled = name.isNotBlank()) {
                Text(stringResource(Res.string.compress))
            }
        },
    ) {
        InputField(
            value = name,
            onValueChange = { name = it },
            singleLine = true,
            label = { Text(stringResource(Res.string.name)) },
        )
        Spacer(Modifier.height(12.dp))
        SelectField(
            label = stringResource(Res.string.format),
            selected = format,
            options = formats.map { it to it.uppercase() },
            onSelect = { format = it },
        )
    }
}

@Composable
private fun ArchiveSelectionToolbar(
    onExtract: () -> Unit,
    onView: (() -> Unit)?,
    onSave: (() -> Unit)?,
) {
    SelectionBar {
        ToolbarAction(Lucide.PackageOpen, stringResource(Res.string.extract), onClick = onExtract)
        ToolbarAction(Lucide.Eye, stringResource(Res.string.view), onClick = onView ?: {}, enabled = onView != null)
        ToolbarAction(Lucide.Download, stringResource(Res.string.save), onClick = onSave ?: {}, enabled = onSave != null)
    }
}

@Composable
private fun SelectionBar(content: @Composable RowScope.() -> Unit) {
    val edge = MaterialTheme.colorScheme.outlineVariant
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .drawBehind { topEdge(edge) }
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.End),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun SelectionToolbar(
    canShare: Boolean,
    onMove: () -> Unit,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit,
    onView: (() -> Unit)?,
    onOpenInBrowser: (() -> Unit)?,
    onRename: (() -> Unit)?,
    onSave: (() -> Unit)?,
    onSaveAs: (() -> Unit)?,
    onCopyPath: (() -> Unit)?,
    onCompress: (() -> Unit)?,
    onExtract: (() -> Unit)?,
) {
    var menu by remember { mutableStateOf(false) }
    SelectionBar {
            ToolbarAction(Lucide.FolderInput, stringResource(Res.string.move), onClick = onMove)
            ToolbarAction(Lucide.Copy, stringResource(Res.string.copy), onClick = onCopy)
            ToolbarAction(Lucide.Share2, stringResource(Res.string.share), onClick = onShare, enabled = canShare)
            ToolbarAction(Lucide.Trash, stringResource(Res.string.delete), onClick = onDelete)
            if (onView != null || onOpenInBrowser != null || onRename != null || onSave != null || onSaveAs != null || onCopyPath != null) {
                Box {
                    ToolbarAction(
                        Lucide.EllipsisVertical,
                        stringResource(Res.string.more),
                        onClick = { menu = true },
                    )
                    AbovePopupMenu(expanded = menu, onDismiss = { menu = false }) {
                        if (onView != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.view),
                                leadingIcon = { Icon(Lucide.Eye, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onView() },
                            )
                        }
                        if (onOpenInBrowser != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.open_in_browser),
                                leadingIcon = { Icon(Lucide.ExternalLink, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onOpenInBrowser() },
                            )
                        }
                        if (onRename != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.rename),
                                leadingIcon = { Icon(Lucide.Pencil, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onRename() },
                            )
                        }
                        if (onSave != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.save),
                                leadingIcon = { Icon(Lucide.Download, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onSave() },
                            )
                        }
                        if (onSaveAs != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.save_as),
                                leadingIcon = { Icon(Lucide.Save, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onSaveAs() },
                            )
                        }
                        if (onCopyPath != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.copy_path),
                                leadingIcon = { Icon(Lucide.ClipboardCopy, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onCopyPath() },
                            )
                        }
                        if (onCompress != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.compress),
                                leadingIcon = { Icon(Lucide.FolderArchive, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onCompress() },
                            )
                        }
                        if (onExtract != null) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.extract),
                                leadingIcon = { Icon(Lucide.PackageOpen, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; onExtract() },
                            )
                        }
                    }
                }
            }
    }
}

@Composable
private fun ToolbarAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val compact = LocalMobileLayout.current
    TooltipIconButton(
        label = label,
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        size = 32.dp,
        showLabel = !compact,
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(if (compact) 20.dp else 18.dp))
    }
}

@Composable
private fun UploadIndicator() {
    val uploads by UploadManager.uploads.collectAsState()
    if (uploads.isEmpty()) return
    var open by remember { mutableStateOf(false) }
    val finished = uploads.count { it.status != UploadManager.Status.Uploading }
    val allDone = finished == uploads.size
    val progress = uploads.map { if (it.status == UploadManager.Status.Uploading) it.progress else 1f }.average().toFloat()
    Box {
        TooltipIconButton(label = stringResource(Res.string.uploads), onClick = { open = true }) {
            UploadRing(progress = progress, complete = allDone)
        }
        AppDropdownMenu(
            expanded = open,
            onDismissRequest = {
                open = false
                if (allDone) UploadManager.clearFinished()
            },
        ) {
            Text(
                "${stringResource(Res.string.uploads)} ($finished/${uploads.size})",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 14.dp, end = 14.dp, bottom = 8.dp),
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Column(
                modifier = Modifier
                    .widthIn(max = 320.dp)
                    .heightIn(max = 380.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                uploads.forEach { UploadRow(it) }
            }
        }
    }
}

@Composable
private fun UploadRing(progress: Float, complete: Boolean) {
    val track = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)
    val accent = MaterialTheme.colorScheme.primary
    Box(contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(24.dp)) {
            val stroke = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round)
            val inset = stroke.width / 2
            val arcSize = Size(size.width - stroke.width, size.height - stroke.width)
            drawCircle(color = track, radius = (size.minDimension - stroke.width) / 2, style = stroke)
            drawArc(
                color = accent,
                startAngle = -90f,
                sweepAngle = 360f * progress.coerceIn(0f, 1f),
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = stroke,
            )
        }
        if (complete) {
            Icon(Lucide.Check, contentDescription = null, tint = accent, modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun UploadRow(upload: UploadManager.Upload) {
    CompactDropdownItem(
        text = upload.name,
        color = if (upload.status == UploadManager.Status.Done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        trailing = {
            when (upload.status) {
                UploadManager.Status.Uploading -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(
                        progress = { upload.progress },
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.5.dp,
                    )
                    Spacer(Modifier.width(10.dp))
                    Icon(
                        Lucide.X,
                        contentDescription = stringResource(Res.string.cancel),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .clip(CircleShape)
                            .clickable { UploadManager.cancel(upload.id) }
                            .size(20.dp),
                    )
                }
                UploadManager.Status.Done -> Icon(
                    Lucide.Check,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp),
                )
                UploadManager.Status.Failed -> Icon(
                    Lucide.X,
                    contentDescription = null,
                    tint = palette.red,
                    modifier = Modifier.size(20.dp),
                )
            }
        },
    )
}

private fun formatDate(epochSeconds: Double): String =
    com.jahirtrap.cconnect.data.formatDateShort((epochSeconds * 1000).toLong())
