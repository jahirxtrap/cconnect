package com.jahirtrap.cconnect.files

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import coil3.compose.LocalPlatformContext
import coil3.compose.AsyncImagePainter
import com.jahirtrap.cconnect.data.remote.AppImageLoader
import com.jahirtrap.cconnect.data.remote.Backend
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontFamily
import com.jahirtrap.cconnect.ui.AppDropdownMenu
import com.jahirtrap.cconnect.ui.theme.LocalMonoFontFamily
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Download
import com.composables.icons.lucide.EllipsisVertical
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Save
import com.composables.icons.lucide.Share2
import com.composables.icons.lucide.Trash
import com.composables.icons.lucide.Type
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.data.remote.SharedApi
import com.jahirtrap.cconnect.data.remote.UrlCodec
import com.jahirtrap.cconnect.data.remote.SharedWatchSocket
import com.jahirtrap.cconnect.data.remote.fetchSharedText
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CenteredProgress
import com.jahirtrap.cconnect.ui.CompactDropdownItem
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.Dismissable
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.MarkdownText
import com.jahirtrap.cconnect.ui.PreviewOverlay
import com.jahirtrap.cconnect.ui.TooltipIconButton
import kotlinx.coroutines.launch

@Composable
fun FilePreviewScreen(
    url: String,
    filename: String,
    onClose: () -> Unit,
    onDelete: (() -> Unit)? = null,
) {
    val scope = rememberCoroutineScope()
    val settings = remember { Settings() }
    var formatted by remember { mutableStateOf(settings.markdownPreviewFormatted) }
    var text by remember(url) { mutableStateOf<String?>(null) }
    var failed by remember(url) { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var confirmingDelete by remember { mutableStateOf(false) }
    var version by remember(url) { mutableStateOf(0) }

    val relPath = remember(url) { SharedApi.relativeFromUrl(url) }
    val watcher = remember { SharedWatchSocket(scope) { Backend.snapshot() } }
    DisposableEffect(Unit) {
        watcher.connect()
        onDispose { watcher.close() }
    }
    LaunchedEffect(url, relPath) {
        val parent = relPath?.substringBeforeLast('/', "") ?: return@LaunchedEffect
        val fileName = relPath.substringAfterLast('/')
        watcher.watch(parent)
        var lastSig: Pair<Long, Double>? = null
        var first = true
        watcher.entries.collect { live ->
            if (live == null) return@collect
            val sig = live.firstOrNull { it.name == fileName }?.let { it.size to it.modified }
            if (first) { first = false; lastSig = sig } else if (sig != lastSig) { lastSig = sig; version++ }
        }
    }

    val keyboard = LocalSoftwareKeyboardController.current
    LaunchedEffect(Unit) { keyboard?.hide() }

    Dismissable { onClose() }

    DisposableEffect(Unit) {
        PreviewOverlay.enter()
        onDispose { PreviewOverlay.leave() }
    }

    val kind = previewKindOf(filename)
    LaunchedEffect(url, version) {
        if (kind == PreviewKind.Html) return@LaunchedEffect
        if (kind == PreviewKind.Image) return@LaunchedEffect  // Coil streams the image itself
        val result = fetchSharedText(url)
        if (result != null) text = result else failed = true
    }

    if (confirmingDelete && onDelete != null) {
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_file_confirm, filename),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = {
                confirmingDelete = false
                onDelete()
                onClose()
            },
            onDismiss = { confirmingDelete = false },
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(Res.string.view),
                subtitle = filename,
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    if (kind == PreviewKind.Markdown) {
                        TooltipIconButton(
                            label = stringResource(Res.string.formatted_view),
                            onClick = {
                                formatted = !formatted
                                settings.markdownPreviewFormatted = formatted
                            },
                        ) {
                            Icon(
                                Lucide.Type, contentDescription = null,
                                tint = if (formatted) MaterialTheme.colorScheme.primary else LocalContentColor.current,
                            )
                        }
                    }
                    Box {
                        TooltipIconButton(label = stringResource(Res.string.files), onClick = { menu = true }) {
                            Icon(Lucide.EllipsisVertical, contentDescription = null)
                        }
                        AppDropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.save),
                                leadingIcon = { Icon(Lucide.Download, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; scope.launch { downloadShared(url, filename) } },
                            )
                            CompactDropdownItem(
                                text = stringResource(Res.string.save_as),
                                leadingIcon = { Icon(Lucide.Save, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; scope.launch { saveSharedAs(url, filename) } },
                            )
                            CompactDropdownItem(
                                text = stringResource(Res.string.share),
                                leadingIcon = { Icon(Lucide.Share2, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; scope.launch { openSharedExternally(url, filename) } },
                            )
                            if (onDelete != null) {
                                CompactDropdownItem(
                                    text = stringResource(Res.string.delete),
                                    leadingIcon = { Icon(Lucide.Trash, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                    onClick = { menu = false; confirmingDelete = true },
                                )
                            }
                        }
                    }
                },
            )
        },
    ) { padding ->
        when {
            kind == PreviewKind.Image -> {
                val imgBase = url.substringBefore("?fb=")
                val imgFallback = url.substringAfter("?fb=", "").takeIf { it.isNotEmpty() }?.let { UrlCodec.decode(it) }
                ImagePreview(if (version > 0) "$imgBase?cb=$version" else imgBase, imgFallback, Modifier.fillMaxSize().padding(padding))
            }
            kind == PreviewKind.Html -> HtmlPreview(
                url = url,
                filename = filename,
                onOpenExternally = { scope.launch { openSharedExternally(url, filename) } },
                modifier = Modifier.fillMaxSize().padding(padding),
            )
            failed -> EmptyState(stringResource(Res.string.file_unavailable), Modifier.fillMaxSize().padding(padding))
            text == null -> CenteredProgress(Modifier.fillMaxSize().padding(padding))
            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            ) {
                if (kind == PreviewKind.Markdown && formatted) {
                    MarkdownText(text.orEmpty(), modifier = Modifier.fillMaxWidth())
                } else {
                    SelectionContainer {
                        Text(
                            text.orEmpty(),
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = LocalMonoFontFamily.current,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ImagePreview(url: String, fallbackUrl: String? = null, modifier: Modifier = Modifier) {
    val context = LocalPlatformContext.current
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var imageState by remember { mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty) }
    var useFallback by remember(url) { mutableStateOf(false) }
    var failedFinal by remember(url) { mutableStateOf(false) }
    val model = if (useFallback && fallbackUrl != null) fallbackUrl else url
    val transformState = rememberTransformableState { zoomChange, panChange, _ ->
        scale = (scale * zoomChange).coerceIn(1f, 6f)
        offset = if (scale > 1f) offset + panChange else Offset.Zero
    }
    Box(
        modifier = modifier
            .clipToBounds()
            .transformable(transformState)
            .pointerInput(Unit) {
                detectTapGestures(onDoubleTap = {
                    if (scale > 1f) {
                        scale = 1f
                        offset = Offset.Zero
                    } else {
                        scale = 2.5f
                    }
                })
            },
        contentAlignment = Alignment.Center,
    ) {
        AsyncImage(
            model = model,
            imageLoader = AppImageLoader.get(context),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            onState = {
                imageState = it
                when (it) {
                    is AsyncImagePainter.State.Error -> if (fallbackUrl != null && !useFallback) useFallback = true else failedFinal = true
                    is AsyncImagePainter.State.Success -> failedFinal = false
                    else -> {}
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                },
        )
        when {
            failedFinal -> EmptyState(stringResource(Res.string.file_unavailable), Modifier.fillMaxSize())
            imageState is AsyncImagePainter.State.Success -> Unit
            else -> CenteredProgress(Modifier.fillMaxSize())
        }
    }
}
