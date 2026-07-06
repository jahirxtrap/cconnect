package com.jahirtrap.cconnect.files

import androidx.compose.runtime.Composable
import java.awt.Image
import java.awt.Toolkit
import java.awt.datatransfer.DataFlavor
import java.awt.datatransfer.Transferable
import java.awt.image.BufferedImage
import java.awt.image.PixelGrabber
import java.io.File
import javax.imageio.ImageIO

@Composable
actual fun ClipboardPasteEffect(enabled: Boolean, onFiles: (List<AttachmentFile>) -> Unit) {
}

private fun clipboardContents(): Transferable? =
    runCatching { Toolkit.getDefaultToolkit().systemClipboard.getContents(null) }.getOrNull()

actual fun clipboardHasFiles(): Boolean {
    val contents = clipboardContents() ?: return false
    return contents.isDataFlavorSupported(DataFlavor.javaFileListFlavor) ||
        contents.isDataFlavorSupported(DataFlavor.imageFlavor)
}

actual suspend fun readClipboardFiles(): List<AttachmentFile> {
    val contents = clipboardContents() ?: return emptyList()
    return runCatching {
        if (contents.isDataFlavorSupported(DataFlavor.javaFileListFlavor)) {
            val list = contents.getTransferData(DataFlavor.javaFileListFlavor) as? List<*>
            list?.filterIsInstance<File>()?.filter { it.isFile }?.map { AttachmentFile(it) } ?: emptyList()
        } else if (contents.isDataFlavorSupported(DataFlavor.imageFlavor)) {
            val image = contents.getTransferData(DataFlavor.imageFlavor) as? Image ?: return emptyList()
            val buffered = flattenClipboardImage(image) ?: return emptyList()
            val tmp = File.createTempFile("pasted-", ".png")
            ImageIO.write(buffered, "png", tmp)
            listOf(AttachmentFile(tmp))
        } else {
            emptyList()
        }
    }.getOrDefault(emptyList())
}

private fun flattenClipboardImage(image: Image): BufferedImage? {
    val w = image.getWidth(null).coerceAtLeast(1)
    val h = image.getHeight(null).coerceAtLeast(1)
    val pixels = IntArray(w * h)
    if (!PixelGrabber(image, 0, 0, w, h, pixels, 0, w).grabPixels()) return null
    val brokenAlpha = pixels.all { (it ushr 24) == 0 }
    val flat = IntArray(w * h) { i ->
        val p = pixels[i]
        val a = (p ushr 24) and 0xFF
        if (brokenAlpha || a == 0xFF) {
            p or (0xFF shl 24)
        } else {
            val r = (p ushr 16) and 0xFF
            val g = (p ushr 8) and 0xFF
            val b = p and 0xFF
            fun over(c: Int) = (c * a + 255 * (255 - a)) / 255
            (0xFF shl 24) or (over(r) shl 16) or (over(g) shl 8) or over(b)
        }
    }
    return BufferedImage(w, h, BufferedImage.TYPE_INT_RGB).apply { setRGB(0, 0, w, h, flat, 0, w) }
}
