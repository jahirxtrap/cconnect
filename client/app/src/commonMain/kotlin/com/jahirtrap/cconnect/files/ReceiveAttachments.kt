package com.jahirtrap.cconnect.files

import androidx.compose.ui.Modifier

expect fun Modifier.receiveAttachments(onFiles: (List<AttachmentFile>) -> Unit): Modifier
