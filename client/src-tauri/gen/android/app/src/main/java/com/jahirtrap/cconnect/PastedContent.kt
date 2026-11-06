package com.jahirtrap.cconnect

import android.content.ClipData
import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.core.view.ContentInfoCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ViewCompat
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import org.json.JSONArray
import org.json.JSONObject

class PastedContent(private val webView: WebView) : OnReceiveContentListener {

    companion object {
        val MIME_TYPES = arrayOf("image/*", "video/*", "audio/*", "text/*", "application/*")

        @JvmStatic
        fun inputConnection(view: View, connection: InputConnection?, outAttrs: EditorInfo): InputConnection? {
            EditorInfoCompat.setContentMimeTypes(outAttrs, MIME_TYPES)
            if (connection == null) return null
            return InputConnectionCompat.createWrapper(view, connection, outAttrs)
        }

        fun encode(context: Context, clip: ClipData): String =
            encode(context, (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri })

        fun encode(context: Context, uris: List<Uri>): String {
            val files = JSONArray()
            for (uri in uris) read(context, uri)?.let { files.put(it) }
            return files.toString()
        }

        private fun read(context: Context, uri: Uri): JSONObject? = runCatching {
            val resolver: ContentResolver = context.contentResolver
            val mime = resolver.getType(uri) ?: "application/octet-stream"
            val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
            JSONObject()
                .put("name", nameOf(context, uri, mime))
                .put("mime", mime)
                .put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))
        }.getOrNull()

        private fun nameOf(context: Context, uri: Uri, mime: String): String {
            val display = runCatching {
                context.contentResolver
                    .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                    ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
            }.getOrNull()
            if (!display.isNullOrBlank()) return display
            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "bin"
            return "pasted-${System.currentTimeMillis()}.$extension"
        }
    }

    fun install() {
        ViewCompat.setOnReceiveContentListener(webView, MIME_TYPES, this)
    }

    override fun onReceiveContent(view: View, payload: ContentInfoCompat): ContentInfoCompat? {
        val split = payload.partition { item -> item.uri != null }
        val media = split.first ?: return split.second
        val json = encode(webView.context, media.clip)
        if (json != "[]") {
            webView.post {
                webView.evaluateJavascript(
                    "window.__cconnectPaste && window.__cconnectPaste(${JSONObject.quote(json)})",
                    null,
                )
            }
        }
        return split.second
    }
}
