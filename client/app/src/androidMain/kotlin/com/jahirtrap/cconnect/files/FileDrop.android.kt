package com.jahirtrap.cconnect.files

import android.content.ClipDescription
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.toAndroidDragEvent

actual fun dropHasFiles(event: DragAndDropEvent): Boolean =
    event.toAndroidDragEvent().clipDescription?.hasMimeType(ClipDescription.MIMETYPE_TEXT_URILIST) == true

actual fun filesFromDrop(event: DragAndDropEvent): List<AttachmentFile> {
    val clip = event.toAndroidDragEvent().clipData ?: return emptyList()
    val result = ArrayList<AttachmentFile>()
    for (i in 0 until clip.itemCount) {
        clip.getItemAt(i)?.uri?.let { result.add(AttachmentFile(it)) }
    }
    return result
}
