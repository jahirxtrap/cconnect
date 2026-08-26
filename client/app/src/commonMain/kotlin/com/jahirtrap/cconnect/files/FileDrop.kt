package com.jahirtrap.cconnect.files

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import com.jahirtrap.cconnect.bringAppToFront

expect fun filesFromDrop(event: DragAndDropEvent): List<AttachmentFile>

expect fun dropHasFiles(event: DragAndDropEvent): Boolean

@Composable
fun Modifier.fileDropTarget(
    enabled: Boolean = true,
    onDragChange: (Boolean) -> Unit = {},
    onFiles: (List<AttachmentFile>) -> Unit,
): Modifier {
    if (!enabled) return this
    val filesCb = rememberUpdatedState(onFiles)
    val dragCb = rememberUpdatedState(onDragChange)
    val target = remember {
        object : DragAndDropTarget {
            override fun onEntered(event: DragAndDropEvent) = dragCb.value(true)
            override fun onExited(event: DragAndDropEvent) = dragCb.value(false)
            override fun onEnded(event: DragAndDropEvent) = dragCb.value(false)
            override fun onDrop(event: DragAndDropEvent): Boolean {
                dragCb.value(false)
                val files = filesFromDrop(event)
                if (files.isEmpty()) return false
                bringAppToFront()
                filesCb.value(files)
                return true
            }
        }
    }
    return this.dragAndDropTarget(shouldStartDragAndDrop = ::dropHasFiles, target = target)
}
