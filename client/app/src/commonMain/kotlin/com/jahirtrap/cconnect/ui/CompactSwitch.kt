package com.jahirtrap.cconnect.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

private val TrackWidth = 36.dp
private val TrackHeight = 20.dp
private val ThumbSize = 16.dp
private val ThumbInset = 2.dp

@Composable
fun CompactSwitch(checked: Boolean, enabled: Boolean = true, onCheckedChange: (Boolean) -> Unit) {
    val thumbOffset by animateDpAsState(if (checked) TrackWidth - ThumbSize - ThumbInset else ThumbInset)
    val trackColor by animateColorAsState(
        if (checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    )
    Box(
        modifier = Modifier
            .alpha(if (enabled) 1f else 0.4f)
            .requiredSize(width = TrackWidth, height = TrackHeight)
            .clip(CircleShape)
            .background(trackColor)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                enabled = enabled,
                role = Role.Switch,
            ) { onCheckedChange(!checked) },
        contentAlignment = Alignment.CenterStart,
    ) {
        Box(
            modifier = Modifier
                .offset(x = thumbOffset)
                .size(ThumbSize)
                .shadow(1.dp, CircleShape)
                .background(MaterialTheme.colorScheme.surface, CircleShape)
        )
    }
}
