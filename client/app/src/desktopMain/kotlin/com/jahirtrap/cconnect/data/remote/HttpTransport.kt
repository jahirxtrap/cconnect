package com.jahirtrap.cconnect.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private val client = OkHttpClient()
private val JSON_MEDIA_TYPE = "application/json".toMediaType()

internal actual suspend fun httpExecute(
    method: String,
    path: String,
    query: Map<String, String>,
    headers: List<Pair<String, String>>,
    jsonBody: String?,
): String? = withContext(Dispatchers.IO) {
    runCatching {
        val url = "${Backend.baseUrl}$path".toHttpUrl().newBuilder()
            .apply { query.forEach { (k, v) -> addQueryParameter(k, v) } }
            .build()
        val builder = Request.Builder().url(url)
        when (method) {
            "POST" -> builder.post((jsonBody ?: "{}").toRequestBody(JSON_MEDIA_TYPE))
            "PUT" -> builder.put((jsonBody ?: "{}").toRequestBody(JSON_MEDIA_TYPE))
            "PATCH" -> builder.patch((jsonBody ?: "{}").toRequestBody(JSON_MEDIA_TYPE))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }
        headers.forEach { (name, value) -> builder.header(name, value) }
        client.newCall(builder.build()).execute().use { resp -> resp.body?.string() }
    }.getOrNull()
}
