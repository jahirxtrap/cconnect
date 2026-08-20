package com.jahirtrap.cconnect.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.awt.Desktop
import java.io.File
import java.net.URI
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext
import kotlin.system.exitProcess

actual object AppUpdater {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .callTimeout(0, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val updateDir = File(System.getProperty("user.home"), ".cconnect/updates")
    private val marker = File(updateDir, "pending")

    actual fun reload(): Boolean = false

    actual fun openRelease(url: String): Boolean =
        runCatching {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(URI(url))
                true
            } else false
        }.getOrDefault(false)

    actual suspend fun download(url: String, version: String, onProgress: (Float) -> Unit): Boolean = withContext(Dispatchers.IO) {
        val name = url.substringAfterLast('/').ifBlank { "CConnect-update" }
        clear()
        updateDir.mkdirs()
        val dest = File(updateDir, name)
        try {
            client.newCall(Request.Builder().url(url).build()).execute().use { resp ->
                val body = resp.body ?: return@withContext false
                if (!resp.isSuccessful) return@withContext false
                val total = body.contentLength()
                body.byteStream().use { input ->
                    dest.outputStream().use { out ->
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
        if (File(updateDir, name).isFile) version else { clear(); null }
    }.getOrNull()

    actual fun pendingName(): String? = runCatching {
        if (!marker.isFile) return null
        marker.readLines().getOrNull(1)?.takeIf { it.isNotBlank() }
    }.getOrNull()

    actual fun install(): Boolean = runCatching {
        val name = marker.readLines().getOrNull(1)?.takeIf { it.isNotBlank() } ?: return false
        val file = File(updateDir, name)
        if (!file.isFile) return false
        val os = System.getProperty("os.name").lowercase()
        when {
            os.contains("linux") -> linuxInstall(file)
            os.contains("windows") -> windowsInstall(file)
            else -> openExternally(file)
        }
    }.getOrDefault(false)

    private fun openExternally(file: File): Boolean =
        if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.OPEN)) {
            Desktop.getDesktop().open(file)
            true
        } else false

    private fun windowsInstall(file: File): Boolean {
        val path = file.absolutePath
        val launched = runCatching {
            val pb = if (path.endsWith(".msi", ignoreCase = true)) ProcessBuilder("msiexec", "/i", path) else ProcessBuilder(path)
            pb.start()
            true
        }.getOrDefault(false)
        if (!launched) return openExternally(file)
        exitProcess(0)
    }

    private fun hasCmd(name: String): Boolean =
        runCatching { ProcessBuilder("which", name).start().waitFor() == 0 }.getOrDefault(false)

    private fun linuxInstall(file: File): Boolean {
        val path = file.absolutePath
        val cmd = when {
            path.endsWith(".deb") -> listOf("pkexec", "apt-get", "install", "-y", path)
            path.endsWith(".rpm") && hasCmd("dnf") -> listOf("pkexec", "dnf", "install", "-y", path)
            path.endsWith(".rpm") && hasCmd("zypper") -> listOf("pkexec", "zypper", "--non-interactive", "install", "--allow-unsigned-rpm", path)
            path.endsWith(".rpm") -> listOf("pkexec", "rpm", "-U", "--force", path)
            else -> null
        }
        if (cmd == null || !hasCmd("pkexec")) return openExternally(file)

        val relaunch = runCatching { ProcessHandle.current().info().command().orElse(null) }.getOrNull()
        if (hasCmd("setsid") && relaunch != null) {
            val script = cmd.joinToString(" ", transform = ::shellQuote) + "; exec " + shellQuote(relaunch)
            val spawned = runCatching {
                ProcessBuilder("setsid", "sh", "-c", script)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start()
                true
            }.getOrDefault(false)
            if (spawned) exitProcess(0)
            return spawned
        }
        return runCatching { ProcessBuilder(cmd).start(); true }.getOrDefault(false)
    }

    private fun shellQuote(value: String): String = "'" + value.replace("'", "'\\''") + "'"

    actual fun consumeIfInstalled(currentVersion: String) {
        runCatching {
            if (!marker.isFile) return
            val version = marker.readLines().getOrNull(0)?.takeIf { it.isNotBlank() } ?: return
            if (AppCompat.compare(currentVersion, version) >= 0) clear()
        }
    }

    private fun clear() {
        runCatching { if (updateDir.exists()) updateDir.deleteRecursively() }
    }
}
