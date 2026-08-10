package com.jahirtrap.cconnect.chat

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.ExperimentalFoundationApi
import com.jahirtrap.cconnect.ui.AppDropdownMenu
import com.jahirtrap.cconnect.ui.clickable
import com.jahirtrap.cconnect.ui.combinedClickable
import androidx.compose.foundation.clickable as foundationClickable
import com.jahirtrap.cconnect.ui.secondaryClick
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.DragInteraction
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.SelectionContainer
import com.composables.icons.lucide.Activity
import com.composables.icons.lucide.Archive
import com.composables.icons.lucide.Radio
import com.composables.icons.lucide.CircleUser
import com.composables.icons.lucide.TriangleAlert
import com.composables.icons.lucide.ArrowUp
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.ChevronDown
import com.composables.icons.lucide.ChevronsDown
import com.composables.icons.lucide.CircleDot
import com.composables.icons.lucide.Clock3
import com.composables.icons.lucide.EllipsisVertical
import com.composables.icons.lucide.Eraser
import com.composables.icons.lucide.File
import com.composables.icons.lucide.Folder
import com.composables.icons.lucide.FolderArchive
import com.composables.icons.lucide.FolderOpen
import com.composables.icons.lucide.Gauge
import com.composables.icons.lucide.Hourglass
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Menu
import com.composables.icons.lucide.MessagesSquare
import com.composables.icons.lucide.Paperclip
import com.composables.icons.lucide.PanelLeftClose
import com.composables.icons.lucide.PanelLeftOpen
import com.composables.icons.lucide.Settings
import com.composables.icons.lucide.SquareSlash
import com.composables.icons.lucide.Sparkles
import com.composables.icons.lucide.Square
import com.composables.icons.lucide.SquareCheckBig
import com.composables.icons.lucide.SquareTerminal
import com.composables.icons.lucide.Type
import com.composables.icons.lucide.SquarePen
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.ui.AbovePopupMenu
import com.jahirtrap.cconnect.ui.AppLogo
import com.jahirtrap.cconnect.ui.selectionTextCursor
import com.jahirtrap.cconnect.ui.AttachmentChip
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.NoticeCard
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CustomIcons
import com.jahirtrap.cconnect.ui.DropdownScrim
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.Claude
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.StatusSpinner
import com.jahirtrap.cconnect.ui.Stop
import com.jahirtrap.cconnect.ui.theme.palette
import com.jahirtrap.cconnect.ui.theme.Radius
import androidx.compose.foundation.layout.RowScope
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.geometry.Offset
import androidx.compose.material3.DrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AlertDialogDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.Icon
import com.jahirtrap.cconnect.ui.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.Scaffold
import com.jahirtrap.cconnect.ui.BackInterceptor
import com.jahirtrap.cconnect.ui.ClearFocusOnImeHide
import com.jahirtrap.cconnect.ui.LocalIsTouch
import com.jahirtrap.cconnect.ui.ClipKey
import com.jahirtrap.cconnect.ui.ClipboardShortcutHandler
import com.jahirtrap.cconnect.ui.PreviewOverlay
import com.jahirtrap.cconnect.ui.Dismissable
import com.jahirtrap.cconnect.ui.horizontalScrollbar
import com.jahirtrap.cconnect.ui.LocalMobileLayout
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.foundation.Image
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.data.ChatMessage
import com.jahirtrap.cconnect.data.CommandOption
import com.jahirtrap.cconnect.data.EnvironmentProfile
import com.jahirtrap.cconnect.data.SelectionLock
import com.jahirtrap.cconnect.data.PermissionMode
import com.jahirtrap.cconnect.data.ProjectInfo
import com.jahirtrap.cconnect.data.QueuedMessage
import com.jahirtrap.cconnect.data.Role
import com.jahirtrap.cconnect.data.pending
import com.jahirtrap.cconnect.data.SessionInfo
import com.jahirtrap.cconnect.data.TodoItem
import com.jahirtrap.cconnect.files.ClipboardPasteEffect
import com.jahirtrap.cconnect.files.clipboardHasFiles
import com.jahirtrap.cconnect.files.readClipboardFiles
import com.jahirtrap.cconnect.files.fileDropTarget
import com.jahirtrap.cconnect.files.pickFiles
import com.jahirtrap.cconnect.files.FilePreviewScreen
import com.jahirtrap.cconnect.files.downloadShared
import com.jahirtrap.cconnect.files.saveSharedAs
import com.jahirtrap.cconnect.files.openSharedExternally
import com.jahirtrap.cconnect.files.isArchive
import com.jahirtrap.cconnect.files.isPreviewable
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ModalBottomSheetProperties
import com.jahirtrap.cconnect.ui.Button
import com.jahirtrap.cconnect.ui.ButtonVariant
import androidx.compose.ui.graphics.luminance
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import com.composables.icons.lucide.History
import com.jahirtrap.cconnect.data.remote.SessionsApi
import com.jahirtrap.cconnect.data.remote.SharedApi
import com.jahirtrap.cconnect.ui.ColorDialog
import com.jahirtrap.cconnect.ui.ColorOption
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.CompactDropdownItem
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.DialogSelectItem
import com.jahirtrap.cconnect.ui.EnvironmentSelectDialog
import com.jahirtrap.cconnect.ui.RenameDialog
import com.jahirtrap.cconnect.ui.SharedLinkActionsDialog
import com.jahirtrap.cconnect.ui.OutlinedPanel
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.TooltipTap
import com.jahirtrap.cconnect.ui.TooltipWrap
import com.jahirtrap.cconnect.ui.dayIndex
import com.jahirtrap.cconnect.ui.theme.sessionColorOf
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun ChatScreen(
    onOpenSettings: (highlight: String?) -> Unit,
    onOpenExplorer: (archive: String?) -> Unit,
    onOpenClaude: () -> Unit,
    onOpenMonitor: () -> Unit,
    onOpenTerminal: () -> Unit,
    onOpenMarkdown: () -> Unit,
    onOpenPreview: (url: String, filename: String, onDelete: (() -> Unit)?) -> Unit,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    drawerState: DrawerState,
) {
    val vm: ChatViewModel = viewModel(factory = LocalChatViewModelFactory.current)
    val state by vm.state.collectAsState()
    val mobile = LocalMobileLayout.current
    val isTouch = LocalIsTouch.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val focusManager = LocalFocusManager.current
    val density = LocalDensity.current
    val expandedState = remember { mutableStateMapOf<Long, Boolean>() }

    var renameTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var deleteTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var colorTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var confirmCommand by remember { mutableStateOf<CommandOption?>(null) }
    var sharedLinkAction by remember { mutableStateOf<Pair<String, String>?>(null) }
    var queuePreview by remember { mutableStateOf<QueuedMessage?>(null) }
    var queueFilePreview by remember { mutableStateOf<Pair<String, String>?>(null) }
    var showRewindSheet by remember { mutableStateOf(false) }
    LaunchedEffect(expanded) {
        if (expanded) {
            focusManager.clearFocus()
            vm.refreshEnvironments()
            vm.ensureHistoryLoaded()
        }
    }
    LaunchedEffect(drawerState.targetValue) {
        if (drawerState.targetValue == DrawerValue.Open) {
            focusManager.clearFocus()
            vm.refreshEnvironments()
            vm.ensureHistoryLoaded()
        }
    }

    val isAtBottom by remember {
        derivedStateOf {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull() ?: return@derivedStateOf true
            last.index == info.totalItemsCount - 1 && last.offset + last.size <= info.viewportEndOffset + 4
        }
    }

    // Only manual scrolling changes this, so incoming content can't flip it before we react.
    var followBottom by remember { mutableStateOf(true) }
    var dropOver by remember { mutableStateOf(false) }

    // Hidden while following; otherwise shown once scrolled more than half the chat viewport above the bottom.
    val showScrollButton by remember {
        derivedStateOf {
            if (followBottom) return@derivedStateOf false
            val info = listState.layoutInfo
            val viewportH = info.viewportEndOffset - info.viewportStartOffset
            if (viewportH == 0) return@derivedStateOf false
            val last = info.visibleItemsInfo.lastOrNull() ?: return@derivedStateOf false
            val belowFold = if (last.index < info.totalItemsCount - 1) viewportH
            else (last.offset + last.size) - info.viewportEndOffset
            belowFold > viewportH / 2
        }
    }

    LaunchedEffect(Unit) { vm.connect() }
    LaunchedEffect(state.connection) {
        if (state.connection == ConnectionState.Connected) vm.ensureHistoryLoaded()
    }
    val activeSession = state.historySessions.firstOrNull { it.sessionId == state.sessionId }
    val tabLabel: String? = activeSession?.let { it.title ?: it.preview ?: state.sessionId?.take(8) }
    val tabColor: String? = if (activeSession != null) state.sessionColor else null
    LaunchedEffect(tabLabel, tabColor, state.streaming, state.sessionId, state.activeProjectKey) {
        TabsController.updateActive(tabLabel, tabColor, state.streaming, state.sessionId, state.activeProjectKey)
    }
    val tabIndex = remember { TabsController.tabs.indexOfFirst { it.id == TabsController.activeId } }
    val chatLoc = remember { readChatLocation() }
    var restoreTriggered by remember { mutableStateOf(false) }
    LaunchedEffect(state.connection) {
        if (!restoreTriggered && chatLoc != null && chatLoc.first == tabIndex && state.connection == ConnectionState.Connected) {
            restoreTriggered = true
            vm.restoreSession(chatLoc.second, chatLoc.third)
        }
    }
    ChatPopstate { tab, sid, pr ->
        if (tab == tabIndex) {
            if (sid != null && pr != null) vm.restoreSession(sid, pr) else vm.newSession()
        }
    }

    // A user drag stops the follow immediately so streaming can't fight the gesture.
    LaunchedEffect(listState) {
        listState.interactionSource.interactions.collect { interaction ->
            if (interaction is DragInteraction.Start) followBottom = false
        }
    }
    LaunchedEffect(listState) {
        snapshotFlow { listState.isScrollInProgress to isAtBottom }.collect { (scrolling, atBottom) ->
            if (!scrolling && atBottom) followBottom = true
        }
    }
    LaunchedEffect(followBottom) { vm.setFollowBottom(followBottom) }
    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .collect { idx -> if (idx < 10) vm.loadMoreHistory() }
    }
    LaunchedEffect(
        state.messages.size,
        state.messages.sumOf { it.text.length },
        state.messages.lastOrNull()?.id,
        state.messages.lastOrNull()?.text,
        state.messages.lastOrNull()?.children?.size,
        state.messages.lastOrNull()?.children?.lastOrNull()?.result,
    ) {
        if (state.messages.isNotEmpty() && followBottom) {
            listState.scrollToItem(state.messages.lastIndex, Int.MAX_VALUE)
        }
    }
    LaunchedEffect(listState) {
        snapshotFlow {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull()
            Triple(last?.index, last?.size, info.viewportEndOffset)
        }.collect { (index, _, _) ->
            val lastIdx = listState.layoutInfo.totalItemsCount - 1
            if (followBottom && index != null && lastIdx >= 0 && index == lastIdx) {
                listState.scrollToItem(lastIdx, Int.MAX_VALUE)
            }
        }
    }
    LaunchedEffect(state.messages.lastOrNull()?.id) {
        val last = state.messages.lastOrNull() ?: return@LaunchedEffect
        if (last.role == Role.INTERACTION && last.interaction?.pending == true) {
            followBottom = true
            listState.animateScrollToItem(state.messages.lastIndex, Int.MAX_VALUE)
        }
    }
    BackInterceptor(enabled = drawerState.targetValue == DrawerValue.Open) { scope.launch { drawerState.close() }; true }
    MaterialExpressiveTheme(motionScheme = MotionScheme.standard()) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            gesturesEnabled = mobile,
            drawerContent = {
                val drawerEdge = MaterialTheme.colorScheme.outlineVariant
                ModalDrawerSheet(
                    drawerShape = RectangleShape,
                    drawerContainerColor = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.drawWithContent {
                        drawContent()
                        drawLine(
                            drawerEdge,
                            Offset(size.width, 0f),
                            Offset(size.width, size.height),
                            1.dp.toPx(),
                        )
                    },
                ) {
                    if (mobile) ChatPanelContent(
                        state = state,
                        vm = vm,
                        onClose = if (isTouch) null else ({ scope.launch { drawerState.close() } }),
                        drawerMode = true,
                        onAfterSelect = { scope.launch { drawerState.close() } },
                        onOpenExplorer = onOpenExplorer,
                        onOpenClaude = onOpenClaude,
                        onOpenMonitor = onOpenMonitor,
                        onOpenTerminal = onOpenTerminal,
                        onOpenMarkdown = onOpenMarkdown,
                        onOpenSettings = onOpenSettings,
                        onRename = { renameTarget = it },
                        onColor = { colorTarget = it },
                        onDelete = { deleteTarget = it },
                    )
                }
            },
        ) {
            MaterialExpressiveTheme(motionScheme = MotionScheme.expressive()) {
                Row(modifier = Modifier.fillMaxSize()) {
                    if (!mobile) {
                        val sidebarWidth by animateDpAsState(if (expanded) 300.dp else 64.dp, label = "sidebar")
                        val sidebarInsets = WindowInsets.systemBars.union(WindowInsets.displayCutout)
                            .only(WindowInsetsSides.Start + WindowInsetsSides.Vertical)
                        val sidebarStart = with(LocalDensity.current) {
                            sidebarInsets.getLeft(this, LocalLayoutDirection.current).toDp()
                        }
                        val edge = MaterialTheme.colorScheme.outlineVariant
                        Surface(
                            color = MaterialTheme.colorScheme.surface,
                            modifier = Modifier
                                .fillMaxHeight()
                                .width(sidebarWidth + sidebarStart)
                                .drawWithContent {
                                    drawContent()
                                    drawLine(
                                        edge,
                                        Offset(size.width, 0f),
                                        Offset(size.width, size.height),
                                        1.dp.toPx(),
                                    )
                                },
                        ) {
                            Column(
                                modifier = Modifier.fillMaxSize().windowInsetsPadding(sidebarInsets),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                if (expanded) {
                                    ChatPanelContent(
                                        state = state,
                                        vm = vm,
                                        onClose = { onExpandedChange(false) },
                                        drawerMode = false,
                                        onAfterSelect = {},
                                        onOpenExplorer = onOpenExplorer,
                                        onOpenClaude = onOpenClaude,
                                        onOpenMonitor = onOpenMonitor,
                                        onOpenTerminal = onOpenTerminal,
                                        onOpenMarkdown = onOpenMarkdown,
                                        onOpenSettings = onOpenSettings,
                                        onRename = { renameTarget = it },
                                        onColor = { colorTarget = it },
                                        onDelete = { deleteTarget = it },
                                    )
                                } else {
                                    Spacer(Modifier.height(8.dp))
                                    TooltipIconButton(label = stringResource(Res.string.menu), onClick = { onExpandedChange(true) }) {
                                        Icon(Lucide.PanelLeftOpen, contentDescription = null)
                                    }
                                    TooltipIconButton(label = stringResource(Res.string.new_session), onClick = { vm.newSession() }) {
                                        Icon(Lucide.SquarePen, contentDescription = null)
                                    }
                                    Spacer(Modifier.weight(1f))
                                    TooltipIconButton(label = stringResource(Res.string.files), onClick = { onOpenExplorer(null) }) {
                                        Icon(Lucide.Folder, contentDescription = null)
                                    }
                                    TooltipIconButton(label = stringResource(Res.string.claude), onClick = onOpenClaude) {
                                        Icon(CustomIcons.Claude, contentDescription = null)
                                    }
                                    TooltipIconButton(label = stringResource(Res.string.monitor), onClick = onOpenMonitor) {
                                        Icon(Lucide.Activity, contentDescription = null)
                                    }
                                    TooltipIconButton(label = stringResource(Res.string.terminal), onClick = onOpenTerminal) {
                                        Icon(Lucide.SquareTerminal, contentDescription = null)
                                    }
                                    TooltipIconButton(label = stringResource(Res.string.markdown), onClick = onOpenMarkdown) {
                                        Icon(Lucide.Type, contentDescription = null)
                                    }
                                    TooltipIconButton(label = stringResource(Res.string.settings), onClick = { onOpenSettings(null) }) {
                                        Icon(Lucide.Settings, contentDescription = null)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                }
                            }
                        }
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        Scaffold(
                            contentWindowInsets = WindowInsets.systemBars.only(WindowInsetsSides.End + WindowInsetsSides.Vertical),
                            snackbarHost = {
                                Column(
                                    modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 12.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    state.versionNotices.sortedBy { it.ordinal }.forEach { notice ->
                                        key(notice) {
                                            NoticeCard(
                                                text = when (notice) {
                                                    CompatStatus.AppOutdated -> stringResource(Res.string.compat_app_outdated)
                                                    CompatStatus.ServerOutdated -> stringResource(Res.string.compat_server_outdated)
                                                    CompatStatus.CliOutdated -> stringResource(Res.string.compat_cli_outdated)
                                                    else -> stringResource(Res.string.update_available, state.latestRelease?.tag.orEmpty())
                                                },
                                                actionLabel = stringResource(Res.string.settings),
                                                onAction = {
                                                    vm.dismissNotice(notice)
                                                    onOpenSettings(if (notice == CompatStatus.CliOutdated) "cli" else "about")
                                                },
                                                onDismiss = { vm.dismissNotice(notice) },
                                            )
                                        }
                                    }
                                }
                            },
                            topBar = {
                                val waitingUser = state.messages.any { it.role == Role.INTERACTION && it.interaction?.pending == true }
                                val statusLeading: (@Composable () -> Unit) = when {
                                    state.connection == ConnectionState.Disconnected -> ({ StatusDot(palette.red, box = 8.dp) })
                                    state.connection == ConnectionState.Connecting -> ({ StatusSpinner() })
                                    waitingUser -> ({ StatusDot(palette.orange, box = 8.dp) })
                                    state.streaming -> ({ StatusSpinner() })
                                    else -> ({ StatusDot(palette.green, box = 8.dp) })
                                }
                                val statusText = when {
                                    state.connection == ConnectionState.Disconnected -> stringResource(Res.string.server_unavailable)
                                    state.connection == ConnectionState.Connecting -> stringResource(Res.string.connecting)
                                    waitingUser -> stringResource(Res.string.waiting_user)
                                    state.streaming -> stringResource(Res.string.working)
                                    else -> state.sessionId?.take(8) ?: stringResource(Res.string.new_chat)
                                }
                                Column {
                                TabTitleSync()
                                if (!mobile) TabStrip()
                                AppTopBar(
                                    title = stringResource(Res.string.app_name),
                                    subtitle = statusText,
                                    subtitleLeading = statusLeading,
                                    fullWidth = mobile,
                                    navigationIcon = if (mobile) ({
                                        TooltipIconButton(label = stringResource(Res.string.menu), onClick = { scope.launch { drawerState.open() } }) {
                                            Icon(Lucide.Menu, contentDescription = null)
                                        }
                                    }) else null,
                                    actions = {
                                        if (state.sessionId != null && !state.streaming) {
                                            TooltipIconButton(
                                                label = stringResource(Res.string.rewind),
                                                onClick = { vm.loadRewindPoints(); showRewindSheet = true },
                                            ) { Icon(Lucide.History, contentDescription = null) }
                                        }
                                        TaskIndicator(todos = state.todos)
                                        if (mobile) TabSwitcher()
                                        TooltipIconButton(
                                            label = stringResource(Res.string.new_session),
                                            onClick = { vm.newSession() },
                                        ) { Icon(Lucide.SquarePen, contentDescription = null) }
                                    },
                                )
                                }
                            },
                        ) { padding ->
                            val sc = state.sideChat?.takeIf { it.boundSessionId == state.sessionId }
                            val sideActive = state.sideChatOpen && sc != null
                            LaunchedEffect(state.pendingInput) {
                                state.pendingInput?.let { vm.draft = it; vm.consumePendingInput() }
                            }
                            val composerFocus = remember { FocusRequester() }
                            val imeVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
                            val peek = 0.58f
                            val expansion = remember { Animatable(if (sideActive) (if (state.sideFullscreen) 1f else peek) else 0f) }
                            LaunchedEffect(sideActive) {
                                if (sideActive) {
                                    if (expansion.value < peek) {
                                        expansion.snapTo(0f)
                                        expansion.animateTo(peek, spring(stiffness = Spring.StiffnessMediumLow))
                                    }
                                    if (imeVisible) composerFocus.requestFocus()
                                }
                            }
                            LaunchedEffect(expansion.value) {
                                if (sideActive && followBottom && state.messages.isNotEmpty()) {
                                    listState.scrollToItem(state.messages.lastIndex, Int.MAX_VALUE)
                                }
                            }
                            val dismissSide: () -> Unit = {
                                scope.launch {
                                    expansion.animateTo(0f, spring(stiffness = Spring.StiffnessMediumLow))
                                    vm.closeSideChat()
                                }
                                Unit
                            }
                            BackInterceptor(enabled = sideActive) { dismissSide(); true }
                            ClearFocusOnImeHide()
                            val dialogOpen = renameTarget != null || deleteTarget != null || colorTarget != null ||
                                confirmCommand != null || sharedLinkAction != null || showRewindSheet
                            val shortcutsEnabled = !dialogOpen && !PreviewOverlay.open && !(mobile && drawerState.targetValue == DrawerValue.Open)
                            ClipboardPasteEffect(enabled = shortcutsEnabled && !sideActive) { vm.addAttachments(it) }
                            ClipboardShortcutHandler(enabled = shortcutsEnabled) { key ->
                                when (key) {
                                    ClipKey.Paste -> if (!sideActive && clipboardHasFiles()) {
                                        scope.launch { readClipboardFiles().takeIf { it.isNotEmpty() }?.let { vm.addAttachments(it) } }
                                        true
                                    } else false
                                    ClipKey.Cancel -> if (sideActive) { dismissSide(); true } else false
                                    else -> false
                                }
                            }
                            Column(
                                modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding).windowInsetsPadding(WindowInsets.navigationBars.only(WindowInsetsSides.End + WindowInsetsSides.Bottom)).imePadding()
                                .fileDropTarget(enabled = !sideActive, onDragChange = { dropOver = it }) { vm.addAttachments(it) }
                                .then(if (dropOver) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp)) else Modifier),
                            ) {
                                BoxWithConstraints(modifier = Modifier.fillMaxWidth().weight(1f).clipToBounds()) {
                                    val boxHeightPx = constraints.maxHeight.toFloat()
                                    val toolbarReveal = (1f - expansion.value / peek).coerceIn(0f, 1f)
                                    val panelH = expansion.value.coerceAtLeast(peek)
                                    val showTime = vm.showTimestamps
                                    Box(modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().fillMaxHeight((1f - panelH * (1f - toolbarReveal)).coerceIn(0.0001f, 1f)).clipToBounds()) {
                                        SelectionContainer(modifier = Modifier.fillMaxSize().selectionTextCursor()) {
                                            LazyColumn(
                                                state = listState,
                                                modifier = Modifier.fillMaxSize().pointerInput(Unit) {
                                                    awaitPointerEventScope {
                                                        while (true) {
                                                            val e = awaitPointerEvent(PointerEventPass.Initial)
                                                            if (e.type == PointerEventType.Scroll && (e.changes.firstOrNull()?.scrollDelta?.y ?: 0f) < 0f) followBottom = false
                                                        }
                                                    }
                                                },
                                            ) {
                                                itemsIndexed(state.messages, key = { _, it -> it.id }) { index, message ->
                                                    val ts = message.timestamp
                                                    var separated = false
                                                    if (ts != null && showTime) {
                                                        val prevTs = (index - 1 downTo 0).firstNotNullOfOrNull { state.messages[it].timestamp }
                                                        if (prevTs == null || dayIndex(prevTs) != dayIndex(ts)) {
                                                            ChatDateSeparator(ts)
                                                            separated = true
                                                        }
                                                    }
                                                    val running = when (message.role) {
                                                        Role.TOOL, Role.AGENT -> message.toolUseId != null && message.toolUseId in state.pendingToolIds
                                                        Role.THINKING -> index == state.messages.lastIndex && state.streaming
                                                        else -> false
                                                    }
                                                    ChatMessageItem(
                                                        message,
                                                        prevRole = state.messages.getOrNull(index - 1)?.role,
                                                        nextRole = state.messages.getOrNull(index + 1)?.role,
                                                        running = running,
                                                        expanded = expandedState[message.id] ?: false,
                                                        onToggle = { expandedState[message.id] = !(expandedState[message.id] ?: false) },
                                                        onAnswer = vm::answerInteraction,
                                                        onToggleOption = vm::toggleQuestionOption,
                                                        onQuestionText = vm::setQuestionFreeText,
                                                        onQuestionNotes = vm::setQuestionNotes,
                                                        onSubmitQuestions = vm::submitQuestions,
                                                        onChatQuestions = vm::chatQuestions,
                                                        onQuestionPage = vm::setActiveQuestion,
                                                        onSharedLink = { url, filename -> sharedLinkAction = url to filename },
                                                        gluedTop = separated,
                                                        showTime = showTime,
                                                    )
                                                }
                                                val status = state.streamStatus
                                                if (status != null && !(state.compacting && status == "slow")) {
                                                    item(key = "stream-status") { StatusProgress(status) }
                                                }
                                                if (state.compacting) {
                                                    item(key = "compacting") { CompactProgress() }
                                                }
                                            }
                                        }
                                        var stickyHeaderHeight by remember { mutableStateOf(0) }
                                        val sticky by remember(expandedState) {
                                            derivedStateOf {
                                                val info = listState.layoutInfo
                                                val start = info.viewportStartOffset
                                                val first = info.visibleItemsInfo.firstOrNull { it.offset + it.size > start }
                                                ?: return@derivedStateOf null
                                                val id = first.key as? Long ?: return@derivedStateOf null
                                                if (expandedState[id] != true) return@derivedStateOf null
                                                Triple(id, first.offset - start, first.offset + first.size - start)
                                            }
                                        }
                                        sticky?.let { (id, topRel, bottomRel) ->
                                            val idx = state.messages.indexOfFirst { it.id == id }
                                            val msg = state.messages.getOrNull(idx)
                                            if (msg != null && hasCollapsibleContent(msg)) {
                                                val gapPx = with(density) { gapAbove(state.messages.getOrNull(idx - 1)?.role, msg.role).roundToPx() }
                                                if (topRel + gapPx < 0) {
                                                    val h = if (stickyHeaderHeight > 0) stickyHeaderHeight else with(density) { 40.dp.roundToPx() }
                                                    val pushY = minOf(0, bottomRel - h)
                                                    StickyCollapsibleHeader(
                                                        message = msg,
                                                        onCollapse = {
                                                            expandedState[id] = false
                                                            scope.launch { listState.scrollToItem(idx, gapPx) }
                                                        },
                                                        modifier = Modifier
                                                        .align(Alignment.TopCenter)
                                                        .fillMaxWidth()
                                                        .offset { IntOffset(0, pushY) }
                                                        .onSizeChanged { stickyHeaderHeight = it.height },
                                                    )
                                                }
                                            }
                                        }
                                        if (showScrollButton && state.messages.isNotEmpty()) {
                                            Surface(
                                                onClick = {
                                                    followBottom = true
                                                    scope.launch { listState.scrollToItem(state.messages.lastIndex, Int.MAX_VALUE) }
                                                },
                                                shape = CircleShape,
                                                color = MaterialTheme.colorScheme.onBackground,
                                                shadowElevation = 4.dp,
                                                modifier = Modifier.align(Alignment.BottomEnd).padding(12.dp).size(32.dp).pointerHoverIcon(PointerIcon.Hand),
                                            ) {
                                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                                    Icon(
                                                        Lucide.ChevronsDown,
                                                        contentDescription = stringResource(Res.string.scroll_to_bottom),
                                                        tint = MaterialTheme.colorScheme.background,
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    if (sideActive && sc != null) {
                                        val dragModifier = Modifier.pointerInput(boxHeightPx) {
                                            detectVerticalDragGestures(
                                                onDragEnd = {
                                                    scope.launch {
                                                        val v = expansion.value
                                                        when {
                                                            v < 0.32f -> { expansion.animateTo(0f, spring(stiffness = Spring.StiffnessMediumLow)); vm.closeSideChat() }
                                                            v < (peek + 1f) / 2f -> { expansion.animateTo(peek, spring(stiffness = Spring.StiffnessMediumLow)); vm.setSideFullscreen(false) }
                                                            else -> { expansion.animateTo(1f, spring(stiffness = Spring.StiffnessMediumLow)); vm.setSideFullscreen(true) }
                                                        }
                                                    }
                                                },
                                            ) { change, dy ->
                                                change.consume()
                                                if (boxHeightPx > 0f) {
                                                    val target = (expansion.value - dy / boxHeightPx).coerceIn(0f, 1f)
                                                    scope.launch { expansion.snapTo(target) }
                                                }
                                            }
                                        }
                                        val dockT = ((expansion.value - peek) / (1f - peek)).coerceIn(0f, 1f)
                                        SidePanel(
                                            sideChat = sc,
                                            headerModifier = dragModifier,
                                            onClear = vm::clearSideChat,
                                            onAnswer = vm::answerInteraction,
                                            onToggleOption = vm::toggleQuestionOption,
                                            onQuestionText = vm::setQuestionFreeText,
                                            onQuestionNotes = vm::setQuestionNotes,
                                            onSubmitQuestions = vm::submitQuestions,
                                            onChatQuestions = vm::chatQuestions,
                                            onSharedLink = { url, filename -> sharedLinkAction = url to filename },
                                            topCorner = (20 * (1f - dockT)).dp,
                                            modifier = Modifier
                                            .align(Alignment.BottomCenter)
                                            .fillMaxWidth()
                                            .offset { IntOffset(0, (toolbarReveal * panelH * boxHeightPx).toInt()) }
                                            .fillMaxHeight(panelH),
                                        )
                                    }
                                }
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(MaterialTheme.colorScheme.background)
                                        .foundationClickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
                                    ) {
                                        val queueScroll = TabsController.queueScroll
                                        val attachScroll = TabsController.attachmentsScroll
                                        val visibleQueue = state.queue.filterNot { it.silent }
                                        val composerChips: (@Composable () -> Unit)? = if (
                                            !sideActive && (visibleQueue.isNotEmpty() || state.attachments.isNotEmpty())
                                        ) ({
                                            if (visibleQueue.isNotEmpty()) {
                                                QueueRow(queue = visibleQueue, scroll = queueScroll, onOpen = { queuePreview = it })
                                            }
                                            if (state.attachments.isNotEmpty()) {
                                                AttachmentsRow(
                                                    attachments = state.attachments,
                                                    uploading = state.uploadingAttachments,
                                                    scroll = attachScroll,
                                                    onRemove = vm::removeAttachment,
                                                    topPadding = if (visibleQueue.isNotEmpty()) 6.dp else 12.dp,
                                                )
                                            }
                                        }) else null
                                        val composerControls: @Composable RowScope.() -> Unit = {
                                            ChatToolbar(
                                            ready = state.capabilitiesReady,
                                            disconnected = state.connection == ConnectionState.Disconnected,
                                            connecting = state.connection == ConnectionState.Connecting,
                                            account = state.accountOverride.ifEmpty { state.account },
                                            accountSelected = state.accountOverride,
                                            accounts = state.capabilities.accounts,
                                            onAccount = vm::setAccount,
                                            model = state.modelOverride.ifEmpty { state.model },
                                            modelSelected = state.modelOverride,
                                            models = state.capabilities.models,
                                            onModel = vm::setModel,
                                            effort = state.effortOverride.ifEmpty { state.effort },
                                            effortSelected = state.effortOverride,
                                            effortLevels = state.capabilities.effortLevels,
                                            onEffort = vm::setEffort,
                                            permissionMode = state.permissionOverride.ifEmpty { state.permissionMode },
                                            permissionSelected = state.permissionOverride,
                                            permissionModes = state.capabilities.permissionModes,
                                            onPermissionMode = vm::setPermissionMode,
                                            streaming = state.streamingOverride ?: state.streamTokens,
                                            onStreaming = vm::toggleStreaming,
                                            onQuickChat = vm::openSideChat,
                                            quickChatActive = sc != null && sc.messages.isNotEmpty(),
                                            contextTokens = state.contextTokens,
                                            modifier = Modifier.weight(1f),
                                            )
                                        }
                                        Composer(
                                            value = if (sideActive) vm.sideDraft else vm.draft,
                                            onValueChange = { if (sideActive) vm.sideDraft = it else vm.draft = it },
                                            streaming = if (sideActive) (sc?.streaming ?: false) else state.streaming,
                                            sessionColor = state.sessionColor,
                                            commands = state.capabilities.commands,
                                            onCommand = { cmd -> if (cmd.requireConfirmation) confirmCommand = cmd else vm.runCommand(cmd) },
                                            onSend = { if (sideActive) vm.sendSideQuestion(it) else vm.submit(it) },
                                            onStop = { if (sideActive) vm.stopSide() else vm.stop() },
                                            canSend = state.connection == ConnectionState.Connected,
                                            commandsEnabled = state.sessionId != null && state.connection == ConnectionState.Connected,
                                            focusRequester = composerFocus,
                                            onCloseSide = if (sideActive) dismissSide else null,
                                            attachments = if (sideActive) emptyList() else state.attachments,
                                            uploading = !sideActive && state.uploadingAttachments,
                                            onAttach = if (sideActive) null else ({ scope.launch { vm.addAttachments(pickFiles()) } }),
                                            chips = composerChips,
                                            controls = if (sideActive) null else composerControls,
                                        )
                                    }
                            }
                        }
                    }
                }
            }
        }
    }

    if (queueFilePreview == null) {
        queuePreview?.let { snap ->
            state.queue.firstOrNull { it.id == snap.id }?.let { q ->
                CompactDialog(
                    onDismiss = { queuePreview = null },
                    title = stringResource(Res.string.queued_message),
                    buttons = {
                        Button(onClick = { queuePreview = null }, variant = ButtonVariant.Outlined) {
                            Text(stringResource(Res.string.close))
                        }
                    },
                ) {
                    if (q.text.isNotBlank()) {
                        OutlinedPanel(modifier = Modifier.fillMaxWidth()) {
                            SelectionContainer(modifier = Modifier.selectionTextCursor()) {
                                Text(q.text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(4.dp))
                            }
                        }
                    }
                    if (q.attachments.isNotEmpty()) {
                        if (q.text.isNotBlank()) Spacer(Modifier.height(8.dp))
                        val attScroll = rememberScrollState()
                        Row(
                            modifier = Modifier.fillMaxWidth()
                                .horizontalScrollbar(attScroll, touchIndicator = false, wheelScroll = true)
                                .horizontalScroll(attScroll),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            q.attachments.forEach { att ->
                                val n = att.substringAfterLast('/')
                                AttachmentChip(
                                    name = n,
                                    icon = if (isArchive(n)) Lucide.FolderArchive else Lucide.File,
                                    onClick = { queueFilePreview = SharedApi.downloadUrl("uploads/$n") to n },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    renameTarget?.let { s ->
        RenameDialog(
            initial = s.title ?: s.preview ?: "",
            onConfirm = { vm.renameSession(s, it); renameTarget = null },
            onDismiss = { renameTarget = null },
        )
    }
    deleteTarget?.let { s ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_conversation_confirm, s.title ?: s.preview ?: s.sessionId),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { vm.deleteSession(s); deleteTarget = null },
            onDismiss = { deleteTarget = null },
        )
    }
    colorTarget?.let { s ->
        ColorDialog(
            title = stringResource(Res.string.conversation_color),
            options = state.capabilities.colors.mapNotNull { name ->
                sessionColorOf(name)?.let { ColorOption(name, it, name) }
            },
            selected = s.color,
            onSelect = { vm.setSessionColor(s, it) },
            onDismiss = { colorTarget = null },
        )
    }
    confirmCommand?.let { cmd ->
        ConfirmDialog(
            title = "/${cmd.name}",
            text = cmd.description,
            confirmLabel = stringResource(Res.string.confirm),
            onConfirm = { vm.runCommand(cmd); confirmCommand = null },
            onDismiss = { confirmCommand = null },
        )
    }
    sharedLinkAction?.let { (url, filename) ->
        val viewable = isPreviewable(filename)
        val archiveRel = SharedApi.relativeFromUrl(url).takeIf { isArchive(filename) }
        SharedLinkActionsDialog(
            filename = filename,
            onView = if (viewable) ({
                onOpenPreview(url, filename, SharedApi.relativeFromUrl(url)?.let { rel ->
                    { scope.launch { SharedApi.delete(rel) } }
                })
            }) else null,
            onOpenInFiles = archiveRel?.let { rel -> { onOpenExplorer(rel) } },
            onSave = { scope.launch { downloadShared(url, filename) } },
            onSaveAs = { scope.launch { saveSharedAs(url, filename) } },
            onShare = { scope.launch { openSharedExternally(url, filename) } },
            onDismiss = { sharedLinkAction = null },
        )
    }
    if (showRewindSheet) {
        RewindSheet(
            points = state.rewindPoints,
            loading = state.rewindLoading,
            onSelect = { showRewindSheet = false; vm.selectRewindPoint(it) },
            onDismiss = { showRewindSheet = false },
        )
    }
    state.rewindTarget?.let { target ->
        RewindDialog(
            message = target.text,
            preview = state.rewindPreview,
            busy = state.rewindBusy,
            onConfirm = { both -> vm.confirmRewind(both) },
            onDismiss = { vm.dismissRewind() },
        )
    }
    queueFilePreview?.let { (url, name) ->
        FilePreviewScreen(url = url, filename = name, onClose = { queueFilePreview = null })
    }
}

@Composable
private fun RewindSheet(
    points: List<SessionsApi.RewindPoint>,
    loading: Boolean,
    onSelect: (SessionsApi.RewindPoint) -> Unit,
    onDismiss: () -> Unit,
) {
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.rewind),
        contentPadding = PaddingValues(0.dp),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.close)) }
        },
    ) {
        when {
            loading -> CenteredProgress(Modifier.fillMaxWidth().padding(vertical = 24.dp))

            points.isEmpty() -> EmptyState(stringResource(Res.string.rewind_empty), Modifier.fillMaxWidth())

            else -> Column(
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                points.asReversed().forEach { point ->
                    OutlinedPanel(onClick = { onSelect(point) }, modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = point.text,
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RewindDialog(
    message: String,
    preview: SessionsApi.RewindPreview?,
    busy: Boolean,
    onConfirm: (Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    val codeAvailable = preview?.canRewind != false
    var both by remember { mutableStateOf(true) }
    LaunchedEffect(preview) { if (preview != null && !preview.canRewind) both = false }
    CompactDialog(
        onDismiss = { if (!busy) onDismiss() },
        title = stringResource(Res.string.rewind),
        contentPadding = PaddingValues(0.dp),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined, enabled = !busy) {
                Text(stringResource(Res.string.cancel))
            }
            Button(onClick = { onConfirm(both) }, enabled = !busy) { Text(stringResource(Res.string.accept)) }
        },
    ) {
        OutlinedPanel(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            if (both) Row(verticalAlignment = Alignment.CenterVertically) {
                when {
                    preview == null -> {
                        LoadingIndicator(modifier = Modifier.size(13.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(Res.string.loading), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    preview.canRewind -> Text(
                        text = buildAnnotatedString {
                            withStyle(SpanStyle(color = palette.green)) { append("+${preview.insertions}") }
                            append(" ")
                            withStyle(SpanStyle(color = palette.red)) { append("−${preview.deletions}") }
                            append(" • " + stringResource(Res.string.rewind_files_count, preview.filesChanged.size))
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    else -> Text(
                        text = stringResource(Res.string.rewind_no_checkpoint),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        DialogSelectItem(
            label = stringResource(Res.string.rewind_both),
            selected = both,
            enabled = !busy && codeAvailable,
            onClick = { both = true },
        )
        DialogSelectItem(
            label = stringResource(Res.string.rewind_conversation),
            selected = !both,
            enabled = !busy,
            onClick = { both = false },
        )
    }
}

@Composable
private fun SidePanel(
    sideChat: SideChatState,
    headerModifier: Modifier = Modifier,
    onClear: () -> Unit = {},
    onAnswer: ((String, String, String?) -> Unit)? = null,
    onToggleOption: ((String, Int, String) -> Unit)? = null,
    onQuestionText: ((String, Int, String) -> Unit)? = null,
    onQuestionNotes: ((String, Int, String) -> Unit)? = null,
    onSubmitQuestions: ((String) -> Unit)? = null,
    onChatQuestions: ((String) -> Unit)? = null,
    onSharedLink: ((String, String) -> Unit)? = null,
    topCorner: Dp = 20.dp,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.background,
        shape = RoundedCornerShape(topStart = topCorner, topEnd = topCorner),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxWidth().then(headerModifier)) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 2.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(width = 32.dp, height = 4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Lucide.MessagesSquare,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        stringResource(Res.string.quick_chat),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Lucide.Eraser,
                        contentDescription = stringResource(Res.string.clear),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(
                            alpha = if (sideChat.messages.isNotEmpty()) 1f else 0.38f,
                        ),
                        modifier = Modifier
                            .size(18.dp)
                            .clip(CircleShape)
                            .clickable(enabled = sideChat.messages.isNotEmpty(), onClick = onClear),
                    )
                }
            }
            HorizontalDivider()
            val listState = rememberLazyListState()
            val scope = rememberCoroutineScope()
            LaunchedEffect(Unit) {
                if (sideChat.messages.isNotEmpty()) listState.scrollToItem(sideChat.messages.lastIndex, Int.MAX_VALUE)
            }
            val isAtBottom by remember {
                derivedStateOf {
                    val info = listState.layoutInfo
                    val last = info.visibleItemsInfo.lastOrNull() ?: return@derivedStateOf true
                    last.index == info.totalItemsCount - 1 && last.offset + last.size <= info.viewportEndOffset + 4
                }
            }
            var followBottom by remember { mutableStateOf(true) }
            val showScrollButton by remember {
                derivedStateOf {
                    if (followBottom) return@derivedStateOf false
                    val info = listState.layoutInfo
                    val viewportH = info.viewportEndOffset - info.viewportStartOffset
                    if (viewportH == 0) return@derivedStateOf false
                    val last = info.visibleItemsInfo.lastOrNull() ?: return@derivedStateOf false
                    val belowFold = if (last.index < info.totalItemsCount - 1) viewportH
                    else (last.offset + last.size) - info.viewportEndOffset
                    belowFold > viewportH / 2
                }
            }
            LaunchedEffect(listState) {
                listState.interactionSource.interactions.collect { interaction ->
                    if (interaction is DragInteraction.Start) followBottom = false
                }
            }
            LaunchedEffect(listState) {
                snapshotFlow { listState.isScrollInProgress to isAtBottom }.collect { (scrolling, atBottom) ->
                    if (!scrolling && atBottom) followBottom = true
                }
            }
            val lastMsg = sideChat.messages.lastOrNull()
            LaunchedEffect(lastMsg?.id, lastMsg?.text) {
                if (sideChat.messages.isNotEmpty() && followBottom) {
                    listState.scrollToItem(sideChat.messages.lastIndex, Int.MAX_VALUE)
                }
            }
            LaunchedEffect(listState) {
                snapshotFlow {
                    val info = listState.layoutInfo
                    val last = info.visibleItemsInfo.lastOrNull()
                    Triple(last?.index, last?.size, info.viewportEndOffset)
                }.collect { (index, _, _) ->
                    val lastIdx = listState.layoutInfo.totalItemsCount - 1
                    if (followBottom && index != null && lastIdx >= 0 && index == lastIdx) {
                        listState.scrollToItem(lastIdx, Int.MAX_VALUE)
                    }
                }
            }
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                SelectionContainer(modifier = Modifier.fillMaxSize().selectionTextCursor()) {
                    LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                        itemsIndexed(sideChat.messages, key = { _, it -> it.id }) { index, message ->
                            ChatMessageItem(
                                message,
                                prevRole = sideChat.messages.getOrNull(index - 1)?.role,
                                nextRole = sideChat.messages.getOrNull(index + 1)?.role,
                                running = message.role == Role.WORKING && index == sideChat.messages.lastIndex && sideChat.streaming,
                                onAnswer = onAnswer,
                                onToggleOption = onToggleOption,
                                onQuestionText = onQuestionText,
                                onQuestionNotes = onQuestionNotes,
                                onSubmitQuestions = onSubmitQuestions,
                                onChatQuestions = onChatQuestions,
                                onSharedLink = onSharedLink,
                            )
                        }
                    }
                }
                if (showScrollButton && sideChat.messages.isNotEmpty()) {
                    Surface(
                        onClick = {
                            followBottom = true
                            scope.launch { listState.scrollToItem(sideChat.messages.lastIndex, Int.MAX_VALUE) }
                        },
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.onBackground,
                        shadowElevation = 4.dp,
                        modifier = Modifier.align(Alignment.BottomEnd).padding(12.dp).size(32.dp),
                    ) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Icon(
                                Lucide.ChevronsDown,
                                contentDescription = stringResource(Res.string.scroll_to_bottom),
                                tint = MaterialTheme.colorScheme.background,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.ChatPanelContent(
    state: ChatUiState,
    vm: ChatViewModel,
    onClose: (() -> Unit)?,
    drawerMode: Boolean,
    onAfterSelect: () -> Unit,
    onOpenExplorer: (String?) -> Unit,
    onOpenClaude: () -> Unit,
    onOpenMonitor: () -> Unit,
    onOpenTerminal: () -> Unit,
    onOpenMarkdown: () -> Unit,
    onOpenSettings: (String?) -> Unit,
    onRename: (com.jahirtrap.cconnect.data.SessionInfo) -> Unit,
    onColor: (com.jahirtrap.cconnect.data.SessionInfo) -> Unit,
    onDelete: (com.jahirtrap.cconnect.data.SessionInfo) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().height(56.dp).padding(start = 8.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val environmentLocked by SelectionLock.environment.collectAsState()
        EnvironmentSelector(
            environments = state.environments,
            activeId = state.activeEnvironmentId,
            locked = environmentLocked,
            onSelect = { vm.selectEnvironment(it) },
            modifier = Modifier.weight(1f),
        )
        TooltipIconButton(
            label = stringResource(Res.string.new_session),
            onClick = { vm.newSession(); onAfterSelect() },
        ) { Icon(Lucide.SquarePen, contentDescription = null) }
        if (onClose != null) {
            TooltipIconButton(label = stringResource(Res.string.menu), onClick = onClose) {
                Icon(if (drawerMode) Lucide.Menu else Lucide.PanelLeftClose, contentDescription = null)
            }
        }
    }
    Row(modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        val projectLocked by SelectionLock.project.collectAsState()
        ProjectSelector(
            projects = state.historyProjects,
            selected = state.historyProjectKey,
            locked = projectLocked,
            onSelect = vm::selectHistoryProject,
            modifier = Modifier.weight(1f),
        )
    }
    val drawerListState = rememberLazyListState()
    LaunchedEffect(state.historySessions.size) {
        if (state.historySessions.isNotEmpty()) drawerListState.scrollToItem(0)
    }
    LazyColumn(
        state = drawerListState,
        modifier = Modifier.weight(1f).fillMaxWidth(),
        contentPadding = PaddingValues(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 8.dp),
    ) {
        when {
            state.historySessions.isNotEmpty() -> items(state.historySessions, key = { it.sessionId }) { s ->
                ConversationRow(
                    title = s.title ?: s.preview ?: s.sessionId.take(8),
                    selected = s.sessionId == state.sessionId,
                    onOpen = { vm.openSession(s); onAfterSelect() },
                    onRename = { onRename(s) },
                    onAutoRename = { vm.autoRenameSession(s) },
                    onColor = { onColor(s) },
                    onOpenNewTab = { s.projectKey?.let { pk -> TabsController.openSessionTab(TabsController.active.ctx.environmentId, s.path.orEmpty(), s.sessionId, pk, s.title ?: s.preview, s.color); onAfterSelect() } },
                    onDelete = { onDelete(s) },
                )
            }

            state.historyLoading -> item { CenteredProgress(Modifier.fillParentMaxSize()) }
            else -> item { EmptyState(stringResource(Res.string.no_chats), Modifier.fillParentMaxSize()) }
        }
    }
    val edge = MaterialTheme.colorScheme.outlineVariant
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .drawBehind { drawLine(edge, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TooltipIconButton(label = stringResource(Res.string.files), onClick = { onOpenExplorer(null) }) {
            Icon(Lucide.Folder, contentDescription = null)
        }
        TooltipIconButton(label = stringResource(Res.string.claude), onClick = onOpenClaude) {
            Icon(CustomIcons.Claude, contentDescription = null)
        }
        TooltipIconButton(label = stringResource(Res.string.monitor), onClick = onOpenMonitor) {
            Icon(Lucide.Activity, contentDescription = null)
        }
        TooltipIconButton(label = stringResource(Res.string.terminal), onClick = onOpenTerminal) {
            Icon(Lucide.SquareTerminal, contentDescription = null)
        }
        TooltipIconButton(label = stringResource(Res.string.markdown), onClick = onOpenMarkdown) {
            Icon(Lucide.Type, contentDescription = null)
        }
        Spacer(Modifier.weight(1f))
        TooltipIconButton(label = stringResource(Res.string.settings), onClick = { onOpenSettings(null) }) {
            Icon(Lucide.Settings, contentDescription = null)
        }
    }
}

private fun hasCollapsibleContent(m: ChatMessage): Boolean = when (m.role) {
    Role.THINKING, Role.TOOL_RESULT, Role.SUMMARY -> !m.labelOnly && m.text.isNotBlank()
    Role.TOOL -> m.text.isNotBlank() || !m.result.isNullOrBlank()
    Role.FILE_CHANGE -> !m.labelOnly && !m.diffLines.isNullOrEmpty()
    Role.COMPACT -> m.compact?.summary?.isNotBlank() == true
    Role.AGENT -> m.children.isNotEmpty()
    Role.INTERACTION -> m.toolName == "ExitPlanMode"
    else -> false
}

@Composable
private fun TaskIndicator(todos: List<TodoItem>) {
    if (todos.isEmpty()) return
    var open by remember { mutableStateOf(false) }
    val done = todos.count { it.status == "completed" }
    val inProgress = todos.count { it.status == "in_progress" }
    Box {
        IconButton(onClick = { open = true }, modifier = Modifier.size(36.dp)) {
            TaskPie(done = done, inProgress = inProgress, total = todos.size)
        }
        AppDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                "${stringResource(Res.string.tasks)} ($done/${todos.size})",
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
                todos.forEach { TaskRow(it) }
            }
        }
    }
}

@Composable
private fun TaskPie(done: Int, inProgress: Int, total: Int) {
    val track = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)
    val doneColor = MaterialTheme.colorScheme.primary
    val runningColor = MaterialTheme.colorScheme.onSurfaceVariant
    val doneSweep = if (total > 0) 360f * done / total else 0f
    val runSweep = if (total > 0) 360f * inProgress / total else 0f
    val allDone = total > 0 && done == total
    Box(contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(24.dp)) {
            drawCircle(color = track)
            drawArc(color = doneColor, startAngle = -90f, sweepAngle = doneSweep, useCenter = true)
            drawArc(color = runningColor, startAngle = -90f + doneSweep, sweepAngle = runSweep, useCenter = true)
        }
        if (allDone) {
            Icon(
                Lucide.Check,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun TaskRow(todo: TodoItem) {
    val completed = todo.status == "completed"
    val inProgress = todo.status == "in_progress"
    val icon = when {
        completed -> Lucide.SquareCheckBig
        inProgress -> Lucide.CircleDot
        else -> Lucide.Square
    }
    val tint = if (completed || inProgress) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    val text = if (inProgress && todo.activeForm.isNotBlank()) todo.activeForm else todo.content
    CompactDropdownItem(
        text = text,
        leadingIcon = { Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp)) },
        color = if (completed) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        textDecoration = if (completed) TextDecoration.LineThrough else null,
        fontWeight = if (inProgress) FontWeight.SemiBold else null,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatToolbar(
    ready: Boolean,
    disconnected: Boolean,
    connecting: Boolean,
    account: String,
    accountSelected: String,
    accounts: List<com.jahirtrap.cconnect.data.ModelOption>,
    onAccount: (String) -> Unit,
    model: String,
    modelSelected: String,
    models: List<com.jahirtrap.cconnect.data.ModelOption>,
    onModel: (String) -> Unit,
    effort: String,
    effortSelected: String,
    effortLevels: List<String>,
    onEffort: (String) -> Unit,
    permissionMode: String,
    permissionSelected: String,
    permissionModes: List<PermissionMode>,
    onPermissionMode: (String) -> Unit,
    streaming: Boolean,
    onStreaming: () -> Unit,
    onQuickChat: () -> Unit = {},
    quickChatActive: Boolean = false,
    contextTokens: Int? = null,
    modifier: Modifier = Modifier,
) {
    val accent = MaterialTheme.colorScheme.primary
    val pstyle = permissionStyle(permissionMode)
    Row(
        modifier = modifier.height(IntrinsicSize.Min),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TooltipWrap(stringResource(Res.string.quick_chat)) {
            Box(modifier = Modifier.fillMaxHeight().padding(start = 2.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .clickable(onClick = onQuickChat)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Lucide.MessagesSquare, contentDescription = stringResource(Res.string.quick_chat), tint = accent, modifier = Modifier.size(16.dp))
                }
                if (quickChatActive) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(accent),
                    )
                }
            }
        }
        Spacer(Modifier.width(6.dp))
        val selectorScroll = TabsController.selectorsScroll
        Row(
            modifier = Modifier
                .weight(1f)
                .horizontalScrollbar(selectorScroll, touchIndicator = false, wheelScroll = true)
                .horizontalScroll(selectorScroll)
                .padding(end = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (disconnected) {
                DisconnectedChip()
                return@Row
            }
            if (connecting) {
                ToolbarLoadingChip(stringResource(Res.string.connecting))
                return@Row
            }
            if (!ready) {
                ToolbarLoadingChip()
                return@Row
            }
            val defaultLabel = stringResource(Res.string.server_default)
            TooltipWrap(stringResource(Res.string.model)) {
                SelectorChip(
                    label = models.firstOrNull { it.id == model }?.label ?: model,
                    icon = Lucide.Sparkles,
                    tint = accent,
                    options = listOf("" to defaultLabel) + models.map { it.id to it.label },
                    selected = modelSelected,
                    onSelect = onModel,
                )
            }
            TooltipWrap(stringResource(Res.string.effort)) {
                SelectorChip(
                    label = effort,
                    icon = Lucide.Gauge,
                    tint = accent,
                    options = listOf("" to defaultLabel) + effortLevels.map { it to it },
                    selected = effortSelected,
                    onSelect = onEffort,
                )
            }
            val styles = permissionModes.associate { it.id to permissionStyle(it.id).let { s -> s.icon to s.color } }
            TooltipWrap(stringResource(Res.string.permissions)) {
                SelectorChip(
                    label = permissionModes.firstOrNull { it.id == permissionMode }?.label ?: permissionMode,
                    icon = pstyle.icon,
                    tint = pstyle.color,
                    options = listOf("" to defaultLabel) + permissionModes.map { it.id to it.label },
                    selected = permissionSelected,
                    optionStyle = { styles[it] ?: (pstyle.icon to pstyle.color) },
                    onSelect = onPermissionMode,
                )
            }
            if (accounts.size > 1) {
                TooltipWrap(stringResource(Res.string.account)) {
                    SelectorChip(
                        label = accounts.firstOrNull { it.id == account }?.label ?: account,
                        icon = Lucide.CircleUser,
                        tint = accent,
                        options = listOf("" to defaultLabel) + accounts.map { it.id to it.label },
                        selected = accountSelected,
                        onSelect = onAccount,
                    )
                }
            }
            TooltipWrap(stringResource(Res.string.streaming)) {
                StreamToggle(streaming = streaming, onClick = onStreaming)
            }
        }
        if (ready && !disconnected && !connecting && contextTokens != null && contextTokens > 0) {
            ContextRing(tokens = contextTokens, limit = if (model.contains("1m")) 1_000_000 else 200_000)
        }
    }
}

@Composable
private fun ContextRing(tokens: Int, limit: Int) {
    val progress = (tokens.toFloat() / limit).coerceIn(0f, 1f)
    val pct = (progress * 100).toInt()
    Box(modifier = Modifier.padding(start = 4.dp, end = 2.dp)) {
        TooltipTap("${fmtTokens(tokens)} / ${fmtTokens(limit)} • $pct%") {
            Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.5.dp,
                    color = if (pct >= 90) palette.red else MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

private fun fmtTokens(n: Int): String =
    if (n >= 1_000_000) {
        val m = n / 1_000_000.0
        if (m % 1.0 == 0.0) "${m.toInt()}M" else "${(m * 10).toInt() / 10.0}M"
    } else "${n / 1000}K"

@Composable
private fun StreamToggle(streaming: Boolean, onClick: () -> Unit) {
    val color = if (streaming) palette.green else MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        modifier = Modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Lucide.Radio, contentDescription = stringResource(Res.string.streaming), tint = color, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun ToolbarLoadingChip(label: String = stringResource(Res.string.loading)) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LoadingIndicator(modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, maxLines = 1)
    }
}

@Composable
private fun DisconnectedChip() {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatusDot(palette.red, box = 16.dp, dot = 10.dp)
        Spacer(Modifier.width(4.dp))
        Text(stringResource(Res.string.disconnected), style = MaterialTheme.typography.labelMedium, maxLines = 1)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SelectorChip(
    label: String,
    icon: ImageVector,
    tint: Color,
    options: List<Pair<String, String>>,
    selected: String,
    optionStyle: ((String) -> Pair<ImageVector, Color>)? = null,
    onSelect: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .clickable { open = true }
                .padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, maxLines = 1)
        }
        if (open) DropdownScrim { open = false }
        if (open) Dismissable { open = false }
        AppDropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            properties = PopupProperties(focusable = !LocalIsTouch.current),
        ) {
            options.forEach { (value, display) ->
                val style = optionStyle?.invoke(value)
                CompactDropdownItem(
                    text = display,
                    leadingIcon = style?.let { { Icon(it.first, contentDescription = null, tint = it.second, modifier = Modifier.size(20.dp)) } },
                    selected = value == selected,
                    onClick = { onSelect(value); open = false },
                )
            }
        }
    }
}

@Composable
private fun CompactProgress() {
    val color = palette.blue
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Lucide.Archive, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(Res.string.compacting),
                style = MaterialTheme.typography.bodyMedium,
                color = color,
            )
        }
        Spacer(Modifier.size(8.dp))
        LinearProgressIndicator(color = color, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun StatusProgress(kind: String) {
    val failed = kind == "failed"
    val color = if (failed) palette.red else palette.orange
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(if (failed) Lucide.TriangleAlert else Lucide.Clock3, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(if (failed) Res.string.status_failed else Res.string.status_slow),
                style = MaterialTheme.typography.bodyMedium,
                color = color,
            )
        }
        if (!failed) {
            Spacer(Modifier.size(8.dp))
            LinearProgressIndicator(color = color, modifier = Modifier.fillMaxWidth())
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommandMenuButton(
    commands: List<CommandOption>,
    streaming: Boolean,
    enabled: Boolean = true,
    onCommand: (CommandOption) -> Unit,
) {
    val ready = commands.isNotEmpty() && enabled && !streaming
    var open by remember { mutableStateOf(false) }
    Box {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .then(if (ready) Modifier else Modifier.pointerHoverIcon(PointerIcon.Default))
                .clickable(enabled = ready) { open = true },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Lucide.SquareSlash,
                contentDescription = stringResource(Res.string.commands),
                tint = if (ready) MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f),
                modifier = Modifier.size(18.dp),
            )
        }
        AbovePopupMenu(expanded = open, onDismiss = { open = false }) {
            commands.forEach { cmd ->
                CommandMenuItem(cmd) { open = false; onCommand(cmd) }
            }
        }
    }
}

@Composable
private fun CommandMenuItem(cmd: CommandOption, enabled: Boolean = true, onClick: () -> Unit) {
    val alpha = if (enabled) 1f else 0.38f
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(min = 112.dp, max = 280.dp)
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text("/${cmd.name}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha))
        if (cmd.description.isNotBlank()) {
            Text(cmd.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun Composer(
    value: String,
    onValueChange: (String) -> Unit,
    streaming: Boolean,
    sessionColor: String?,
    commands: List<CommandOption>,
    onCommand: (CommandOption) -> Unit,
    onSend: (String) -> Unit,
    onStop: () -> Unit,
    showCommands: Boolean = true,
    canSend: Boolean = true,
    commandsEnabled: Boolean = true,
    focusRequester: FocusRequester? = null,
    onCloseSide: (() -> Unit)? = null,
    attachments: List<Attachment> = emptyList(),
    uploading: Boolean = false,
    onAttach: (() -> Unit)? = null,
    chips: (@Composable () -> Unit)? = null,
    controls: (@Composable RowScope.() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(Radius.lg)
    val accent = sessionColorOf(sessionColor)
    val textStyle = MaterialTheme.typography.bodyLarge
    val density = LocalDensity.current
    val lineHeight = with(density) { textStyle.lineHeight.toDp() }
    var field by remember { mutableStateOf(TextFieldValue(value, TextRange(value.length))) }
    if (field.text != value) field = TextFieldValue(value, TextRange(value.length))

    val busy = streaming || uploading
    val canSubmit = value.isNotBlank() || attachments.isNotEmpty()

    fun trySend(): Boolean {
        if (!canSubmit) return false
        val text = field.text
        field = TextFieldValue("")
        onValueChange("")
        onSend(text)
        return true
    }

    fun insertNewline() {
        val sel = field.selection
        val updated = field.text.substring(0, sel.min) + "\n" + field.text.substring(sel.max)
        field = TextFieldValue(updated, TextRange(sel.min + 1))
        onValueChange(updated)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, accent ?: MaterialTheme.colorScheme.outlineVariant, shape)
            .pointerHoverIcon(PointerIcon.Text)
            .foundationClickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) { focusRequester?.requestFocus() },
    ) {
        chips?.invoke()
        BasicTextField(
            value = field,
            onValueChange = { field = it; onValueChange(it.text) },
            modifier = Modifier.fillMaxWidth()
                .padding(horizontal = 14.dp)
                .padding(top = if (chips != null) 6.dp else 14.dp)
                .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
                .onPreviewKeyEvent { e ->
                    if (e.type == KeyEventType.KeyDown && e.key == Key.Enter) {
                        if (e.isCtrlPressed || e.isShiftPressed) insertNewline() else trySend()
                        true
                    } else false
                },
            textStyle = textStyle.copy(color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            maxLines = 6,
            decorationBox = { innerTextField ->
                Box {
                    if (value.isEmpty()) {
                        Text(
                            stringResource(Res.string.type_message),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    innerTextField()
                }
            },
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onCloseSide != null) {
                ComposerButton(
                    icon = Lucide.X,
                    contentDescription = stringResource(Res.string.close),
                    onClick = onCloseSide,
                    background = MaterialTheme.colorScheme.surfaceVariant,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                if (onAttach != null) {
                    ComposerButton(
                        icon = Lucide.Paperclip,
                        contentDescription = stringResource(Res.string.attach_files),
                        onClick = onAttach,
                        enabled = !uploading,
                        background = MaterialTheme.colorScheme.surfaceVariant,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (showCommands) {
                    CommandMenuButton(commands = commands, streaming = streaming, enabled = commandsEnabled, onCommand = onCommand)
                }
            }
            if (controls != null) controls() else Spacer(Modifier.weight(1f))
            if (busy) {
                ComposerButton(
                    icon = CustomIcons.Stop,
                    contentDescription = stringResource(Res.string.stop),
                    onClick = onStop,
                    background = MaterialTheme.colorScheme.surfaceVariant,
                    tint = MaterialTheme.colorScheme.onSurface,
                    iconSize = 14.dp,
                )
            }
            CircleActionButton(
                icon = Lucide.ArrowUp,
                contentDescription = stringResource(Res.string.send),
                enabled = canSubmit,
                onClick = { onSend(value); onValueChange("") },
            )
        }
    }
}

@Composable
private fun QueueRow(queue: List<QueuedMessage>, scroll: ScrollState, onOpen: (QueuedMessage) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScrollbar(scroll, touchIndicator = false, wheelScroll = true)
            .horizontalScroll(scroll)
            .padding(start = 14.dp, end = 14.dp, top = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        queue.forEach { q ->
            AttachmentChip(
                name = q.text.ifBlank { q.attachments.joinToString(", ") { att -> att.substringAfterLast('/') } },
                icon = Lucide.Hourglass,
                onClick = { onOpen(q) },
            )
        }
    }
}

@Composable
private fun AttachmentsRow(
    attachments: List<Attachment>,
    uploading: Boolean,
    scroll: ScrollState,
    onRemove: (Long) -> Unit,
    topPadding: Dp = 12.dp,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScrollbar(scroll, touchIndicator = false, wheelScroll = true)
            .horizontalScroll(scroll)
            .padding(start = 14.dp, end = 14.dp, top = topPadding),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        attachments.forEach { attachment ->
            AttachmentChip(
                name = attachment.name,
                icon = if (isArchive(attachment.name)) Lucide.FolderArchive else Lucide.File,
                trailing = {
                    if (uploading) {
                        CircularProgressIndicator(
                            progress = { attachment.progress },
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp),
                        )
                    } else {
                        Icon(
                            Lucide.X,
                            contentDescription = stringResource(Res.string.delete),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .clip(CircleShape)
                                .clickable { onRemove(attachment.id) }
                                .size(16.dp),
                        )
                    }
                },
            )
        }
    }
}

@Composable
private fun CircleActionButton(
    icon: ImageVector,
    contentDescription: String,
    enabled: Boolean,
    iconSize: Dp = 18.dp,
    onClick: () -> Unit,
) {
    val bg = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    val fg = if (enabled) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(bg)
            .then(if (enabled) Modifier else Modifier.pointerHoverIcon(PointerIcon.Default))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = contentDescription, tint = fg, modifier = Modifier.size(iconSize))
    }
}

@Composable
private fun ComposerButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    background: Color,
    tint: Color,
    enabled: Boolean = true,
    iconSize: Dp = 18.dp,
) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(background)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = contentDescription, tint = tint, modifier = Modifier.size(iconSize))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EnvironmentSelector(
    environments: List<EnvironmentProfile>,
    activeId: String?,
    locked: Boolean,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val active = environments.firstOrNull { it.id == activeId } ?: environments.firstOrNull()
    if (active == null) {
        Row(modifier = modifier.padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            AppLogo()
            Spacer(Modifier.width(8.dp))
            Text(stringResource(Res.string.app_name), style = MaterialTheme.typography.titleLarge)
        }
        return
    }
    var open by remember { mutableStateOf(false) }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(enabled = !locked) { open = true }
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppLogo()
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                active.name,
                style = MaterialTheme.typography.titleMedium.copy(lineHeight = 18.sp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                active.address,
                style = MaterialTheme.typography.labelSmall.copy(lineHeight = 12.sp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (!locked) Icon(Lucide.ChevronDown, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (open) {
        EnvironmentSelectDialog(
            environments = environments,
            activeId = active.id,
            onSelect = onSelect,
            onDismiss = { open = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProjectSelector(projects: List<ProjectInfo>, selected: String?, locked: Boolean, onSelect: (String?) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    var fieldWidth by remember { mutableStateOf(0.dp) }
    val density = LocalDensity.current
    val label = if (selected == null) stringResource(Res.string.all_projects)
    else projects.firstOrNull { it.projectKey == selected }?.let(::projectLabel) ?: selected
    Box(modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .onSizeChanged { fieldWidth = with(density) { it.width.toDp() } }
                .clip(RoundedCornerShape(Radius.item))
                .clickable(enabled = !locked) { open = true }
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.FolderOpen, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(label, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            if (!locked) Icon(Lucide.ChevronDown, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
        }
        AppDropdownMenu(expanded = open, onDismissRequest = { open = false }, minWidth = fieldWidth) {
            CompactDropdownItem(stringResource(Res.string.all_projects), selected = selected == null) { onSelect(null); open = false }
            projects.forEach { p ->
                CompactDropdownItem(projectLabel(p), selected = selected == p.projectKey) { onSelect(p.projectKey); open = false }
            }
        }
    }
}

private fun projectLabel(p: ProjectInfo): String = p.name ?: p.path ?: p.projectKey

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun ConversationRow(
    title: String,
    onOpen: () -> Unit,
    onRename: () -> Unit,
    onAutoRename: () -> Unit,
    onColor: () -> Unit,
    onOpenNewTab: () -> Unit,
    onDelete: () -> Unit,
    selected: Boolean = false,
) {
    var menu by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.item))
            .then(if (selected) Modifier.background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)) else Modifier)
            .combinedClickable(onClick = onOpen, onLongClick = { menu = true })
            .secondaryClick { menu = true }
            .padding(end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = MaterialTheme.typography.bodyMedium,
            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            fontWeight = if (selected) FontWeight.SemiBold else null,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).padding(horizontal = 8.dp, vertical = 8.dp),
        )
        Box {
            IconButton(onClick = { menu = true }, modifier = Modifier.size(28.dp)) {
                Icon(Lucide.EllipsisVertical, contentDescription = null, modifier = Modifier.size(16.dp))
            }
            AppDropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                CompactDropdownItem(stringResource(Res.string.rename)) { menu = false; onRename() }
                CompactDropdownItem(stringResource(Res.string.auto_rename)) { menu = false; onAutoRename() }
                CompactDropdownItem(stringResource(Res.string.conversation_color)) { menu = false; onColor() }
                CompactDropdownItem(stringResource(Res.string.open_in_new_tab)) { menu = false; onOpenNewTab() }
                CompactDropdownItem(stringResource(Res.string.delete)) { menu = false; onDelete() }
            }
        }
    }
}
