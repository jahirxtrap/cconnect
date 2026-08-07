package com.jahirtrap.cconnect.claude

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.CircleUser
import com.composables.icons.lucide.Lucide
import com.jahirtrap.cconnect.data.remote.AccountsApi
import com.jahirtrap.cconnect.data.remote.SettingsApi
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.settings.PreferenceRow
import com.jahirtrap.cconnect.settings.SettingsGroup
import com.jahirtrap.cconnect.ui.ActionButton
import com.jahirtrap.cconnect.ui.CompactDialog
import com.jahirtrap.cconnect.ui.ConfirmDialog
import com.jahirtrap.cconnect.ui.InputField
import com.jahirtrap.cconnect.ui.RenameDialog
import com.jahirtrap.cconnect.ui.StatusDot
import com.jahirtrap.cconnect.ui.Button
import com.jahirtrap.cconnect.ui.ButtonVariant
import com.jahirtrap.cconnect.ui.theme.palette
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun AccountsSection(enabled: Boolean, onChanged: () -> Unit) {
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val uriHandler = LocalUriHandler.current
    var snapshot by remember { mutableStateOf<AccountsApi.Snapshot?>(null) }
    var reload by remember { mutableStateOf(0) }
    var adding by remember { mutableStateOf(false) }
    var actions by remember { mutableStateOf<AccountsApi.Account?>(null) }
    var renaming by remember { mutableStateOf<AccountsApi.Account?>(null) }
    var deleting by remember { mutableStateOf<AccountsApi.Account?>(null) }
    var busy by remember { mutableStateOf<String?>(null) }
    var login by remember { mutableStateOf<Pair<String, String>?>(null) }
    var loginError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(reload, enabled) {
        if (enabled) snapshot = runCatching { AccountsApi.list() }.getOrNull()
    }

    fun refresh() {
        reload++
        onChanged()
    }

    fun beginLogin(account: AccountsApi.Account) {
        busy = account.id
        loginError = null
        scope.launch {
            val url = runCatching { AccountsApi.startLogin(account.id) }.getOrNull()
            busy = null
            if (url == null) loginError = account.id else login = account.id to url
        }
    }

    val accounts = snapshot?.accounts.orEmpty()
    val defaultId = snapshot?.default
    val defaultLabel = stringResource(Res.string.account_is_default)
    val pendingLabel = stringResource(Res.string.account_pending)
    val connectedLabel = stringResource(Res.string.account_connected)

    SettingsGroup(stringResource(Res.string.accounts)) {
        accounts.forEach { account ->
            PreferenceRow(
                icon = Lucide.CircleUser,
                title = account.label,
                summary = when {
                    !account.loggedIn -> pendingLabel
                    account.id == defaultId -> defaultLabel
                    else -> connectedLabel
                },
                alert = stringResource(Res.string.account_login_failed).takeIf { loginError == account.id },
                enabled = enabled,
                trailing = {
                    if (busy == account.id) LoadingIndicator(modifier = Modifier.size(20.dp))
                    else StatusDot(
                        color = if (account.loggedIn) palette.green else palette.orange,
                        box = 20.dp,
                        dot = 12.dp,
                    )
                },
                onClick = if (enabled) ({ actions = account }) else null,
            )
        }
        ActionButton(
            text = stringResource(Res.string.account_add),
            enabled = enabled,
            onClick = { adding = true },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }

    actions?.let { account ->
        CompactDialog(
            onDismiss = { actions = null },
            title = account.label,
            buttons = {
                Button(onClick = { actions = null }, variant = ButtonVariant.Outlined) {
                    Text(stringResource(Res.string.close))
                }
            },
        ) {
            if (!account.loggedIn) {
                ActionButton(
                    text = stringResource(Res.string.account_login),
                    onClick = { actions = null; beginLogin(account) },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
            }
            if (account.loggedIn && account.id != defaultId) {
                ActionButton(
                    text = stringResource(Res.string.account_set_default),
                    onClick = {
                        actions = null
                        scope.launch {
                            runCatching { SettingsApi.update(account = account.id) }
                            refresh()
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
            }
            ActionButton(
                text = stringResource(Res.string.rename),
                onClick = { actions = null; renaming = account },
                modifier = Modifier.fillMaxWidth(),
            )
            if (!account.primary) {
                Spacer(Modifier.height(6.dp))
                ActionButton(
                    text = stringResource(Res.string.account_sync_mcp),
                    onClick = {
                        actions = null
                        scope.launch { runCatching { AccountsApi.syncMcp(account.id) } }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                ActionButton(
                    text = stringResource(Res.string.delete),
                    onClick = { actions = null; deleting = account },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }

    if (adding) {
        RenameDialog(
            initial = "",
            title = stringResource(Res.string.account_add),
            confirmLabel = stringResource(Res.string.account_add),
            onConfirm = { label ->
                adding = false
                scope.launch {
                    runCatching { AccountsApi.create(label) }
                    refresh()
                }
            },
            onDismiss = { adding = false },
        )
    }

    renaming?.let { account ->
        RenameDialog(
            initial = account.label,
            title = stringResource(Res.string.account_name),
            onConfirm = { label ->
                renaming = null
                scope.launch {
                    runCatching { AccountsApi.rename(account.id, label) }
                    refresh()
                }
            },
            onDismiss = { renaming = null },
        )
    }

    deleting?.let { account ->
        ConfirmDialog(
            title = account.label,
            text = stringResource(Res.string.delete),
            confirmLabel = stringResource(Res.string.delete),
            onConfirm = {
                deleting = null
                scope.launch {
                    runCatching { AccountsApi.delete(account.id) }
                    refresh()
                }
            },
            onDismiss = { deleting = null },
        )
    }

    login?.let { (accountId, url) ->
        var code by remember(accountId) { mutableStateOf("") }
        CompactDialog(
            onDismiss = {
                login = null
                scope.launch { runCatching { AccountsApi.cancelLogin(accountId) } }
            },
            title = stringResource(Res.string.account_login),
            buttons = {
                Button(variant = ButtonVariant.Outlined, onClick = {
                    login = null
                    scope.launch { runCatching { AccountsApi.cancelLogin(accountId) } }
                }) { Text(stringResource(Res.string.cancel)) }
                Button(
                    enabled = code.isNotBlank(),
                    onClick = {
                        val entered = code
                        login = null
                        busy = accountId
                        scope.launch {
                            val ok = runCatching { AccountsApi.submitCode(accountId, entered) }.getOrDefault(false)
                            busy = null
                            loginError = if (ok) null else accountId
                            refresh()
                        }
                    },
                ) { Text(stringResource(Res.string.account_login)) }
            },
        ) {
            Text(stringResource(Res.string.account_login_hint), style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(12.dp))
            Text(
                url,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.primary,
                maxLines = 3,
            )
            Spacer(Modifier.height(8.dp))
            ActionButton(
                text = stringResource(Res.string.account_copy_link),
                onClick = { clipboard.setText(AnnotatedString(url)) },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            ActionButton(
                text = stringResource(Res.string.`open`),
                onClick = { runCatching { uriHandler.openUri(url) } },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            InputField(
                value = code,
                onValueChange = { code = it },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(Res.string.account_code)) },
            )
        }
    }

}
