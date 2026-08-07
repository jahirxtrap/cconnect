package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.foundation.text.selection.DisableSelection
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import coil3.compose.AsyncImagePainter
import coil3.compose.LocalPlatformContext
import coil3.compose.rememberAsyncImagePainter
import coil3.request.ImageRequest
import com.composables.icons.lucide.ExternalLink
import com.composables.icons.lucide.File
import com.composables.icons.lucide.FolderArchive
import com.composables.icons.lucide.ImageOff
import com.composables.icons.lucide.Lucide
import com.jahirtrap.cconnect.data.remote.AppImageLoader
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.UrlCodec
import com.jahirtrap.cconnect.files.isArchive
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.open
import com.jahirtrap.cconnect.resources.open_external_link
import com.jahirtrap.cconnect.resources.open_external_link_message
import org.intellij.markdown.IElementType
import org.intellij.markdown.MarkdownElementTypes
import org.intellij.markdown.MarkdownTokenTypes
import org.intellij.markdown.ast.ASTNode
import org.intellij.markdown.ast.getTextInNode
import org.intellij.markdown.flavours.gfm.GFMElementTypes
import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
import org.intellij.markdown.flavours.gfm.GFMTokenTypes
import org.intellij.markdown.parser.MarkdownParser
import org.jetbrains.compose.resources.stringResource
import com.jahirtrap.cconnect.ui.theme.LocalMonoFontFamily

private val flavour = GFMFlavourDescriptor()

@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    selectable: Boolean = true,
    onSharedLink: ((url: String, filename: String) -> Unit)? = null,
) {
    val root = remember(markdown) { MarkdownParser(flavour).buildMarkdownTreeFromString(markdown) }
    val codeBg = MaterialTheme.colorScheme.surfaceContainerHigh
    val linkColor = MaterialTheme.colorScheme.primary
    val defaultHandler = LocalUriHandler.current
    var externalLink by remember { mutableStateOf<String?>(null) }
    val uriHandler = remember(onSharedLink) {
        object : UriHandler {
            override fun openUri(uri: String) {
                val prefix = Backend.baseUrl + "/shared/"
                if (uri.startsWith(prefix) && onSharedLink != null) {
                    val raw = uri.substring(prefix.length).substringBefore('?').substringBefore('#')
                    val filename = UrlCodec.decode(raw.substringAfterLast('/')) ?: raw
                    onSharedLink(uri, filename)
                } else {
                    externalLink = uri
                }
            }
        }
    }
    externalLink?.let { link ->
        DisableSelection {
            ConfirmDialog(
                title = stringResource(Res.string.open_external_link),
                text = stringResource(Res.string.open_external_link_message, link),
                confirmLabel = stringResource(Res.string.open),
                onConfirm = {
                    defaultHandler.openUri(link)
                    externalLink = null
                },
                onDismiss = { externalLink = null },
            )
        }
    }
    val monoFamily = LocalMonoFontFamily.current
    val ctx = remember(markdown, linkColor, codeBg, monoFamily) { MdContext(markdown, linkColor, codeBg, monoFamily) }
    CompositionLocalProvider(
        LocalUriHandler provides uriHandler,
        LocalImageDownload provides onSharedLink,
    ) {
        if (selectable) {
            SelectionContainer(modifier = modifier) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { Blocks(root, ctx, depth = 0) }
            }
        } else {
            Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) { Blocks(root, ctx, depth = 0) }
        }
    }
}

private class MdContext(val src: String, val linkColor: Color, val codeBg: Color, val monoFamily: FontFamily)

private fun ASTNode.text(src: String): String = getTextInNode(src).toString()
private fun ASTNode.child(type: IElementType): ASTNode? = children.firstOrNull { it.type == type }

@Composable
private fun Blocks(parent: ASTNode, ctx: MdContext, depth: Int) {
    var i = 0
    val children = parent.children
    while (i < children.size) {
        val node = children[i]
        if (node.type == MarkdownElementTypes.HTML_BLOCK && node.text(ctx.src).contains("<details", ignoreCase = true)) {
            val summary = SUMMARY_RE.find(node.text(ctx.src))?.groupValues?.get(1)?.trim()?.ifBlank { null } ?: "Details"
            val inner = ArrayList<ASTNode>()
            var j = i + 1
            while (j < children.size && !(children[j].type == MarkdownElementTypes.HTML_BLOCK && children[j].text(ctx.src).contains("</details>", ignoreCase = true))) {
                inner.add(children[j]); j++
            }
            DetailsBlock(summary, inner, ctx, depth)
            i = j + 1
            continue
        }
        RenderNode(node, ctx, depth)
        i++
    }
}

@Composable
private fun RenderNode(node: ASTNode, ctx: MdContext, depth: Int) {
    when (node.type) {
        MarkdownElementTypes.ATX_1, MarkdownElementTypes.SETEXT_1 -> HeadingText(node, ctx, MaterialTheme.typography.titleLarge)
        MarkdownElementTypes.ATX_2, MarkdownElementTypes.SETEXT_2 -> HeadingText(node, ctx, MaterialTheme.typography.titleMedium)
        MarkdownElementTypes.ATX_3, MarkdownElementTypes.ATX_4, MarkdownElementTypes.ATX_5, MarkdownElementTypes.ATX_6 ->
            HeadingText(node, ctx, MaterialTheme.typography.titleSmall)

        MarkdownElementTypes.PARAGRAPH -> ParagraphBlock(node, ctx)
        MarkdownElementTypes.CODE_FENCE -> CodeBlock(codeFenceContent(node, ctx.src), ctx.codeBg, codeFenceLang(node, ctx.src))
        MarkdownElementTypes.CODE_BLOCK -> CodeBlock(node.text(ctx.src).trimEnd('\n'), ctx.codeBg, "")
        MarkdownElementTypes.UNORDERED_LIST -> ListBlock(node, ordered = false, ctx = ctx, depth = depth)
        MarkdownElementTypes.ORDERED_LIST -> ListBlock(node, ordered = true, ctx = ctx, depth = depth)
        MarkdownElementTypes.BLOCK_QUOTE -> QuoteBlock(node, ctx, depth)
        GFMElementTypes.TABLE -> TableView(node, ctx)
        MarkdownTokenTypes.HORIZONTAL_RULE -> HorizontalDivider()
        else -> Unit
    }
}

@Composable
private fun HeadingText(node: ASTNode, ctx: MdContext, base: TextStyle) {
    MdText(
        text = inline(node, ctx, skipLeading = true),
        codeBg = ctx.codeBg,
        modifier = Modifier.fillMaxWidth(),
        style = base.copy(fontWeight = FontWeight.Bold),
    )
}

@Composable
private fun ParagraphBlock(node: ASTNode, ctx: MdContext) {
    val children = node.children
    if (children.none { isImage(it) }) {
        MdText(inline(node, ctx), ctx.codeBg, modifier = Modifier.fillMaxWidth(), style = MaterialTheme.typography.bodyMedium)
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        paragraphSegments(children, ctx.src).forEach { segment ->
            when (segment) {
                is MdSegment.Images -> ImageGrid(segment.items)
                is MdSegment.Text -> {
                    val text = inlineOf(segment.nodes, ctx)
                    if (text.isNotBlank()) MdText(text, ctx.codeBg, modifier = Modifier.fillMaxWidth(), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

private sealed interface MdSegment {
    data class Text(val nodes: List<ASTNode>) : MdSegment
    data class Images(val items: List<Pair<String, String>>) : MdSegment
}

private fun paragraphSegments(children: List<ASTNode>, src: String): List<MdSegment> {
    val segments = ArrayList<MdSegment>()
    val run = ArrayList<ASTNode>()
    val images = ArrayList<Pair<String, String>>()
    for (child in children) {
        val image = imageOf(child, src)
        if (image == null) {
            run.add(child)
            continue
        }
        if (run.any { it.type != MarkdownTokenTypes.WHITE_SPACE && it.type != MarkdownTokenTypes.EOL }) {
            if (images.isNotEmpty()) {
                segments.add(MdSegment.Images(images.toList()))
                images.clear()
            }
            segments.add(MdSegment.Text(run.toList()))
        }
        run.clear()
        images.add(image)
    }
    if (images.isNotEmpty()) segments.add(MdSegment.Images(images.toList()))
    if (run.isNotEmpty()) segments.add(MdSegment.Text(run.toList()))
    return segments
}

@Composable
private fun ImageGrid(items: List<Pair<String, String>>) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val width = minOf(IMAGE_TILE_WIDTH, maxWidth)
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(IMAGE_TILE_GAP, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(IMAGE_TILE_GAP),
        ) {
            items.forEach { (url, alt) -> MarkdownImage(url = url, alt = alt, width = width) }
        }
    }
}

@Composable
private fun QuoteBlock(node: ASTNode, ctx: MdContext, depth: Int) {
    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Box(modifier = Modifier.width(3.dp).fillMaxHeight().background(MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)))
        Column(modifier = Modifier.padding(start = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Blocks(node, ctx, depth)
        }
    }
}

@Composable
private fun DetailsBlock(summary: String, inner: List<ASTNode>, ctx: MdContext, depth: Int) {
    var expanded by remember { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded }, verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = CustomIcons.PlayFilled,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(10.dp).rotate(if (expanded) 90f else 0f),
            )
            Spacer(Modifier.size(6.dp))
            Text(summary, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (expanded) {
            Column(modifier = Modifier.padding(start = 8.dp, top = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                inner.forEach { RenderNode(it, ctx, depth) }
            }
        }
    }
}

@Composable
private fun TableView(table: ASTNode, ctx: MdContext) {
    val scroll = rememberScrollState()
    val rows = table.children.filter { it.type == GFMElementTypes.HEADER || it.type == GFMElementTypes.ROW }
    val cols = rows.firstOrNull()?.children?.count { it.type == GFMTokenTypes.CELL } ?: 0
    val cellWidth = 140.dp
    val totalWidth = cellWidth * cols.coerceAtLeast(1)
    Column(modifier = Modifier.fillMaxWidth().horizontalScrollbar(scroll).horizontalScroll(scroll)) {
        rows.forEach { rowNode ->
            val header = rowNode.type == GFMElementTypes.HEADER
            Row {
                rowNode.children.filter { it.type == GFMTokenTypes.CELL }.forEach { cell ->
                    MdText(
                        text = inline(cell, ctx),
                        codeBg = ctx.codeBg,
                        modifier = Modifier.width(cellWidth).padding(6.dp),
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = if (header) FontWeight.Bold else FontWeight.Normal),
                    )
                }
            }
            HorizontalDivider(modifier = Modifier.width(totalWidth))
        }
    }
}

@Composable
private fun ListBlock(list: ASTNode, ordered: Boolean, ctx: MdContext, depth: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        var index = orderedStart(list, ctx.src)
        list.children.filter { it.type == MarkdownElementTypes.LIST_ITEM }.forEach { item ->
            val marker = taskMarker(item, ctx.src)
            val bullet = when {
                marker != null -> if (marker) "☑  " else "☐  "
                ordered -> "$index. "
                else -> "${unorderedBullet(depth)}  "
            }
            Row {
                Text(text = bullet, style = MaterialTheme.typography.bodyMedium)
                Column { Blocks(item, ctx, depth + 1) }
            }
            index++
        }
    }
}

private fun unorderedBullet(depth: Int): String = when (depth) {
    0 -> "•"
    1 -> "◦"
    else -> "▪"
}

private fun orderedStart(list: ASTNode, src: String): Int {
    val item = list.children.firstOrNull { it.type == MarkdownElementTypes.LIST_ITEM } ?: return 1
    val number = item.children.firstOrNull { it.type == MarkdownTokenTypes.LIST_NUMBER }?.text(src)?.trim()?.trimEnd('.', ')')
    return number?.toIntOrNull() ?: 1
}

private fun taskMarker(item: ASTNode, src: String): Boolean? {
    val box = findCheckBox(item) ?: return null
    return box.text(src).contains('x', ignoreCase = true)
}

private fun findCheckBox(node: ASTNode): ASTNode? {
    if (node.type == GFMTokenTypes.CHECK_BOX) return node
    node.children.forEach { c -> findCheckBox(c)?.let { return it } }
    return null
}

private fun codeFenceLang(node: ASTNode, src: String): String =
    node.children.firstOrNull { it.type == MarkdownTokenTypes.FENCE_LANG }?.text(src)?.trim()?.lowercase().orEmpty()

private fun codeFenceContent(node: ASTNode, src: String): String {
    val sb = StringBuilder()
    node.children.forEach { c ->
        when (c.type) {
            MarkdownTokenTypes.CODE_FENCE_CONTENT -> sb.append(c.text(src))
            MarkdownTokenTypes.EOL -> sb.append('\n')
        }
    }
    return sb.toString().removePrefix("\n").trimEnd('\n')
}

private fun isImage(node: ASTNode): Boolean =
    node.type == MarkdownElementTypes.IMAGE ||
        (node.type == MarkdownElementTypes.INLINE_LINK && node.children.any { it.type == MarkdownElementTypes.IMAGE })

private fun imageOf(node: ASTNode, src: String): Pair<String, String>? {
    val image = when {
        node.type == MarkdownElementTypes.IMAGE -> node
        node.type == MarkdownElementTypes.INLINE_LINK -> node.children.firstOrNull { it.type == MarkdownElementTypes.IMAGE }
        else -> null
    } ?: return null
    val link = image.child(MarkdownElementTypes.INLINE_LINK) ?: image
    val url = (link.child(MarkdownElementTypes.LINK_DESTINATION)?.text(src)?.trim()?.trim('<', '>')).orEmpty().ifEmpty { return null }
    val alt = link.child(MarkdownElementTypes.LINK_TEXT)?.let { rawText(it, src) }.orEmpty()
    return url to alt
}

private fun rawText(node: ASTNode, src: String): String {
    val sb = StringBuilder()
    fun walk(n: ASTNode) {
        if (n.children.isEmpty()) {
            if (n.type == MarkdownTokenTypes.TEXT || n.type == MarkdownTokenTypes.WHITE_SPACE) sb.append(n.text(src))
        } else {
            n.children.forEach { walk(it) }
        }
    }
    walk(node)
    return sb.toString()
}

private fun inline(node: ASTNode, ctx: MdContext, skipLeading: Boolean = false): AnnotatedString =
    buildAnnotatedString {
        var leading = skipLeading
        node.children.forEach { c ->
            if (leading) {
                if (c.type == MarkdownTokenTypes.ATX_HEADER || c.type == MarkdownTokenTypes.WHITE_SPACE || c.type == MarkdownTokenTypes.EOL) return@forEach
                leading = false
            }
            appendNode(c, ctx)
        }
    }

private fun inlineOf(nodes: List<ASTNode>, ctx: MdContext): AnnotatedString =
    buildAnnotatedString { nodes.forEach { appendNode(it, ctx) } }

private fun AnnotatedString.Builder.appendChildren(node: ASTNode, ctx: MdContext) {
    node.children.forEach { appendNode(it, ctx) }
}

private fun AnnotatedString.Builder.appendNode(n: ASTNode, ctx: MdContext) {
    when (n.type) {
        MarkdownTokenTypes.TEXT, MarkdownTokenTypes.WHITE_SPACE -> append(n.text(ctx.src))
        GFMTokenTypes.GFM_AUTOLINK -> {
            val url = n.text(ctx.src)
            appendUrl(url, ctx) { append(url) }
        }
        MarkdownTokenTypes.EOL -> append(" ")
        MarkdownTokenTypes.HARD_LINE_BREAK -> append("\n")
        MarkdownTokenTypes.ESCAPED_BACKTICKS -> append(n.text(ctx.src))
        MarkdownTokenTypes.EMPH -> Unit
        MarkdownElementTypes.EMPH -> styled(SpanStyle(fontStyle = FontStyle.Italic)) { appendChildren(n, ctx) }
        MarkdownElementTypes.STRONG -> styled(SpanStyle(fontWeight = FontWeight.Bold)) { appendChildren(n, ctx) }
        GFMElementTypes.STRIKETHROUGH -> styled(SpanStyle(textDecoration = TextDecoration.LineThrough)) { appendChildren(n, ctx) }
        MarkdownElementTypes.CODE_SPAN -> {
            val literal = n.text(ctx.src).trim('`')
            val start = length
            styled(SpanStyle(fontFamily = ctx.monoFamily)) { append(literal) }
            addStringAnnotation(INLINE_CODE_TAG, literal, start, length)
        }
        MarkdownElementTypes.INLINE_LINK, MarkdownElementTypes.FULL_REFERENCE_LINK, MarkdownElementTypes.SHORT_REFERENCE_LINK ->
            appendLink(n, ctx)
        MarkdownElementTypes.AUTOLINK -> {
            val url = n.text(ctx.src).trim('<', '>')
            appendUrl(url, ctx) { append(url) }
        }
        MarkdownElementTypes.IMAGE -> {
            append("🖼 ")
            val link = n.child(MarkdownElementTypes.INLINE_LINK) ?: n
            styled(SpanStyle(color = ctx.linkColor, fontStyle = FontStyle.Italic)) {
                link.child(MarkdownElementTypes.LINK_TEXT)?.let { appendInner(it, ctx) }
            }
        }
        else -> if (n.children.isEmpty()) {
            val t = n.text(ctx.src)
            if (t.equals("<br>", true) || t.equals("<br/>", true) || t.equals("<br />", true)) append("\n") else append(t)
        } else {
            appendChildren(n, ctx)
        }
    }
}

private fun AnnotatedString.Builder.appendInner(linkText: ASTNode, ctx: MdContext) {
    linkText.children.forEach { c ->
        if (c.type == MarkdownTokenTypes.LBRACKET || c.type == MarkdownTokenTypes.RBRACKET) return@forEach
        appendNode(c, ctx)
    }
}

private fun AnnotatedString.Builder.appendLink(node: ASTNode, ctx: MdContext) {
    val dest = (node.child(MarkdownElementTypes.LINK_DESTINATION)?.text(ctx.src)?.trim()?.trim('<', '>')).orEmpty()
    val label = node.child(MarkdownElementTypes.LINK_TEXT)
    if (dest.isEmpty()) {
        styled(SpanStyle(color = ctx.linkColor, textDecoration = TextDecoration.Underline)) {
            if (label != null) appendInner(label, ctx) else appendChildren(node, ctx)
        }
        return
    }
    appendUrl(dest, ctx) {
        if (label != null) appendInner(label, ctx) else append(dest)
    }
}

private fun AnnotatedString.Builder.appendUrl(url: String, ctx: MdContext, content: AnnotatedString.Builder.() -> Unit) {
    val style = SpanStyle(color = ctx.linkColor, textDecoration = TextDecoration.Underline)
    val shared = url.startsWith(Backend.baseUrl + "/shared/")
    withLink(LinkAnnotation.Url(url = url, styles = TextLinkStyles(style = style))) {
        if (shared) {
            appendInlineContent(if (isArchive(url.substringAfterLast('/'))) SHARED_ARCHIVE_TAG else SHARED_FILE_TAG, "📄")
            append("⁠")
        }
        content()
        if (!shared) {
            append("⁠")
            appendInlineContent(EXT_LINK_TAG, "↗")
        }
    }
}

private inline fun AnnotatedString.Builder.styled(style: SpanStyle, block: AnnotatedString.Builder.() -> Unit) {
    pushStyle(style)
    block()
    pop()
}

private val SUMMARY_RE = Regex("<summary>(.*?)</summary>", RegexOption.IGNORE_CASE)
private const val INLINE_CODE_TAG = "inline_code"
private const val EXT_LINK_TAG = "ext_link"
private const val SHARED_FILE_TAG = "shared_file"
private const val SHARED_ARCHIVE_TAG = "shared_archive"

private val IMAGE_TILE_WIDTH = 280.dp
private const val IMAGE_TILE_RATIO = 3f / 4f
private val IMAGE_TILE_GAP = 6.dp

internal val LocalImageDownload = staticCompositionLocalOf<((url: String, filename: String) -> Unit)?> { null }

@Composable
private fun MarkdownImage(url: String, alt: String, width: Dp) {
    val context = LocalPlatformContext.current
    val uriHandler = LocalUriHandler.current
    val download = LocalImageDownload.current
    val loader = remember { AppImageLoader.get(context) }
    val resolved = remember(url) {
        when {
            url.startsWith("http://") || url.startsWith("https://") -> url
            url.startsWith("/") -> Backend.baseUrl.removeSuffix("/api") + url
            else -> url
        }
    }
    val onTap = { if (download != null) download(resolved, filenameFromUrl(resolved)) else uriHandler.openUri(resolved) }
    val painter = rememberAsyncImagePainter(model = ImageRequest.Builder(context).data(resolved).build(), imageLoader = loader)
    val state by painter.state.collectAsState()
    val shape = RoundedCornerShape(6.dp)
    Box(modifier = Modifier.width(width).aspectRatio(IMAGE_TILE_RATIO), contentAlignment = Alignment.Center) {
        when (state) {
            is AsyncImagePainter.State.Success -> {
                val sz = painter.intrinsicSize
                val aspect = if (sz.isSpecified && sz.height > 0f) sz.width / sz.height else 1f
                val fit = if (aspect >= 1f) Modifier.fillMaxWidth() else Modifier.fillMaxHeight()
                Image(
                    painter = painter,
                    contentDescription = alt.ifBlank { null },
                    contentScale = ContentScale.Fit,
                    modifier = fit.aspectRatio(aspect).clip(shape).clickable(onClick = onTap),
                )
            }
            is AsyncImagePainter.State.Error -> Column(
                modifier = Modifier.fillMaxSize().clip(shape).clickable(onClick = onTap).padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(Lucide.ImageOff, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text(
                    text = alt.ifBlank { resolved },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            else -> CenteredProgress(Modifier.fillMaxSize(), size = 24.dp)
        }
    }
}

@Composable
fun RemoteImageThumb(url: String, modifier: Modifier = Modifier) {
    val context = LocalPlatformContext.current
    val loader = remember { AppImageLoader.get(context) }
    val painter = rememberAsyncImagePainter(model = ImageRequest.Builder(context).data(url).build(), imageLoader = loader)
    val state by painter.state.collectAsState()
    val shape = RoundedCornerShape(8.dp)
    val base = modifier.height(150.dp).clip(shape)
    when (state) {
        is AsyncImagePainter.State.Success -> {
            val sz = painter.intrinsicSize
            val aspect = if (sz.isSpecified && sz.height > 0f) sz.width / sz.height else 1f
            Image(painter = painter, contentDescription = null, contentScale = ContentScale.Fit, modifier = base.aspectRatio(aspect))
        }
        is AsyncImagePainter.State.Error -> Box(base.aspectRatio(1f), contentAlignment = Alignment.Center) {
            Icon(Lucide.ImageOff, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
        }
        else -> CenteredProgress(base.aspectRatio(1f), size = 22.dp)
    }
}

private fun filenameFromUrl(url: String): String {
    val raw = url.substringBefore('?').substringBefore('#').substringAfterLast('/')
    return (UrlCodec.decode(raw) ?: raw).ifBlank { "image" }
}

@Composable
private fun MdText(text: AnnotatedString, codeBg: Color, modifier: Modifier = Modifier, style: TextStyle = LocalTextStyle.current) {
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    val linkColor = MaterialTheme.colorScheme.primary
    val linkIcons = remember(linkColor) {
        mapOf(
            SHARED_FILE_TAG to InlineTextContent(Placeholder(width = 1.05.em, height = 1.05.em, placeholderVerticalAlign = PlaceholderVerticalAlign.Center)) {
                Icon(Lucide.File, contentDescription = null, tint = linkColor, modifier = Modifier.fillMaxSize().padding(end = 2.dp))
            },
            SHARED_ARCHIVE_TAG to InlineTextContent(Placeholder(width = 1.05.em, height = 1.05.em, placeholderVerticalAlign = PlaceholderVerticalAlign.Center)) {
                Icon(Lucide.FolderArchive, contentDescription = null, tint = linkColor, modifier = Modifier.fillMaxSize().padding(end = 2.dp))
            },
            EXT_LINK_TAG to InlineTextContent(Placeholder(width = 1.05.em, height = 1.05.em, placeholderVerticalAlign = PlaceholderVerticalAlign.Center)) {
                Icon(Lucide.ExternalLink, contentDescription = null, tint = linkColor, modifier = Modifier.fillMaxSize().padding(start = 2.dp))
            },
        )
    }
    Text(
        text = text,
        style = style,
        inlineContent = linkIcons,
        onTextLayout = { layout = it },
        modifier = modifier.textHoverCursor(
            layout = { layout },
            isLink = { offset -> text.getLinkAnnotations(offset, (offset + 1).coerceAtMost(text.length)).isNotEmpty() },
        ).drawBehind {
            val result = layout ?: return@drawBehind
            val padX = 3.dp.toPx()
            val padY = 1.dp.toPx()
            val radius = 6.dp.toPx()
            text.getStringAnnotations(INLINE_CODE_TAG, 0, text.length).forEach { ann ->
                val firstLine = result.getLineForOffset(ann.start)
                val lastLine = result.getLineForOffset((ann.end - 1).coerceAtLeast(ann.start))
                for (line in firstLine..lastLine) {
                    val startOffset = if (line == firstLine) ann.start else result.getLineStart(line)
                    val endOffset = if (line == lastLine) ann.end else result.getLineEnd(line, visibleEnd = true)
                    if (endOffset <= startOffset) continue
                    val firstBox = result.getBoundingBox(startOffset)
                    val lastBox = result.getBoundingBox((endOffset - 1).coerceAtLeast(startOffset))
                    val left = minOf(firstBox.left, lastBox.left) - padX
                    val right = maxOf(firstBox.right, lastBox.right) + padX
                    val top = result.getLineTop(line) + padY
                    val bottom = result.getLineBottom(line) - padY
                    drawRoundRect(color = codeBg, topLeft = Offset(left, top), size = Size(right - left, bottom - top), cornerRadius = CornerRadius(radius, radius))
                }
            }
        },
    )
}
