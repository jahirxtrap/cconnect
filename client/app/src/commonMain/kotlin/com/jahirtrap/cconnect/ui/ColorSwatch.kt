package com.jahirtrap.cconnect.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import com.jahirtrap.cconnect.ui.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Lucide

private val SwatchSize = 40.dp

@Composable
fun ColorSwatch(
    color: Color?,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    val fg = if (color == null) MaterialTheme.colorScheme.onSurfaceVariant else Color.White
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    Box(
        modifier = modifier
            .size(SwatchSize)
            .clip(CircleShape)
            .background(color ?: MaterialTheme.colorScheme.surfaceVariant)
            .border(
                if (selected) 2.dp else 1.dp,
                if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.outlineVariant,
                CircleShape,
            )
            .then(if (hovered) Modifier.border(2.dp, Color.White, CircleShape) else Modifier)
            .hoverable(interaction)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        when {
            selected -> Icon(Lucide.Check, contentDescription = null, tint = fg, modifier = Modifier.size(20.dp))
            icon != null -> Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SwatchGrid(
    count: Int,
    modifier: Modifier = Modifier,
    columns: Int = 5,
    swatch: @Composable (Int) -> Unit,
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(12.dp),
        maxItemsInEachRow = columns,
    ) {
        repeat(count) { swatch(it) }
        val remainder = count % columns
        if (remainder != 0) repeat(columns - remainder) { Spacer(Modifier.size(SwatchSize)) }
    }
}
