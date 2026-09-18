package com.jahirtrap.cconnect

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import android.view.View
import androidx.core.content.IntentCompat
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject

private const val SHARE_ATTEMPTS = 20
private const val SHARE_RETRY_MS = 400L
private const val OAUTH_SCHEME = "com.jahirtrap.cconnect"

class MainActivity : TauriActivity() {
  override val handleBackNavigation = false

  private lateinit var downloads: Downloads
  private val installer by lazy { Installer(this) }
  private val dictation by lazy { Dictation(this) { content } }
  private var pendingSave: Triple<String, String, String>? = null
  private var content: WebView? = null
  private var pendingShare: String? = null
  private var shareAttempts = 0
  private var pendingRedirect: String? = null
  private var redirectAttempts = 0
  @Volatile private var safeArea: Insets = Insets.NONE
  @Volatile private var keyboard = 0

  private val backCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      val view = content
      if (view == null) {
        leave()
        return
      }
      view.evaluateJavascript("window.__cconnectBack ? window.__cconnectBack() : false") { handled ->
        if (handled != "true") leave()
      }
    }
  }

  private val createDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri: Uri? ->
    val pending = pendingSave ?: return@registerForActivityResult
    pendingSave = null
    if (uri != null) downloads.writeUri(pending.first, uri, pending.third)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    downloads = Downloads(this) { url, filename, headers ->
      pendingSave = Triple(url, filename, headers)
      createDocument.launch(filename)
    }
    super.onCreate(savedInstanceState)
    onBackPressedDispatcher.addCallback(this, backCallback)
    trackWindowInsets()
    takeShare(intent)
    takeRedirect(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    takeShare(intent)
    deliverShare()
    takeRedirect(intent)
    deliverRedirect()
  }

  private fun takeRedirect(intent: Intent?) {
    val data = intent?.takeIf { it.action == Intent.ACTION_VIEW }?.data ?: return
    if (data.scheme != OAUTH_SCHEME) return
    pendingRedirect = data.toString()
    redirectAttempts = 0
  }

  private fun deliverRedirect() {
    val url = pendingRedirect ?: return
    val view = content ?: return
    if (redirectAttempts++ > SHARE_ATTEMPTS) return
    view.postDelayed({
      view.evaluateJavascript(
        "window.__cconnectOauth ? (window.__cconnectOauth(${JSONObject.quote(url)}), true) : false",
      ) { accepted ->
        if (accepted == "true") pendingRedirect = null else deliverRedirect()
      }
    }, SHARE_RETRY_MS)
  }

  private fun takeShare(intent: Intent?) {
    val uris = when (intent?.action) {
      Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
      Intent.ACTION_SEND_MULTIPLE ->
        IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
      else -> return
    }
    if (uris.isEmpty()) return
    val json = PastedContent.encode(this, uris)
    if (json == "[]") return
    pendingShare = json
    shareAttempts = 0
  }

  /** The web view only takes it once the chat registered its hook, which lags a cold start. */
  private fun deliverShare() {
    val json = pendingShare ?: return
    val view = content ?: return
    if (shareAttempts++ > SHARE_ATTEMPTS) return
    view.postDelayed({
      view.evaluateJavascript(
        "window.__cconnectPaste ? (window.__cconnectPaste(${JSONObject.quote(json)}), true) : false",
      ) { accepted ->
        if (accepted == "true") pendingShare = null else deliverShare()
      }
    }, SHARE_RETRY_MS)
  }

  private fun trackWindowInsets() {
    val root = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
      keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
      )
      safeArea = Insets.of(bars.left, bars.top, bars.right, (bars.bottom - keyboard).coerceAtLeast(0))
      content?.evaluateJavascript("window.__cconnectInsets && window.__cconnectInsets(${safeAreaJson()})", null)
      WindowInsetsCompat.Builder(insets)
        .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
        .build()
    }
  }

  private fun safeAreaJson(): String {
    val density = resources.displayMetrics.density
    return JSONObject()
      .put("top", safeArea.top / density)
      .put("bottom", safeArea.bottom / density)
      .put("left", safeArea.left / density)
      .put("right", safeArea.right / density)
      .put("keyboard", keyboard / density)
      .toString()
  }

  inner class SafeAreaBridge {
    @JavascriptInterface
    fun get(): String = safeAreaJson()
  }

  override fun onResume() {
    super.onResume()
    content?.evaluateJavascript("window.__cconnectResume && window.__cconnectResume()", null)
  }

  private fun leave() {
    backCallback.isEnabled = false
    onBackPressedDispatcher.onBackPressed()
    backCallback.isEnabled = true
  }

  override fun onWebViewCreate(webView: WebView) {
    content = webView
    webView.addJavascriptInterface(SystemBars(), "AndroidSystemBars")
    webView.addJavascriptInterface(SafeAreaBridge(), "AndroidInsets")
    webView.addJavascriptInterface(downloads, "AndroidDownloads")
    webView.addJavascriptInterface(Background(), "AndroidBackground")
    webView.addJavascriptInterface(CodeScanner(), "AndroidQrScan")
    webView.addJavascriptInterface(installer, "AndroidInstaller")
    webView.addJavascriptInterface(Voice(), "AndroidVoice")
    PastedContent(webView).install()
    deliverShare()
    deliverRedirect()
  }

  inner class CodeScanner {
    private val scanner by lazy { QrScan(this@MainActivity) { content } }

    @JavascriptInterface
    fun isAvailable(): Boolean = scanner.available()

    @JavascriptInterface
    fun scan() = scanner.scan()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray,
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode != Dictation.PERMISSION_REQUEST) return
    dictation.onPermissionResult(grantResults.firstOrNull() == android.content.pm.PackageManager.PERMISSION_GRANTED)
  }

  inner class Voice {
    @JavascriptInterface
    fun isAvailable(): Boolean = dictation.available()

    @JavascriptInterface
    fun start(language: String) = dictation.start(language)

    @JavascriptInterface
    fun stop() = dictation.stop()
  }

  inner class Background {
    @JavascriptInterface
    fun batteryOptimizationIgnored(): Boolean {
      val power = getSystemService(Context.POWER_SERVICE) as PowerManager
      return power.isIgnoringBatteryOptimizations(packageName)
    }

    @JavascriptInterface
    fun requestIgnoreBatteryOptimization() {
      val target =
        if (batteryOptimizationIgnored()) Settings.ACTION_APPLICATION_DETAILS_SETTINGS
        else Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
      runCatching {
        startActivity(Intent(target, Uri.parse("package:$packageName")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }

  inner class SystemBars {
    @JavascriptInterface
    fun setAppearance(dark: Boolean) {
      runOnUiThread {
        WindowCompat.getInsetsController(window, window.decorView).apply {
          isAppearanceLightStatusBars = !dark
          isAppearanceLightNavigationBars = !dark
        }
      }
    }
  }
}
