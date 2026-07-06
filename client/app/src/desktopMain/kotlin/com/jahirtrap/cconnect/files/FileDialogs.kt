package com.jahirtrap.cconnect.files

import org.lwjgl.util.tinyfd.TinyFileDialogs
import java.awt.EventQueue
import java.awt.FileDialog
import java.awt.Frame
import java.io.File
import javax.swing.JFileChooser

object FileDialogs {
    private var lastDir: String = System.getProperty("user.home") ?: "."

    private val isLinux = System.getProperty("os.name")?.lowercase()?.let { !it.contains("win") && !it.contains("mac") } ?: false

    fun openMultiple(): List<File> = runCatching {
        if (isLinux) {
            val pick: () -> List<File> = {
                val dialog = FileDialog(null as Frame?, "Open", FileDialog.LOAD)
                dialog.directory = lastDir
                dialog.isMultipleMode = true
                dialog.isVisible = true
                dialog.files?.toList().orEmpty().also { files -> files.firstOrNull()?.parent?.let { lastDir = it } }
            }
            if (EventQueue.isDispatchThread()) pick()
            else {
                var result: List<File> = emptyList()
                EventQueue.invokeAndWait { result = pick() }
                result
            }
        } else {
            TinyFileDialogs.tinyfd_openFileDialog("Open", lastDir + File.separator, null, null, true)
                ?.split("|")?.map(::File)?.also { files -> files.firstOrNull()?.parent?.let { lastDir = it } }
                ?: emptyList()
        }
    }.getOrDefault(emptyList())

    fun save(name: String): File? = runCatching {
        if (isLinux) {
            val pick: () -> File? = {
                val dialog = FileDialog(null as Frame?, "Save", FileDialog.SAVE)
                dialog.directory = lastDir
                dialog.file = name
                dialog.isVisible = true
                val dir = dialog.directory
                val file = dialog.file
                if (dir == null || file == null) null else File(dir, file).also { lastDir = dir }
            }
            if (EventQueue.isDispatchThread()) pick()
            else {
                var result: File? = null
                EventQueue.invokeAndWait { result = pick() }
                result
            }
        } else {
            TinyFileDialogs.tinyfd_saveFileDialog("Save", lastDir + File.separator + name, null, null)
                ?.let { path -> File(path).also { f -> f.parent?.let { lastDir = it } } }
        }
    }.getOrNull()

    fun chooseDirectory(): File? = runCatching {
        if (isLinux) {
            val pick: () -> File? = {
                val chooser = JFileChooser(lastDir).apply {
                    fileSelectionMode = JFileChooser.DIRECTORIES_ONLY
                }
                if (chooser.showOpenDialog(null) == JFileChooser.APPROVE_OPTION) {
                    chooser.selectedFile?.also { lastDir = it.absolutePath }
                } else null
            }
            if (EventQueue.isDispatchThread()) pick()
            else {
                var result: File? = null
                EventQueue.invokeAndWait { result = pick() }
                result
            }
        } else {
            TinyFileDialogs.tinyfd_selectFolderDialog("Select folder", lastDir + File.separator)
                ?.let { File(it).also { f -> lastDir = f.absolutePath } }
        }
    }.getOrNull()
}
