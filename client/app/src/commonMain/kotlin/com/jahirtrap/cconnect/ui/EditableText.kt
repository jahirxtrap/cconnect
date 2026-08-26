package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.ui.theme.Radius
import com.jahirtrap.cconnect.ui.theme.snapDp

@Composable
fun EditableText(
    value: String,
    editing: Boolean,
    onEdit: () -> Unit,
    onValueChange: (String) -> Unit,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
    interactive: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    val focus = remember { FocusRequester() }
    val shape = RoundedCornerShape(Radius.md)
    LaunchedEffect(editing) { if (editing) focus.requestFocus() }
    BackInterceptor(enabled = editing) { onCancel(); true }
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = editing,
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { onCommit() }),
        modifier = modifier
            .clip(shape)
            .background(
                if (!editing && hovered) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f) else Color.Transparent,
            )
            .border(snapDp(2.dp), if (editing) MaterialTheme.colorScheme.primary else Color.Transparent, shape)
            .hoverable(interaction, enabled = interactive)
            .pointerHoverIcon(if (editing) PointerIcon.Text else PointerIcon.Hand)
            .then(if (editing || !interactive) Modifier else Modifier.clickable(onClick = onEdit))
            .focusRequester(focus)
            .onFocusChanged { if (!it.isFocused && editing) onCommit() }
            .onPreviewKeyEvent { event ->
                if (editing && event.type == KeyEventType.KeyDown && event.key == Key.Escape) {
                    onCancel()
                    true
                } else {
                    false
                }
            }
            .padding(horizontal = 12.dp, vertical = 8.dp),
    )
}
