package com.jahirtrap.cconnect

import android.graphics.Color
import android.graphics.RectF
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import androidx.pdf.PdfDocument
import androidx.pdf.SandboxedPdfLoader
import androidx.pdf.view.PdfView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.roundToInt

private const val SCREEN_FOLDER = "pdf-screen"
private const val PAGE_GAP_DP = 10f

class PdfScreen(private val activity: AppCompatActivity, private val content: () -> WebView?) {
    private val main = Handler(Looper.getMainLooper())
    private val loader by lazy { SandboxedPdfLoader(activity, Dispatchers.IO) }
    private val folder by lazy { File(activity.cacheDir, SCREEN_FOLDER).apply { deleteRecursively(); mkdirs() } }
    private var view: PdfView? = null
    private var document: PdfDocument? = null
    private var loading: Job? = null
    private var hole: RectF? = null
    private var cover: List<RectF> = emptyList()
    private var touching = false

    @JavascriptInterface
    fun present(url: String, background: String) {
        main.post { open(url, background) }
    }

    @JavascriptInterface
    fun layer(json: String): Boolean {
        main.post { place(JSONObject(json)) }
        return true
    }

    @JavascriptInterface
    fun dismiss() {
        main.post(::close)
    }

    fun dispatch(event: MotionEvent): Boolean {
        val target = view ?: return false
        if (event.actionMasked == MotionEvent.ACTION_DOWN) {
            val area = hole
            touching = target.visibility == View.VISIBLE && area != null && area.contains(event.x, event.y) &&
                cover.none { it.contains(event.x, event.y) }
        }
        if (!touching) return false
        val at = IntArray(2).also(target::getLocationInWindow)
        val local = MotionEvent.obtain(event)
        local.offsetLocation(-at[0].toFloat(), -at[1].toFloat())
        target.dispatchTouchEvent(local)
        local.recycle()
        if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) touching = false
        return true
    }

    private fun open(url: String, background: String) {
        close()
        val parent = content()?.parent as? ViewGroup ?: return report(false)
        val pdf = PdfView(activity)
        ViewCompat.setOnApplyWindowInsetsListener(pdf) { _, _ -> WindowInsetsCompat.CONSUMED }
        runCatching { pdf.setBackgroundColor(Color.parseColor(background)) }
        pdf.visibility = View.INVISIBLE
        parent.addView(pdf, 0, FrameLayout.LayoutParams(0, 0))
        view = pdf
        hole?.let { fit(pdf, it) }
        loading = activity.lifecycleScope.launch {
            val opened = runCatching {
                val file = File(folder, "document.pdf")
                withContext(Dispatchers.IO) { downloadPdf(url, file) }
                loader.openDocument(Uri.fromFile(file))
            }.getOrNull()
            if (opened == null || view !== pdf) {
                opened?.close()
                if (view === pdf) report(false)
                return@launch
            }
            val pageWidth = runCatching { opened.getPageInfo(0).width }.getOrNull()
            document = opened
            pdf.pdfDocument = opened
            if (pageWidth != null && pageWidth > 0) fitWidth(pdf, pageWidth)
            pdf.visibility = View.VISIBLE
            report(true)
        }
    }

    private fun fitWidth(pdf: PdfView, pageWidth: Int) {
        var fitted = 0f
        val apply = {
            val fit = pdf.width.toFloat() / pageWidth
            if (fit > 0f && fit != fitted) {
                val atFit = fitted == 0f || pdf.zoom <= fitted
                pdf.verticalPageSpacing = (PAGE_GAP_DP * activity.resources.displayMetrics.density / fit).roundToInt()
                pdf.minZoom = fit
                if (atFit) pdf.zoom = fit
                fitted = fit
            }
        }
        pdf.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> apply() }
        if (pdf.width > 0) apply()
    }

    private fun place(args: JSONObject) {
        val webView = content() ?: return
        val origin = IntArray(2).also(webView::getLocationInWindow)
        hole = args.optJSONObject("hole")?.let { area(it, origin) }
        val list = args.optJSONArray("cover") ?: JSONArray()
        cover = (0 until list.length()).map { area(list.getJSONObject(it), origin) }
        if (hole != null) webView.setBackgroundColor(Color.TRANSPARENT)
        val pdf = view ?: return
        hole?.let { fit(pdf, it) }
    }

    private fun fit(pdf: PdfView, area: RectF) {
        val parent = pdf.parent as? View ?: return
        val origin = IntArray(2).also(parent::getLocationInWindow)
        pdf.layoutParams = (pdf.layoutParams as FrameLayout.LayoutParams).apply {
            width = area.width().roundToInt()
            height = area.height().roundToInt()
            leftMargin = (area.left - origin[0]).roundToInt()
            topMargin = (area.top - origin[1]).roundToInt()
        }
    }

    private fun area(box: JSONObject, origin: IntArray): RectF {
        val density = activity.resources.displayMetrics.density
        val left = origin[0] + box.getDouble("x").toFloat() * density
        val top = origin[1] + box.getDouble("y").toFloat() * density
        return RectF(left, top, left + box.getDouble("width").toFloat() * density, top + box.getDouble("height").toFloat() * density)
    }

    private fun close() {
        loading?.cancel()
        loading = null
        view?.let { (it.parent as? ViewGroup)?.removeView(it) }
        view = null
        document?.let { opened -> runCatching { opened.close() } }
        document = null
        touching = false
    }

    private fun report(ready: Boolean) {
        content()?.evaluateJavascript("window.__cconnectPdfScreen && window.__cconnectPdfScreen(${JSONObject().put("ready", ready)})", null)
    }
}
