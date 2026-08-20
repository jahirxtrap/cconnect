package com.jahirtrap.cconnect.data

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.jahirtrap.cconnect.appContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

actual object AppUpdater {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .callTimeout(0, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val dir get() = File(appContext.cacheDir, "updates")
    private val marker get() = File(dir, "pending")

    actual fun openRelease(url: String): Boolean = runCatching {
        appContext.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        true
    }.getOrDefault(false)

    actual fun reload(): Boolean = false

    actual suspend fun download(url: String, version: String, onProgress: (Float) -> Unit): Boolean = withContext(Dispatchers.IO) {
        clear()
        val d = dir.apply { mkdirs() }
        val name = url.substringAfterLast('/').ifBlank { "CConnect-update.apk" }
        val file = File(d, name)
        try {
            client.newCall(Request.Builder().url(url).build()).execute().use { resp ->
                val body = resp.body ?: return@withContext false
                if (!resp.isSuccessful) return@withContext false
                val total = body.contentLength()
                body.byteStream().use { input ->
                    file.outputStream().use { out ->
                        val buffer = ByteArray(64 * 1024)
                        var copied = 0L
                        while (true) {
                            coroutineContext.ensureActive()
                            val n = input.read(buffer)
                            if (n < 0) break
                            out.write(buffer, 0, n)
                            copied += n
                            if (total > 0) onProgress(copied.toFloat() / total)
                        }
                    }
                }
            }
            marker.writeText("$version\n$name")
            true
        } catch (e: CancellationException) {
            clear()
            throw e
        } catch (_: Exception) {
            clear()
            false
        }
    }

    actual fun pendingVersion(): String? = runCatching {
        if (!marker.isFile) return null
        val lines = marker.readLines()
        val version = lines.getOrNull(0)?.takeIf { it.isNotBlank() } ?: return null
        val name = lines.getOrNull(1)?.takeIf { it.isNotBlank() } ?: return null
        if (File(dir, name).isFile) version else { clear(); null }
    }.getOrNull()

    actual fun pendingName(): String? = runCatching {
        if (!marker.isFile) return null
        marker.readLines().getOrNull(1)?.takeIf { it.isNotBlank() }
    }.getOrNull()

    actual fun install(): Boolean = runCatching {
        val name = marker.readLines().getOrNull(1)?.takeIf { it.isNotBlank() } ?: return false
        val file = File(dir, name)
        if (!file.isFile) return false
        val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
        appContext.startActivity(
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
        true
    }.getOrDefault(false)

    actual fun consumeIfInstalled(currentVersion: String) {
        runCatching {
            if (!marker.isFile) return
            val version = marker.readLines().getOrNull(0)?.takeIf { it.isNotBlank() } ?: return
            if (AppCompat.compare(currentVersion, version) >= 0) clear()
        }
    }

    private fun clear() {
        runCatching { if (dir.exists()) dir.deleteRecursively() }
    }
}
