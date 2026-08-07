package com.jahirtrap.cconnect.markdown

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Download
import com.composables.icons.lucide.EllipsisVertical
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Save
import com.composables.icons.lucide.Share2
import com.composables.icons.lucide.Type
import com.jahirtrap.cconnect.data.loadMarkdownScratch
import com.jahirtrap.cconnect.data.saveMarkdownScratch
import com.jahirtrap.cconnect.files.saveTextAs
import com.jahirtrap.cconnect.files.saveTextToDownloads
import com.jahirtrap.cconnect.files.shareText
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.*
import com.jahirtrap.cconnect.ui.AppDropdownMenu
import com.jahirtrap.cconnect.ui.AppTopBar
import com.jahirtrap.cconnect.ui.CompactDropdownItem
import com.jahirtrap.cconnect.ui.Dismissable
import com.jahirtrap.cconnect.ui.MarkdownText
import com.jahirtrap.cconnect.ui.TooltipIconButton
import com.jahirtrap.cconnect.ui.theme.LocalMonoFontFamily
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource

@Composable
fun MarkdownScreen(onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf(loadMarkdownScratch()) }
    var formatted by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    val filename = stringResource(Res.string.markdown_filename)

    val latestText = rememberUpdatedState(text)
    LaunchedEffect(text) {
        delay(400)
        saveMarkdownScratch(text)
    }
    DisposableEffect(Unit) {
        onDispose { saveMarkdownScratch(latestText.value) }
    }

    Dismissable { onClose() }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(Res.string.markdown),
                navigationIcon = {
                    TooltipIconButton(label = stringResource(Res.string.back), onClick = onClose) {
                        Icon(Lucide.ArrowLeft, contentDescription = null)
                    }
                },
                actions = {
                    TooltipIconButton(
                        label = stringResource(Res.string.formatted_view),
                        onClick = { formatted = !formatted },
                    ) {
                        Icon(
                            Lucide.Type, contentDescription = null,
                            tint = if (formatted) MaterialTheme.colorScheme.primary else LocalContentColor.current,
                        )
                    }
                    Box {
                        TooltipIconButton(label = stringResource(Res.string.files), onClick = { menu = true }) {
                            Icon(Lucide.EllipsisVertical, contentDescription = null)
                        }
                        AppDropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            CompactDropdownItem(
                                text = stringResource(Res.string.save),
                                leadingIcon = { Icon(Lucide.Download, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; scope.launch { saveTextToDownloads(filename, text) } },
                            )
                            CompactDropdownItem(
                                text = stringResource(Res.string.save_as),
                                leadingIcon = { Icon(Lucide.Save, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; scope.launch { saveTextAs(filename, text) } },
                            )
                            CompactDropdownItem(
                                text = stringResource(Res.string.share),
                                leadingIcon = { Icon(Lucide.Share2, contentDescription = null, modifier = Modifier.size(20.dp)) },
                                onClick = { menu = false; scope.launch { shareText(filename, text) } },
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        if (formatted) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            ) {
                MarkdownText(text, modifier = Modifier.fillMaxWidth())
            }
        } else {
            BasicTextField(
                value = text,
                onValueChange = { text = it },
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = LocalMonoFontFamily.current,
                    color = MaterialTheme.colorScheme.onSurface,
                ),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            )
        }
    }
}
