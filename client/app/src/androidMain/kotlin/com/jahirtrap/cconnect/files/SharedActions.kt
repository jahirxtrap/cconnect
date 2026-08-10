package com.jahirtrap.cconnect.files

import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import com.jahirtrap.cconnect.appContext
import com.jahirtrap.cconnect.data.remote.Backend
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.OutputStream

private val client = OkHttpClient()

actual suspend fun downloadShared(url: String, filename: String): Boolean = withContext(Dispatchers.IO) {
    enqueueToDownloads(url, filename)
}

var androidSaveAs: (suspend (filename: String) -> Uri?)? = null

actual suspend fun saveSharedAs(url: String, filename: String): Boolean {
    val uri = androidSaveAs?.invoke(filename) ?: return false
    return saveToUri(url, uri)
}

actual suspend fun openSharedExternally(url: String, filename: String): Boolean =
    openExternally(url, filename)

actual suspend fun openSharedInBrowser(url: String, filename: String): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val file = cacheCopy(url, filename) ?: return@withContext false
        val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
        val view = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeOf(filename))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        appContext.startActivity(view)
        true
    }.getOrDefault(false)
}

actual suspend fun saveAllShared(items: List<Pair<String, String>>): Boolean = withContext(Dispatchers.IO) {
    items.all { (url, filename) -> enqueueToDownloads(url, filename) }
}

actual suspend fun openAllSharedExternally(items: List<Pair<String, String>>): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val dir = File(appContext.cacheDir, "shared").apply { mkdirs() }
        val uris = ArrayList<Uri>()
        items.forEach { (url, filename) ->
            val file = dedup(dir, filename)
            client.newCall(authorizedRequest(url)).execute().use { resp ->
                val body = resp.body ?: return@withContext false
                if (!resp.isSuccessful) return@withContext false
                file.outputStream().use { body.byteStream().copyTo(it) }
            }
            uris.add(FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file))
        }
        if (uris.isEmpty()) return@withContext false
        val send = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = "*/*"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        appContext.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    }.getOrDefault(false)
}

private fun enqueueToDownloads(url: String, filename: String): Boolean = runCatching {
    val request = DownloadManager.Request(Uri.parse(url))
        .setTitle(filename)
        .setMimeType(mimeOf(filename))
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
    if (url.startsWith(Backend.baseUrl)) {
        Backend.authHeaders.forEach { (name, value) -> request.addRequestHeader(name, value) }
    }
    val manager = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    manager.enqueue(request)
    true
}.getOrDefault(false)

private fun writeToDownloads(filename: String, copy: (OutputStream) -> Unit): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, mimeOf(filename))
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val resolver = appContext.contentResolver
        val target = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
        resolver.openOutputStream(target)?.use(copy) ?: return false
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(target, values, null, null)
        return true
    }
    val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).apply { mkdirs() }
    val dest = dedup(dir, filename)
    dest.outputStream().use(copy)
    return true
}

private fun cacheCopy(url: String, filename: String): File? = runCatching {
    val dir = File(appContext.cacheDir, "shared").apply { mkdirs() }
    val file = dedup(dir, filename)
    client.newCall(authorizedRequest(url)).execute().use { resp ->
        val body = resp.body ?: return null
        if (!resp.isSuccessful) return null
        file.outputStream().use { body.byteStream().copyTo(it) }
    }
    file
}.getOrNull()

private suspend fun openExternally(url: String, filename: String): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val file = cacheCopy(url, filename) ?: return@withContext false
        val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = mimeOf(filename)
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        appContext.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    }.getOrDefault(false)
}

private suspend fun saveToUri(url: String, uri: Uri): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        client.newCall(authorizedRequest(url)).execute().use { resp ->
            val body = resp.body ?: return@use false
            if (!resp.isSuccessful) return@use false
            appContext.contentResolver.openOutputStream(uri)?.use { out -> body.byteStream().copyTo(out) } != null
        }
    }.getOrDefault(false)
}

private fun authorizedRequest(url: String): Request {
    val builder = Request.Builder().url(url)
    if (url.startsWith(Backend.baseUrl)) {
        Backend.authHeaders.forEach { (name, value) -> builder.header(name, value) }
    }
    return builder.build()
}

private fun mimeOf(filename: String): String {
    val ext = filename.substringAfterLast('.', "").lowercase()
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
}

private fun dedup(dir: File, name: String): File {
    dir.mkdirs()
    var target = File(dir, name)
    if (!target.exists()) return target
    val stem = name.substringBeforeLast('.', name)
    val ext = name.substringAfterLast('.', "").let { if (it.isEmpty()) "" else ".$it" }
    var n = 1
    while (target.exists()) {
        target = File(dir, "$stem ($n)$ext")
        n++
    }
    return target
}

actual suspend fun saveTextToDownloads(filename: String, text: String): Boolean = withContext(Dispatchers.IO) {
    runCatching { writeToDownloads(filename) { out -> out.write(text.toByteArray()) } }.getOrDefault(false)
}

actual suspend fun saveTextAs(filename: String, text: String): Boolean {
    val uri = androidSaveAs?.invoke(filename) ?: return false
    return withContext(Dispatchers.IO) {
        runCatching { appContext.contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) } != null }.getOrDefault(false)
    }
}

actual suspend fun shareText(filename: String, text: String): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val dir = File(appContext.cacheDir, "shared").apply { mkdirs() }
        val file = dedup(dir, filename)
        file.writeText(text)
        val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = mimeOf(filename)
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        appContext.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    }.getOrDefault(false)
}
