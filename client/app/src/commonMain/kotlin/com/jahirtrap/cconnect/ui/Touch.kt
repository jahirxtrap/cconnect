package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.isCoarsePointer

val LocalIsTouch = compositionLocalOf { false }

val LocalMobileLayout = compositionLocalOf { false }

@Composable
fun Modifier.clearFocusOnTap(): Modifier {
    val focus = LocalFocusManager.current
    return pointerInput(Unit) {
        awaitPointerEventScope {
            while (true) {
                val event = awaitPointerEvent(PointerEventPass.Final)
                if (event.type == PointerEventType.Press && event.changes.none { it.isConsumed }) {
                    focus.clearFocus()
                }
            }
        }
    }
}

@Composable
fun ProvideIsTouch(content: @Composable () -> Unit) {
    var touch by remember { mutableStateOf(isCoarsePointer()) }
    val density = LocalDensity.current
    val size = LocalWindowInfo.current.containerSize
    val mobile = if (size.width == 0 || size.height == 0) isCoarsePointer()
        else size.height > size.width || with(density) { size.width.toDp() } < 600.dp
    CompositionLocalProvider(LocalIsTouch provides touch, LocalMobileLayout provides mobile) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    awaitPointerEventScope {
                        while (true) {
                            val type = awaitPointerEvent(PointerEventPass.Initial).changes.firstOrNull()?.type
                            if (type == PointerType.Touch) touch = true
                            else if (type == PointerType.Mouse) touch = false
                        }
                    }
                }
                .clearFocusOnTap(),
        ) {
            content()
        }
    }
}
