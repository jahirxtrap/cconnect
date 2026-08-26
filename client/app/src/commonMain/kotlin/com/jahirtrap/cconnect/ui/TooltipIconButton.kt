package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.PopupPositionProvider
import com.composables.icons.lucide.Folder
import com.composables.icons.lucide.Lucide
import com.jahirtrap.cconnect.isAndroidPlatform
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.choose
import com.jahirtrap.cconnect.ui.theme.Radius
import org.jetbrains.compose.resources.stringResource
import com.jahirtrap.cconnect.ui.theme.shadowLg
import kotlinx.coroutines.launch

/** Folder button that sits inside a path field, next to the local-server and project ones. */
@Composable
fun PickerIcon(onClick: () -> Unit) {
    TooltipIconButton(label = stringResource(Res.string.choose), onClick = onClick, size = 24.dp) {
        Icon(
            Lucide.Folder,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TooltipIconButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: Dp = 36.dp,
    showLabel: Boolean = false,
    tooltip: Boolean = true,
    icon: @Composable () -> Unit,
) {
    if (!tooltip && !showLabel) {
        IconAction(onClick = onClick, modifier = modifier, enabled = enabled, size = size, icon = icon)
        return
    }
    if (showLabel) {
        Row(
            modifier = modifier
                .height(size)
                .clip(CircleShape)
                .clickable(enabled = enabled, onClick = onClick)
                .alpha(if (enabled) 1f else 0.4f)
                .padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            icon()
            Text(
                label,
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        return
    }
    val skikoTouch = !isAndroidPlatform && LocalIsTouch.current
    val tooltipState = rememberTooltipState()
    val scope = rememberCoroutineScope()
    TooltipBox(
        positionProvider = rememberAboveOrBelowPositionProvider(),
        tooltip = { AppTooltip(label) },
        state = tooltipState,
        enableUserInput = !skikoTouch,
    ) {
        if (skikoTouch) {
            Box(
                modifier = modifier
                    .size(size)
                    .alpha(if (enabled) 1f else 0.4f)
                    .clip(CircleShape)
                    .combinedClickable(
                        enabled = enabled,
                        onLongClick = { scope.launch { tooltipState.show() } },
                        onClick = onClick,
                    ),
                contentAlignment = Alignment.Center,
                content = { icon() },
            )
        } else {
            IconAction(onClick = onClick, modifier = modifier, enabled = enabled, size = size, icon = icon)
        }
    }
}

@Composable
private fun IconAction(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: Dp = 36.dp,
    icon: @Composable () -> Unit,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.size(size).then(if (enabled) Modifier.pointerHoverIcon(PointerIcon.Hand) else Modifier),
        content = { icon() },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TooltipWrap(label: String, content: @Composable () -> Unit) {
    val skikoTouch = !isAndroidPlatform && LocalIsTouch.current
    val tooltipState = rememberTooltipState()
    TooltipBox(
        positionProvider = rememberAboveOrBelowPositionProvider(),
        tooltip = { AppTooltip(label) },
        state = tooltipState,
        enableUserInput = !skikoTouch,
    ) {
        content()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TooltipTap(label: String, content: @Composable () -> Unit) {
    val skikoTouch = !isAndroidPlatform && LocalIsTouch.current
    val tooltipState = rememberTooltipState()
    val scope = rememberCoroutineScope()
    TooltipBox(
        positionProvider = rememberAboveOrBelowPositionProvider(),
        tooltip = { AppTooltip(label) },
        state = tooltipState,
        enableUserInput = !skikoTouch,
    ) {
        Box(
            modifier = Modifier.clip(CircleShape).combinedClickable(onClick = { scope.launch { tooltipState.show() } }),
            contentAlignment = Alignment.Center,
        ) {
            content()
        }
    }
}

@Composable
fun AppTooltip(label: String) {
    val shape = RoundedCornerShape(Radius.sm)
    Surface(
        modifier = Modifier.shadowLg(shape),
        shape = shape,
        color = MaterialTheme.colorScheme.surfaceVariant,
        contentColor = MaterialTheme.colorScheme.onSurface,
        tonalElevation = 0.dp,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun rememberAboveOrBelowPositionProvider(spacing: Dp = 4.dp): PopupPositionProvider {
    val density = LocalDensity.current
    val spacingPx = with(density) { spacing.roundToPx() }
    val statusBarTopPx = WindowInsets.systemBars.getTop(density)
    return remember(spacingPx, statusBarTopPx) {
        object : PopupPositionProvider {
            override fun calculatePosition(
                anchorBounds: IntRect,
                windowSize: IntSize,
                layoutDirection: LayoutDirection,
                popupContentSize: IntSize,
            ): IntOffset {
                val rawX = anchorBounds.left + (anchorBounds.width - popupContentSize.width) / 2
                val above = anchorBounds.top - popupContentSize.height - spacingPx
                val below = anchorBounds.bottom + spacingPx
                val y = if (above >= statusBarTopPx) above else below
                val x = rawX.coerceIn(0, (windowSize.width - popupContentSize.width).coerceAtLeast(0))
                return IntOffset(x, y)
            }
        }
    }
}
