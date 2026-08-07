package com.jahirtrap.cconnect.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.remember
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jahirtrap.cconnect.ui.clickable
import com.jahirtrap.cconnect.ui.theme.Radius
import com.jahirtrap.cconnect.ui.theme.palette

@Composable
fun SettingsGroup(
    label: String?,
    labelTrailing: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        if (label != null) {
            Row(
                modifier = Modifier.fillMaxWidth().height(36.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    label.uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    letterSpacing = 0.6.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                labelTrailing?.invoke()
            }
        } else {
            Spacer(Modifier.height(16.dp))
        }
        DividedColumn(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.group))
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(Radius.group))
                .background(MaterialTheme.colorScheme.surface),
            divider = MaterialTheme.colorScheme.outlineVariant,
            content = content,
        )
    }
}

@Composable
private fun DividedColumn(
    modifier: Modifier,
    divider: Color,
    content: @Composable () -> Unit,
) {
    val breaks = remember { mutableListOf<Int>() }
    val thickness = with(LocalDensity.current) { 1.dp.toPx() }
    Layout(
        content = content,
        modifier = modifier.drawWithContent {
            drawContent()
            breaks.forEach { y ->
                drawLine(divider, Offset(0f, y.toFloat()), Offset(size.width, y.toFloat()), thickness)
            }
        },
    ) { measurables, constraints ->
        val placeables = measurables.map { it.measure(constraints.copy(minHeight = 0)) }
        layout(constraints.maxWidth, placeables.sumOf { it.height }) {
            breaks.clear()
            var y = 0
            placeables.forEachIndexed { index, placeable ->
                if (index > 0) breaks.add(y)
                placeable.placeRelative(0, y)
                y += placeable.height
            }
        }
    }
}

@Composable
fun PreferenceRow(
    icon: ImageVector,
    title: String,
    summary: String?,
    trailing: (@Composable () -> Unit)? = null,
    enabled: Boolean = true,
    alert: String? = null,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val alpha = if (enabled) 1f else 0.38f
    Row(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha), modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (summary != null) {
                Text(summary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (alert != null) {
                Text(alert, style = MaterialTheme.typography.bodySmall, color = palette.red.copy(alpha = alpha))
            }
        }
        if (trailing != null) {
            Spacer(Modifier.width(12.dp))
            trailing()
        }
    }
}
