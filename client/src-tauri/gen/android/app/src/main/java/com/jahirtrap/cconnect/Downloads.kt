package com.jahirtrap.cconnect

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

private const val BUFFER_SIZE = 64 * 1024

private class Progress {
    @Volatile var bytes = 0L
    @Volatile var total = 0L
    @Volatile var status = "active"
    @Volatile var cancelled = false
}

private const val SAVED_LIMIT = 50

class Downloads(private val activity: Activity, private val onSaveAs: (String, String, String) -> Unit) {
    private val workers = Executors.newCachedThreadPool()
    private val transfers = ConcurrentHashMap<String, Progress>()
    private val saved = ConcurrentHashMap<String, String>()
    private val counter = AtomicInteger()

    @JavascriptInterface
    fun enqueue(url: String, filename: String, headersJson: String): String {
        val id = counter.incrementAndGet().toString()
        val progress = Progress()
        transfers[id] = progress
        workers.execute {
            val target = runCatching { copyToDownloads(url, filename, headersJson, progress) }.getOrNull()
            if (target != null) remember(id, target)
            progress.status = if (target != null) "done" else "failed"
        }
        return id
    }

    @JavascriptInterface
    fun openSaved(id: String): Boolean {
        val target = saved[id] ?: return false
        return viewSaved(target)
    }

    @JavascriptInterface
    fun status(id: String): String {
        val progress = transfers[id] ?: return state("failed", 0, 0)
        if (progress.status != "active") transfers.remove(id)
        return state(progress.status, progress.bytes, progress.total)
    }

    @JavascriptInterface
    fun cancel(id: String) {
        transfers.remove(id)?.cancelled = true
    }

    @JavascriptInterface
    fun saveAs(url: String, filename: String, headersJson: String) {
        activity.runOnUiThread { onSaveAs(url, filename, headersJson) }
    }

    @JavascriptInterface
    fun share(url: String, filename: String, headersJson: String) {
        workers.execute {
            val file = fetchToCache(url, filename, headersJson) ?: return@execute
            sendFile(file, filename)
        }
    }

    @JavascriptInterface
    fun open(url: String, filename: String, headersJson: String) {
        workers.execute {
            val file = fetchToCache(url, filename, headersJson) ?: return@execute
            if (!viewFile(file, filename)) sendFile(file, filename)
        }
    }

    @JavascriptInterface
    fun saveText(filename: String, text: String): Boolean =
        writeToDownloads(filename) { out -> out.write(text.toByteArray()) } != null

    @JavascriptInterface
    fun shareText(filename: String, text: String) {
        workers.execute {
            val file = dedup(File(activity.cacheDir, "shared"), filename)
            if (runCatching { file.writeText(text) }.isFailure) return@execute
            sendFile(file, filename)
        }
    }

    fun writeUri(url: String, target: Uri, headersJson: String) {
        workers.execute {
            runCatching {
                open(url, headersJson).use { stream ->
                    activity.contentResolver.openOutputStream(target)?.use { out -> stream.copyTo(out) }
                }
            }
        }
    }

    private fun copyToDownloads(url: String, filename: String, headersJson: String, progress: Progress): String? {
        val connection = connect(url, headersJson)
        progress.total = connection.contentLengthLong
        return connection.inputStream.use { stream ->
            writeToDownloads(filename) { out -> pump(stream, out, progress) }
        }
    }

    private fun remember(id: String, target: String) {
        if (saved.size >= SAVED_LIMIT) saved.keys.take(saved.size - SAVED_LIMIT + 1).forEach(saved::remove)
        saved[id] = target
    }

    private fun viewSaved(target: String): Boolean = runCatching {
        val uri = if (target.startsWith("content://")) Uri.parse(target) else sharedUri(File(target))
        val view = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, activity.contentResolver.getType(uri) ?: mimeOf(target))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(view)
        true
    }.getOrDefault(false)

    private fun pump(stream: InputStream, out: OutputStream, progress: Progress) {
        val buffer = ByteArray(BUFFER_SIZE)
        while (true) {
            if (progress.cancelled) throw InterruptedException()
            val read = stream.read(buffer)
            if (read < 0) break
            out.write(buffer, 0, read)
            progress.bytes += read
        }
    }

    private fun sendFile(file: File, filename: String) {
        runCatching {
            val send = Intent(Intent.ACTION_SEND).apply {
                type = mimeOf(filename)
                putExtra(Intent.EXTRA_STREAM, sharedUri(file))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    private fun viewFile(file: File, filename: String): Boolean = runCatching {
        val view = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(sharedUri(file), mimeOf(filename))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(view)
        true
    }.getOrDefault(false)

    private fun sharedUri(file: File): Uri =
        FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)

    private fun fetchToCache(url: String, filename: String, headersJson: String): File? = runCatching {
        val file = dedup(File(activity.cacheDir, "shared"), filename)
        open(url, headersJson).use { stream -> file.outputStream().use { stream.copyTo(it) } }
        file
    }.getOrNull()

    private fun connect(url: String, headersJson: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        headersOf(headersJson).forEach { (name, value) -> setRequestProperty(name, value) }
        setRequestProperty("Accept-Encoding", "identity")
        connectTimeout = 30_000
        readTimeout = 30_000
    }

    private fun open(url: String, headersJson: String): InputStream = connect(url, headersJson).inputStream

    private fun writeToDownloads(filename: String, copy: (OutputStream) -> Unit): String? = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, filename)
                put(MediaStore.Downloads.MIME_TYPE, mimeOf(filename))
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = activity.contentResolver
            val target = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
            try {
                resolver.openOutputStream(target)?.use(copy) ?: return null
            } catch (error: Throwable) {
                resolver.delete(target, null, null)
                throw error
            }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(target, values, null, null)
            return target.toString()
        }
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).apply { mkdirs() }
        val file = dedup(dir, filename)
        file.outputStream().use(copy)
        file.absolutePath
    }.getOrNull()

    private fun state(status: String, bytes: Long, total: Long) =
        JSONObject().put("status", status).put("bytes", bytes).put("total", total).toString()

    private fun headersOf(json: String): Map<String, String> = runCatching {
        val parsed = JSONObject(json)
        parsed.keys().asSequence().associateWith { parsed.getString(it) }
    }.getOrDefault(emptyMap())

    private fun mimeOf(filename: String): String {
        val extension = filename.substringAfterLast('.', "").lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
    }

    private fun dedup(dir: File, name: String): File {
        dir.mkdirs()
        var target = File(dir, name)
        if (!target.exists()) return target
        val stem = name.substringBeforeLast('.', name)
        val extension = name.substringAfterLast('.', "").let { if (it.isEmpty()) "" else ".$it" }
        var index = 1
        while (target.exists()) {
            target = File(dir, "$stem ($index)$extension")
            index++
        }
        return target
    }
}
