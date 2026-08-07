package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Centered = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None,
)

@Composable
fun AppTopBar(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    subtitleLeading: (@Composable () -> Unit)? = null,
    fullWidth: Boolean = true,
    navigationIcon: (@Composable () -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val barSides = if (fullWidth) WindowInsetsSides.Horizontal + WindowInsetsSides.Top else WindowInsetsSides.End
    val line = MaterialTheme.colorScheme.outlineVariant
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .drawBehind {
                drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
            }
            .windowInsetsPadding(WindowInsets.systemBars.union(WindowInsets.displayCutout).only(barSides))
            .height(56.dp)
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        navigationIcon?.invoke()
        Column(modifier = Modifier.weight(1f).padding(start = if (navigationIcon != null) 2.dp else 12.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleLarge.copy(lineHeight = 22.sp, lineHeightStyle = Centered),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (subtitle != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (subtitleLeading != null) {
                        subtitleLeading()
                        Spacer(Modifier.width(4.dp))
                    }
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodySmall.copy(lineHeight = 14.sp, lineHeightStyle = Centered),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            actions()
        }
    }
}

@Composable
fun StatusDot(color: Color, modifier: Modifier = Modifier, box: Dp = 14.dp, dot: Dp = 8.dp) {
    Box(modifier = modifier.size(box), contentAlignment = Alignment.Center) {
        Box(Modifier.size(dot).clip(CircleShape).background(color))
    }
}
