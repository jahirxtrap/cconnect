package com.jahirtrap.cconnect.ui

import androidx.compose.ui.graphics.vector.ImageVector
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.CircleQuestionMark
import com.composables.icons.lucide.Clock
import com.composables.icons.lucide.Download
import com.composables.icons.lucide.ExternalLink
import com.composables.icons.lucide.File
import com.composables.icons.lucide.Folder
import com.composables.icons.lucide.Info
import com.composables.icons.lucide.Lightbulb
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.MessageSquare
import com.composables.icons.lucide.Pencil
import com.composables.icons.lucide.Plus
import com.composables.icons.lucide.RefreshCw
import com.composables.icons.lucide.Search
import com.composables.icons.lucide.Settings
import com.composables.icons.lucide.Shield
import com.composables.icons.lucide.Sparkles
import com.composables.icons.lucide.Trash2
import com.composables.icons.lucide.TriangleAlert
import com.composables.icons.lucide.X

fun componentIcon(name: String?): ImageVector? = when (name) {
    "question" -> Lucide.CircleQuestionMark
    "clock" -> Lucide.Clock
    "sparkles" -> Lucide.Sparkles
    "message-square" -> Lucide.MessageSquare
    "check" -> Lucide.Check
    "x" -> Lucide.X
    "plus" -> Lucide.Plus
    "pencil" -> Lucide.Pencil
    "trash" -> Lucide.Trash2
    "download" -> Lucide.Download
    "external-link" -> Lucide.ExternalLink
    "refresh" -> Lucide.RefreshCw
    "search" -> Lucide.Search
    "settings" -> Lucide.Settings
    "info" -> Lucide.Info
    "alert" -> Lucide.TriangleAlert
    "lightbulb" -> Lucide.Lightbulb
    "shield" -> Lucide.Shield
    "file" -> Lucide.File
    "folder" -> Lucide.Folder
    else -> null
}
