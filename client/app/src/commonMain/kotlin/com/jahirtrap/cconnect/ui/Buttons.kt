package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button as MaterialButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.IconButton as MaterialIconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.ui.theme.snapDp

private val ButtonHeight = 36.dp
private val ButtonPadding = PaddingValues(horizontal = 16.dp)
private const val DisabledAlpha = 0.4f

enum class ButtonVariant { Filled, Outlined, Ghost, Text, Accent }

@Composable
fun Button(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Filled,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val container = if (variant == ButtonVariant.Filled) scheme.primary else Color.Transparent
    val label = when (variant) {
        ButtonVariant.Filled -> scheme.onPrimary
        ButtonVariant.Outlined, ButtonVariant.Ghost -> scheme.onSurface
        ButtonVariant.Text -> scheme.onSurfaceVariant
        ButtonVariant.Accent -> scheme.primary
    }
    MaterialButton(
        onClick = onClick,
        modifier = modifier.height(ButtonHeight).handCursor(enabled),
        enabled = enabled,
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = label,
            disabledContainerColor = container.copy(alpha = container.alpha * DisabledAlpha),
            disabledContentColor = label.copy(alpha = DisabledAlpha),
        ),
        elevation = null,
        border = if (variant == ButtonVariant.Outlined) {
            BorderStroke(snapDp(2.dp), scheme.outlineVariant.copy(alpha = if (enabled) 1f else DisabledAlpha))
        } else {
            null
        },
        contentPadding = ButtonPadding,
        content = content,
    )
}

@Composable
fun IconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) = MaterialIconButton(onClick = onClick, modifier = modifier.handCursor(enabled), enabled = enabled, content = content)
