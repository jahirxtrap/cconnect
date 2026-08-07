package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Icon
import org.jetbrains.compose.resources.stringResource
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.X
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.close

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoticeCard(
    text: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    onDismiss: () -> Unit,
) {
    val isTouch = LocalIsTouch.current
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value != SwipeToDismissBoxValue.Settled) onDismiss()
            value != SwipeToDismissBoxValue.Settled
        },
    )
    SwipeToDismissBox(state = dismissState, backgroundContent = {}) {
        Surface(
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surfaceVariant,
            tonalElevation = 0.dp,
            shadowElevation = 4.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                modifier = Modifier.padding(start = 16.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f).padding(vertical = 8.dp),
                )
                if (actionLabel != null && onAction != null) {
                    Button(onClick = onAction, variant = ButtonVariant.Accent) { Text(actionLabel) }
                }
                if (!isTouch) {
                    TooltipIconButton(label = stringResource(Res.string.close), onClick = onDismiss) {
                        Icon(Lucide.X, contentDescription = null)
                    }
                }
            }
        }
    }
}
