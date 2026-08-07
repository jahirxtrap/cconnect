package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberTransition
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.ui.theme.Radius
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties

private val MenuMinWidth = 160.dp
private val SubMenuMinWidth = 192.dp
private val MenuMaxHeight = 384.dp
val MenuPadding = 4.dp

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
private fun MenuPopup(
    expanded: Boolean,
    onDismiss: () -> Unit,
    positionProvider: PopupPositionProvider,
    origin: TransformOrigin,
    minWidth: Dp,
    modifier: Modifier,
    properties: PopupProperties,
    content: @Composable ColumnScope.() -> Unit,
) {
    val state = remember { MutableTransitionState(false) }
    state.targetState = expanded
    if (!state.currentState && !state.targetState) return
    Popup(
        popupPositionProvider = positionProvider,
        onDismissRequest = onDismiss,
        properties = properties,
    ) {
        val transition = rememberTransition(state, "MenuPopup")
        val scale by transition.animateFloat(
            transitionSpec = { MaterialTheme.motionScheme.fastSpatialSpec() },
        ) { if (it) 1f else 0.8f }
        val alpha by transition.animateFloat(
            transitionSpec = { MaterialTheme.motionScheme.fastEffectsSpec() },
        ) { if (it) 1f else 0f }
        Surface(
            modifier = modifier.graphicsLayer {
                scaleX = scale
                scaleY = scale
                this.alpha = alpha
                transformOrigin = origin
            },
            shape = RoundedCornerShape(Radius.md),
            color = MaterialTheme.colorScheme.surfaceVariant,
            tonalElevation = 0.dp,
            shadowElevation = MenuDefaults.ShadowElevation,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
            Column(
                modifier = Modifier
                    .padding(MenuPadding)
                    .heightIn(max = MenuMaxHeight)
                    .width(IntrinsicSize.Max)
                    .verticalScroll(rememberScrollState()),
            ) {
                Spacer(Modifier.width((minWidth - MenuPadding * 2).coerceAtLeast(0.dp)))
                content()
            }
        }
    }
}

@Composable
fun AppDropdownMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    minWidth: Dp = MenuMinWidth,
    properties: PopupProperties = PopupProperties(focusable = true),
    content: @Composable ColumnScope.() -> Unit,
) {
    val gap = with(LocalDensity.current) { MenuPadding.roundToPx() }
    MenuPopup(
        expanded = expanded,
        onDismiss = onDismissRequest,
        positionProvider = remember(gap) { BelowAnchorPositionProvider(gap) },
        origin = TransformOrigin(0f, 0f),
        minWidth = minWidth,
        modifier = modifier,
        properties = properties,
        content = content,
    )
}

@Composable
fun AbovePopupMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (expanded) DropdownScrim(onDismiss)
    if (expanded) Dismissable(onDismiss = onDismiss)
    val gap = with(LocalDensity.current) { MenuPadding.roundToPx() }
    MenuPopup(
        expanded = expanded,
        onDismiss = onDismiss,
        positionProvider = remember(gap) { AboveAnchorPositionProvider(gap) },
        origin = TransformOrigin(0f, 1f),
        minWidth = MenuMinWidth,
        modifier = Modifier,
        properties = PopupProperties(focusable = !LocalIsTouch.current),
        content = content,
    )
}

@Composable
fun SubMenuPopup(
    expanded: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val pad = with(LocalDensity.current) { MenuPadding.roundToPx() }
    MenuPopup(
        expanded = expanded,
        onDismiss = onDismiss,
        positionProvider = remember(pad) { BesideAnchorPositionProvider(pad) },
        origin = TransformOrigin(0f, 0f),
        minWidth = SubMenuMinWidth,
        modifier = modifier,
        properties = PopupProperties(focusable = false),
        content = content,
    )
}

class BelowAnchorPositionProvider(private val gapPx: Int) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val below = anchorBounds.bottom + gapPx
        val above = anchorBounds.top - popupContentSize.height - gapPx
        val y = if (below + popupContentSize.height <= windowSize.height) below else above.coerceAtLeast(0)
        val maxX = (windowSize.width - popupContentSize.width).coerceAtLeast(0)
        return IntOffset(anchorBounds.left.coerceIn(0, maxX), y)
    }
}

class BesideAnchorPositionProvider(private val padPx: Int) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val right = anchorBounds.right + padPx
        val left = anchorBounds.left - popupContentSize.width - padPx
        val x = if (right + popupContentSize.width <= windowSize.width) right else left.coerceAtLeast(0)
        val maxY = (windowSize.height - popupContentSize.height).coerceAtLeast(0)
        return IntOffset(x, (anchorBounds.top - padPx).coerceIn(0, maxY))
    }
}

class AboveAnchorPositionProvider(private val gapPx: Int) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val y = (anchorBounds.top - popupContentSize.height - gapPx).coerceAtLeast(0)
        val maxX = (windowSize.width - popupContentSize.width).coerceAtLeast(0)
        return IntOffset(anchorBounds.left.coerceIn(0, maxX), y)
    }
}
