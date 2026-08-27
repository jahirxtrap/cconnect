package com.jahirtrap.cconnect

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.view.View
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.core.view.ContentInfoCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ViewCompat
import org.json.JSONArray
import org.json.JSONObject

/** Files the system hands to the web view — the clipboard's paste, the keyboard's GIFs and stickers.
 *  The page is a <textarea>, which only ever takes plain text, so without declaring this the system
 *  refuses the paste on its own ("CConnect no admite el pegado de imágenes aquí") and nothing ever
 *  reaches JS. Declaring it here is what the Compose client gets from `contentReceiver`. */
class PastedContent(private val webView: WebView) : OnReceiveContentListener {

    private companion object {
        val MIME_TYPES = arrayOf("image/*", "video/*", "audio/*", "text/*", "application/*")
    }

    fun install() {
        ViewCompat.setOnReceiveContentListener(webView, MIME_TYPES, this)
    }

    override fun onReceiveContent(view: View, payload: ContentInfoCompat): ContentInfoCompat? {
        val split = payload.partition { item -> item.uri != null }
        val media = split.first ?: return split.second
        val files = JSONArray()
        val clip = media.clip
        for (index in 0 until clip.itemCount) {
            val uri = clip.getItemAt(index).uri ?: continue
            read(uri)?.let { files.put(it) }
        }
        if (files.length() > 0) {
            val json = files.toString()
            webView.post {
                webView.evaluateJavascript(
                    "window.__cconnectPaste && window.__cconnectPaste(${JSONObject.quote(json)})",
                    null,
                )
            }
        }
        return split.second
    }

    private fun read(uri: Uri): JSONObject? = runCatching {
        val resolver: ContentResolver = webView.context.contentResolver
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
        JSONObject()
            .put("name", nameOf(uri, mime))
            .put("mime", mime)
            .put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))
    }.getOrNull()

    private fun nameOf(uri: Uri, mime: String): String {
        val resolver = webView.context.contentResolver
        val display = runCatching {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull()
        if (!display.isNullOrBlank()) return display
        val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "bin"
        return "pasted-${System.currentTimeMillis()}.$extension"
    }
}
