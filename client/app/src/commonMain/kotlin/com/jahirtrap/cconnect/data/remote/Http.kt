package com.jahirtrap.cconnect.data.remote

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

internal expect suspend fun httpExecute(
    method: String,
    path: String,
    query: Map<String, String>,
    headers: List<Pair<String, String>>,
    jsonBody: String?,
): String?

// Each verb returns the envelope's `data` on success (an empty object when the
// response carries no data), or null on failure.
object Http {

    suspend fun get(path: String, query: Map<String, String> = emptyMap()): JsonElement? =
        execute("GET", path, query, null)

    suspend fun post(path: String, body: JsonObject? = null): JsonElement? =
        execute("POST", path, emptyMap(), body?.toString() ?: "{}")

    suspend fun put(path: String, body: JsonObject? = null): JsonElement? =
        execute("PUT", path, emptyMap(), body?.toString() ?: "{}")

    suspend fun patch(path: String, body: JsonObject? = null): JsonElement? =
        execute("PATCH", path, emptyMap(), body?.toString() ?: "{}")

    suspend fun delete(path: String, query: Map<String, String> = emptyMap()): JsonElement? =
        execute("DELETE", path, query, null)

    private suspend fun execute(method: String, path: String, query: Map<String, String>, jsonBody: String?): JsonElement? {
        val text = httpExecute(method, path, query, Backend.authHeaders, jsonBody) ?: return null
        return runCatching {
            val obj = json.parseToJsonElement(text).jsonObject
            if (obj["success"]?.jsonPrimitive?.booleanOrNull == true) obj["data"] ?: JsonObject(emptyMap()) else null
        }.getOrNull()
    }

    private val json = Json { ignoreUnknownKeys = true }
}
