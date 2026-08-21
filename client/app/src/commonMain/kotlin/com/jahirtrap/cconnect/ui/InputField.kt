package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.cancel
import org.jetbrains.compose.resources.stringResource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.ui.theme.Radius
import com.jahirtrap.cconnect.ui.theme.snapDp

@Composable
fun InputField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: @Composable (() -> Unit)? = null,
    placeholder: String? = null,
    singleLine: Boolean = false,
    minLines: Int = 1,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: @Composable (() -> Unit)? = null,
    onClear: (() -> Unit)? = null,
    clearAlways: Boolean = false,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(Radius.md)
    val borderColor = if (focused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    val lineHeightDp = with(LocalDensity.current) { MaterialTheme.typography.bodyMedium.lineHeight.toDp() }
    Column(modifier) {
        if (label != null) {
            ProvideTextStyle(MaterialTheme.typography.labelLarge) { label() }
            Spacer(Modifier.height(6.dp))
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .border(snapDp(2.dp), borderColor, shape)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier
                    .weight(1f)
                    .then(if (singleLine) Modifier.height(lineHeightDp) else Modifier.heightIn(min = lineHeightDp * minLines))
                    .onFocusChanged { focused = it.isFocused }
                    .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier),
                singleLine = singleLine,
                minLines = minLines,
                maxLines = maxLines,
                keyboardOptions = keyboardOptions,
                visualTransformation = visualTransformation,
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                decorationBox = { inner ->
                    if (value.isEmpty() && placeholder != null) {
                        Text(
                            placeholder,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    inner()
                },
            )
            if (onClear != null && (clearAlways || value.isNotEmpty())) {
                Spacer(Modifier.width(4.dp))
                IconButton(onClick = onClear, modifier = Modifier.size(28.dp)) {
                    Icon(
                        Lucide.X,
                        contentDescription = stringResource(Res.string.cancel),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            if (trailingIcon != null) {
                Spacer(Modifier.width(8.dp))
                trailingIcon()
            }
        }
    }
}
