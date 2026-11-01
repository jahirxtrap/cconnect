package com.jahirtrap.cconnect

import android.app.Activity
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class Speech(private val activity: Activity, private val webView: () -> WebView?) {

    private var ready = false
    private var failed = false
    private var last = ""

    private val engine: TextToSpeech = TextToSpeech(activity.applicationContext) { status ->
        ready = status == TextToSpeech.SUCCESS
        failed = !ready
        deliver("", if (ready) "ready" else "error")
    }

    init {
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) = Unit

            override fun onDone(utteranceId: String) {
                if (utteranceId == last) deliver(utteranceId.substringBefore('#'), "done")
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String) {
                deliver(utteranceId.substringBefore('#'), "error")
            }

            override fun onError(utteranceId: String, errorCode: Int) {
                deliver(utteranceId.substringBefore('#'), "error")
            }
        })
    }

    fun available(): Boolean = !failed

    fun voices(): String {
        if (!ready) return "[]"
        val listed = JSONArray()
        runCatching { engine.voices }.getOrNull().orEmpty()
            .filter { !it.isNetworkConnectionRequired }
            .sortedBy { it.name }
            .forEach { voice ->
                listed.put(
                    JSONObject()
                        .put("id", voice.name)
                        .put("label", "${voice.locale.getDisplayName(voice.locale)} · ${voice.name}")
                        .put("language", voice.locale.toLanguageTag()),
                )
            }
        return listed.toString()
    }

    fun speak(key: String, chunks: String, language: String, voice: String, rate: Float) {
        if (!ready) {
            deliver(key, "error")
            return
        }
        val parts = JSONArray(chunks)
        if (parts.length() == 0) {
            deliver(key, "done")
            return
        }
        val picked = runCatching { engine.voices }.getOrNull().orEmpty().firstOrNull { it.name == voice }
        if (picked != null) engine.setVoice(picked) else engine.setLanguage(Locale.forLanguageTag(language))
        engine.setSpeechRate(rate)
        last = "$key#${parts.length() - 1}"
        for (index in 0 until parts.length()) {
            val mode = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            engine.speak(parts.getString(index), mode, null, "$key#$index")
        }
    }

    fun stop() {
        last = ""
        engine.stop()
    }

    fun shutdown() {
        engine.shutdown()
    }

    private fun deliver(key: String, kind: String) {
        val payload = JSONObject().put("id", key).put("kind", kind)
        activity.runOnUiThread {
            webView()?.evaluateJavascript("window.__cconnectSpeech && window.__cconnectSpeech($payload)", null)
        }
    }
}
