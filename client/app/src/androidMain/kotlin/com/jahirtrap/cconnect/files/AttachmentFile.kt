package com.jahirtrap.cconnect.files

import android.net.Uri
import android.provider.OpenableColumns
import com.jahirtrap.cconnect.appContext
import com.jahirtrap.cconnect.data.remote.AccountsApi
import com.jahirtrap.cconnect.data.remote.SharedApi
import com.jahirtrap.cconnect.data.remote.uploadBytes
import java.io.InputStream

actual class AttachmentFile(val uri: Uri) {

    private val metadata: Pair<String, Long> by lazy { metadataOf(uri) }

    actual val name: String get() = metadata.first
    actual val size: Long get() = metadata.second

    fun openStream(): InputStream? = appContext.contentResolver.openInputStream(uri)
}

private fun metadataOf(uri: Uri): Pair<String, Long> {
    val resolver = appContext.contentResolver
    return resolver.query(uri, null, null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
        val name = if (nameIdx >= 0) cursor.getString(nameIdx) else null
        val size = if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) cursor.getLong(sizeIdx) else -1L
        (name ?: uri.lastPathSegment ?: "file") to size
    } ?: ((uri.lastPathSegment ?: "file") to -1L)
}

actual suspend fun uploadAttachment(
    file: AttachmentFile,
    path: String,
    onProgress: (Float) -> Unit,
): String? = uploadBytes(SharedApi.downloadUrl(path), "PUT", file.size, { file.openStream() }, onProgress)
    ?.let(SharedApi::savedPath)

actual suspend fun uploadAccountBundle(file: AttachmentFile, label: String): Boolean =
    uploadBytes(AccountsApi.importUrl(label), "POST", file.size, { file.openStream() }) {} != null
