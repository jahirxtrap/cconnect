package com.jahirtrap.cconnect.data.remote

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.job
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.TimeUnit

private val client = OkHttpClient()
private val uploadClient = OkHttpClient.Builder().writeTimeout(0, TimeUnit.MILLISECONDS).build()
private val OCTET_STREAM = "application/octet-stream".toMediaType()

internal suspend fun uploadBytes(
    url: String,
    method: String,
    length: Long,
    open: () -> InputStream?,
    onProgress: (Float) -> Unit,
): String? = withContext(Dispatchers.IO) {
    runCatching {
        val body = object : RequestBody() {
            override fun contentType() = OCTET_STREAM
            override fun contentLength() = if (length > 0) length else -1
            override fun writeTo(sink: BufferedSink) {
                val input = open() ?: throw IOException("cannot open source")
                input.use {
                    val buffer = ByteArray(64 * 1024)
                    var sent = 0L
                    while (true) {
                        val read = it.read(buffer)
                        if (read < 0) break
                        sink.write(buffer, 0, read)
                        sent += read
                        if (length > 0) onProgress(sent.toFloat() / length)
                    }
                }
            }
        }
        val request = Request.Builder().url(url).method(method, body).apply {
            Backend.authHeaders.forEach { (name, value) -> header(name, value) }
        }.build()
        val call = uploadClient.newCall(request)
        coroutineContext.job.invokeOnCompletion { if (it is CancellationException) call.cancel() }
        call.execute().use { resp -> if (resp.isSuccessful) resp.body?.string().orEmpty() else null }
    }.getOrNull()
}

internal actual suspend fun fetchSharedText(url: String): String? = withContext(Dispatchers.IO) {
    runCatching {
        val request = Request.Builder().url(url).apply {
            Backend.authHeaders.forEach { (name, value) -> header(name, value) }
        }.build()
        client.newCall(request).execute().use { resp ->
            if (resp.isSuccessful) resp.body?.string() else null
        }
    }.getOrNull()
}
