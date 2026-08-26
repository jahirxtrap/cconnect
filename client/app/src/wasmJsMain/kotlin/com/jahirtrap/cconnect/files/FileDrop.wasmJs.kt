package com.jahirtrap.cconnect.files

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.domDataTransferOrNull

@OptIn(ExperimentalComposeUiApi::class)
actual fun dropHasFiles(event: DragAndDropEvent): Boolean {
    val types = event.transferData?.domDataTransferOrNull?.types ?: return false
    var i = 0
    while (i < types.length) {
        if (types[i].toString() == "Files") return true
        i++
    }
    return false
}

@OptIn(ExperimentalComposeUiApi::class)
actual fun filesFromDrop(event: DragAndDropEvent): List<AttachmentFile> {
    val files = event.transferData?.domDataTransferOrNull?.files ?: return emptyList()
    val result = ArrayList<AttachmentFile>()
    var i = 0
    while (i < files.length) {
        val file = files.item(i)
        if (file != null) result.add(AttachmentFile(file))
        i++
    }
    return result
}
