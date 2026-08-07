package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.ui.theme.LocalMonoFontFamily
import com.jahirtrap.cconnect.ui.theme.Radius
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Copy
import com.composables.icons.lucide.Lucide
import kotlinx.coroutines.delay

@Composable
internal fun CodeBlock(code: String, bg: Color, lang: String) {
    val scroll = rememberScrollState()
    Surface(color = bg, shape = RoundedCornerShape(Radius.panel), modifier = Modifier.fillMaxWidth()) {
        Column {
            CodeBlockHeader(lang, code)
            Text(
                text = code.trimEnd('\n'),
                fontFamily = LocalMonoFontFamily.current,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier
                    .horizontalScrollbar(scroll)
                    .horizontalScroll(scroll)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun CodeBlockHeader(lang: String, code: String) {
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) {
            delay(1000)
            copied = false
        }
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 10.dp, end = 2.dp, top = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = lang.ifBlank { "code" },
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        IconButton(
            onClick = {
                clipboard.setText(AnnotatedString(code.trimEnd('\n')))
                copied = true
            },
            modifier = Modifier.size(28.dp),
        ) {
            Icon(
                imageVector = if (copied) Lucide.Check else Lucide.Copy,
                contentDescription = "Copy",
                tint = if (copied) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}
