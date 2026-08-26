package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.CornerLeftUp
import com.composables.icons.lucide.File
import com.composables.icons.lucide.Folder
import com.composables.icons.lucide.HardDrive
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Monitor
import com.jahirtrap.cconnect.data.remote.SystemApi
import com.jahirtrap.cconnect.isAndroidPlatform
import com.jahirtrap.cconnect.isWebPlatform
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.cancel
import com.jahirtrap.cconnect.resources.choose
import com.jahirtrap.cconnect.resources.browse
import com.jahirtrap.cconnect.ui.theme.Radius
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource

/** Walks the PC's folders through the backend, for the targets with no native file dialog. */
@Composable
fun PathPickerDialog(
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    files: Boolean = false,
    start: String = "",
) {
    var listing by remember { mutableStateOf<SystemApi.DirListing?>(null) }
    var browsing by remember { mutableStateOf(start) }
    var picked by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(browsing) {
        listing = SystemApi.dirs(browsing, files)
        picked = null
    }
    val target = if (files) picked else listing?.path
    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(Res.string.choose),
        description = listing?.path,
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(onClick = { target?.let(onConfirm) }, enabled = target != null) {
                Text(stringResource(Res.string.choose))
            }
        },
        titleTrailing = {
            // These paths belong to the machine running the backend, which is why the browsing
            // happens there. When the backend is this same machine, the OS dialog is nicer.
            if (!isWebPlatform && !isAndroidPlatform) {
                TooltipIconButton(
                    label = stringResource(Res.string.browse),
                    onClick = {
                        scope.launch(Dispatchers.Default) {
                            (pickPath(files) as? PathChoice.Chosen)?.let { onConfirm(it.path) }
                        }
                    },
                    size = 32.dp,
                ) { Icon(Lucide.Monitor, contentDescription = null, modifier = Modifier.size(18.dp)) }
            }
        },
    ) {
        LazyColumn(modifier = Modifier.fillMaxWidth().height(320.dp)) {
            listing?.parent?.let { parent ->
                item(key = "up") { PathRow("..", Lucide.CornerLeftUp, false) { browsing = parent } }
            }
            items(listing?.roots.orEmpty(), key = { "root-$it" }) { root ->
                PathRow(root, Lucide.HardDrive, false) { browsing = root }
            }
            items(listing?.entries.orEmpty(), key = { it.path }) { entry ->
                PathRow(
                    text = entry.name,
                    icon = if (entry.isDir) Lucide.Folder else Lucide.File,
                    selected = picked == entry.path,
                ) {
                    if (entry.isDir) browsing = entry.path else picked = entry.path
                }
            }
        }
    }
}

@Composable
private fun PathRow(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.item))
            .then(if (selected) Modifier.background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)) else Modifier)
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (icon == Lucide.Folder) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
