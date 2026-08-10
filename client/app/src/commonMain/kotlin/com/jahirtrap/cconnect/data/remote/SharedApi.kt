package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.SharedEntry
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.add
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

object SharedApi {

    suspend fun delete(path: String): Boolean = Http.delete("/shared/${encode(path)}") != null

    suspend fun search(path: String, query: String): List<SharedEntry>? =
        Http.get("/shared-search", mapOf("q" to query, "path" to path))?.jsonArray?.map(::parseEntry)

    suspend fun archiveList(path: String, inner: String = ""): List<SharedEntry>? =
        Http.get("/shared-archive", mapOf("path" to path, "inner" to inner))?.jsonArray?.map(::parseEntry)

    fun archiveFileUrl(path: String, inner: String): String =
        "${Backend.baseUrl}/shared-archive-file?path=${UrlCodec.encode(path)}&inner=${UrlCodec.encode(inner)}"

    fun parseEntry(el: JsonElement): SharedEntry {
        val o = el.jsonObject
        return SharedEntry(
            name = o["name"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            isDir = o["is_dir"]?.jsonPrimitive?.booleanOrNull ?: false,
            size = o["size"]?.jsonPrimitive?.longOrNull ?: 0L,
            modified = o["modified"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
            items = o["items"]?.jsonPrimitive?.intOrNull ?: 0,
        )
    }

    suspend fun mkdir(path: String): Boolean =
        Http.post("/shared/folder", buildJsonObject { put("path", path) }) != null

    suspend fun rename(path: String, name: String): Boolean =
        Http.post("/shared/rename", buildJsonObject { put("path", path); put("name", name) }) != null

    suspend fun absolutePaths(paths: List<String>): List<String>? =
        Http.post("/shared/paths", buildJsonObject { putJsonArray("paths") { paths.forEach { add(it) } } })
            ?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }

    suspend fun move(paths: List<String>, dest: String): Boolean =
        Http.post("/shared/move", transferBody(paths, dest)) != null

    suspend fun copy(paths: List<String>, dest: String): Boolean =
        Http.post("/shared/copy", transferBody(paths, dest)) != null

    private fun transferBody(paths: List<String>, dest: String) = buildJsonObject {
        putJsonArray("paths") { paths.forEach { add(it) } }
        put("dest", dest)
    }

    suspend fun compressFormats(): List<String>? =
        Http.get("/shared-capabilities")?.jsonObject?.get("compress_formats")
            ?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }

    suspend fun compress(paths: List<String>, format: String = "zip", name: String? = null): Boolean =
        Http.post("/shared/compress", buildJsonObject {
            putJsonArray("paths") { paths.forEach { add(it) } }
            put("format", format)
            if (name != null) put("name", name)
        }) != null

    suspend fun extract(
        path: String,
        dest: String? = null,
        intoFolder: Boolean = true,
        members: List<String>? = null,
        base: String = "",
    ): Boolean = Http.post("/shared/extract", buildJsonObject {
        put("path", path)
        if (dest != null) put("dest", dest)
        put("into_folder", intoFolder)
        if (members != null) putJsonArray("members") { members.forEach { add(it) } }
        if (base.isNotEmpty()) put("base", base)
    }) != null

    fun downloadUrl(path: String): String = "${Backend.baseUrl}/shared/${encode(path)}"

    internal fun savedPath(body: String): String? = runCatching {
        Json.parseToJsonElement(body).jsonObject["data"]?.jsonObject?.get("path")?.jsonPrimitive?.contentOrNull
    }.getOrNull()

    fun relativeFromUrl(url: String): String? {
        val prefix = "${Backend.baseUrl}/shared/"
        if (!url.startsWith(prefix)) return null
        return url.removePrefix(prefix).substringBefore('?')
            .split("/").joinToString("/") { UrlCodec.decode(it) }
    }

    private fun encode(path: String): String =
        path.split("/").filter { it.isNotEmpty() }.joinToString("/") { UrlCodec.encode(it) }
}
