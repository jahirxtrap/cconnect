package com.jahirtrap.cconnect.files

import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

actual suspend fun downloadShared(url: String, filename: String): Boolean =
    FileTransfer.enqueueToDownloads(url, filename)

actual suspend fun saveSharedAs(url: String, filename: String): Boolean {
    val dest = withContext(Dispatchers.Default) { FileDialogs.save(filename) } ?: return false
    return FileTransfer.saveTo(url, dest)
}

actual suspend fun openSharedExternally(url: String, filename: String): Boolean {
    copyToClipboard(url)
    return true
}

actual suspend fun openSharedInBrowser(url: String, filename: String): Boolean =
    FileTransfer.openExternally(url, filename)

actual suspend fun saveAllShared(items: List<Pair<String, String>>): Boolean {
    val dir = withContext(Dispatchers.Default) { FileDialogs.chooseDirectory() } ?: return false
    return FileTransfer.saveAllTo(items, dir)
}

actual suspend fun openAllSharedExternally(items: List<Pair<String, String>>): Boolean {
    copyToClipboard(items.joinToString("\n") { it.first })
    return true
}

private fun copyToClipboard(text: String) {
    runCatching { Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection(text), null) }
}

actual suspend fun saveTextToDownloads(filename: String, text: String): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val dir = FileTransfer.userDownloadsDir().apply { mkdirs() }
        File(dir, filename).writeText(text)
        true
    }.getOrDefault(false)
}

actual suspend fun saveTextAs(filename: String, text: String): Boolean {
    val dest = withContext(Dispatchers.Default) { FileDialogs.save(filename) } ?: return false
    return withContext(Dispatchers.IO) { runCatching { dest.writeText(text); true }.getOrDefault(false) }
}

actual suspend fun shareText(filename: String, text: String): Boolean {
    copyToClipboard(text)
    return true
}
