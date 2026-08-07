package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.border
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.jahirtrap.cconnect.ui.theme.Radius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.PopupProperties
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.ChevronDown
import com.composables.icons.lucide.Lucide

@Composable
fun CompactDropdownItem(
    text: String,
    leadingIcon: (@Composable () -> Unit)? = null,
    selected: Boolean = false,
    color: Color = Color.Unspecified,
    textDecoration: TextDecoration? = null,
    fontWeight: FontWeight? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.sm))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingIcon != null) {
            leadingIcon()
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            color = if (color == Color.Unspecified) MaterialTheme.colorScheme.onSurface else color,
            textDecoration = textDecoration,
            fontWeight = fontWeight,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            Spacer(Modifier.width(8.dp))
            Icon(Lucide.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
        }
        if (trailing != null) {
            Spacer(Modifier.width(8.dp))
            trailing()
        }
    }
}

@Composable
fun SelectField(
    label: String,
    selected: String,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    var fieldWidth by remember { mutableStateOf(0.dp) }
    val density = LocalDensity.current
    val display = options.firstOrNull { it.first == selected }?.second ?: selected
    val shape = RoundedCornerShape(8.dp)
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(4.dp))
        Box {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .onSizeChanged { fieldWidth = with(density) { it.width.toDp() } }
                    .clip(shape)
                    .border(1.dp, if (open) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant, shape)
                    .clickable { open = true }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(display, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                Icon(Lucide.ChevronDown, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
            }
            if (open) DropdownScrim { open = false }
            if (open) Dismissable { open = false }
            DropdownMenu(
                expanded = open,
                onDismissRequest = { open = false },
                modifier = Modifier.widthIn(min = fieldWidth),
                properties = PopupProperties(focusable = !LocalIsTouch.current),
            ) {
                options.forEach { (value, text) ->
                    CompactDropdownItem(text = text, selected = value == selected, onClick = { onSelect(value); open = false })
                }
            }
        }
    }
}
