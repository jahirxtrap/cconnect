package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberTransition
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.ui.theme.Radius
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun AbovePopupMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (expanded) DropdownScrim(onDismiss)
    if (expanded) Dismissable(onDismiss = onDismiss)
    val state = remember { MutableTransitionState(false) }
    state.targetState = expanded
    if (state.currentState || state.targetState) {
        val gap = with(LocalDensity.current) { 4.dp.roundToPx() }
        Popup(
            popupPositionProvider = remember(gap) { AboveAnchorPositionProvider(gap) },
            onDismissRequest = onDismiss,
            properties = PopupProperties(focusable = !LocalIsTouch.current),
        ) {
            val transition = rememberTransition(state, "AbovePopupMenu")
            val scale by transition.animateFloat(
                transitionSpec = { MaterialTheme.motionScheme.fastSpatialSpec() },
            ) { if (it) 1f else 0.8f }
            val alpha by transition.animateFloat(
                transitionSpec = { MaterialTheme.motionScheme.fastEffectsSpec() },
            ) { if (it) 1f else 0f }
            Surface(
                modifier = Modifier.graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    this.alpha = alpha
                    transformOrigin = TransformOrigin(0f, 1f)
                },
                shape = RoundedCornerShape(Radius.md),
                color = MaterialTheme.colorScheme.surfaceVariant,
                tonalElevation = 0.dp,
                shadowElevation = MenuDefaults.ShadowElevation,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            ) {
                Column(
                    modifier = Modifier
                        .padding(4.dp)
                        .width(IntrinsicSize.Max),
                    content = content,
                )
            }
        }
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
