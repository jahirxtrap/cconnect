package com.jahirtrap.cconnect

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

class Dictation(private val activity: Activity, private val webView: () -> WebView?) {

    companion object {
        const val PERMISSION_REQUEST = 4711
        private const val RESTART_DELAY_MS = 300L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var language = ""

    fun available(): Boolean = runCatching {
        SpeechRecognizer.isRecognitionAvailable(activity)
    }.getOrDefault(false)

    fun start(tag: String) {
        language = tag
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                PERMISSION_REQUEST,
            )
            return
        }
        listening = true
        activity.runOnUiThread { listen() }
    }

    fun stop() {
        listening = false
        handler.removeCallbacksAndMessages(null)
        activity.runOnUiThread { recognizer?.stopListening() }
    }

    fun onPermissionResult(granted: Boolean) {
        if (granted) start(language) else deliver("end", error = "permission")
    }

    private fun listen() {
        val engine = recognizer ?: SpeechRecognizer.createSpeechRecognizer(activity).also {
            it.setRecognitionListener(listener)
            recognizer = it
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, activity.packageName)
        }
        runCatching { engine.startListening(intent) }
            .onFailure { deliver("end", error = "start") }
    }

    private fun release() {
        listening = false
        handler.removeCallbacksAndMessages(null)
        recognizer?.destroy()
        recognizer = null
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onPartialResults(partialResults: Bundle?) {
            deliver("partial", text = first(partialResults))
        }

        override fun onResults(results: Bundle?) {
            deliver("final", text = first(results))
            if (listening) restart() else finish(null)
        }

        override fun onError(error: Int) {
            val transient = error == SpeechRecognizer.ERROR_NO_MATCH ||
                error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ||
                error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY
            if (transient && listening) {
                restart()
                return
            }
            finish(if (transient) null else "recognizer")
        }
    }

    private fun restart() {
        handler.postDelayed({
            if (!listening) return@postDelayed
            recognizer?.cancel()
            listen()
        }, RESTART_DELAY_MS)
    }

    private fun finish(error: String?) {
        release()
        deliver("end", error = error)
    }

    private fun first(bundle: Bundle?): String =
        bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()

    private fun deliver(kind: String, text: String = "", error: String? = null) {
        val payload = JSONObject()
            .put("kind", kind)
            .put("text", text)
            .put("error", error ?: JSONObject.NULL)
        activity.runOnUiThread {
            webView()?.evaluateJavascript("window.__cconnectVoice && window.__cconnectVoice($payload)", null)
        }
    }
}
