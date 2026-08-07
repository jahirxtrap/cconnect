package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
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
import com.jahirtrap.cconnect.ui.theme.Radius
import com.jahirtrap.cconnect.ui.theme.sessionColorOf

// Compact replacement for Material3 AlertDialog, whose built-in paddings look too airy
// and whose 560dp cap keeps dialogs narrower than the design calls for.
@Composable
fun CompactDialog(
    onDismiss: () -> Unit,
    title: String,
    buttons: @Composable RowScope.() -> Unit,
    description: String? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp),
    titleTrailing: (@Composable RowScope.() -> Unit)? = null,
    header: (@Composable ColumnScope.() -> Unit)? = null,
    content: (@Composable ColumnScope.() -> Unit)? = null,
) {
    Dismissable(onDismiss = onDismiss)
    val windowWidth = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.width.toDp() }
    val available = (windowWidth - 32.dp).coerceAtLeast(0.dp)
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.widthIn(min = 384.dp.coerceAtMost(available), max = 672.dp.coerceAtMost(available)),
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 0.dp,
            shadowElevation = 16.dp,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
            Column(modifier = Modifier.heightIn(max = 640.dp).padding(vertical = 20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            title,
                            style = MaterialTheme.typography.titleLarge.copy(fontSize = 16.sp, lineHeight = 22.sp),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        if (description != null) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                description,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    if (titleTrailing != null) titleTrailing()
                }
                if (header != null) {
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp), content = header)
                }
                if (content != null) {
                    Spacer(Modifier.height(16.dp))
                    Column(
                        modifier = Modifier
                            .weight(1f, fill = false)
                            .verticalScroll(rememberScrollState())
                            .padding(contentPadding),
                        content = content,
                    )
                }
                Spacer(Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
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
        description = text,
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = onConfirm) { Text(confirmLabel) }
        },
    )
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
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(text) }, enabled = text.isNotBlank() && error == null) {
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

data class ColorOption(val value: String, val color: Color, val label: String)

@Composable
fun ColorDialog(
    title: String,
    options: List<ColorOption>,
    selected: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
    columns: Int = 5,
    applyOnSelect: Boolean = false,
) {
    var picked by remember { mutableStateOf(selected) }
    val choose: (String?) -> Unit = { value ->
        if (applyOnSelect) {
            onSelect(value)
            onDismiss()
        } else {
            picked = value
        }
    }
    CompactDialog(
        onDismiss = onDismiss,
        title = title,
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            if (!applyOnSelect) {
                Button(onClick = { onSelect(picked); onDismiss() }) { Text(stringResource(Res.string.save)) }
            }
        },
    ) {
        SwatchGrid(count = options.size + 1, columns = columns) { index ->
            if (index == 0) {
                ColorSwatch(color = null, selected = picked == null, onClick = { choose(null) }, icon = Lucide.X)
            } else {
                val option = options[index - 1]
                ColorSwatch(
                    color = option.color,
                    selected = picked == option.value,
                    onClick = { choose(option.value) },
                )
            }
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
        buttons = { Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) } },
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
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { onConfirm(choice) }) { Text(stringResource(Res.string.save)) }
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
        buttons = { Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) } },
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
        buttons = { Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) } },
    ) {
        if (onView != null) DialogActionItem(stringResource(Res.string.view), Lucide.Eye) { onDismiss(); onView() }
        if (onOpenInFiles != null) DialogActionItem(stringResource(Res.string.open_in_files), Lucide.FolderArchive) { onDismiss(); onOpenInFiles() }
        DialogActionItem(stringResource(Res.string.save), Lucide.Download) { onDismiss(); onSave() }
        DialogActionItem(stringResource(Res.string.save_as), Lucide.Save) { onDismiss(); onSaveAs() }
        DialogActionItem(stringResource(Res.string.share), Lucide.Share2) { onDismiss(); onShare() }
    }
}

val DialogItemShape = RoundedCornerShape(Radius.lg)
val DialogItemInset = 20.dp
val DialogItemPaddingH = 12.dp
val DialogItemPaddingV = 10.dp

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
            .padding(horizontal = DialogItemInset)
            .clip(DialogItemShape)
            .clickable(enabled = enabled, onClick = onClick)
            .alpha(if (enabled) 1f else 0.38f)
            .padding(horizontal = DialogItemPaddingH, vertical = DialogItemPaddingV),
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
            .padding(horizontal = DialogItemInset)
            .clip(DialogItemShape)
            .then(if (selected) Modifier.background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)) else Modifier)
            .clickable(enabled = enabled, onClick = onClick)
            .alpha(if (enabled) 1f else 0.38f)
            .padding(
                start = DialogItemPaddingH,
                end = if (trailing != null) 4.dp else DialogItemPaddingH,
                top = DialogItemPaddingV,
                bottom = DialogItemPaddingV,
            ),
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
