package com.jahirtrap.cconnect

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.RectF
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.util.Base64
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import androidx.webkit.ProfileStore
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebStorageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.roundToInt
import org.json.JSONArray
import org.json.JSONObject

private const val PROFILE = "cconnect-browser"
private const val WEBVIEW_DIR = "app_webview"
private const val WEBVIEW_CACHE_DIR = "WebView"
private const val PROFILE_INDEX = "pref_store"
private const val SIGNAL = "⁣cconnect:"
private const val STATE_EVENT = "browser-state"
private const val OPEN_EVENT = "browser-open"
private const val PICKING_EVENT = "browser-picking"
private const val PICKED_EVENT = "browser-picked"
private const val FOCUSED_EVENT = "browser-focused"
private const val SHIELD_EVENT = "browser-shield"
private const val ANSWER_SECONDS = 10L
private const val ICON_QUALITY = 100
private const val BLOCKED_STATUS = 403
private val WEB_SCHEMES = setOf("http", "https", "about", "data", "blob", "javascript")

object BrowserNative {
  @JvmStatic external fun blocks(url: String, source: String, accept: String): Boolean

  @JvmStatic external fun hiding(url: String): String

  @JvmStatic external fun pageScript(): String
}

class Browser(
  private val activity: Activity,
  private val content: () -> WebView?,
  private val chooseFiles: (Intent, ValueCallback<Array<Uri>>) -> Unit,
) {
  private class Tab(val id: String, val view: WebView) {
    @Volatile var source = ""
    val blocked = AtomicInteger()
    var bounds: JSONObject? = null
    var zoom = 1f
    var agent: String? = null
  }

  private val main = Handler(Looper.getMainLooper())
  private val tabs = LinkedHashMap<String, Tab>()
  private val profiled by lazy { WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE) }
  private val documentStart by lazy { WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) }
  private val script by lazy { BrowserNative.pageScript() }
  private var hole: RectF? = null
  private var cover: List<RectF> = emptyList()
  private var shown: String? = null
  private var gesture: WebView? = null
  private var routed: String? = null

  @JavascriptInterface
  fun call(command: String, json: String): String {
    val args = JSONObject(json)
    return when (command) {
      "browser_open" -> ui { open(args) }
      "browser_bounds" -> ui { tab(args)?.let { place(it, args) } }
      "browser_zoom" -> ui { tab(args)?.let { zoom(it, args.getDouble("zoom").toFloat()) } }
      "browser_agent" -> ui { tab(args)?.let { agent(it, args.optString("agent").ifEmpty { null }) } }
      "browser_visible" -> ui { visible(args.getString("id"), args.getBoolean("visible")) }
      "browser_navigate" -> ui { tab(args)?.view?.loadUrl(args.getString("url")) }
      "browser_back" -> ui { tab(args)?.view?.takeIf { it.canGoBack() }?.goBack() }
      "browser_forward" -> ui { tab(args)?.view?.takeIf { it.canGoForward() }?.goForward() }
      "browser_reload" -> ui { tab(args)?.view?.reload() }
      "browser_close" -> ui { close(args.getString("id")) }
      "browser_pick" -> ui {
        tab(args)?.view?.evaluateJavascript(
          "window.__cconnect && window.__cconnect.pick(${args.getBoolean("enabled")})",
          null,
        )
      }
      "browser_layer" -> {
        ui { layer(args) }
        "true"
      }
      "browser_restart" -> wait { done ->
        tabs.keys.toList().forEach(::close)
        done()
      }
      "browser_clear_data" -> wait(::clear)
      "browser_data_size" -> profileDirs().sumOf(::size).toString()
      else -> "null"
    }
  }

  fun dispatch(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) gesture = target(event.x, event.y)
    val view = gesture ?: return false
    val at = IntArray(2).also(view::getLocationInWindow)
    val local = MotionEvent.obtain(event)
    local.offsetLocation(-at[0].toFloat(), -at[1].toFloat())
    local.transform(Matrix().apply { setScale(1 / view.scaleX, 1 / view.scaleY) })
    view.dispatchTouchEvent(local)
    local.recycle()
    if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) gesture = null
    return true
  }

  fun pause() = tabs.values.forEach { it.view.onPause() }

  fun resume() = tabs.values.forEach { it.view.onResume() }

  fun closeAll() = tabs.keys.toList().forEach(::close)

  private fun ui(block: () -> Unit): String {
    main.post { runCatching(block) }
    return "null"
  }

  private fun wait(block: (() -> Unit) -> Unit): String {
    val done = CountDownLatch(1)
    main.post { runCatching { block(done::countDown) }.onFailure { done.countDown() } }
    done.await(ANSWER_SECONDS, TimeUnit.SECONDS)
    return "null"
  }

  private fun tab(args: JSONObject) = tabs[args.getString("id")]

  private fun px(value: Double) = (value * activity.resources.displayMetrics.density).roundToInt()

  @SuppressLint("SetJavaScriptEnabled")
  private fun open(args: JSONObject) {
    val id = args.getString("id")
    tabs[id]?.let {
      report(it, current(it).put("loading", false))
      return
    }
    route(args.optJSONObject("proxy"))
    val parent = content()?.parent as? ViewGroup ?: return
    val view = WebView(activity)
    if (profiled) WebViewCompat.setProfile(view, PROFILE)
    val tab = Tab(id, view)
    view.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      loadWithOverviewMode = true
      useWideViewPort = true
      builtInZoomControls = true
      displayZoomControls = false
      setSupportMultipleWindows(true)
    }
    if (documentStart) WebViewCompat.addDocumentStartJavaScript(view, script, setOf("*"))
    view.webViewClient = PageClient(tab)
    view.webChromeClient = PageChrome(tab)
    view.setDownloadListener { url, agent, disposition, mime, _ -> download(url, agent, disposition, mime) }
    parent.addView(view, 0, FrameLayout.LayoutParams(0, 0))
    place(tab, args)
    tabs[id] = tab
    view.loadUrl(args.getString("url"))
  }

  private fun place(tab: Tab, args: JSONObject) {
    val origin = content()
    tab.bounds = args
    tab.view.pivotX = 0f
    tab.view.pivotY = 0f
    tab.view.scaleX = tab.zoom
    tab.view.scaleY = tab.zoom
    tab.view.layoutParams = (tab.view.layoutParams as FrameLayout.LayoutParams).apply {
      width = px(args.getDouble("width") / tab.zoom)
      height = px(args.getDouble("height") / tab.zoom)
      leftMargin = px(args.getDouble("x")) + (origin?.left ?: 0)
      topMargin = px(args.getDouble("y")) + (origin?.top ?: 0)
    }
  }

  private fun zoom(tab: Tab, value: Float) {
    if (value <= 0f || value == tab.zoom) return
    tab.zoom = value
    tab.bounds?.let { place(tab, it) }
  }

  private fun agent(tab: Tab, value: String?) {
    if (value == tab.agent) return
    tab.agent = value
    tab.view.settings.userAgentString = value
    tab.view.reload()
  }

  private fun visible(id: String, on: Boolean) {
    val tab = tabs[id] ?: return
    tab.view.visibility = if (on) View.VISIBLE else View.INVISIBLE
    if (on) shown = id else if (shown == id) shown = null
  }

  private fun close(id: String) {
    val tab = tabs.remove(id) ?: return
    if (shown == id) shown = null
    if (gesture == tab.view) gesture = null
    (tab.view.parent as? ViewGroup)?.removeView(tab.view)
    tab.view.destroy()
  }

  private fun layer(args: JSONObject) {
    val view = content() ?: return
    val origin = IntArray(2).also(view::getLocationInWindow)
    hole = args.optJSONObject("hole")?.let { area(it, origin) }
    val list = args.optJSONArray("cover") ?: JSONArray()
    cover = (0 until list.length()).map { area(list.getJSONObject(it), origin) }
    if (hole != null) view.setBackgroundColor(Color.TRANSPARENT)
  }

  private fun area(box: JSONObject, origin: IntArray): RectF {
    val left = origin[0] + px(box.getDouble("x"))
    val top = origin[1] + px(box.getDouble("y"))
    return RectF(
      left.toFloat(),
      top.toFloat(),
      (left + px(box.getDouble("width"))).toFloat(),
      (top + px(box.getDouble("height"))).toFloat(),
    )
  }

  private fun target(x: Float, y: Float): WebView? {
    val area = hole ?: return null
    if (!area.contains(x, y) || cover.any { it.contains(x, y) }) return null
    return shown?.let { tabs[it]?.view }?.takeIf { it.visibility == View.VISIBLE }
  }

  private fun route(proxy: JSONObject?) {
    if (proxy == null || !WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) return
    val signature = proxy.toString()
    if (signature == routed) return
    routed = signature
    val controller = ProxyController.getInstance()
    val executor = ContextCompat.getMainExecutor(activity)
    val address = proxy.optString("url").trim()
    val keep = proxy.optJSONArray("keep") ?: JSONArray()
    val spared = proxy.optString("bypass").split(',').map(String::trim).filter(String::isNotEmpty) +
      (0 until keep.length()).map(keep::getString)
    runCatching {
      when {
        proxy.optString("mode") == "manual" && address.isNotEmpty() -> controller.setProxyOverride(
          ProxyConfig.Builder().addProxyRule(address).apply { spared.forEach(::addBypassRule) }.build(),
          executor,
        ) {}
        proxy.optString("mode") == "none" ->
          controller.setProxyOverride(ProxyConfig.Builder().addDirect().build(), executor) {}
        else -> controller.clearProxyOverride(executor) {}
      }
    }
  }

  private fun clear(done: () -> Unit) {
    tabs.values.forEach { it.view.clearHistory() }
    if (!profiled) {
      tabs.values.forEach { it.view.clearCache(true) }
      done()
      return
    }
    val store = ProfileStore.getInstance()
    val profile = store.getOrCreateProfile(PROFILE)
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA)) {
      WebStorageCompat.deleteBrowsingData(profile.webStorage, done)
      return
    }
    tabs.values.forEach { it.view.clearCache(true) }
    profile.webStorage.deleteAllData()
    profile.cookieManager.removeAllCookies {
      if (tabs.isEmpty()) runCatching { store.deleteProfile(PROFILE) }
      done()
    }
  }

  private fun profileDirs(): List<File> = runCatching {
    val root = File(activity.dataDir, WEBVIEW_DIR)
    val profiles = JSONObject(File(root, PROFILE_INDEX).readText()).getJSONObject("profile").getJSONArray("list")
    val path = (0 until profiles.length())
      .map(profiles::getJSONObject)
      .firstOrNull { it.optString("name") == PROFILE }
      ?.getString("path")
    if (path == null) emptyList() else listOf(File(root, path), File(File(activity.cacheDir, WEBVIEW_CACHE_DIR), path))
  }.getOrDefault(emptyList())

  private fun size(file: File): Long =
    if (file.isDirectory) file.listFiles().orEmpty().sumOf(::size) else file.length()

  private fun cookies(url: String): String? =
    if (profiled) ProfileStore.getInstance().getOrCreateProfile(PROFILE).cookieManager.getCookie(url)
    else CookieManager.getInstance().getCookie(url)

  private fun download(url: String, agent: String, disposition: String?, mime: String?) {
    runCatching {
      val request = DownloadManager.Request(Uri.parse(url))
        .setMimeType(mime)
        .addRequestHeader("User-Agent", agent)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, disposition, mime))
      cookies(url)?.let { request.addRequestHeader("Cookie", it) }
      (activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
    }
  }

  private fun current(tab: Tab) = JSONObject()
    .put("url", tab.view.url.orEmpty())
    .put("title", tab.view.title.orEmpty())
    .put("canGoBack", tab.view.canGoBack())
    .put("canGoForward", tab.view.canGoForward())

  private fun report(tab: Tab, state: JSONObject) = emit(STATE_EVENT, state.put("id", tab.id))

  private fun emit(event: String, payload: JSONObject) {
    val message = JSONObject().put("event", event).put("payload", payload).toString()
    main.post { content()?.evaluateJavascript("window.__cconnectBrowser && window.__cconnectBrowser($message)", null) }
  }

  private fun signal(tab: Tab, json: String) {
    val message = runCatching { JSONObject(json) }.getOrNull() ?: return
    when (message.optString("kind")) {
      "picked" -> message.optJSONObject("data")?.let { emit(PICKED_EVENT, it.put("id", tab.id)) }
      "picking" -> emit(PICKING_EVENT, JSONObject().put("id", tab.id).put("picking", message.optBoolean("data")))
      "focused" -> emit(FOCUSED_EVENT, JSONObject().put("id", tab.id))
    }
  }

  private fun leave(view: WebView, target: Uri): Boolean {
    runCatching {
      val intent =
        if (target.scheme == "intent") Intent.parseUri(target.toString(), Intent.URI_INTENT_SCHEME).apply {
          addCategory(Intent.CATEGORY_BROWSABLE)
          component = null
          selector = null
        } else Intent(Intent.ACTION_VIEW, target)
      runCatching { activity.startActivity(intent) }.onFailure {
        intent.getStringExtra("browser_fallback_url")?.let(view::loadUrl)
      }
    }
    return true
  }

  private inner class PageClient(private val tab: Tab) : WebViewClient() {
    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
      tab.source = url
      tab.blocked.set(0)
      emit(SHIELD_EVENT, JSONObject().put("id", tab.id).put("blocked", 0))
      report(tab, JSONObject().put("url", url).put("loading", true))
    }

    override fun onPageFinished(view: WebView, url: String) {
      report(tab, current(tab).put("loading", false))
    }

    override fun doUpdateVisitedHistory(view: WebView, url: String, reload: Boolean) {
      tab.source = url
      report(tab, current(tab))
    }

    override fun onPageCommitVisible(view: WebView, url: String) {
      if (!documentStart) view.evaluateJavascript(script, null)
      BrowserNative.hiding(url).takeIf(String::isNotEmpty)?.let { view.evaluateJavascript(it, null) }
    }

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
      if (request.isForMainFrame) return null
      val accept = request.requestHeaders["Accept"].orEmpty()
      if (!BrowserNative.blocks(request.url.toString(), tab.source, accept)) return null
      emit(SHIELD_EVENT, JSONObject().put("id", tab.id).put("blocked", tab.blocked.incrementAndGet()))
      return WebResourceResponse("text/plain", "utf-8", BLOCKED_STATUS, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
      val target = request.url
      return if (target.scheme?.lowercase() in WEB_SCHEMES) false else leave(view, target)
    }
  }

  private inner class PageChrome(private val tab: Tab) : WebChromeClient() {
    override fun onReceivedTitle(view: WebView, title: String) {
      if (title.startsWith(SIGNAL)) {
        signal(tab, title.removePrefix(SIGNAL))
        return
      }
      report(tab, JSONObject().put("title", title))
    }

    override fun onReceivedIcon(view: WebView, icon: Bitmap) {
      val bytes = ByteArrayOutputStream().also { icon.compress(Bitmap.CompressFormat.PNG, ICON_QUALITY, it) }.toByteArray()
      report(tab, JSONObject().put("favicon", "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)))
    }

    override fun onCreateWindow(view: WebView, dialog: Boolean, user: Boolean, message: Message): Boolean {
      val catcher = WebView(activity)
      if (profiled) WebViewCompat.setProfile(catcher, PROFILE)
      catcher.webViewClient = object : WebViewClient() {
        private var taken = false

        private fun take(window: WebView, url: String) {
          if (taken || url.isEmpty() || url == "about:blank") return
          taken = true
          emit(OPEN_EVENT, JSONObject().put("id", tab.id).put("url", url))
          window.stopLoading()
          main.post(window::destroy)
        }

        override fun shouldOverrideUrlLoading(window: WebView, request: WebResourceRequest): Boolean {
          take(window, request.url.toString())
          return true
        }

        override fun onPageStarted(window: WebView, url: String, favicon: Bitmap?) = take(window, url)
      }
      (message.obj as WebView.WebViewTransport).webView = catcher
      message.sendToTarget()
      return true
    }

    override fun onShowFileChooser(
      view: WebView,
      callback: ValueCallback<Array<Uri>>,
      params: FileChooserParams,
    ): Boolean {
      chooseFiles(params.createIntent(), callback)
      return true
    }
  }
}
