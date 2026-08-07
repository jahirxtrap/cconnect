@file:OptIn(kotlin.uuid.ExperimentalUuidApi::class)

package com.jahirtrap.cconnect.terminal

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import com.jahirtrap.cconnect.ui.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import com.jahirtrap.cconnect.ui.Button
import com.jahirtrap.cconnect.ui.ButtonVariant
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.CirclePlus
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Pencil
import com.composables.icons.lucide.Trash
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.data.SshProfile
import com.jahirtrap.cconnect.data.SshStore
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.BackInterceptor
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.EmptyState
import com.jahirtrap.cconnect.ui.InputField
import com.jahirtrap.cconnect.ui.ListRow
import com.jahirtrap.cconnect.ui.SecretTextField
import com.jahirtrap.cconnect.ui.TooltipIconButton
import kotlin.uuid.Uuid

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TerminalScreen(onClose: () -> Unit) {
    val store = remember { SshStore() }
    var profiles by remember { mutableStateOf(store.profiles) }
    var active by remember { mutableStateOf<SshProfile?>(null) }
    var editing by remember { mutableStateOf<SshProfile?>(null) }
    var adding by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<SshProfile?>(null) }

    if (active != null) {
        BackInterceptor { active = null; true }
        TerminalSession(
            profile = active!!,
            onClose = { active = null },
            onOsDetected = { detected ->
                val current = active ?: return@TerminalSession
                if (current.os != detected) {
                    val updated = current.copy(os = detected)
                    store.upsert(updated)
                    profiles = store.profiles
                    active = updated
                }
            },
        )
        return
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(Res.string.ssh_hosts),
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    TooltipIconButton(label = stringResource(Res.string.add_ssh_host), onClick = { adding = true }) {
                        Icon(Lucide.CirclePlus, contentDescription = null)
                    }
                },
            )
        },
    ) { pad ->
        Column(modifier = Modifier.fillMaxSize().padding(pad)) {
            if (profiles.isEmpty()) {
                EmptyState(stringResource(Res.string.no_hosts), Modifier.fillMaxSize())
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(profiles, key = { it.id }) { p ->
                        ListRow(
                            icon = iconForOs(p.os),
                            iconTint = colorForOs(p.os) ?: MaterialTheme.colorScheme.primary,
                            title = p.name.ifBlank { p.host },
                            subtitle = p.address,
                            onClick = { active = p },
                            trailing = {
                                IconButton(onClick = { editing = p }, modifier = Modifier.size(40.dp)) { Icon(Lucide.Pencil, contentDescription = null, modifier = Modifier.size(22.dp)) }
                                IconButton(onClick = { deleting = p }, modifier = Modifier.size(40.dp)) { Icon(Lucide.Trash, contentDescription = stringResource(Res.string.delete), modifier = Modifier.size(22.dp)) }
                            },
                        )
                    }
                }
            }
        }
    }

    if (adding) {
        SshEditDialog(
            initial = null,
            onConfirm = { p -> store.upsert(p); profiles = store.profiles; adding = false },
            onDismiss = { adding = false },
        )
    }
    editing?.let { p ->
        SshEditDialog(
            initial = p,
            onConfirm = { saved -> store.upsert(saved); profiles = store.profiles; editing = null },
            onDismiss = { editing = null },
        )
    }
    deleting?.let { p ->
        ConfirmDialog(
            title = stringResource(Res.string.delete),
            text = stringResource(Res.string.delete_ssh_host_confirm, p.name.ifBlank { p.host }),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = { store.delete(p.id); profiles = store.profiles; deleting = null },
            onDismiss = { deleting = null },
        )
    }
}

@Composable
private fun SshEditDialog(
    initial: SshProfile?,
    onConfirm: (SshProfile) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var host by remember { mutableStateOf(initial?.host ?: "") }
    var port by remember { mutableStateOf((initial?.port ?: 22).toString()) }
    var user by remember { mutableStateOf(initial?.user ?: "") }
    var password by remember { mutableStateOf(initial?.password ?: "") }

    CompactDialog(
        onDismiss = onDismiss,
        title = stringResource(if (initial == null) Res.string.add_ssh_host else Res.string.edit_ssh_host),
        buttons = {
            Button(onClick = onDismiss, variant = ButtonVariant.Outlined) { Text(stringResource(Res.string.cancel)) }
            Button(
                onClick = {
                    onConfirm(
                        SshProfile(
                            id = initial?.id ?: Uuid.random().toString(),
                            name = name.trim().ifBlank { host.trim() },
                            host = host.trim(),
                            port = port.trim().toIntOrNull() ?: 22,
                            user = user.trim(),
                            password = password,
                        )
                    )
                },
                enabled = host.isNotBlank() && user.isNotBlank(),
            ) { Text(stringResource(Res.string.save)) }
        },
    ) {
        InputField(value = name, onValueChange = { name = it }, label = { Text(stringResource(Res.string.ssh_name)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Box(Modifier.height(8.dp))
        InputField(value = host, onValueChange = { host = it }, label = { Text(stringResource(Res.string.host)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Box(Modifier.height(8.dp))
        InputField(value = port, onValueChange = { port = it.filter(Char::isDigit) }, label = { Text(stringResource(Res.string.port)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
        Box(Modifier.height(8.dp))
        InputField(value = user, onValueChange = { user = it }, label = { Text(stringResource(Res.string.ssh_user)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Box(Modifier.height(8.dp))
        SecretTextField(
            value = password,
            onValueChange = { password = it },
            label = stringResource(Res.string.ssh_password),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
