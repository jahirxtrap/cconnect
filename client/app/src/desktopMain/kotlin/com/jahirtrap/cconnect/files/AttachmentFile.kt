package com.jahirtrap.cconnect.files

import com.jahirtrap.cconnect.data.remote.AccountsApi
import com.jahirtrap.cconnect.data.remote.SharedApi
import com.jahirtrap.cconnect.data.remote.uploadBytes
import java.io.File

actual class AttachmentFile(val file: File) {
    actual val name: String get() = file.name
    actual val size: Long get() = file.length()
}

actual suspend fun uploadAttachment(
    file: AttachmentFile,
    path: String,
    onProgress: (Float) -> Unit,
): String? = uploadBytes(SharedApi.downloadUrl(path), "PUT", file.size, { file.file.inputStream() }, onProgress)
    ?.let(SharedApi::savedPath)

actual suspend fun uploadAccountBundle(file: AttachmentFile, label: String): Boolean =
    uploadBytes(AccountsApi.importUrl(label), "POST", file.size, { file.file.inputStream() }) {} != null
