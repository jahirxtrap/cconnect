package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.Lucide
import kotlinx.coroutines.delay
import com.jahirtrap.cconnect.ui.theme.snapDp

private const val SUBMENU_CLOSE_MS = 160L

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
fun CompactDropdownSubMenu(
    text: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    leadingIcon: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val triggerSource = remember { MutableInteractionSource() }
    val popupSource = remember { MutableInteractionSource() }
    val overTrigger by triggerSource.collectIsHoveredAsState()
    val overPopup by popupSource.collectIsHoveredAsState()
    val siblings = LocalSubMenuScope.current
    val id = remember { Any() }
    LaunchedEffect(overTrigger, overPopup) {
        if (overTrigger || overPopup) {
            siblings?.active = id
            if (overTrigger) onExpandedChange(true)
        } else {
            delay(SUBMENU_CLOSE_MS)
            onExpandedChange(false)
        }
    }
    LaunchedEffect(siblings?.active) {
        if (siblings != null && siblings.active !== id && expanded) onExpandedChange(false)
    }
    Box(modifier = Modifier.hoverable(triggerSource)) {
        CompactDropdownItem(
            text = text,
            leadingIcon = leadingIcon,
            trailing = {
                Icon(
                    Lucide.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
            },
            onClick = {
                siblings?.active = id
                onExpandedChange(!expanded)
            },
        )
        SubMenuPopup(
            expanded = expanded,
            onDismiss = { onExpandedChange(false) },
            modifier = Modifier.hoverable(popupSource),
            content = content,
        )
    }
}

@Composable
fun SelectField(
    label: String,
    selected: String,
    options: List<Pair<String, String>> = emptyList(),
    enabled: Boolean = true,
    shown: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
    onSelect: (String) -> Unit = {},
) {
    var open by remember { mutableStateOf(false) }
    var fieldWidth by remember { mutableStateOf(0.dp) }
    val density = LocalDensity.current
    val display = shown ?: options.firstOrNull { it.first == selected }?.second ?: selected
    val shape = RoundedCornerShape(Radius.md)
    Column {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(6.dp))
        Box {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .onSizeChanged { fieldWidth = with(density) { it.width.toDp() } }
                    .clip(shape)
                    .border(snapDp(2.dp), if (open) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant, shape)
                    .clickable(enabled = enabled) { if (onClick != null) onClick() else open = true }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(display, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (trailing != null) {
                    Spacer(Modifier.width(8.dp))
                    trailing()
                }
                if (enabled) {
                    Spacer(Modifier.width(8.dp))
                    Icon(Lucide.ChevronDown, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
                }
            }
            if (open) DropdownScrim { open = false }
            if (open) Dismissable { open = false }
            AppDropdownMenu(
                expanded = open,
                onDismissRequest = { open = false },
                minWidth = fieldWidth,
                properties = PopupProperties(focusable = !LocalIsTouch.current),
            ) {
                options.forEach { (value, text) ->
                    CompactDropdownItem(text = text, selected = value == selected, onClick = { onSelect(value); open = false })
                }
            }
        }
    }
}
