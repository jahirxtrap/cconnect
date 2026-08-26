package com.jahirtrap.cconnect.chat

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
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
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.draw.alpha
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.LazyListState
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
import com.composables.icons.lucide.Eye
import com.composables.icons.lucide.EyeOff
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
import com.jahirtrap.cconnect.ui.theme.endEdge
import com.jahirtrap.cconnect.ui.theme.topEdge
import com.jahirtrap.cconnect.ui.theme.shadowMd
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
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.zIndex
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
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
import androidx.compose.ui.layout.layout
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
import com.jahirtrap.cconnect.data.projectLabel
import com.jahirtrap.cconnect.data.QueuedMessage
import com.jahirtrap.cconnect.data.Role
import com.jahirtrap.cconnect.data.pending
import com.jahirtrap.cconnect.data.SessionInfo
import com.jahirtrap.cconnect.data.TrashedSession
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
import com.jahirtrap.cconnect.ui.InputField
import com.jahirtrap.cconnect.ui.SelectField
import com.jahirtrap.cconnect.data.ChatCategory
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.GripHorizontal
import com.composables.icons.lucide.Plus
import com.composables.icons.lucide.RotateCcw
import com.composables.icons.lucide.Settings2
import com.composables.icons.lucide.Trash
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.ui.EditableText
import com.jahirtrap.cconnect.ui.PathChoice
import com.jahirtrap.cconnect.ui.PathPickerDialog
import com.jahirtrap.cconnect.ui.PickerIcon
import com.jahirtrap.cconnect.ui.pickPath
import com.jahirtrap.cconnect.ui.CompactDropdownSubMenu
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
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.jahirtrap.cconnect.ui.theme.snapDp
import com.jahirtrap.cconnect.settings.VisibilityDialog
import com.jahirtrap.cconnect.data.VisibilityPrefs

private const val ANCHOR_TIMEOUT_MS = 250L

private class OpenedChat {
    var sessionId: String? = null
}

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
    val tabId = TabsController.active.id
    val listState = remember(tabId) {
        val awaiting = vm.state.value.view.lastOrNull()?.interaction?.pending == true
        val (index, offset) = if (awaiting) 0 to 0 else TabsController.messageScroll(tabId)
        LazyListState(index, offset)
    }
    LaunchedEffect(tabId) {
        snapshotFlow { listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset }
            .collect { (index, offset) -> TabsController.saveMessageScroll(tabId, index, offset) }
    }
    val shown = remember(tabId) { OpenedChat() }
    val published = if (state.frozen == null) state.sessionId else shown.sessionId
    if (shown.sessionId != published) {
        val switching = shown.sessionId != null
        shown.sessionId = published
        if (switching) listState.requestScrollToItem(0)
    }
    val focusManager = LocalFocusManager.current
    val density = LocalDensity.current
    val expandedState = TabsController.expandedBlocks(tabId)

    var renameTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var deleteTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var colorTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var moveTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var movePreset by remember { mutableStateOf<String?>(null) }
    var newCategoryTarget by remember { mutableStateOf<SessionInfo?>(null) }
    var organizeOpen by remember { mutableStateOf(false) }
    var confirmCommand by remember { mutableStateOf<CommandOption?>(null) }
    var sharedLinkAction by remember { mutableStateOf<Pair<String, String>?>(null) }
    var discardComponent by remember { mutableStateOf<String?>(null) }
    var queuePreview by remember { mutableStateOf<QueuedMessage?>(null) }
    var queueFilePreview by remember { mutableStateOf<Pair<String, String>?>(null) }
    var showRewindSheet by remember { mutableStateOf(false) }
    var purgeViewTarget by remember { mutableStateOf<TrashedSession?>(null) }
    var showVisibility by remember { mutableStateOf(false) }
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
            listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset <= 4
        }
    }

    val itemHeights = remember { mutableStateMapOf<Long, Int>() }
    var anchorPending by remember { mutableStateOf<Long?>(null) }
    var pageAnchor by remember { mutableStateOf(false) }
    var collapseToTop by remember { mutableStateOf<Long?>(null) }
    var pendingScroll by remember { mutableStateOf(0) }
    LaunchedEffect(listState) {
        snapshotFlow { pendingScroll }.collect { amount ->
            if (amount == 0) return@collect
            listState.dispatchRawDelta(amount.toFloat())
            pendingScroll = 0
        }
    }
    val anchorPage = remember(listState) {
        {
            val hold = !(listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset <= 4)
            pageAnchor = hold
            hold
        }
    }
    LaunchedEffect(pageAnchor) {
        if (!pageAnchor) return@LaunchedEffect
        delay(ANCHOR_TIMEOUT_MS)
        pageAnchor = false
    }
    val firstMessage = state.view.firstOrNull()
    val conversationId = firstMessage?.timestamp ?: firstMessage?.text?.hashCode()?.toLong()
    var contentPx by remember(conversationId) { mutableStateOf(-1) }
    LaunchedEffect(conversationId) {
        snapshotFlow {
            val info = listState.layoutInfo
            val items = info.visibleItemsInfo
            if (items.isEmpty() || items.size != info.totalItemsCount) -1 else items.sumOf { it.size }
        }.collect { contentPx = it }
    }

    // Only manual scrolling changes this, so incoming content can't flip it before we react.
    var followBottom by TabsController.followBottom(tabId)
    var dropOver by remember { mutableStateOf(false) }

    var opening by remember { mutableStateOf(state.transcriptLoading) }
    LaunchedEffect(state.transcriptLoading) {
        if (state.transcriptLoading) opening = true
    }

    LaunchedEffect(opening, state.transcriptLoading) {
        if (opening && !state.transcriptLoading) opening = false
    }

    // Hidden while following; otherwise shown once scrolled more than half the chat viewport above the bottom.
    val showScrollButton by remember {
        derivedStateOf {
            if (followBottom) return@derivedStateOf false
            val info = listState.layoutInfo
            val viewportH = info.viewportEndOffset - info.viewportStartOffset
            if (viewportH == 0) return@derivedStateOf false
            val belowFold = if (listState.firstVisibleItemIndex > 0) viewportH
            else listState.firstVisibleItemScrollOffset
            belowFold > viewportH / 2
        }
    }

    LaunchedEffect(Unit) { vm.connect() }
    LaunchedEffect(state.connection) {
        if (state.connection == ConnectionState.Connected) vm.ensureHistoryLoaded()
    }
    val activeSession = state.allSessions.firstOrNull { it.sessionId == state.sessionId }
    val busy = state.streaming || (state.activity ?: activeSession?.activity) in setOf("waiting", "working", "slow", "compacting")
    val tabLabel: String? = activeSession?.let { it.title ?: it.preview ?: state.sessionId?.take(8) }
    val tabColor: String? = if (activeSession != null) state.sessionColor else null
    // The tab names the chat being read; the status line under the app name says where it lives.
    val viewTabLabel = state.viewOnly?.let { it.title ?: it.sessionId.take(8) }
    LaunchedEffect(tabLabel, tabColor, busy, state.sessionId, state.activeProjectKey, viewTabLabel) {
        TabsController.updateActive(tabLabel, tabColor, busy, state.sessionId, state.activeProjectKey, viewTabLabel)
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
    // Going back has to land on the chat the entry points at, not only on a tab that happens to
    // hold it: most history is made switching chats inside one tab, and that tab has to follow.
    ChatPopstate { _, sid, pr ->
        if (sid == null || pr == null) {
            vm.newSession()
        } else {
            val open = TabsController.tabs.firstOrNull { it.sessionId == sid }
            if (open != null) TabsController.selectTab(open.id) else vm.restoreSession(sid, pr)
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
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }
            .collect { idx ->
                val total = listState.layoutInfo.totalItemsCount
                if (total > 0 && idx >= total - 10) vm.loadMoreHistory()
            }
    }
    LaunchedEffect(
        state.view.size,
        state.view.sumOf { it.text.length },
        state.view.lastOrNull()?.id,
        state.view.lastOrNull()?.text,
        state.view.lastOrNull()?.children?.size,
        state.view.lastOrNull()?.children?.lastOrNull()?.result,
        state.compacting,
        state.activity,
    ) {
        if (state.view.isNotEmpty() && followBottom) {
            listState.scrollToItem(0)
        }
    }
    LaunchedEffect(listState) {
        snapshotFlow {
            val info = listState.layoutInfo
            val first = info.visibleItemsInfo.firstOrNull()
            Triple(first?.index, first?.size, info.viewportEndOffset)
        }.collect { (index, _, _) ->
            if (followBottom && index == 0 && contentPx < 0) listState.scrollToItem(0)
        }
    }
    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.viewportSize }.collect {
            if (followBottom && state.view.isNotEmpty() && contentPx < 0) {
                listState.scrollToItem(0)
            }
        }
    }
    LaunchedEffect(state.view.lastOrNull()?.id) {
        val last = state.view.lastOrNull() ?: return@LaunchedEffect
        if (last.role == Role.INTERACTION && last.interaction?.pending == true) {
            followBottom = true
            listState.animateScrollToItem(0)
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
                        endEdge(drawerEdge)
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
                        onMove = { session, preset -> movePreset = preset; moveTarget = session },
                        onNewCategory = { newCategoryTarget = it },
                        onOrganize = { organizeOpen = true },
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
                                    endEdge(edge)
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
                                        onMove = { session, preset -> movePreset = preset; moveTarget = session },
                                        onNewCategory = { newCategoryTarget = it },
                                        onOrganize = { organizeOpen = true },
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
                                val activity = state.activity ?: activeSession?.activity
                                val statusLeading: (@Composable () -> Unit) = when {
                                    // Reading a deleted chat: where it lives is the whole state, there is no session to report on.
                                    state.viewOnly != null -> ({ StatusDot(palette.gray, box = 8.dp) })
                                    state.connection == ConnectionState.Disconnected -> ({ StatusDot(palette.red, box = 8.dp) })
                                    state.connection == ConnectionState.Connecting -> ({ StatusSpinner() })
                                    activity == "waiting" -> ({ StatusDot(palette.orange, box = 8.dp) })
                                    activity == "compacting" -> ({ StatusSpinner(color = palette.blue) })
                                    activity == "slow" -> ({ StatusSpinner(color = palette.yellow) })
                                    activity == "working" -> ({ StatusSpinner() })
                                    activity == "failed" -> ({ StatusDot(palette.red, box = 8.dp) })
                                    else -> ({ StatusDot(palette.green, box = 8.dp) })
                                }
                                val statusText = when {
                                    state.viewOnly != null -> stringResource(Res.string.trash)
                                    state.connection == ConnectionState.Disconnected -> stringResource(Res.string.server_unavailable)
                                    state.connection == ConnectionState.Connecting -> stringResource(Res.string.connecting)
                                    activity == "waiting" -> stringResource(Res.string.waiting_user)
                                    activity == "compacting" -> stringResource(Res.string.compacting)
                                    activity == "working" || activity == "slow" -> stringResource(Res.string.working)
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
                                        if (state.viewOnly != null) {
                                            TooltipIconButton(
                                                label = stringResource(Res.string.restore),
                                                onClick = { vm.restoreViewOnly() },
                                            ) { Icon(Lucide.RotateCcw, contentDescription = null) }
                                            TooltipIconButton(
                                                label = stringResource(Res.string.delete),
                                                onClick = { purgeViewTarget = state.viewOnly },
                                            ) { Icon(Lucide.Trash, contentDescription = null) }
                                        } else {
                                            if (state.sessionId != null && !busy) {
                                                TooltipIconButton(
                                                    label = stringResource(Res.string.rewind),
                                                    onClick = { vm.loadRewindPoints(); showRewindSheet = true },
                                                ) { Icon(Lucide.History, contentDescription = null) }
                                            }
                                            TaskIndicator(todos = state.todos)
                                        }
                                        if (mobile) TabSwitcher()
                                        TooltipIconButton(
                                            label = stringResource(Res.string.new_session),
                                            onClick = { if (state.viewOnly != null) vm.closeViewOnly() else vm.newSession() },
                                        ) { Icon(Lucide.SquarePen, contentDescription = null) }
                                    },
                                )
                                }
                            },
                        ) { padding ->
                            val sc = state.sideChat ?: SideChatState(boundSessionId = state.sessionId)
                            val sideActive = state.sideChatOpen
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
                                if (sideActive && followBottom && state.view.isNotEmpty()) {
                                    listState.scrollToItem(0)
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
                                confirmCommand != null || sharedLinkAction != null || discardComponent != null || showRewindSheet
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
                                .fileDropTarget(enabled = !sideActive && state.viewOnly == null, onDragChange = { dropOver = it }) { vm.addAttachments(it) }
                                .then(if (dropOver) Modifier.border(snapDp(2.dp), MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp)) else Modifier),
                            ) {
                                BoxWithConstraints(modifier = Modifier.fillMaxWidth().weight(1f).clipToBounds()) {
                                    val boxHeightPx = constraints.maxHeight.toFloat()
                                    val toolbarReveal = (1f - expansion.value / peek).coerceIn(0f, 1f)
                                    val panelH = expansion.value.coerceAtLeast(peek)
                                    val showTime = vm.showTimestamps
                                    val listFraction = (1f - panelH * (1f - toolbarReveal)).coerceIn(0.0001f, 1f)
                                    Box(modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().fillMaxHeight(listFraction).clipToBounds()) {
                                        if (opening) CenteredProgress(Modifier.fillMaxSize())
                                        CompositionLocalProvider(LocalAnchorPage provides anchorPage) {
                                        SelectionContainer(modifier = Modifier.fillMaxSize().alpha(if (opening) 0f else 1f).selectionTextCursor()) {
                                            LazyColumn(
                                                state = listState,
                                                reverseLayout = true,
                                                verticalArrangement = Arrangement.Top,
                                                modifier = Modifier.fillMaxWidth().pointerInput(Unit) {
                                                    awaitPointerEventScope {
                                                        while (true) {
                                                            val e = awaitPointerEvent(PointerEventPass.Initial)
                                                            if (e.type == PointerEventType.Scroll && (e.changes.firstOrNull()?.scrollDelta?.y ?: 0f) < 0f) followBottom = false
                                                        }
                                                    }
                                                },
                                            ) {
                                                if (state.compacting || state.activity == "compacting") {
                                                    item(key = "compacting") {
                                                        CompactProgress()
                                                    }
                                                } else {
                                                    val status = state.streamStatus
                                                    if (status == "slow" || status == "failed") {
                                                        item(key = "stream-status") { StatusProgress(status) }
                                                    }
                                                }
                                                itemsIndexed(state.view.asReversed(), key = { _, it -> it.id }) { reversed, message ->
                                                    val index = state.view.lastIndex - reversed
                                                    val ts = message.timestamp
                                                    val separated = if (ts != null && showTime) {
                                                        val prevTs = (index - 1 downTo 0).firstNotNullOfOrNull { state.view[it].timestamp }
                                                        prevTs == null || dayIndex(prevTs) != dayIndex(ts)
                                                    } else false
                                                    val running = when (message.role) {
                                                        Role.TOOL, Role.AGENT -> message.toolUseId != null && message.toolUseId in state.pendingToolIds
                                                        Role.THINKING, Role.WORKING, Role.ASSISTANT -> index == state.view.lastIndex && state.streaming
                                                        else -> false
                                                    }
                                                    Column(
                                                        modifier = Modifier.offset { IntOffset(0, pendingScroll) }.onSizeChanged { size ->
                                                            val previous = itemHeights.put(message.id, size.height)
                                                            if (previous == null || previous == size.height) return@onSizeChanged
                                                            val delta = size.height - previous
                                                            if (pageAnchor) {
                                                                pageAnchor = false
                                                                listState.requestScrollToItem(
                                                                    listState.firstVisibleItemIndex,
                                                                    listState.firstVisibleItemScrollOffset + delta,
                                                                )
                                                                return@onSizeChanged
                                                            }
                                                            if (collapseToTop == message.id) {
                                                                collapseToTop = null
                                                                val info = listState.layoutInfo
                                                                val listIndex = info.visibleItemsInfo.firstOrNull { it.key == message.id }?.index
                                                                if (listIndex != null) {
                                                                    val viewport = info.viewportEndOffset - info.viewportStartOffset
                                                                    val gap = with(density) { gapAbove(state.view.getOrNull(index - 1)?.role, message.role).roundToPx() }
                                                                    listState.requestScrollToItem(listIndex, size.height - gap - viewport)
                                                                }
                                                                return@onSizeChanged
                                                            }
                                                            if (anchorPending == message.id) {
                                                                anchorPending = null
                                                                listState.requestScrollToItem(
                                                                    listState.firstVisibleItemIndex,
                                                                    listState.firstVisibleItemScrollOffset + delta,
                                                                )
                                                            } else if (!followBottom && delta > 0) {
                                                                pendingScroll += delta
                                                            }
                                                        },
                                                    ) {
                                                    if (separated && ts != null) ChatDateSeparator(ts)
                                                    ChatMessageItem(
                                                        message,
                                                        prevRole = state.view.getOrNull(index - 1)?.role,
                                                        nextRole = state.view.getOrNull(index + 1)?.role,
                                                        running = running,
                                                        expanded = expandedState[message.id] ?: false,
                                                        onToggle = {
                                                            if (!isAtBottom) anchorPending = message.id
                                                            expandedState[message.id] = !(expandedState[message.id] ?: false)
                                                        },
                                                        onAnswer = vm::answerInteraction,
                                                        onComponentPage = vm::setActivePage,
                                                        onComponentValue = vm::setComponentValue,
                                                        onComponentPick = vm::toggleComponentOption,
                                                        onSubmitComponent = vm::submitComponent,
                                                        onDiscardComponent = { requestId, dirty ->
                                                            if (dirty) discardComponent = requestId else vm.chatQuestions(requestId)
                                                        },
                                                        onSharedLink = { url, filename -> sharedLinkAction = url to filename },
                                                        gluedTop = separated,
                                                        showTime = showTime,
                                                    )
                                                    }
                                                }
                                            }
                                        }
                                        }
                                        var stickyHeaderHeight by remember { mutableStateOf(0) }
                                        // Two open blocks can both start above the fold; the header
                                        // belongs to the lower one, the one being read. In this
                                        // reversed list that is the smallest index whose own header
                                        // is still out of sight.
                                        val sticky by remember(expandedState) {
                                            derivedStateOf {
                                                val info = listState.layoutInfo
                                                val end = info.viewportEndOffset
                                                info.visibleItemsInfo
                                                    .sortedByDescending { it.index }
                                                    .takeWhile { end - it.offset - it.size < 0 }
                                                    .lastOrNull { (it.key as? Long)?.let { id -> expandedState[id] == true } == true }
                                                    ?.let { item ->
                                                        val id = item.key as? Long ?: return@derivedStateOf null
                                                        Triple(id, end - item.offset - item.size, end - item.offset)
                                                    }
                                            }
                                        }
                                        sticky?.let { (id, topRel, bottomRel) ->
                                            val idx = state.view.indexOfFirst { it.id == id }
                                            val msg = state.view.getOrNull(idx)
                                            if (msg != null && hasCollapsibleContent(msg)) {
                                                val gapPx = with(density) { gapAbove(state.view.getOrNull(idx - 1)?.role, msg.role).roundToPx() }
                                                if (topRel + gapPx < 0) {
                                                    val h = if (stickyHeaderHeight > 0) stickyHeaderHeight else with(density) { 40.dp.roundToPx() }
                                                    val pushY = minOf(0, bottomRel - h)
                                                    StickyCollapsibleHeader(
                                                        message = msg,
                                                        onCollapse = {
                                                            collapseToTop = id
                                                            expandedState[id] = false
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
                                        if (showScrollButton && state.view.isNotEmpty()) {
                                            Surface(
                                                onClick = {
                                                    followBottom = true
                                                    scope.launch { listState.scrollToItem(0) }
                                                },
                                                shape = CircleShape,
                                                color = MaterialTheme.colorScheme.onBackground,
                                                modifier = Modifier.align(Alignment.BottomEnd).padding(12.dp).shadowMd(CircleShape).size(32.dp).pointerHoverIcon(PointerIcon.Hand),
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
                                    if (sideActive) {
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
                                            showWorking = state.visibility.working ?: state.serverVisibility.working ?: state.showWorking,
                                            headerModifier = dragModifier,
                                            onClear = vm::clearSideChat,
                                            onAnswer = vm::answerInteraction,
                                            onComponentPage = vm::setActivePage,
                                            onComponentValue = vm::setComponentValue,
                                            onComponentPick = vm::toggleComponentOption,
                                            onSubmitComponent = vm::submitComponent,
                                            onDiscardComponent = { requestId, dirty ->
                                                if (dirty) discardComponent = requestId else vm.chatQuestions(requestId)
                                            },
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
                                // Nothing can be sent to a chat that is only being read, so the composer is not there at all.
                                if (state.viewOnly == null) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(MaterialTheme.colorScheme.background)
                                        .foundationClickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
                                    ) {
                                        val queueScroll = TabsController.queueScroll
                                        val attachScroll = TabsController.attachmentsScroll
                                        val visibleQueue = state.queueView.filterNot { it.silent }
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
                                            streamingSelected = state.streamingOverride?.let { if (it) "on" else "off" } ?: "",
                                            serverStreaming = state.streamTokens,
                                            onStreaming = vm::setStreaming,
                                            simpleMode = (state.visibility.simple ?: state.serverVisibility.simple) == "on",
                                            onVisibility = { showVisibility = true },
                                            onQuickChat = vm::openSideChat,
                                            quickChatActive = sc != null && sc.messages.isNotEmpty(),
                                            contextTokens = state.contextView,
                                            modifier = Modifier.weight(1f),
                                            )
                                        }
                                        Composer(
                                            value = if (sideActive) vm.sideDraft else vm.draft,
                                            onValueChange = { if (sideActive) vm.sideDraft = it else vm.draft = it },
                                            streaming = if (sideActive) (sc?.streaming ?: false) else busy,
                                            sessionColor = state.sessionColor,
                                            commands = state.capabilities.commands,
                                            onCommand = { cmd -> if (cmd.requireConfirmation) confirmCommand = cmd else vm.runCommand(cmd) },
                                            onSend = { if (sideActive) vm.sendSideQuestion(it) else vm.submit(it) },
                                            onStop = { if (sideActive) vm.stopSide() else vm.stop() },
                                            canSend = state.connection == ConnectionState.Connected,
                                            commandsEnabled = state.sessionId != null && state.connection == ConnectionState.Connected && !busy,
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
    }

    if (queueFilePreview == null) {
        queuePreview?.let { snap ->
            state.queueView.firstOrNull { it.id == snap.id }?.let { q ->
                CompactDialog(
                    onDismiss = { queuePreview = null },
                    title = stringResource(Res.string.queued_message),
                    buttons = {
                        Button(onClick = { queuePreview = null }, variant = ButtonVariant.Outlined) {
                            Text(stringResource(Res.string.cancel))
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
    purgeViewTarget?.let { item ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_conversation_confirm, item.title ?: item.sessionId.take(8)),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { vm.purgeViewOnly(); purgeViewTarget = null },
            onDismiss = { purgeViewTarget = null },
        )
    }
    deleteTarget?.let { s ->
        // With the trash on nothing is lost, so the dialog reads as a move, not as a deletion.
        ConfirmDialog(
            title = stringResource(if (state.trashEnabled) Res.string.trash else Res.string.delete),
            text = stringResource(
                if (state.trashEnabled) Res.string.trash_conversation_confirm else Res.string.delete_conversation_confirm,
                s.title ?: s.preview ?: s.sessionId,
            ),
            confirmLabel = stringResource(if (state.trashEnabled) Res.string.confirm else Res.string.delete),
            onConfirm = { vm.deleteSession(s); deleteTarget = null },
            onDismiss = { deleteTarget = null },
        )
    }
    if (organizeOpen) {
        OrganizeDialog(state = state, vm = vm, onDismiss = { organizeOpen = false })
    }
    moveTarget?.let { s ->
        MoveSessionDialog(
            session = s,
            projects = state.historyProjects,
            preset = movePreset,
            onConfirm = { cwd -> vm.moveSession(s, cwd); moveTarget = null },
            onDismiss = { moveTarget = null },
        )
    }
    newCategoryTarget?.let { s ->
        RenameDialog(
            initial = "",
            title = stringResource(Res.string.add_category),
            confirmLabel = stringResource(Res.string.create),
            onConfirm = { name -> vm.createCategoryWith(name, s.sessionId); newCategoryTarget = null },
            onDismiss = { newCategoryTarget = null },
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
    discardComponent?.let { requestId ->
        ConfirmDialog(
            title = stringResource(Res.string.cancel),
            text = stringResource(Res.string.component_discard_confirm),
            confirmLabel = stringResource(Res.string.discard),
            onConfirm = { vm.chatQuestions(requestId); discardComponent = null },
            onDismiss = { discardComponent = null },
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
    if (showVisibility) {
        VisibilityDialog(
            current = state.visibility,
            server = state.serverVisibility,
            onConfirm = { values ->
                vm.applyVisibility(values)
                showVisibility = false
            },
            onDismiss = { showVisibility = false },
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
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
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
    showWorking: String = "label",
    headerModifier: Modifier = Modifier,
    onClear: () -> Unit = {},
    onAnswer: ((String, String, String?) -> Unit)? = null,
    onComponentPage: ((String, Int) -> Unit)? = null,
    onComponentValue: ((String, String, String) -> Unit)? = null,
    onComponentPick: ((String, String, String, Boolean) -> Unit)? = null,
    onSubmitComponent: ((String, String?) -> Unit)? = null,
    onDiscardComponent: ((String, Boolean) -> Unit)? = null,
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
            val isAtBottom by remember {
                derivedStateOf {
                    listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset <= 4
                }
            }
            var followBottom by remember { mutableStateOf(true) }
            val itemHeights = remember { mutableStateMapOf<Long, Int>() }
            var pendingScroll by remember { mutableStateOf(0) }
            var pageAnchor by remember { mutableStateOf(false) }
            val anchorPage = remember(listState) {
                {
                    val hold = !(listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset <= 4)
                    pageAnchor = hold
                    hold
                }
            }
            LaunchedEffect(pageAnchor) {
                if (!pageAnchor) return@LaunchedEffect
                delay(ANCHOR_TIMEOUT_MS)
                pageAnchor = false
            }
            LaunchedEffect(listState) {
                snapshotFlow { pendingScroll }.collect { amount ->
                    if (amount == 0) return@collect
                    listState.dispatchRawDelta(amount.toFloat())
                    pendingScroll = 0
                }
            }
            val sideVisible = if (showWorking == "label") sideChat.messages
            else sideChat.messages.filter { it.role != Role.WORKING }
            val firstSide = sideVisible.firstOrNull()
            val sideConversationId = firstSide?.timestamp ?: firstSide?.text?.hashCode()?.toLong()
            var sideContentPx by remember(sideConversationId) { mutableStateOf(-1) }
            LaunchedEffect(sideConversationId) {
                snapshotFlow {
                    val info = listState.layoutInfo
                    val items = info.visibleItemsInfo
                    if (items.isEmpty() || items.size != info.totalItemsCount) -1 else items.sumOf { it.size }
                }.collect { sideContentPx = it }
            }
            val showScrollButton by remember {
                derivedStateOf {
                    if (followBottom) return@derivedStateOf false
                    val info = listState.layoutInfo
                    val viewportH = info.viewportEndOffset - info.viewportStartOffset
                    if (viewportH == 0) return@derivedStateOf false
                    val belowFold = if (listState.firstVisibleItemIndex > 0) viewportH
                    else listState.firstVisibleItemScrollOffset
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
                if (sideChat.messages.isNotEmpty() && followBottom) listState.scrollToItem(0)
            }
            LaunchedEffect(listState) {
                snapshotFlow {
                    val info = listState.layoutInfo
                    val first = info.visibleItemsInfo.firstOrNull()
                    Triple(first?.index, first?.size, info.viewportEndOffset)
                }.collect { (index, _, _) ->
                    if (followBottom && index == 0 && sideContentPx < 0) listState.scrollToItem(0)
                }
            }
            LaunchedEffect(listState) {
                snapshotFlow { listState.layoutInfo.viewportSize }.collect {
                    if (followBottom && sideChat.messages.isNotEmpty() && sideContentPx < 0) {
                        listState.scrollToItem(0)
                    }
                }
            }
            LaunchedEffect(lastMsg?.id) {
                val last = lastMsg ?: return@LaunchedEffect
                if (last.role == Role.INTERACTION && last.interaction?.pending == true) {
                    followBottom = true
                    listState.animateScrollToItem(0)
                }
            }
            BoxWithConstraints(modifier = Modifier.weight(1f).fillMaxWidth()) {
                CompositionLocalProvider(LocalAnchorPage provides anchorPage) {
                SelectionContainer(modifier = Modifier.fillMaxSize().selectionTextCursor()) {
                    LazyColumn(
                        state = listState,
                        reverseLayout = true,
                        verticalArrangement = Arrangement.Top,
                        modifier = Modifier.fillMaxWidth().pointerInput(Unit) {
                            awaitPointerEventScope {
                                while (true) {
                                    val e = awaitPointerEvent(PointerEventPass.Initial)
                                    if (e.type == PointerEventType.Scroll && (e.changes.firstOrNull()?.scrollDelta?.y ?: 0f) < 0f) followBottom = false
                                }
                            }
                        },
                    ) {
                        itemsIndexed(sideVisible.asReversed(), key = { _, it -> it.id }) { reversed, message ->
                            val index = sideVisible.lastIndex - reversed
                            Column(
                                modifier = Modifier.offset { IntOffset(0, pendingScroll) }.onSizeChanged { size ->
                                    val previous = itemHeights.put(message.id, size.height)
                                    if (previous == null || previous == size.height) return@onSizeChanged
                                    val delta = size.height - previous
                                    if (pageAnchor) {
                                        pageAnchor = false
                                        listState.requestScrollToItem(
                                            listState.firstVisibleItemIndex,
                                            listState.firstVisibleItemScrollOffset + delta,
                                        )
                                    } else if (!followBottom && delta > 0) pendingScroll += delta
                                },
                            ) {
                            ChatMessageItem(
                                message,
                                prevRole = sideVisible.getOrNull(index - 1)?.role,
                                nextRole = sideVisible.getOrNull(index + 1)?.role,
                                running = message.role == Role.WORKING && index == sideChat.messages.lastIndex && sideChat.streaming,
                                onAnswer = onAnswer,
                                onComponentPage = onComponentPage,
                                onComponentValue = onComponentValue,
                                onComponentPick = onComponentPick,
                                onSubmitComponent = onSubmitComponent,
                                onDiscardComponent = onDiscardComponent,
                                onSharedLink = onSharedLink,
                            )
                            }
                        }
                    }
                }
                }
                if (showScrollButton && sideChat.messages.isNotEmpty()) {
                    Surface(
                        onClick = {
                            followBottom = true
                            scope.launch { listState.scrollToItem(0) }
                        },
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.align(Alignment.BottomEnd).padding(12.dp).shadowMd(CircleShape).size(32.dp),
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
    onMove: (com.jahirtrap.cconnect.data.SessionInfo, String?) -> Unit,
    onNewCategory: (com.jahirtrap.cconnect.data.SessionInfo) -> Unit,
    onOrganize: () -> Unit,
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
            // The one in front stays listed even when hidden, or the selector would name a project it cannot show.
            projects = state.historyProjects.filter {
                it.projectKey !in state.hiddenProjects || it.projectKey == state.historyProjectKey
            },
            selected = state.historyProjectKey,
            locked = projectLocked,
            onSelect = vm::selectHistoryProject,
            modifier = Modifier.weight(1f),
        )
        TooltipIconButton(label = stringResource(Res.string.organize), onClick = onOrganize, size = 32.dp) {
            Icon(Lucide.Settings2, contentDescription = null, modifier = Modifier.size(16.dp))
        }
    }
    val drawerListState = rememberLazyListState()
    LaunchedEffect(state.historyProjectKey) {
        if (state.historySessions.isNotEmpty()) drawerListState.scrollToItem(0)
    }
    LazyColumn(
        state = drawerListState,
        modifier = Modifier.weight(1f).fillMaxWidth(),
        contentPadding = PaddingValues(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 8.dp),
    ) {
        val groups = groupSessions(state)
        when {
            state.historySessions.isNotEmpty() -> groups.forEachIndexed { groupIndex, group ->
                // The loose group has no header of its own, so it needs a line to break from the one above.
                if (group.category == null && groupIndex > 0) {
                    item(key = "loose-divider") {
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = MaterialTheme.colorScheme.outlineVariant,
                        )
                    }
                }
                if (group.category != null) {
                    item(key = "cat-${group.category.id}") {
                        CategoryHeader(
                            category = group.category,
                            count = group.sessions.size,
                            collapsed = group.category.id in state.collapsedCategories,
                            onToggle = { vm.toggleCategory(group.category) },
                            onNewChat = { TabsController.newTab(group.category.id); onAfterSelect() },
                        )
                    }
                }
                if (group.category?.id !in state.collapsedCategories) {
                    items(group.sessions, key = { it.sessionId }) { s ->
                        ConversationRow(
                            title = s.title ?: s.preview ?: s.sessionId.take(8),
                            selected = s.sessionId == state.sessionId,
                            onOpen = { vm.openSession(s); onAfterSelect() },
                            onRename = { onRename(s) },
                            onAutoRename = { vm.autoRenameSession(s) },
                            onColor = { onColor(s) },
                            onOpenNewTab = { s.projectKey?.let { pk -> TabsController.openSessionTab(TabsController.active.ctx.environmentId, s.path.orEmpty(), s.sessionId, pk, s.title ?: s.preview, s.color); onAfterSelect() } },
                            onDelete = { onDelete(s) },
                            onMove = { preset -> onMove(s, preset) },
                            categories = state.categories,
                            currentCategoryId = state.placement[s.sessionId]?.categoryId,
                            onPlace = { categoryId -> vm.placeSession(s.sessionId, categoryId) },
                            onNewCategory = { onNewCategory(s) },
                            projects = state.historyProjects,
                            currentProjectKey = s.projectKey,
                            activity = s.activity,
                        )
                    }
                }
            }

            state.historyLoading -> item { CenteredProgress(Modifier.fillParentMaxSize()) }
            else -> item { EmptyState(stringResource(Res.string.no_chats), Modifier.fillParentMaxSize()) }
        }
    }
    val edge = MaterialTheme.colorScheme.outlineVariant
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .drawBehind { topEdge(edge) }
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
    streamingSelected: String,
    serverStreaming: Boolean,
    simpleMode: Boolean,
    onStreaming: (String) -> Unit,
    onVisibility: () -> Unit,
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
            Box(modifier = Modifier.padding(start = 2.dp)) {
                Row(
                    modifier = Modifier
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
                StreamToggle(streaming = streaming, selected = streamingSelected, serverOn = serverStreaming, onSelect = onStreaming)
            }
            TooltipWrap(stringResource(Res.string.visibility)) {
                VisibilityToggle(simple = simpleMode, onClick = onVisibility)
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
private fun VisibilityToggle(simple: Boolean, onClick: () -> Unit) {
    val color = MaterialTheme.colorScheme.primary
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(if (simple) Lucide.EyeOff else Lucide.Eye, contentDescription = stringResource(Res.string.visibility), tint = color, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun StreamToggle(streaming: Boolean, selected: String, serverOn: Boolean, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val color = if (streaming) palette.green else MaterialTheme.colorScheme.onSurfaceVariant
    val onText = stringResource(Res.string.option_on)
    val offText = stringResource(Res.string.option_off)
    val options = listOf(
        "" to "${stringResource(Res.string.server_default)} (${if (serverOn) onText else offText})",
        "on" to onText,
        "off" to offText,
    )
    Box {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .clickable { open = true }
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.Radio, contentDescription = stringResource(Res.string.streaming), tint = color, modifier = Modifier.size(16.dp))
        }
        if (open) DropdownScrim { open = false }
        if (open) Dismissable { open = false }
        AppDropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            properties = PopupProperties(focusable = !LocalIsTouch.current),
        ) {
            options.forEach { (value, display) ->
                CompactDropdownItem(
                    text = display,
                    selected = value == selected,
                    onClick = { onSelect(value); open = false },
                )
            }
        }
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

/** The turn is dragging or the API failed: same band as compacting, in its own colour. */
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
            Icon(
                if (failed) Lucide.TriangleAlert else Lucide.Clock3,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(18.dp),
            )
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
            .border(snapDp(2.dp), accent ?: MaterialTheme.colorScheme.outlineVariant, shape)
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


@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun OrganizeDialog(state: ChatUiState, vm: ChatViewModel, onDismiss: () -> Unit) {
    var editing by remember { mutableStateOf<String?>(null) }
    var draft by remember { mutableStateOf("") }
    var deletingCategory by remember { mutableStateOf<ChatCategory?>(null) }
    var deletingProject by remember { mutableStateOf<ProjectInfo?>(null) }
    var addingProject by remember { mutableStateOf(false) }
    var trashOpen by remember { mutableStateOf(false) }
    var draggingId by remember { mutableStateOf<String?>(null) }
    var dragDy by remember { mutableStateOf(0f) }
    val rowHeights = remember { mutableStateMapOf<String, Float>() }
    val isTouch = LocalIsTouch.current
    val categoryWord = stringResource(Res.string.category)
    val spacingPx = with(LocalDensity.current) { 4.dp.toPx() }

    fun commit(category: ChatCategory) {
        if (draft.isNotBlank() && draft != category.name) vm.renameCategory(category, draft)
        editing = null
    }

    val dragFrom = state.categories.indexOfFirst { it.id == draggingId }
    val step = (rowHeights[draggingId] ?: 0f) + spacingPx
    // Where the dragged row would land; the rows in between open the gap for it.
    val dropIndex = if (draggingId == null || step <= spacingPx) -1
    else (dragFrom + (dragDy / step).roundToInt()).coerceIn(0, state.categories.lastIndex)

    fun shiftOf(index: Int): Float = when {
        dropIndex < 0 || index == dragFrom -> 0f
        dropIndex > dragFrom && index > dragFrom && index <= dropIndex -> -step
        dropIndex < dragFrom && index < dragFrom && index >= dropIndex -> step
        else -> 0f
    }

    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.organize),
        buttons = { Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.close)) } },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 420.dp)
                .verticalScroll(rememberScrollState())
                // A drag owns the pointer: nothing under it may claim the cursor.
                .then(
                    if (draggingId == null) Modifier
                    else Modifier.pointerHoverIcon(PointerIcon.Hand, overrideDescendants = true),
                ),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            SelectField(
                label = stringResource(Res.string.chat_order),
                selected = state.chatOrder,
                options = listOf(
                    "auto" to stringResource(Res.string.chat_order_auto),
                    "manual" to stringResource(Res.string.chat_order_manual),
                ),
                shown = stringResource(
                    if (state.chatOrder == "manual") Res.string.chat_order_manual else Res.string.chat_order_auto,
                ),
                onSelect = { vm.setChatOrder(it) },
            )
            val noCategory = stringResource(Res.string.no_category)
            SelectField(
                label = stringResource(Res.string.default_category),
                selected = state.defaultCategory,
                options = listOf("" to noCategory) + state.categories.map { it.id to it.name },
                shown = state.categories.firstOrNull { it.id == state.defaultCategory }?.name ?: noCategory,
                onSelect = { vm.setDefaultCategory(it) },
            )
            FieldLabel(stringResource(Res.string.categories))
            state.categories.forEachIndexed { index, category ->
                val dragging = category.id == draggingId
                val shift = remember(category.id) { Animatable(0f) }
                LaunchedEffect(shiftOf(index), draggingId) {
                    // The rows land where the gap already showed them, so the drop must not animate.
                    if (draggingId == null) shift.snapTo(0f) else shift.animateTo(shiftOf(index), tween(160))
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .onSizeChanged { rowHeights[category.id] = it.height.toFloat() }
                        .zIndex(if (dragging) 1f else 0f)
                        .graphicsLayer { translationY = if (dragging) dragDy else shift.value }
                        .clip(RoundedCornerShape(Radius.item))
                        .then(
                            if (dragging) {
                                Modifier
                                    .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
                                    .pointerHoverIcon(PointerIcon.Hand, overrideDescendants = true)
                            } else {
                                Modifier
                            },
                        )
                        .padding(end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    DragHandle(
                        isTouch = isTouch,
                        onStart = { draggingId = category.id; dragDy = 0f },
                        onDrag = { dragDy += it },
                        onEnd = {
                            if (dropIndex >= 0 && dropIndex != dragFrom) {
                                vm.reorderCategory(category.id, dropIndex)
                                vm.commitCategoryOrder(category.id)
                            }
                            draggingId = null
                            dragDy = 0f
                        },
                    )
                    EditableText(
                        value = if (editing == category.id) draft else category.name,
                        editing = editing == category.id,
                        onEdit = { editing = category.id; draft = category.name },
                        onValueChange = { draft = it },
                        onCommit = { commit(category) },
                        onCancel = { editing = null },
                        modifier = Modifier.weight(1f),
                        interactive = draggingId == null,
                    )
                    val hidden = category.id in state.hiddenCategories
                    val eye = if (hidden) Lucide.EyeOff else Lucide.Eye
                    if (draggingId == null) {
                        TooltipIconButton(
                            label = stringResource(if (hidden) Res.string.show else Res.string.hide),
                            onClick = { vm.toggleCategoryHidden(category.id) },
                            size = 32.dp,
                        ) { Icon(eye, contentDescription = null, modifier = Modifier.size(16.dp)) }
                        TooltipIconButton(
                            label = stringResource(Res.string.delete),
                            onClick = { deletingCategory = category },
                            size = 32.dp,
                        ) { Icon(Lucide.Trash, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    } else {
                        Box(Modifier.size(32.dp), contentAlignment = Alignment.Center) {
                            Icon(eye, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                        Box(Modifier.size(32.dp), contentAlignment = Alignment.Center) {
                            Icon(Lucide.Trash, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
            ActionButton(
                text = stringResource(Res.string.add_category),
                onClick = { vm.createCategory("$categoryWord ${state.categories.size + 1}") },
                modifier = Modifier.fillMaxWidth(),
            )
            FieldLabel(stringResource(Res.string.projects))
            // Alphabetical: projects carry no order of their own, unlike categories.
            state.historyProjects.sortedBy { projectLabel(it).lowercase() }.forEach { project ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    EditableText(
                        value = if (editing == project.projectKey) draft else projectLabel(project),
                        editing = editing == project.projectKey,
                        onEdit = { editing = project.projectKey; draft = projectLabel(project) },
                        onValueChange = { draft = it },
                        onCommit = { if (draft.isNotBlank()) vm.renameProject(project, draft); editing = null },
                        onCancel = { editing = null },
                        modifier = Modifier.weight(1f),
                        interactive = draggingId == null,
                    )
                    // Always in place so the row keeps its shape; it only has something to reset with a custom name.
                    TooltipIconButton(
                        label = stringResource(Res.string.reset_name),
                        onClick = { vm.renameProject(project, "") },
                        enabled = project.customName,
                        size = 32.dp,
                    ) { Icon(Lucide.RotateCcw, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    val hidden = project.projectKey in state.hiddenProjects
                    TooltipIconButton(
                        label = stringResource(if (hidden) Res.string.show else Res.string.hide),
                        onClick = { vm.toggleProjectHidden(project.projectKey) },
                        size = 32.dp,
                    ) {
                        Icon(
                            if (hidden) Lucide.EyeOff else Lucide.Eye,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                    TooltipIconButton(
                        label = stringResource(Res.string.delete),
                        onClick = { deletingProject = project },
                        size = 32.dp,
                    ) { Icon(Lucide.Trash, contentDescription = null, modifier = Modifier.size(16.dp)) }
                }
            }
            ActionButton(
                text = stringResource(Res.string.add_project),
                onClick = { addingProject = true },
                modifier = Modifier.fillMaxWidth(),
            )
            // The trash is a place of its own, not a third list crammed under these two.
            if (state.trashEnabled) {
                ActionButton(
                    text = stringResource(Res.string.trash),
                    onClick = { trashOpen = true },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
    if (trashOpen) {
        TrashDialog(
            vm = vm,
            onView = { vm.openViewOnly(it); trashOpen = false; onDismiss() },
            onDismiss = { trashOpen = false },
        )
    }
    deletingCategory?.let { category ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_category_confirm, category.name),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { vm.deleteCategory(category); deletingCategory = null },
            onDismiss = { deletingCategory = null },
        )
    }
    deletingProject?.let { project ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_project_confirm, projectLabel(project)),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { vm.deleteProject(project.projectKey); deletingProject = null },
            onDismiss = { deletingProject = null },
        )
    }
    if (addingProject) {
        ProjectPathDialog(
            onConfirm = { path, name -> vm.addProject(path, name.ifBlank { null }); addingProject = false },
            onDismiss = { addingProject = false },
        )
    }
}

@Composable
private fun TrashDialog(vm: ChatViewModel, onView: (TrashedSession) -> Unit, onDismiss: () -> Unit) {
    var items by remember { mutableStateOf<List<TrashedSession>>(emptyList()) }
    var emptying by remember { mutableStateOf(false) }
    var purging by remember { mutableStateOf<TrashedSession?>(null) }
    val scope = rememberCoroutineScope()
    suspend fun load() {
        items = vm.trash().items
    }
    LaunchedEffect(Unit) { load() }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.trash),
        titleTrailing = {
            TooltipIconButton(
                label = stringResource(Res.string.empty_trash),
                onClick = { emptying = true },
                enabled = items.isNotEmpty(),
                size = 32.dp,
            ) { Icon(Lucide.Trash, contentDescription = null, modifier = Modifier.size(18.dp)) }
        },
        buttons = { Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.close)) } },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (items.isEmpty()) {
                Text(
                    stringResource(Res.string.trash_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                )
            }
            items.forEach { item ->
                // The whole row opens it read-only, like a chat row does, so the hover covers it all.
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radius.item))
                        .clickable { onView(item) }
                        .padding(end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        item.title ?: item.sessionId.take(8),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 10.dp),
                    )
                    TooltipIconButton(
                        label = stringResource(Res.string.restore),
                        onClick = { scope.launch { vm.restoreTrashed(item.sessionId); load() } },
                        size = 32.dp,
                    ) { Icon(Lucide.RotateCcw, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    // Deleting here is the end of the line, so it asks like every other point of no return.
                    TooltipIconButton(
                        label = stringResource(Res.string.delete),
                        onClick = { purging = item },
                        size = 32.dp,
                    ) { Icon(Lucide.Trash, contentDescription = null, modifier = Modifier.size(16.dp)) }
                }
            }
        }
    }
    purging?.let { item ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_conversation_confirm, item.title ?: item.sessionId.take(8)),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { scope.launch { vm.purgeTrashed(item.sessionId); load() }; purging = null },
            onDismiss = { purging = null },
        )
    }
    if (emptying) {
        ConfirmDialog(
            title = stringResource(Res.string.empty_trash),
            text = stringResource(Res.string.empty_trash_confirm),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { scope.launch { vm.emptyTrash(); load() }; emptying = false },
            onDismiss = { emptying = false },
        )
    }
}

@Composable
private fun ProjectPathDialog(onConfirm: (String, String) -> Unit, onDismiss: () -> Unit) {
    var path by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var browsing by remember { mutableStateOf(false) }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.add_project),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(path.trim(), name.trim()) }, enabled = path.isNotBlank()) {
                Text(stringResource(Res.string.create))
            }
        },
    ) {
        InputField(
            value = path,
            onValueChange = { path = it },
            singleLine = true,
            placeholder = stringResource(Res.string.move_project_path),
            // The path belongs to the machine running the backend, so browsing happens there.
            trailingIcon = { PickerIcon { browsing = true } },
            modifier = Modifier.fillMaxWidth(),
        )
        Box(Modifier.height(10.dp))
        // Optional: left empty, the project shows the name of its folder.
        InputField(
            value = name,
            onValueChange = { name = it },
            singleLine = true,
            placeholder = stringResource(Res.string.name),
            modifier = Modifier.fillMaxWidth(),
        )
    }
    if (browsing) {
        PathPickerDialog(
            onConfirm = { path = it; browsing = false },
            onDismiss = { browsing = false },
            start = path,
        )
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 4.dp))
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun DragHandle(
    isTouch: Boolean,
    onStart: () -> Unit,
    onDrag: (Float) -> Unit,
    onEnd: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(28.dp)
            .pointerHoverIcon(PointerIcon.Hand)
            .pointerInput(isTouch) {
                if (isTouch) {
                    detectDragGesturesAfterLongPress(
                        onDragStart = { onStart() },
                        onDragEnd = onEnd,
                        onDragCancel = onEnd,
                        onDrag = { change, amount -> change.consume(); onDrag(amount.y) },
                    )
                } else {
                    detectDragGestures(
                        onDragStart = { onStart() },
                        onDragEnd = onEnd,
                        onDragCancel = onEnd,
                        onDrag = { change, amount -> change.consume(); onDrag(amount.y) },
                    )
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Lucide.GripHorizontal,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(16.dp),
        )
    }
}

private data class SessionGroup(val category: ChatCategory?, val sessions: List<SessionInfo>)

private fun groupSessions(state: ChatUiState): List<SessionGroup> {
    val sessions = state.historySessions
    if (state.categories.isEmpty()) return listOf(SessionGroup(null, sessions))
    val manual = state.chatOrder == "manual"
    val ordered = { list: List<SessionInfo> ->
        if (manual) list.sortedBy { state.placement[it.sessionId]?.position ?: Double.MAX_VALUE }
        else list.sortedByDescending { it.lastActive ?: 0.0 }
    }
    val byCategory = sessions.groupBy { state.placement[it.sessionId]?.categoryId }
    // A hidden category takes its chats with it: they are not loose, just out of sight.
    val groups = state.categories
        .filter { it.id !in state.hiddenCategories }
        .map { SessionGroup(it, ordered(byCategory[it.id].orEmpty())) }
    val loose = ordered(byCategory[null].orEmpty())
    return if (loose.isEmpty()) groups else groups + SessionGroup(null, loose)
}

@Composable
private fun CategoryHeader(
    category: ChatCategory,
    count: Int,
    collapsed: Boolean,
    onToggle: () -> Unit,
    onNewChat: () -> Unit,
) {
    val accent = sessionColorOf(category.color) ?: MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.item))
            .clickable(onClick = onToggle)
            .pointerHoverIcon(PointerIcon.Hand)
            .padding(end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (collapsed) Lucide.ChevronRight else Lucide.ChevronDown,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 4.dp).size(14.dp),
        )
        Text(
            category.name.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = accent,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            // Shorter than a chat row on purpose: a header, not another entry in the list.
            modifier = Modifier.weight(1f).padding(start = 4.dp, top = 6.dp, bottom = 6.dp),
        )
        Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            Text(
                count.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        // Starts a chat already inside this category.
        TooltipIconButton(
            label = stringResource(Res.string.new_chat),
            size = 24.dp,
            tooltip = false,
            onClick = onNewChat,
        ) {
            Icon(
                Lucide.Plus,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}

@Composable
private fun MoveSessionDialog(
    session: SessionInfo,
    projects: List<ProjectInfo>,
    /** Project path picked in the menu; null opens straight on the custom-path field. */
    preset: String?,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var custom by remember { mutableStateOf("") }
    var browsing by remember { mutableStateOf(false) }
    val target = preset ?: custom.trim()
    // The menu already picked the project, so that case is only confirmed here.
    val targetName = preset?.let { path -> projects.firstOrNull { it.path == path }?.let(::projectLabel) ?: path }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.move_to_project),
        description = targetName,
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(target) }, enabled = target.isNotBlank() && target != session.path) {
                Text(stringResource(Res.string.move))
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (preset == null) {
                InputField(
                    value = custom,
                    onValueChange = { custom = it },
                    singleLine = true,
                    placeholder = stringResource(Res.string.move_project_path),
                    // The path belongs to the machine running the backend, so browsing happens there.
                    trailingIcon = { PickerIcon { browsing = true } },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Text(
                stringResource(Res.string.move_project_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
    if (browsing) {
        PathPickerDialog(
            onConfirm = { custom = it; browsing = false },
            onDismiss = { browsing = false },
            start = custom,
        )
    }
}

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
    /** `preset` is the project path to land on, or null to type a custom one. */
    onMove: (String?) -> Unit,
    categories: List<ChatCategory> = emptyList(),
    currentCategoryId: String? = null,
    onPlace: (String?) -> Unit = {},
    onNewCategory: () -> Unit = {},
    projects: List<ProjectInfo> = emptyList(),
    currentProjectKey: String? = null,
    selected: Boolean = false,
    activity: String? = null,
) {
    var menu by remember { mutableStateOf(false) }
    var categoryMenu by remember { mutableStateOf(false) }
    var projectMenu by remember { mutableStateOf(false) }
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
        when (activity) {
            "waiting" -> StatusDot(palette.orange, box = 16.dp, dot = 9.dp)
            "failed" -> StatusDot(palette.red, box = 16.dp, dot = 9.dp)
            "renaming" -> Box(Modifier.size(16.dp), contentAlignment = Alignment.Center) {
                StatusSpinner(size = 9.dp, color = palette.purple)
            }
            "compacting" -> Box(Modifier.size(16.dp), contentAlignment = Alignment.Center) {
                StatusSpinner(size = 9.dp, color = palette.blue)
            }
            "slow" -> Box(Modifier.size(16.dp), contentAlignment = Alignment.Center) {
                StatusSpinner(size = 9.dp, color = palette.yellow)
            }
            "working" -> Box(Modifier.size(16.dp), contentAlignment = Alignment.Center) {
                StatusSpinner(size = 9.dp)
            }
        }
        Box {
            IconButton(onClick = { menu = true }, modifier = Modifier.size(28.dp)) {
                Icon(Lucide.EllipsisVertical, contentDescription = null, modifier = Modifier.size(16.dp))
            }
            AppDropdownMenu(expanded = menu, onDismissRequest = { menu = false; categoryMenu = false }) {
                CompactDropdownItem(stringResource(Res.string.rename)) { menu = false; onRename() }
                CompactDropdownItem(stringResource(Res.string.auto_rename)) { menu = false; onAutoRename() }
                CompactDropdownItem(stringResource(Res.string.conversation_color)) { menu = false; onColor() }
                CompactDropdownItem(stringResource(Res.string.open_in_new_tab)) { menu = false; onOpenNewTab() }
                CompactDropdownSubMenu(
                    text = stringResource(Res.string.category),
                    expanded = categoryMenu,
                    onExpandedChange = { categoryMenu = it },
                ) {
                    if (categories.isNotEmpty()) {
                        CompactDropdownItem(stringResource(Res.string.no_category), selected = currentCategoryId == null) {
                            menu = false
                            categoryMenu = false
                            onPlace(null)
                        }
                        categories.forEach { category ->
                            CompactDropdownItem(category.name, selected = currentCategoryId == category.id) {
                                menu = false
                                categoryMenu = false
                                onPlace(category.id)
                            }
                        }
                    }
                    CompactDropdownItem(
                        stringResource(Res.string.add_category),
                        trailing = {
                            Icon(
                                Lucide.Plus,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(16.dp),
                            )
                        },
                    ) {
                        menu = false
                        categoryMenu = false
                        onNewCategory()
                    }
                }
                CompactDropdownSubMenu(
                    text = stringResource(Res.string.project),
                    expanded = projectMenu,
                    onExpandedChange = { projectMenu = it },
                ) {
                    projects.forEach { project ->
                        val path = project.path
                        val current = project.projectKey == currentProjectKey
                        CompactDropdownItem(projectLabel(project), selected = current) {
                            menu = false
                            projectMenu = false
                            if (!current && path != null) onMove(path)
                        }
                    }
                    CompactDropdownItem(
                        stringResource(Res.string.add_project),
                        trailing = {
                            Icon(
                                Lucide.Plus,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(16.dp),
                            )
                        },
                    ) {
                        menu = false
                        projectMenu = false
                        onMove(null)
                    }
                }
                CompactDropdownItem(stringResource(Res.string.delete)) { menu = false; onDelete() }
            }
        }
    }
}
