package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jahirtrap.cconnect.data.formatDecimal
import com.jahirtrap.cconnect.ui.theme.palette

@Composable
fun MetricHeader(title: String, subtitle: String, percent: Float, showValue: Boolean = true) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
            if (title.isNotBlank()) Text(title, style = MaterialTheme.typography.bodyLarge)
            if (subtitle.isNotBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (showValue) {
            Spacer(Modifier.width(12.dp))
            Text(
                "${formatDecimal(percent.toDouble(), 1)}%",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
fun MetricBar(
    title: String,
    subtitle: String,
    percent: Float,
    modifier: Modifier = Modifier,
    color: Color? = null,
    showValue: Boolean = true,
) {
    val barColor = color ?: if (percent >= 90f) palette.red else MaterialTheme.colorScheme.primary
    val heading = title.isNotBlank() || subtitle.isNotBlank() || showValue
    Column(modifier = modifier.fillMaxWidth()) {
        if (heading) {
            MetricHeader(title, subtitle, percent, showValue)
            Spacer(Modifier.height(8.dp))
        }
        LinearProgressIndicator(
            progress = { (percent / 100f).coerceIn(0f, 1f) },
            color = barColor,
            trackColor = MaterialTheme.colorScheme.outlineVariant,
            gapSize = 0.dp,
            drawStopIndicator = {},
            modifier = Modifier.fillMaxWidth().height(4.dp),
        )
    }
}
