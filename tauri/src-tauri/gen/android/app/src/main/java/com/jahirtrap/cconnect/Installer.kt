package com.jahirtrap.cconnect

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

private const val BUFFER_SIZE = 64 * 1024
private const val APK_MIME = "application/vnd.android.package-archive"

class Installer(private val activity: Activity) {
    private val workers = Executors.newSingleThreadExecutor()

    @Volatile private var bytes = 0L
    @Volatile private var total = 0L
    @Volatile private var state = "idle"
    @Volatile private var target: File? = null
    @Volatile private var cancelled = false

    @JavascriptInterface
    fun start(url: String) {
        bytes = 0
        total = 0
        target = null
        cancelled = false
        state = "active"
        workers.execute {
            val file = runCatching { fetch(url) }.getOrNull()
            target = file
            state = if (file != null) "done" else "failed"
        }
    }

    @JavascriptInterface
    fun status(): String =
        JSONObject().put("status", state).put("bytes", bytes).put("total", total).toString()

    @JavascriptInterface
    fun cancel() {
        cancelled = true
    }

    @JavascriptInterface
    fun canInstall(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()

    @JavascriptInterface
    fun requestPermission() {
        runCatching {
            activity.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }
    }

    @JavascriptInterface
    fun install(): Boolean {
        val file = target ?: downloaded() ?: return false
        if (!canInstall()) {
            requestPermission()
            return false
        }
        return runCatching {
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            activity.startActivity(
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, APK_MIME)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
            true
        }.getOrDefault(false)
    }

    private fun downloaded(): File? =
        File(activity.cacheDir, "updates").listFiles()?.firstOrNull { it.isFile && it.length() > 0 }

    private fun fetch(url: String): File {
        val dir = File(activity.cacheDir, "updates").apply { deleteRecursively(); mkdirs() }
        val file = File(dir, url.substringAfterLast('/').ifBlank { "cconnect.apk" })
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            setRequestProperty("Accept-Encoding", "identity")
            connectTimeout = 30_000
            readTimeout = 30_000
        }
        total = connection.contentLengthLong
        connection.inputStream.use { stream ->
            file.outputStream().use { out ->
                val buffer = ByteArray(BUFFER_SIZE)
                while (true) {
                    if (cancelled) throw InterruptedException()
                    val read = stream.read(buffer)
                    if (read < 0) break
                    out.write(buffer, 0, read)
                    bytes += read
                }
            }
        }
        return file
    }
}
