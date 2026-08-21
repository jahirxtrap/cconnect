package com.jahirtrap.cconnect.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Lucide
import com.jahirtrap.cconnect.ui.theme.Radius
import com.jahirtrap.cconnect.ui.theme.snapDp

@Composable
fun OptionRow(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    description: String? = null,
    selected: Boolean = false,
    multi: Boolean = false,
) {
    val accent = MaterialTheme.colorScheme.primary
    val markShape = if (multi) RoundedCornerShape(Radius.sm) else CircleShape
    val markScale by animateFloatAsState(if (selected) 1f else 0f, label = "option-mark")
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(markShape)
                .border(snapDp(2.dp), if (selected) accent else MaterialTheme.colorScheme.outline, markShape),
            contentAlignment = Alignment.Center,
        ) {
            if (multi) {
                Icon(Lucide.Check, contentDescription = null, tint = accent, modifier = Modifier.size(13.dp).scale(markScale))
            } else {
                Box(Modifier.size(10.dp).scale(markScale).clip(CircleShape).background(accent))
            }
        }
        Spacer(Modifier.size(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                label,
                style = MaterialTheme.typography.bodyMedium,
                color = if (selected) accent else MaterialTheme.colorScheme.onSurface,
            )
            if (!description.isNullOrBlank()) {
                Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
