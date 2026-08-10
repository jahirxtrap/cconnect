package com.jahirtrap.cconnect.files

import com.jahirtrap.cconnect.data.remote.AccountsApi
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.SharedApi
import com.jahirtrap.cconnect.data.remote.UrlCodec
import kotlinx.coroutines.suspendCancellableCoroutine
import org.w3c.files.File
import org.w3c.xhr.XMLHttpRequest
import kotlin.coroutines.resume

actual class AttachmentFile(val file: File) {
    actual val name: String get() = file.name
    actual val size: Long get() = file.size.toDouble().toLong()
}

actual suspend fun uploadAttachment(
    file: AttachmentFile,
    path: String,
    onProgress: (Float) -> Unit,
): String? {
    val body = send(file, uploadUrl(path), "PUT") ?: return null
    return SharedApi.savedPath(body)?.also { onProgress(1f) }
}

actual suspend fun uploadAccountBundle(file: AttachmentFile, label: String): Boolean =
    send(file, AccountsApi.importUrl(label), "POST") != null

private suspend fun send(file: AttachmentFile, url: String, method: String): String? =
    suspendCancellableCoroutine { cont ->
        val xhr = XMLHttpRequest()
        xhr.open(method, url)
        Backend.authHeaders.forEach { (name, value) -> xhr.setRequestHeader(name, value) }
        xhr.onload = { _ -> cont.resume(if (xhr.status.toInt() in 200..299) xhr.responseText else null) }
        xhr.onerror = { _ -> cont.resume(null) }
        cont.invokeOnCancellation { runCatching { xhr.abort() } }
        xhr.send(file.file)
    }

private fun uploadUrl(path: String): String =
    "${Backend.baseUrl}/shared/" + path.split("/").filter { it.isNotEmpty() }.joinToString("/") { UrlCodec.encode(it) }
