package com.jahirtrap.cconnect.files

import androidx.compose.ui.Modifier

actual fun Modifier.receiveAttachments(onFiles: (List<AttachmentFile>) -> Unit): Modifier = this
