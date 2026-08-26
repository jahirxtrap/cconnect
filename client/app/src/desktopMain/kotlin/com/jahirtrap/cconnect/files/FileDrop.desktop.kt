package com.jahirtrap.cconnect.files

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragData
import androidx.compose.ui.draganddrop.dragData
import java.io.File
import java.net.URI

@OptIn(ExperimentalComposeUiApi::class)
actual fun dropHasFiles(event: DragAndDropEvent): Boolean = event.dragData() is DragData.FilesList

@OptIn(ExperimentalComposeUiApi::class)
actual fun filesFromDrop(event: DragAndDropEvent): List<AttachmentFile> {
    val data = event.dragData()
    if (data !is DragData.FilesList) return emptyList()
    return data.readFiles().mapNotNull { uri ->
        runCatching { File(URI(uri)) }.getOrNull()?.takeIf { it.isFile }?.let { AttachmentFile(it) }
    }
}
