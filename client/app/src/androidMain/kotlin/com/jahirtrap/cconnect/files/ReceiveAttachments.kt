package com.jahirtrap.cconnect.files

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.content.ReceiveContentListener
import androidx.compose.foundation.content.TransferableContent
import androidx.compose.foundation.content.consume
import androidx.compose.foundation.content.contentReceiver
import androidx.compose.ui.Modifier

@OptIn(ExperimentalFoundationApi::class)
actual fun Modifier.receiveAttachments(onFiles: (List<AttachmentFile>) -> Unit): Modifier = contentReceiver(
    object : ReceiveContentListener {
        override fun onReceive(transferableContent: TransferableContent): TransferableContent? {
            // Anything the system can point at with a URI is an attachment; plain text stays in the field.
            val files = mutableListOf<AttachmentFile>()
            val rest = transferableContent.consume { item ->
                val uri = item.uri
                if (uri == null) false else { files += AttachmentFile(uri); true }
            }
            if (files.isNotEmpty()) onFiles(files)
            return rest
        }
    },
)
