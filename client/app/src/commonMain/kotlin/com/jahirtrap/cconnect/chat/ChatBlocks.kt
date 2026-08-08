package com.jahirtrap.cconnect.chat

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.text.selection.DisableSelection
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import com.jahirtrap.cconnect.ui.IconButton
import com.jahirtrap.cconnect.ui.textHoverCursor
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import com.jahirtrap.cconnect.ui.theme.LocalMonoFontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.data.remote.SharedApi
import com.jahirtrap.cconnect.data.remote.UrlCodec
import com.jahirtrap.cconnect.files.PreviewKind
import com.jahirtrap.cconnect.files.isArchive
import com.jahirtrap.cconnect.files.previewKindOf
import com.jahirtrap.cconnect.ui.AttachmentChip
import com.composables.icons.lucide.Archive
import com.composables.icons.lucide.ChevronDown
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.CircleQuestionMark
import com.composables.icons.lucide.CornerDownRight
import com.composables.icons.lucide.File
import com.composables.icons.lucide.FilePen
import com.composables.icons.lucide.FolderArchive
import com.composables.icons.lucide.Bell
import com.composables.icons.lucide.Bot
import com.composables.icons.lucide.Calendar
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Lightbulb
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.MessageSquare
import com.composables.icons.lucide.Shield
import com.composables.icons.lucide.SquareTerminal
import com.composables.icons.lucide.TriangleAlert
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.ui.CustomIcons
import com.jahirtrap.cconnect.ui.PlayFilled
import com.jahirtrap.cconnect.data.ChatMessage
import com.jahirtrap.cconnect.data.CompactData
import com.jahirtrap.cconnect.data.DiffKind
import com.jahirtrap.cconnect.data.DiffLine
import com.jahirtrap.cconnect.data.InteractionData
import com.jahirtrap.cconnect.data.InteractionOption
import com.jahirtrap.cconnect.data.InteractionQuestion
import com.jahirtrap.cconnect.data.QuestionDraft
import com.jahirtrap.cconnect.data.Role
import com.jahirtrap.cconnect.data.SendStatus
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.ui.CodeBlock
import com.jahirtrap.cconnect.ui.MarkdownText
import com.jahirtrap.cconnect.ui.OutlinedPanel
import com.jahirtrap.cconnect.ui.formatClock
import com.jahirtrap.cconnect.ui.formatDay
import com.jahirtrap.cconnect.ui.horizontalScrollbar
import com.jahirtrap.cconnect.ui.theme.palette
import kotlinx.coroutines.launch

private val BIG = 16.dp
private val SMALL = 6.dp

private data class UserContent(
    val body: String,
    val attachments: List<Pair<String, String>>,
)

private val IMAGE_MARKER_REGEX = Regex("""\[Image #\d+\]""")

private fun userContent(message: ChatMessage): UserContent {
    val media = mutableListOf<Pair<String, String>>()
    val files = mutableListOf<Pair<String, String>>()
    var body = message.text

    if (message.attachments != null) {
        message.attachments.forEach { name ->
            val url = SharedApi.downloadUrl("uploads/$name")
            if (previewKindOf(name) == PreviewKind.Image) media += url to name else files += url to name
        }
        body = body.lineSequence().filterNot {
            it.startsWith("@") && (it.contains("shared/uploads/") || it.contains("shared\\uploads\\"))
        }.joinToString("\n")
    } else if (body.contains('@')) {
        val imgRefs = message.images.orEmpty()
        var imgIdx = 0
        body = body.lines().filter { line ->
            val mentionLine = line.startsWith("@") &&
                (line.contains("shared/uploads/") || line.contains("shared\\uploads\\"))
            if (mentionLine) {
                line.split(" @").forEach { raw ->
                    val name = raw.removePrefix("@").substringAfterLast('/').substringAfterLast('\\')
                    val url = SharedApi.downloadUrl("uploads/$name")
                    if (previewKindOf(name) == PreviewKind.Image) {
                        val fb = imgRefs.getOrNull(imgIdx)?.let { "?fb=${UrlCodec.encode(it)}" } ?: ""
                        imgIdx++
                        media += (url + fb) to name
                    } else files += url to name
                }
            }
            !mentionLine
        }.joinToString("\n")
    }

    body = body.replace(IMAGE_MARKER_REGEX, "").trim()
    return UserContent(body, media + files)
}

@Composable
fun ChatMessageItem(
    message: ChatMessage,
    prevRole: Role? = null,
    nextRole: Role? = null,
    running: Boolean = false,
    expanded: Boolean? = null,
    onToggle: (() -> Unit)? = null,
    onAnswer: ((String, String, String?) -> Unit)? = null,
    onToggleOption: ((String, Int, String) -> Unit)? = null,
    onQuestionText: ((String, Int, String) -> Unit)? = null,
    onQuestionNotes: ((String, Int, String) -> Unit)? = null,
    onSubmitQuestions: ((String) -> Unit)? = null,
    onChatQuestions: ((String) -> Unit)? = null,
    onQuestionPage: ((String, Int) -> Unit)? = null,
    onSharedLink: ((String, String) -> Unit)? = null,
    gluedTop: Boolean = false,
    showTime: Boolean = true,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = if (gluedTop) 0.dp else gapAbove(prevRole, message.role), bottom = bottomGap(message.role, nextRole)),
    ) {
        when (message.role) {
            Role.USER -> Band(MaterialTheme.colorScheme.surfaceVariant) {
                val content = remember(message.text, message.attachments, message.images) { userContent(message) }
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(if (content.attachments.isNotEmpty()) 6.dp else 0.dp)) {
                    if (content.body.isNotEmpty()) {
                        SelectableText(content.body, MaterialTheme.typography.bodyMedium, MaterialTheme.colorScheme.onSurface)
                    }
                    if (content.attachments.isNotEmpty() || (message.timestamp != null && showTime) || message.sendStatus == SendStatus.ERROR) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            if (content.attachments.isNotEmpty()) {
                                val chipScroll = rememberScrollState()
                                Row(
                                    modifier = Modifier.weight(1f).horizontalScrollbar(chipScroll, touchIndicator = false).horizontalScroll(chipScroll),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    content.attachments.forEach { (url, name) ->
                                        AttachmentChip(
                                            name = name,
                                            icon = if (isArchive(name)) Lucide.FolderArchive else Lucide.File,
                                            onClick = { onSharedLink?.invoke(url, name) },
                                        )
                                    }
                                }
                            } else {
                                Spacer(Modifier.weight(1f))
                            }
                            if (message.timestamp != null && showTime) {
                                DisableSelection {
                                    Text(
                                        text = formatClock(message.timestamp),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(start = 8.dp),
                                    )
                                }
                            }
                            if (message.sendStatus == SendStatus.ERROR) {
                                Icon(
                                    Lucide.TriangleAlert,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(start = 6.dp).size(14.dp),
                                )
                            }
                        }
                    }
                }
            }

            Role.ASSISTANT -> Plain {
                MarkdownText(message.text, modifier = Modifier.fillMaxWidth(), selectable = false, onSharedLink = onSharedLink)
            }

            Role.THINKING -> Collapsible(label = stringResource(Res.string.thinking), text = message.text, icon = Lucide.Lightbulb, labelOnly = message.labelOnly, running = running, expanded = expanded, onToggle = onToggle)

            Role.WORKING -> Collapsible(label = stringResource(Res.string.working), text = "", icon = Lucide.Bot, labelOnly = true, running = running)

            Role.TOOL -> ToolBlock(name = message.toolName, input = message.text, result = message.result, running = running, expanded = expanded, onToggle = onToggle)

            Role.TOOL_RESULT -> Collapsible(label = stringResource(Res.string.result), text = message.text, labelOnly = message.labelOnly, expanded = expanded, onToggle = onToggle)

            Role.SUMMARY -> Collapsible(label = stringResource(Res.string.summary), text = message.text, expanded = expanded, onToggle = onToggle)

            Role.INTERACTION -> message.interaction?.let {
                if (it.kind == "questions") {
                    QuestionsBlock(
                        data = it,
                        onToggleOption = { qi, optId -> onToggleOption?.invoke(it.requestId, qi, optId) },
                        onFreeText = { qi, text -> onQuestionText?.invoke(it.requestId, qi, text) },
                        onNotes = { qi, text -> onQuestionNotes?.invoke(it.requestId, qi, text) },
                        onSubmit = { onSubmitQuestions?.invoke(it.requestId) },
                        onChat = { onChatQuestions?.invoke(it.requestId) },
                        onActivePage = { page -> onQuestionPage?.invoke(it.requestId, page) },
                    )
                } else {
                    InteractionBlock(data = it, toolName = message.toolName, input = message.text, expanded = expanded, onToggle = onToggle, onAnswer = onAnswer)
                }
            }

            Role.FILE_CHANGE -> FileChangeBlock(path = message.path.orEmpty(), diffLines = message.diffLines.orEmpty(), labelOnly = message.labelOnly, expanded = expanded, onToggle = onToggle)

            Role.COMPACT -> message.compact?.let { CompactBlock(it, expanded = expanded, onToggle = onToggle) }

            Role.PLAN -> PlanBlock(markdown = message.text, expanded = expanded, onToggle = onToggle, onSharedLink = onSharedLink)

            Role.AGENT -> AgentBlock(message = message, running = running, expanded = expanded, onToggle = onToggle)

            Role.API_ERROR -> Band(palette.orange.copy(alpha = 0.15f)) {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        Lucide.TriangleAlert,
                        contentDescription = null,
                        tint = palette.orange,
                        modifier = Modifier.padding(top = 1.dp).size(18.dp),
                    )
                    Spacer(Modifier.size(8.dp))
                    SelectableText(message.text, MaterialTheme.typography.bodyMedium, palette.orange, modifier = Modifier.weight(1f))
                }
            }

            Role.INTERRUPTED -> Band(palette.orange.copy(alpha = 0.15f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Lucide.TriangleAlert,
                        contentDescription = null,
                        tint = palette.orange,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.size(8.dp))
                    SelectableText(stringResource(Res.string.interrupted), MaterialTheme.typography.bodyMedium, palette.orange, modifier = Modifier.weight(1f))
                }
            }

            Role.SYSTEM -> Plain {
                SelectableText(message.text, MaterialTheme.typography.bodySmall, MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Role.NOTIFICATION -> NotificationBlock(message.text)
        }
    }
}

@Composable
fun StickyCollapsibleHeader(message: ChatMessage, onCollapse: () -> Unit, modifier: Modifier = Modifier) {
    val primary = MaterialTheme.colorScheme.primary
    val variant = MaterialTheme.colorScheme.onSurfaceVariant
    val spec: Triple<ImageVector?, String, Color> = when (message.role) {
        Role.THINKING -> Triple(Lucide.Lightbulb, stringResource(Res.string.thinking), variant)
        Role.TOOL -> Triple(Lucide.SquareTerminal, message.toolName.orEmpty(), primary)
        Role.TOOL_RESULT -> Triple(null, stringResource(Res.string.result), variant)
        Role.SUMMARY -> Triple(null, stringResource(Res.string.summary), variant)
        Role.FILE_CHANGE -> Triple(Lucide.FilePen, message.path.orEmpty(), primary)
        Role.COMPACT -> Triple(Lucide.Archive, stringResource(Res.string.compacted), primary)
        Role.AGENT -> Triple(Lucide.Bot, message.toolName ?: stringResource(Res.string.agent), primary)
        Role.INTERACTION -> Triple(Lucide.Lightbulb, stringResource(Res.string.plan), primary)
        else -> Triple(null, "", variant)
    }
    val (icon, label, tint) = spec
    Surface(color = MaterialTheme.colorScheme.background, shadowElevation = 2.dp, modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { onCollapse() }.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
                Spacer(Modifier.size(6.dp))
            }
            Text(label, style = MaterialTheme.typography.labelLarge, color = tint, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Icon(Lucide.ChevronDown, contentDescription = null, tint = variant, modifier = Modifier.size(18.dp))
        }
    }
}

private fun isNotice(role: Role?): Boolean = role == Role.API_ERROR || role == Role.INTERRUPTED

private fun group(role: Role?): Int = when (role) {
    Role.THINKING, Role.WORKING, Role.TOOL, Role.TOOL_RESULT, Role.INTERACTION, Role.FILE_CHANGE, Role.COMPACT, Role.PLAN, Role.AGENT, Role.NOTIFICATION -> 0
    Role.ASSISTANT -> 1
    Role.USER, Role.API_ERROR, Role.INTERRUPTED -> 2
    else -> 3
}

private fun bottomGap(cur: Role, next: Role?): Dp = when {
    next != null -> 0.dp
    isNotice(cur) || cur == Role.USER -> 0.dp
    else -> BIG
}

internal fun gapAbove(prev: Role?, cur: Role): Dp {
    if (prev == null) return BIG
    if (prev == cur) return 0.dp
    if (isNotice(cur) || isNotice(prev)) {
        val other = if (isNotice(cur)) prev else cur
        return when (other) {
            Role.ASSISTANT -> BIG
            Role.USER -> 0.dp
            else -> SMALL
        }
    }
    val a = group(prev)
    val b = group(cur)
    if (a != 0 && b != 0) return BIG
    return if (a == 1 || b == 1) 0.dp else SMALL
}

@Composable
private fun Band(background: Color, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(background)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        content()
    }
}

@Composable
private fun Plain(content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        content()
    }
}

@Composable
private fun SelectableText(text: String, style: TextStyle, color: Color, modifier: Modifier = Modifier) {
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    Text(
        text,
        style = style,
        color = color,
        onTextLayout = { layout = it },
        modifier = modifier.fillMaxWidth().textHoverCursor(layout = { layout }),
    )
}

@Composable
private fun Collapsible(label: String, text: String, icon: ImageVector? = null, labelOnly: Boolean = false, running: Boolean = false, expanded: Boolean? = null, onToggle: (() -> Unit)? = null) {
    var localExpanded by rememberSaveable { mutableStateOf(false) }
    val isExpanded = expanded ?: localExpanded
    val toggle = onToggle ?: { localExpanded = !localExpanded }
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().then(if (labelOnly) Modifier else Modifier.clickable { toggle() }),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.size(6.dp))
            }
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            if (running) {
                LoadingIndicator(modifier = Modifier.size(16.dp), color = MaterialTheme.colorScheme.primary)
                if (!labelOnly) Spacer(Modifier.size(2.dp))
            }
            if (!labelOnly) {
                Icon(
                    imageVector = if (isExpanded) Lucide.ChevronDown else Lucide.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        if (isExpanded && !labelOnly) {
            CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurfaceVariant) {
                MarkdownText(text, modifier = Modifier.fillMaxWidth().padding(top = 4.dp), selectable = false)
            }
        }
    }
}

@Composable
private fun AgentBlock(message: ChatMessage, running: Boolean = false, expanded: Boolean? = null, onToggle: (() -> Unit)? = null) {
    var localExpanded by rememberSaveable { mutableStateOf(false) }
    val isExpanded = expanded ?: localExpanded
    val toggle = onToggle ?: { localExpanded = !localExpanded }
    val name = message.toolName ?: stringResource(Res.string.agent)
    val preview = message.text.replace("\n", " ").trim()
    val nameColor = MaterialTheme.colorScheme.primary
    val previewColor = MaterialTheme.colorScheme.onSurfaceVariant
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clickable { toggle() }, verticalAlignment = Alignment.CenterVertically) {
            Icon(Lucide.Bot, contentDescription = null, tint = nameColor, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(6.dp))
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = nameColor)) { append(name) }
                    if (!isExpanded && preview.isNotEmpty()) {
                        append("  ")
                        withStyle(SpanStyle(color = previewColor)) { append(preview) }
                    }
                },
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (running) {
                LoadingIndicator(modifier = Modifier.size(16.dp), color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.size(2.dp))
            }
            if (message.children.isNotEmpty()) {
                Icon(
                    imageVector = if (isExpanded) Lucide.ChevronDown else Lucide.ChevronRight,
                    contentDescription = null,
                    tint = previewColor,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        if (isExpanded && message.children.isNotEmpty()) {
            Column(modifier = Modifier.fillMaxWidth().padding(start = 12.dp, top = 4.dp)) {
                message.children.forEach { child ->
                    ChatMessageItem(message = child, prevRole = child.role, nextRole = child.role, gluedTop = true)
                }
            }
        }
    }
}

@Composable
private fun PlanBlock(markdown: String, expanded: Boolean? = null, onToggle: (() -> Unit)? = null, onSharedLink: ((String, String) -> Unit)? = null) {
    var localExpanded by rememberSaveable { mutableStateOf(false) }
    val isExpanded = expanded ?: localExpanded
    val toggle = onToggle ?: { localExpanded = !localExpanded }
    val preview = markdown.lineSequence().firstOrNull { it.isNotBlank() }?.trim()?.trimStart('#', ' ')?.trim().orEmpty()
    val nameColor = MaterialTheme.colorScheme.primary
    val previewColor = MaterialTheme.colorScheme.onSurfaceVariant
    val planLabel = stringResource(Res.string.plan)
    val header = buildAnnotatedString {
        withStyle(SpanStyle(color = nameColor)) { append(planLabel) }
        if (!isExpanded && preview.isNotEmpty()) {
            append("  ")
            withStyle(SpanStyle(color = previewColor)) { append(preview) }
        }
    }
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { toggle() },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Lucide.Lightbulb,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.size(6.dp))
            Text(
                text = header,
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = if (isExpanded) Lucide.ChevronDown else Lucide.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
        }
        if (isExpanded) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainerHigh,
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            ) {
                MarkdownText(
                    markdown,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                    selectable = false,
                    onSharedLink = onSharedLink,
                )
            }
        }
    }
}

@Composable
private fun ToolBlock(name: String?, input: String, result: String? = null, running: Boolean = false, expanded: Boolean? = null, onToggle: (() -> Unit)? = null) {
    var localExpanded by rememberSaveable { mutableStateOf(false) }
    val isExpanded = expanded ?: localExpanded
    val toggle = onToggle ?: { localExpanded = !localExpanded }
    val preview = input.replace("\n", " ").trim()
    val nameColor = MaterialTheme.colorScheme.primary
    val previewColor = MaterialTheme.colorScheme.onSurfaceVariant
    val header = buildAnnotatedString {
        withStyle(SpanStyle(color = nameColor)) { append(name.orEmpty()) }
        if (!isExpanded && preview.isNotEmpty()) {
            append("  ")
            withStyle(SpanStyle(color = previewColor)) { append(preview) }
        }
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { toggle() },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Lucide.SquareTerminal,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.size(6.dp))
            Text(
                text = header,
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (running) {
                LoadingIndicator(modifier = Modifier.size(16.dp), color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.size(2.dp))
            }
            Icon(
                imageVector = if (isExpanded) Lucide.ChevronDown else Lucide.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
        }
        if (isExpanded) {
            if (input.isNotBlank()) {
                Text(
                    text = input,
                    fontFamily = LocalMonoFontFamily.current,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (!result.isNullOrBlank()) {
                Spacer(Modifier.size(6.dp))
                CodeBlock(result, MaterialTheme.colorScheme.surfaceContainerHigh, stringResource(Res.string.result))
            }
        }
    }
}

@Composable
private fun NotificationBlock(summary: String) {
    val label = stringResource(Res.string.notification)
    val accent = MaterialTheme.colorScheme.primary
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val header = buildAnnotatedString {
        withStyle(SpanStyle(color = accent)) { append(label) }
        if (summary.isNotBlank()) {
            append("  ")
            withStyle(SpanStyle(color = muted)) { append(summary) }
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Lucide.Bell, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
        Spacer(Modifier.size(6.dp))
        Text(
            text = header,
            style = MaterialTheme.typography.labelLarge,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun FileChangeBlock(path: String, diffLines: List<DiffLine>, labelOnly: Boolean = false, expanded: Boolean? = null, onToggle: (() -> Unit)? = null) {
    var localExpanded by rememberSaveable { mutableStateOf(false) }
    val isExpanded = expanded ?: localExpanded
    val toggle = onToggle ?: { localExpanded = !localExpanded }
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().then(if (labelOnly) Modifier else Modifier.clickable { toggle() }),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Lucide.FilePen,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.size(6.dp))
            Text(
                text = path,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (!labelOnly) {
                Icon(
                    imageVector = if (isExpanded) Lucide.ChevronDown else Lucide.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        if (isExpanded && !labelOnly && diffLines.isNotEmpty()) {
            val bg = MaterialTheme.colorScheme.surfaceContainerHigh
            val defaultFg = MaterialTheme.colorScheme.onSurfaceVariant
            val scroll = rememberScrollState()
            Surface(
                color = bg,
                shape = RoundedCornerShape(6.dp),
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            ) {
                Column(
                    modifier = Modifier
                        .horizontalScrollbar(scroll)
                        .horizontalScroll(scroll)
                        .padding(vertical = 4.dp),
                ) {
                    diffLines.forEach { line ->
                        val (fg, lineBg, prefix) = diffStyleFor(line.kind, defaultFg)
                        Text(
                            text = if (line.text.isEmpty() && prefix.isEmpty()) " " else "$prefix${line.text}",
                            color = fg,
                            fontFamily = LocalMonoFontFamily.current,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            softWrap = false,
                            modifier = Modifier
                                .background(lineBg)
                                .padding(horizontal = 10.dp, vertical = 1.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CompactBlock(data: CompactData, expanded: Boolean? = null, onToggle: (() -> Unit)? = null) {
    var localExpanded by rememberSaveable { mutableStateOf(false) }
    val isExpanded = expanded ?: localExpanded
    val toggle = onToggle ?: { localExpanded = !localExpanded }
    val hasSummary = data.summary.isNotBlank()
    val triggerLabel = when (data.trigger) {
        "manual" -> stringResource(Res.string.compact_manual)
        "auto" -> stringResource(Res.string.compact_auto)
        else -> null
    }
    val stats = buildString {
        if (triggerLabel != null) append(triggerLabel)
        val pre = data.preTokens
        val post = data.postTokens
        if (pre != null && post != null) {
            if (isNotEmpty()) append(" • ")
            append("${fmtTokens(pre)} → ${fmtTokens(post)}")
        }
    }.ifBlank { null }
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(enabled = hasSummary) { toggle() },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.Archive, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(6.dp))
            Text(stringResource(Res.string.compacted), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.weight(1f))
            if (stats != null) {
                Text(stats, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (hasSummary) {
                Spacer(Modifier.size(6.dp))
                Icon(if (isExpanded) Lucide.ChevronDown else Lucide.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
            }
        }
        if (isExpanded && hasSummary) {
            MarkdownText(data.summary, modifier = Modifier.fillMaxWidth().padding(top = 4.dp), selectable = false)
        }
    }
}

private fun fmtTokens(n: Int): String = when {
    n >= 1_000_000 -> "${n / 1_000_000}M"
    n >= 1_000 -> "${n / 1_000}k"
    else -> n.toString()
}

@Composable
private fun diffStyleFor(kind: DiffKind, defaultFg: Color): Triple<Color, Color, String> {
    val p = palette
    return when (kind) {
        DiffKind.HEADER -> Triple(p.gray, Color.Transparent, "")
        DiffKind.HUNK -> Triple(p.blue, p.blueBg, "")
        DiffKind.ADD -> Triple(p.green, p.greenBg, "+")
        DiffKind.DEL -> Triple(p.red, p.redBg, "-")
        DiffKind.CTX -> Triple(defaultFg, Color.Transparent, " ")
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InteractionBlock(
    data: InteractionData,
    toolName: String?,
    input: String,
    expanded: Boolean? = null,
    onToggle: (() -> Unit)? = null,
    onAnswer: ((String, String, String?) -> Unit)?,
) {
    val resolved = data.resolved
    val isPlan = toolName == "ExitPlanMode"
    val title = if (isPlan) stringResource(Res.string.plan) else (data.title ?: toolName ?: stringResource(Res.string.permission_title))
    val headerIcon = if (isPlan) Lucide.Lightbulb else Lucide.Shield
    var localPlanExpanded by rememberSaveable { mutableStateOf(false) }
    val planExpanded = expanded ?: localPlanExpanded
    val togglePlan = onToggle ?: { localPlanExpanded = !localPlanExpanded }
    val planPreview = if (isPlan) input.lineSequence().firstOrNull { it.isNotBlank() }?.trim()?.trimStart('#', ' ')?.trim().orEmpty() else ""
    val titleColor = MaterialTheme.colorScheme.primary
    val previewColor = MaterialTheme.colorScheme.onSurfaceVariant
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = if (isPlan) Modifier.fillMaxWidth().clickable { togglePlan() } else Modifier,
        ) {
            Icon(
                headerIcon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.size(8.dp))
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = titleColor)) { append(title) }
                    if (isPlan && !planExpanded && planPreview.isNotEmpty()) {
                        append("  ")
                        withStyle(SpanStyle(color = previewColor)) { append(planPreview) }
                    }
                },
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (isPlan) {
                Icon(
                    if (planExpanded) Lucide.ChevronDown else Lucide.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        if (input.isNotBlank()) {
            if (isPlan) {
                if (planExpanded) {
                    OutlinedPanel(modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                        MarkdownText(input, modifier = Modifier.fillMaxWidth(), selectable = false)
                    }
                }
            } else {
                Text(
                    text = input,
                    fontFamily = LocalMonoFontFamily.current,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
        if (resolved == null) {
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                data.options.forEach { opt ->
                    OutlinedButton(
                        onClick = { onAnswer?.invoke(data.requestId, opt.id, null) },
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.pointerHoverIcon(PointerIcon.Hand, overrideDescendants = true),
                    ) {
                        Text(optionLabel(opt), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        } else {
            val chosen = data.options.firstOrNull { it.id == resolved }
            val label = chosen?.let { optionLabel(it) }.orEmpty()
            val display = label.ifBlank { data.resolvedText.orEmpty() }
            val extra = if (label.isNotBlank()) data.resolvedText else null
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                Icon(CustomIcons.PlayFilled, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(10.dp))
                Spacer(Modifier.size(6.dp))
                Text(display, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (!extra.isNullOrBlank()) {
                Text(extra, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun optionLabel(opt: InteractionOption): String {
    if (!opt.label.isNullOrBlank()) return opt.label
    return when (opt.id) {
        "allow" -> stringResource(Res.string.permission_allow)
        "allow_always" -> stringResource(Res.string.permission_allow_always)
        "deny" -> stringResource(Res.string.permission_deny)
        "different" -> stringResource(Res.string.permission_different)
        else -> opt.id
    }
}

@Composable
private fun QuestionsBlock(
    data: InteractionData,
    onToggleOption: (Int, String) -> Unit,
    onFreeText: (Int, String) -> Unit,
    onNotes: (Int, String) -> Unit,
    onSubmit: () -> Unit,
    onChat: () -> Unit,
    onActivePage: (Int) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Lucide.CircleQuestionMark, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(6.dp))
            Text(stringResource(Res.string.questions_title), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        }
        if (data.submitted) {
            ResolvedQuestions(data)
        } else {
            val many = data.questions.size > 1
            val pagerState = rememberPagerState(initialPage = data.activeQuestion.coerceIn(0, (data.questions.size - 1).coerceAtLeast(0)), pageCount = { data.questions.size })
            val scope = rememberCoroutineScope()
            LaunchedEffect(pagerState.currentPage) { onActivePage(pagerState.currentPage) }
            if (many) {
                Spacer(Modifier.height(4.dp))
                QuestionTabs(data.questions, pagerState)
                Spacer(Modifier.height(10.dp))
                HorizontalPager(state = pagerState, verticalAlignment = Alignment.Top, modifier = Modifier.animateContentSize()) { page ->
                    QuestionContent(data, page, onToggleOption, onFreeText, onNotes, showChip = false)
                }
            } else {
                Spacer(Modifier.height(4.dp))
                Box(Modifier.animateContentSize()) {
                    QuestionContent(data, 0, onToggleOption, onFreeText, onNotes, showChip = true)
                }
            }
            Spacer(Modifier.height(6.dp))
            val isLast = pagerState.currentPage >= data.questions.lastIndex
            val canSend = many || data.drafts.getOrElse(0) { QuestionDraft() }.let { it.selected.isNotEmpty() || it.freeText.isNotBlank() }
            ActionButton(
                text = stringResource(
                    when {
                        !isLast -> Res.string.next
                        many -> Res.string.submit_answers
                        else -> Res.string.send
                    }
                ),
                onClick = {
                    if (!isLast) scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                    else onSubmit()
                },
                enabled = !isLast || canSend,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            ActionButton(
                text = stringResource(Res.string.chat_about_this),
                onClick = onChat,
                icon = Lucide.MessageSquare,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun ResolvedQuestions(data: InteractionData) {
    if (data.declined) {
        Spacer(Modifier.height(2.dp))
        SummaryLine(Lucide.MessageSquare, 10.dp, stringResource(Res.string.chat_about_this))
        return
    }
    data.questions.forEachIndexed { qi, q ->
        Spacer(Modifier.height(4.dp))
        if (!q.header.isNullOrBlank()) {
            HeaderChip(q.header)
            Spacer(Modifier.height(2.dp))
        }
        if (!q.question.isNullOrBlank()) {
            Text(q.question, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
            Spacer(Modifier.height(2.dp))
        }
        SummaryLine(CustomIcons.PlayFilled, 10.dp, data.summary.getOrElse(qi) { "" }.ifBlank { "—" })
        val note = data.notes.getOrElse(qi) { "" }
        if (note.isNotBlank()) SummaryLine(Lucide.CornerDownRight, 12.dp, note, indent = 16.dp, top = 2.dp)
    }
}

@Composable
private fun QuestionTabs(questions: List<InteractionQuestion>, pagerState: PagerState) {
    val scope = rememberCoroutineScope()
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        itemsIndexed(questions) { i, q ->
            val active = i == pagerState.currentPage
            val label = q.header?.ifBlank { null } ?: q.question?.take(18)?.ifBlank { null } ?: "${i + 1}"
            Surface(
                color = if (active) MaterialTheme.colorScheme.primary.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .clickable { scope.launch { pagerState.animateScrollToPage(i) } }
                    .pointerHoverIcon(PointerIcon.Hand, overrideDescendants = true),
            ) {
                Text(
                    label,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
        }
    }
}

@Composable
private fun QuestionContent(
    data: InteractionData,
    qi: Int,
    onToggleOption: (Int, String) -> Unit,
    onFreeText: (Int, String) -> Unit,
    onNotes: (Int, String) -> Unit,
    showChip: Boolean,
) {
    val q = data.questions[qi]
    val draft = data.drafts.getOrElse(qi) { QuestionDraft() }
    val hasPreview = q.options.any { !it.preview.isNullOrBlank() }
    Column(modifier = Modifier.fillMaxWidth()) {
        if (showChip && !q.header.isNullOrBlank()) {
            HeaderChip(q.header)
            Spacer(Modifier.height(3.dp))
        }
        if (!q.question.isNullOrBlank()) {
            Text(q.question, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
            Spacer(Modifier.height(6.dp))
        }
        q.options.forEach { opt ->
            val selected = opt.id in draft.selected
            OptionRow(opt, selected, q.multiSelect) { onToggleOption(qi, opt.id) }
            if (selected && !opt.preview.isNullOrBlank()) PreviewBox(opt.preview)
        }
        if (!hasPreview) {
            Spacer(Modifier.height(6.dp))
            DraftInput(
                draft.freeText,
                { onFreeText(qi, it) },
                stringResource(Res.string.interaction_other_hint),
                onClear = if (q.multiSelect) ({ onFreeText(qi, "") }) else null,
            )
        }
        var showNotes by rememberSaveable(data.requestId, qi) { mutableStateOf(draft.notes.isNotBlank()) }
        Spacer(Modifier.height(if (showNotes) 6.dp else 2.dp))
        if (showNotes) {
            DraftInput(
                draft.notes,
                { onNotes(qi, it) },
                stringResource(Res.string.interaction_notes_hint),
                // First press clears the text; pressing it while empty removes the note field.
                onClear = { if (draft.notes.isNotBlank()) onNotes(qi, "") else showNotes = false },
                clearAlways = true,
            )
        } else {
            Text(
                stringResource(Res.string.add_notes),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { showNotes = true }
                    .pointerHoverIcon(PointerIcon.Hand, overrideDescendants = true)
                    .padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun SummaryLine(icon: ImageVector, iconSize: Dp, text: String, indent: Dp = 0.dp, top: Dp = 0.dp) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = indent, top = top)) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(iconSize))
        Spacer(Modifier.size(6.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun HeaderChip(text: String) {
    Surface(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f), shape = RoundedCornerShape(6.dp)) {
        Text(
            text,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun OptionRow(opt: InteractionOption, selected: Boolean, multi: Boolean, onClick: () -> Unit) {
    val accent = MaterialTheme.colorScheme.primary
    val shape = if (multi) RoundedCornerShape(6.dp) else CircleShape
    val markScale by animateFloatAsState(if (selected) 1f else 0f, label = "option-mark")
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .pointerHoverIcon(PointerIcon.Hand, overrideDescendants = true)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(shape)
                .border(2.dp, if (selected) accent else MaterialTheme.colorScheme.outline, shape),
            contentAlignment = Alignment.Center,
        ) {
            if (multi) {
                Icon(Lucide.Check, contentDescription = null, tint = accent, modifier = Modifier.size(13.dp).scale(markScale))
            } else {
                Box(Modifier.size(10.dp).scale(markScale).clip(CircleShape).background(accent))
            }
        }
        Spacer(Modifier.size(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                opt.label.orEmpty(),
                style = MaterialTheme.typography.bodyMedium,
                color = if (selected) accent else MaterialTheme.colorScheme.onSurface,
            )
            if (!opt.description.isNullOrBlank()) {
                Text(opt.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun ChatDateSeparator(millis: Long) {
    DisableSelection {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Lucide.Calendar,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.size(6.dp))
            Text(
                text = formatDay(millis),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun PreviewBox(preview: String) {
    val scroll = rememberScrollState()
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = RoundedCornerShape(6.dp),
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 4.dp),
    ) {
        Text(
            preview.trimEnd('\n'),
            fontFamily = LocalMonoFontFamily.current,
            style = MaterialTheme.typography.bodySmall.copy(lineHeight = 14.sp),
            color = MaterialTheme.colorScheme.onSurface,
            softWrap = false,
            modifier = Modifier.horizontalScrollbar(scroll, touchIndicator = false).horizontalScroll(scroll).padding(horizontal = 10.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun DraftInput(value: String, onValueChange: (String) -> Unit, placeholder: String, onClear: (() -> Unit)? = null, clearAlways: Boolean = false) {
    val shape = RoundedCornerShape(8.dp)
    val showClear = onClear != null && (clearAlways || value.isNotEmpty())
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(start = 10.dp, end = if (onClear != null) 4.dp else 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            maxLines = 3,
            modifier = Modifier.weight(1f).padding(vertical = 8.dp),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(placeholder, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                inner()
            },
        )
        if (showClear) {
            IconButton(onClick = onClear!!, modifier = Modifier.size(28.dp)) {
                Icon(Lucide.X, contentDescription = stringResource(Res.string.cancel), tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            }
        }
    }
}
