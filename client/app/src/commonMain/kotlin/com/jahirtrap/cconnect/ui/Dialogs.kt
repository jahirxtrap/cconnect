package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialogDefaults
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import com.jahirtrap.cconnect.ui.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.vector.ImageVector
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.composables.icons.lucide.Download
import com.composables.icons.lucide.Eye
import com.composables.icons.lucide.FolderArchive
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Save
import com.composables.icons.lucide.Share2
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.data.EnvironmentProfile
import com.jahirtrap.cconnect.ui.theme.sessionColorOf

// Compact replacement for Material3 AlertDialog, whose built-in paddings look too airy.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompactDialog(
    onDismiss: () -> Unit,
    title: String,
    buttons: @Composable RowScope.() -> Unit,
    contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp),
    titleTrailing: (@Composable RowScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dismissable(onDismiss = onDismiss)
    BasicAlertDialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier.widthIn(min = 280.dp),
            shape = MaterialTheme.shapes.large,
            color = AlertDialogDefaults.containerColor,
            tonalElevation = AlertDialogDefaults.TonalElevation,
        ) {
            Column(modifier = Modifier.heightIn(max = 640.dp).padding(vertical = 14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = if (titleTrailing != null) 8.dp else 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        title,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, fontSize = 20.sp),
                        modifier = Modifier.weight(1f),
                    )
                    if (titleTrailing != null) titleTrailing()
                }
                Spacer(Modifier.height(12.dp))
                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState())
                        .padding(contentPadding),
                    content = content,
                )
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.End,
                    content = buttons,
                )
            }
        }
    }
}

@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        buttons = {
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) }
            TextButton(onClick = onConfirm) { Text(confirmLabel) }
        },
    ) {
        Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun RenameDialog(
    initial: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    title: String = stringResource(Res.string.rename),
    confirmLabel: String = stringResource(Res.string.save),
    suffix: String? = null,
    errorOf: ((String) -> String?)? = null,
    secret: Boolean = false,
) {
    var text by remember { mutableStateOf(initial) }
    val error = if (text.isNotBlank()) errorOf?.invoke(text) else null
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }
    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        buttons = {
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) }
            TextButton(onClick = { onConfirm(text) }, enabled = text.isNotBlank() && error == null) {
                Text(confirmLabel)
            }
        },
    ) {
        InputField(
            value = text,
            onValueChange = { text = it },
            maxLines = if (secret) 1 else 2,
            singleLine = secret,
            visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
            modifier = Modifier.fillMaxWidth(),
            focusRequester = focusRequester,
            trailingIcon = suffix?.let {
                { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            },
        )
        if (error != null) {
            Spacer(Modifier.height(6.dp))
            Text(error, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ColorDialog(
    colors: List<String>,
    selected: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
    columns: Int = 5,
) {
    var picked by remember { mutableStateOf(selected) }
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.conversation_color),
        buttons = {
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) }
            TextButton(onClick = { onSelect(picked); onDismiss() }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            maxItemsInEachRow = columns,
        ) {
            ColorSwatch(color = null, selected = picked == null, onClick = { picked = null }, icon = Lucide.X)
            colors.forEach { name ->
                sessionColorOf(name)?.let { c ->
                    ColorSwatch(color = c, selected = picked == name, onClick = { picked = name })
                }
            }
            val remainder = (1 + colors.count { sessionColorOf(it) != null }) % columns
            if (remainder != 0) repeat(columns - remainder) { Spacer(Modifier.size(40.dp)) }
        }
    }
}

@Composable
fun SelectDialog(
    title: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        contentPadding = PaddingValues(0.dp),
        buttons = { TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) } },
    ) {
        options.forEach { (value, label) ->
            DialogSelectItem(label = label, selected = value == selected, onClick = { onSelect(value); onDismiss() })
        }
    }
}

@Composable
fun ConfirmSelectDialog(
    title: String,
    options: List<Pair<String, String>>,
    selected: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var choice by remember { mutableStateOf(selected) }
    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        contentPadding = PaddingValues(0.dp),
        buttons = {
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) }
            TextButton(onClick = { onConfirm(choice) }) { Text(stringResource(Res.string.save)) }
        },
    ) {
        options.forEach { (value, label) ->
            DialogSelectItem(label = label, selected = value == choice, onClick = { choice = value })
        }
    }
}

@Composable
fun EnvironmentSelectDialog(
    environments: List<EnvironmentProfile>,
    activeId: String?,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.environment),
        contentPadding = PaddingValues(0.dp),
        buttons = { TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) } },
    ) {
        environments.forEach { c ->
            DialogSelectItem(
                label = c.name,
                subtitle = c.address,
                selected = c.id == activeId,
                onClick = { onSelect(c.id); onDismiss() },
            )
        }
    }
}

@Composable
fun SharedLinkActionsDialog(
    filename: String,
    onSave: () -> Unit,
    onSaveAs: () -> Unit,
    onShare: () -> Unit,
    onDismiss: () -> Unit,
    onView: (() -> Unit)? = null,
    onOpenInFiles: (() -> Unit)? = null,
) {
    CompactDialog(
        onDismiss = onDismiss,
        title = filename,
        contentPadding = PaddingValues(0.dp),
        buttons = { TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) } },
    ) {
        if (onView != null) DialogActionItem(stringResource(Res.string.view), Lucide.Eye) { onDismiss(); onView() }
        if (onOpenInFiles != null) DialogActionItem(stringResource(Res.string.open_in_files), Lucide.FolderArchive) { onDismiss(); onOpenInFiles() }
        DialogActionItem(stringResource(Res.string.save), Lucide.Download) { onDismiss(); onSave() }
        DialogActionItem(stringResource(Res.string.save_as), Lucide.Save) { onDismiss(); onSaveAs() }
        DialogActionItem(stringResource(Res.string.share), Lucide.Share2) { onDismiss(); onShare() }
    }
}

@Composable
fun DialogActionItem(
    text: String,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick)
            .alpha(if (enabled) 1f else 0.38f)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(14.dp))
        }
        Text(text)
    }
}

@Composable
fun SelectionDot(selected: Boolean, modifier: Modifier = Modifier) {
    val ring = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
    val dotScale by animateFloatAsState(if (selected) 1f else 0f, label = "select-dot")
    Box(
        modifier = modifier.size(20.dp).clip(CircleShape).border(2.dp, ring, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(10.dp).scale(dotScale).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
    }
}

@Composable
fun DialogSelectItem(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    subtitle: String? = null,
    enabled: Boolean = true,
    labelFontFamily: FontFamily? = null,
    trailing: @Composable (RowScope.() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .clip(RoundedCornerShape(20.dp))
            .then(if (selected) Modifier.background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)) else Modifier)
            .clickable(enabled = enabled, onClick = onClick)
            .alpha(if (enabled) 1f else 0.38f)
            .padding(start = 12.dp, end = if (trailing != null) 4.dp else 12.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SelectionDot(selected)
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                label,
                style = MaterialTheme.typography.labelLarge,
                fontFamily = labelFontFamily,
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (subtitle != null) Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (trailing != null) trailing()
    }
}
