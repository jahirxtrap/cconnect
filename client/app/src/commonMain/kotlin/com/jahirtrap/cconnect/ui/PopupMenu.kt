package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
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
import com.jahirtrap.cconnect.ui.theme.shadowLg
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import com.jahirtrap.cconnect.ui.theme.snapDp

private val MenuMinWidth = 160.dp
private val SubMenuMinWidth = 192.dp
private val MenuMaxHeight = 384.dp
val MenuPadding = 4.dp
val MenuEdge = 8.dp
private const val MenuExitMillis = 90

@Stable
class SubMenuScope {
    var active by mutableStateOf<Any?>(null)
}

val LocalSubMenuScope = staticCompositionLocalOf<SubMenuScope?> { null }

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
            transitionSpec = {
                if (targetState) MaterialTheme.motionScheme.fastSpatialSpec() else tween(MenuExitMillis, easing = LinearEasing)
            },
        ) { if (it) 1f else 0.96f }
        val alpha by transition.animateFloat(
            transitionSpec = {
                if (targetState) MaterialTheme.motionScheme.fastEffectsSpec() else tween(MenuExitMillis, easing = LinearEasing)
            },
        ) { if (it) 1f else 0f }
        val shownScale = if (state.targetState) scale else 1f
        val shape = RoundedCornerShape(Radius.md)
        Surface(
            modifier = modifier
                .graphicsLayer {
                    scaleX = shownScale
                    scaleY = shownScale
                    this.alpha = alpha
                    transformOrigin = origin
                }
                .shadowLg(shape),
            shape = shape,
            color = MaterialTheme.colorScheme.surfaceVariant,
            tonalElevation = 0.dp,
            border = BorderStroke(snapDp(2.dp), MaterialTheme.colorScheme.outlineVariant),
        ) {
            CompositionLocalProvider(LocalSubMenuScope provides remember { SubMenuScope() }) {
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
    val density = LocalDensity.current
    val gap = with(density) { MenuPadding.roundToPx() }
    val edge = with(density) { MenuEdge.roundToPx() }
    var above by remember { mutableStateOf(false) }
    MenuPopup(
        expanded = expanded,
        onDismiss = onDismissRequest,
        positionProvider = remember(gap, edge) { BelowAnchorPositionProvider(gap, edge) { above = it } },
        origin = TransformOrigin(0f, if (above) 1f else 0f),
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
    val density = LocalDensity.current
    val gap = with(density) { MenuPadding.roundToPx() }
    val edge = with(density) { MenuEdge.roundToPx() }
    MenuPopup(
        expanded = expanded,
        onDismiss = onDismiss,
        positionProvider = remember(gap, edge) { AboveAnchorPositionProvider(gap, edge) },
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
    val density = LocalDensity.current
    val pad = with(density) { MenuPadding.roundToPx() }
    val edge = with(density) { MenuEdge.roundToPx() }
    MenuPopup(
        expanded = expanded,
        onDismiss = onDismiss,
        positionProvider = remember(pad, edge) { BesideAnchorPositionProvider(pad, edge) },
        origin = TransformOrigin(0f, 0f),
        minWidth = SubMenuMinWidth,
        modifier = modifier,
        properties = PopupProperties(focusable = false),
        content = content,
    )
}

class BelowAnchorPositionProvider(
    private val gapPx: Int,
    private val edgePx: Int,
    private val onPlacedAbove: (Boolean) -> Unit = {},
) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val below = anchorBounds.bottom + gapPx
        val above = anchorBounds.top - popupContentSize.height - gapPx
        val fitsBelow = below + popupContentSize.height <= windowSize.height - edgePx
        onPlacedAbove(!fitsBelow)
        val y = if (fitsBelow) below else above.coerceAtLeast(edgePx)
        val maxX = (windowSize.width - popupContentSize.width - edgePx).coerceAtLeast(edgePx)
        return IntOffset(anchorBounds.left.coerceIn(edgePx, maxX), y)
    }
}

class BesideAnchorPositionProvider(private val padPx: Int, private val edgePx: Int) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val right = anchorBounds.right + padPx
        val left = anchorBounds.left - popupContentSize.width - padPx
        val fitsRight = right + popupContentSize.width <= windowSize.width - edgePx
        val x = if (fitsRight) right else left.coerceAtLeast(edgePx)
        val maxY = (windowSize.height - popupContentSize.height - edgePx).coerceAtLeast(edgePx)
        return IntOffset(x, (anchorBounds.top - padPx).coerceIn(edgePx, maxY))
    }
}

class AboveAnchorPositionProvider(private val gapPx: Int, private val edgePx: Int) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val y = (anchorBounds.top - popupContentSize.height - gapPx).coerceAtLeast(edgePx)
        val maxX = (windowSize.width - popupContentSize.width - edgePx).coerceAtLeast(edgePx)
        return IntOffset(anchorBounds.left.coerceIn(edgePx, maxX), y)
    }
}
