package com.jahirtrap.cconnect.files

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

actual suspend fun pickFiles(): List<AttachmentFile> =
    withContext(Dispatchers.Default) { FileDialogs.openMultiple().map { AttachmentFile(it) } }