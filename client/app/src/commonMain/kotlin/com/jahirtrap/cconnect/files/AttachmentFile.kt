package com.jahirtrap.cconnect.files

expect class AttachmentFile {
    val name: String
    val size: Long
}

expect suspend fun uploadAttachment(
    file: AttachmentFile,
    path: String,
    onProgress: (Float) -> Unit,
): String?

expect suspend fun uploadAccountBundle(file: AttachmentFile, label: String): Boolean
