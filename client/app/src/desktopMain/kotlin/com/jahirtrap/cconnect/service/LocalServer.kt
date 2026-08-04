package com.jahirtrap.cconnect.service

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.TimeUnit

actual object LocalServer {
    private val _status = MutableStateFlow(LocalServerInfo())
    actual val status: StateFlow<LocalServerInfo> = _status.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var process: Process? = null
    private var readerJob: Job? = null
    private var readyJob: Job? = null
    @Volatile private var startedByUs = false
    private val lastLines = ArrayDeque<String>()

    private val urlRegex = Regex("""https?://\S+""")

    actual fun start(config: LocalServerConfig) {
        if (process?.isAlive == true) return
        scope.launch { doStart(config) }
    }

    actual fun stop() {
        val proc = process
        process = null
        readerJob?.cancel()
        readerJob = null
        readyJob?.cancel()
        readyJob = null
        if (proc != null && startedByUs) {
            runCatching { proc.toHandle().descendants().forEach { it.destroy() } }
            runCatching { proc.destroy() }
            runCatching { if (proc.isAlive) proc.destroyForcibly() }
        }
        startedByUs = false
        _status.update {
            it.copy(managed = false, ready = false, error = null, errorDetail = null, publicUrl = null, token = null)
        }
    }

    actual fun restart(config: LocalServerConfig) {
        val old = process
        stop()
        scope.launch {
            if (old != null) runCatching { old.waitFor(5, TimeUnit.SECONDS) }
            var tries = 0
            while (isPortOpen("127.0.0.1", config.probePort) && tries < 15) { delay(200); tries++ }
            doStart(config)
        }
    }

    private fun doStart(config: LocalServerConfig) {
        val dir = File(config.dir)
        if (config.dir.isBlank() || !dir.isDirectory) {
            _status.update { it.copy(managed = false, error = LocalServerError.BadDir, errorDetail = null) }
            return
        }
        if (isPortOpen("127.0.0.1", config.probePort)) {
            startedByUs = false
            _status.update { it.copy(managed = false, ready = true, error = null, errorDetail = null) }
            return
        }
        val python = resolvePython(config, dir)
        if (python == null) {
            _status.update { it.copy(managed = false, error = LocalServerError.NoPython, errorDetail = null) }
            return
        }
        val cmd = mutableListOf(python, "run.py")
        if (config.mode != "local") {
            cmd += "--expose"; cmd += config.mode
            if (config.mode == "caddy" && config.publicHost.isNotBlank()) {
                cmd += "--public-host"; cmd += config.publicHost.trim()
            }
        }
        val proc = runCatching {
            ProcessBuilder(cmd).directory(dir).redirectErrorStream(true)
                .also { it.environment()["PYTHONUNBUFFERED"] = "1" }
                .start()
        }.getOrNull()
        if (proc == null) {
            _status.update { it.copy(managed = false, error = LocalServerError.LaunchFailed, errorDetail = null) }
            return
        }
        process = proc
        startedByUs = true
        lastLines.clear()
        _status.update {
            it.copy(managed = true, ready = false, error = null, errorDetail = null, publicUrl = null, token = null)
        }
        // The configured environment may be a tailnet address that answers long after the backend does.
        readyJob = scope.launch {
            repeat(60) {
                if (!proc.isAlive) return@launch
                if (isPortOpen("127.0.0.1", config.probePort)) {
                    _status.update { it.copy(ready = true) }
                    return@launch
                }
                delay(500)
            }
        }
        readerJob = scope.launch {
            runCatching {
                proc.inputStream.bufferedReader().forEachLine { line ->
                    lastLines.addLast(line)
                    while (lastLines.size > 20) lastLines.removeFirst()
                    _status.update { parseLine(line, it) }
                }
            }
            if (process === proc) {
                process = null
                startedByUs = false
                val tail = lastLines.toList().takeLast(12).joinToString("\n").trim()
                _status.update {
                    it.copy(managed = false, ready = false, error = LocalServerError.Crashed, errorDetail = tail.ifBlank { null })
                }
            }
        }
    }

    private fun parseLine(line: String, info: LocalServerInfo): LocalServerInfo {
        var next = info
        if (line.contains("Public URL")) urlRegex.find(line)?.value?.let { next = next.copy(publicUrl = it.trimEnd('/')) }
        if (line.contains("Token")) {
            val token = line.substringAfter(":", "").substringBefore("[Auto]").trim()
            if (token.isNotBlank()) next = next.copy(token = token)
        }
        return next
    }

    private fun resolvePython(config: LocalServerConfig, dir: File): String? = when (config.python) {
        "custom" -> config.pythonPath.takeIf { it.isNotBlank() && File(it).exists() }
        "auto" -> detectVenv(dir) ?: systemPython()
        else -> systemPython()
    }

    private fun detectVenv(dir: File): String? {
        val subs = dir.listFiles()?.filter { it.isDirectory } ?: return null
        val candidates = listOf("Scripts/python.exe", "bin/python", "bin/python3")
        return subs.firstNotNullOfOrNull { sub ->
            candidates.map { File(sub, it) }.firstOrNull { it.isFile }?.absolutePath
        }
    }

    private fun systemPython(): String =
        if (System.getProperty("os.name").orEmpty().lowercase().contains("win")) "python" else "python3"

    private fun isPortOpen(host: String, port: Int): Boolean = runCatching {
        Socket().use { it.connect(InetSocketAddress(host, port), 400); true }
    }.getOrDefault(false)
}

actual fun pickDirectory(): String? =
    com.jahirtrap.cconnect.files.FileDialogs.chooseDirectory()?.absolutePath

actual fun pickExecutable(): String? =
    com.jahirtrap.cconnect.files.FileDialogs.openMultiple().firstOrNull()?.absolutePath
