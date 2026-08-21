package com.jahirtrap.cconnect.ui

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

const val CCONNECT_LANG = "cconnect"

data class GalleryItem(val url: String, val alt: String? = null, val poster: String? = null)

data class PlaylistItem(val url: String, val title: String? = null, val duration: Int? = null)

sealed interface CconnectBlock {
    data class Gallery(val items: List<GalleryItem>) : CconnectBlock
    data class Playlist(val items: List<PlaylistItem>) : CconnectBlock
    data class Pdf(val url: String, val title: String? = null) : CconnectBlock
    data class Html(val url: String, val title: String? = null) : CconnectBlock
}

private fun JsonObject.str(key: String): String? =
    this[key]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }

private fun JsonObject.int(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull

private fun JsonObject.objects(key: String): List<JsonObject> =
    runCatching { this[key]?.jsonArray?.mapNotNull { it as? JsonObject } }.getOrNull() ?: emptyList()

fun parseCconnectBlock(source: String): CconnectBlock? {
    val root = runCatching { Json.parseToJsonElement(source).jsonObject }.getOrNull() ?: return null
    return when (root.str("type")) {
        "gallery" -> root.objects("items")
            .mapNotNull { item -> item.str("url")?.let { GalleryItem(it, item.str("alt"), item.str("poster")) } }
            .takeIf { it.isNotEmpty() }
            ?.let { CconnectBlock.Gallery(it) }

        "playlist" -> root.objects("items")
            .mapNotNull { item -> item.str("url")?.let { PlaylistItem(it, item.str("title"), item.int("duration")) } }
            .takeIf { it.isNotEmpty() }
            ?.let { CconnectBlock.Playlist(it) }

        "pdf" -> root.str("url")?.let { CconnectBlock.Pdf(it, root.str("title")) }
        "html" -> root.str("url")?.let { CconnectBlock.Html(it, root.str("title")) }
        else -> null
    }
}
