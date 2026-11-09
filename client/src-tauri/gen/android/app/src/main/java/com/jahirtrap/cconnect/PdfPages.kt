package com.jahirtrap.cconnect

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

private const val CACHE_FOLDER = "pdf"
private const val LOOPBACK = "127.0.0.1"
private const val BACKLOG = 32
private const val MAX_TILE_PIXELS = 16_777_216
private const val FILE_HEADER = 14
private const val INFO_HEADER = 40
private const val BYTES_PER_PIXEL = 4
private const val BITS_PER_PIXEL = 32
private const val PIXELS_PER_METER = 2835
private const val ROWS_PER_WRITE = 64
private const val COPY_BUFFER = 64 * 1024
private const val READ_TIMEOUT_MS = 30_000
private const val RENDERERS = 3
private const val CLOSE_WAIT_MS = 2_000L
private const val GONE = 410

private class Renderer(val descriptor: ParcelFileDescriptor, val renderer: PdfRenderer) {
    private var page: PdfRenderer.Page? = null

    fun page(index: Int): PdfRenderer.Page {
        page?.takeIf { it.index == index }?.let { return it }
        page?.close()
        page = null
        return renderer.openPage(index).also { page = it }
    }

    fun close() {
        runCatching { page?.close() }
        runCatching { renderer.close() }
        runCatching { descriptor.close() }
    }
}

private class Document(val folder: File, val file: File, val renderers: List<Renderer>) {
    val idle = ArrayBlockingQueue(renderers.size, false, renderers)
    val painter: ExecutorService = Executors.newFixedThreadPool(renderers.size)
    @Volatile var generation = 0

    fun close() {
        painter.shutdownNow()
        runCatching { painter.awaitTermination(CLOSE_WAIT_MS, TimeUnit.MILLISECONDS) }
        renderers.forEach(Renderer::close)
        folder.deleteRecursively()
    }
}

internal fun downloadPdf(url: String, target: File) {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.readTimeout = READ_TIMEOUT_MS
    try {
        if (connection.responseCode !in 200..299) error("status ${connection.responseCode}")
        connection.inputStream.use { input -> target.outputStream().use { input.copyTo(it, COPY_BUFFER) } }
    } finally {
        connection.disconnect()
    }
}

private fun openRenderer(file: File): Renderer {
    val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    return runCatching { Renderer(descriptor, PdfRenderer(descriptor)) }.getOrElse {
        descriptor.close()
        throw it
    }
}

class PdfPages(private val activity: Activity, private val webView: () -> WebView?) {
    private val workers = Executors.newCachedThreadPool()
    private val documents = ConcurrentHashMap<String, Document>()
    private val tokens = ConcurrentHashMap<String, String>()
    private val counter = AtomicInteger()
    private val root by lazy { File(activity.cacheDir, CACHE_FOLDER).apply { deleteRecursively(); mkdirs() } }
    private val server by lazy { ServerSocket(0, BACKLOG, InetAddress.getByName(LOOPBACK)).also(::listen) }

    @JavascriptInterface
    fun open(url: String): String {
        val id = counter.incrementAndGet().toString()
        workers.execute {
            val base = runCatching { load(id, url) }.getOrNull()
            report(JSONObject().put("id", id).apply { if (base != null) put("base", base) })
        }
        return id
    }

    @JavascriptInterface
    fun close(id: String) {
        val token = tokens.remove(id) ?: return
        documents.remove(token)?.let { document -> workers.execute { document.close() } }
    }

    @JavascriptInterface
    fun focus(id: String, generation: Int) {
        tokens[id]?.let(documents::get)?.generation = generation
    }

    fun closeAll() {
        tokens.keys.toList().forEach(::close)
    }

    private fun load(id: String, url: String): String {
        val token = UUID.randomUUID().toString()
        val folder = File(root, token).apply { mkdirs() }
        val file = File(folder, "document.pdf")
        downloadPdf(url, file)
        val renderers = mutableListOf<Renderer>()
        runCatching { repeat(RENDERERS) { renderers.add(openRenderer(file)) } }.onFailure {
            renderers.forEach(Renderer::close)
            folder.deleteRecursively()
            throw it
        }
        documents[token] = Document(folder, file, renderers)
        tokens[id] = token
        return "http://$LOOPBACK:${server.localPort}/$token"
    }

    private fun report(payload: JSONObject) {
        activity.runOnUiThread {
            webView()?.evaluateJavascript("window.__cconnectPdf && window.__cconnectPdf($payload)", null)
        }
    }

    private fun listen(socket: ServerSocket) {
        Thread {
            while (!socket.isClosed) {
                val client = runCatching { socket.accept() }.getOrNull() ?: continue
                workers.execute { runCatching { client.use(::answer) } }
            }
        }.apply { isDaemon = true }.start()
    }

    private fun answer(client: Socket) {
        val input = BufferedInputStream(client.getInputStream())
        val line = readLine(input) ?: return
        while (readLine(input)?.isNotEmpty() == true) Unit
        val parts = line.split(" ")
        val output = BufferedOutputStream(client.getOutputStream(), COPY_BUFFER)
        if (parts.size < 2 || parts[0] != "GET") return respond(output, 405, "text/plain", 0) {}
        val target = Uri.parse("http://$LOOPBACK${parts[1]}")
        val segments = target.pathSegments
        val document = segments.getOrNull(0)?.let(documents::get)
        if (document == null || segments.size != 2) return respond(output, 404, "text/plain", 0) {}
        if (segments[1] == "file") {
            return respond(output, 200, "application/pdf", document.file.length()) { out ->
                document.file.inputStream().use { it.copyTo(out, COPY_BUFFER) }
            }
        }
        val page = segments[1].toIntOrNull()
        val full = target.getQueryParameter("fw")?.toIntOrNull()
        val x = target.getQueryParameter("x")?.toIntOrNull() ?: 0
        val y = target.getQueryParameter("y")?.toIntOrNull() ?: 0
        val width = target.getQueryParameter("w")?.toIntOrNull()
        val height = target.getQueryParameter("h")?.toIntOrNull()
        val generation = target.getQueryParameter("g")?.toIntOrNull() ?: 0
        if (page == null || full == null || width == null || height == null || width <= 0 || height <= 0 ||
            width.toLong() * height > MAX_TILE_PIXELS
        ) {
            return respond(output, 400, "text/plain", 0) {}
        }
        val pixels = runCatching {
            document.painter.submit<IntArray?> {
                if (generation < document.generation) return@submit null
                val renderer = document.idle.take()
                try {
                    paint(renderer.page(page), full, x, y, width, height)
                } finally {
                    document.idle.put(renderer)
                }
            }.get()
        }.getOrNull() ?: return respond(output, GONE, "text/plain", 0) {}
        val length = FILE_HEADER + INFO_HEADER + pixels.size.toLong() * BYTES_PER_PIXEL
        respond(output, 200, "image/bmp", length) { out -> writeBitmap(out, pixels, width, height) }
    }

    private fun paint(page: PdfRenderer.Page, full: Int, x: Int, y: Int, width: Int, height: Int): IntArray {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try {
            bitmap.eraseColor(Color.WHITE)
            val scale = full.toFloat() / page.width
            val matrix = Matrix().apply {
                setScale(scale, scale)
                postTranslate(-x.toFloat(), -y.toFloat())
            }
            page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            return IntArray(width * height).also { bitmap.getPixels(it, 0, width, 0, 0, width, height) }
        } finally {
            bitmap.recycle()
        }
    }

    private fun writeBitmap(out: OutputStream, pixels: IntArray, width: Int, height: Int) {
        val header = ByteBuffer.allocate(FILE_HEADER + INFO_HEADER).order(ByteOrder.LITTLE_ENDIAN)
        header.put('B'.code.toByte()).put('M'.code.toByte())
        header.putInt(FILE_HEADER + INFO_HEADER + pixels.size * BYTES_PER_PIXEL).putInt(0).putInt(FILE_HEADER + INFO_HEADER)
        header.putInt(INFO_HEADER).putInt(width).putInt(-height).putShort(1).putShort(BITS_PER_PIXEL.toShort())
        header.putInt(0).putInt(pixels.size * BYTES_PER_PIXEL).putInt(PIXELS_PER_METER).putInt(PIXELS_PER_METER)
        header.putInt(0).putInt(0)
        out.write(header.array())
        val rows = ByteBuffer.allocate(width * ROWS_PER_WRITE * BYTES_PER_PIXEL).order(ByteOrder.LITTLE_ENDIAN)
        var row = 0
        while (row < height) {
            val count = minOf(ROWS_PER_WRITE, height - row)
            rows.clear()
            rows.asIntBuffer().put(pixels, row * width, count * width)
            out.write(rows.array(), 0, count * width * BYTES_PER_PIXEL)
            row += count
        }
    }

    private fun respond(output: BufferedOutputStream, status: Int, type: String, length: Long, body: (OutputStream) -> Unit) {
        val head = "HTTP/1.1 $status ${if (status == 200) "OK" else "Error"}\r\n" +
            "Content-Type: $type\r\nContent-Length: $length\r\nCache-Control: no-store\r\n" +
            "Access-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
        output.write(head.toByteArray(Charsets.US_ASCII))
        body(output)
        output.flush()
    }

    private fun readLine(input: BufferedInputStream): String? {
        val line = StringBuilder()
        while (true) {
            val next = input.read()
            if (next < 0) return if (line.isEmpty()) null else line.toString()
            if (next == '\n'.code) return line.toString().trimEnd('\r')
            line.append(next.toChar())
        }
    }
}
