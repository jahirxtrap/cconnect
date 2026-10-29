package com.jahirtrap.cconnect

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.MotionEvent
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import android.view.View
import androidx.core.content.IntentCompat
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File
import org.json.JSONObject

private const val SHARE_ATTEMPTS = 20
private const val SHARE_RETRY_MS = 400L
private const val WEBVIEW_DATA = "app_webview"
private const val WEBVIEW_SEED = "variations_seed"

class MainActivity : TauriActivity() {
  override val handleBackNavigation = false

  private lateinit var downloads: Downloads
  private val installer by lazy { Installer(this) }
  private val dictation by lazy { Dictation(this) { content } }
  private var pendingSave: Triple<String, String, String>? = null
  private var content: WebView? = null
  private var pendingShare: String? = null
  private var pendingOpened = false
  private var shareAttempts = 0
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

  private val googleConsent: ActivityResultLauncher<IntentSenderRequest> =
    registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
      googleAuth.onConsent(result.data)
    }

  private val googleAuth by lazy { GoogleAuth(this, { content }, { googleConsent }) }

  private val link by lazy { BackgroundLink(this) { content } }

  private val notifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

  private var pendingFiles: ValueCallback<Array<Uri>>? = null

  private val pageFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
    pendingFiles?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    pendingFiles = null
  }

  private val browser by lazy {
    Browser(this, { content }) { intent, callback ->
      pendingFiles?.onReceiveValue(null)
      pendingFiles = callback
      runCatching { pageFiles.launch(intent) }.onFailure {
        pendingFiles = null
        callback.onReceiveValue(null)
      }
    }
  }

  private val createDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri: Uri? ->
    val pending = pendingSave ?: return@registerForActivityResult
    pendingSave = null
    if (uri != null) downloads.writeUri(pending.first, uri, pending.third)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    dropWebViewExperiments()
    enableEdgeToEdge()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    downloads = Downloads(this) { url, filename, headers ->
      pendingSave = Triple(url, filename, headers)
      createDocument.launch(filename)
    }
    super.onCreate(savedInstanceState)
    onBackPressedDispatcher.addCallback(this, backCallback)
    askNotifications()
    trackWindowInsets()
    val relaunched = (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0
    if (savedInstanceState == null && !relaunched) takeShare(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    link.tapped(intent)
    takeShare(intent)
    deliverShare()
  }

  private fun dropWebViewExperiments() {
    File(dataDir, WEBVIEW_DATA).listFiles { file -> file.name.startsWith(WEBVIEW_SEED) }?.forEach(File::delete)
  }

  private fun askNotifications() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
    notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
  }

  private fun takeShare(intent: Intent?) {
    val uris = when (intent?.action) {
      Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
      Intent.ACTION_SEND_MULTIPLE ->
        IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
      Intent.ACTION_VIEW -> listOfNotNull(intent.data)
      else -> return
    }
    if (uris.isEmpty()) return
    val json = PastedContent.encode(this, uris)
    if (json == "[]") return
    pendingShare = json
    pendingOpened = intent.action == Intent.ACTION_VIEW
    shareAttempts = 0
  }

  /** The web view only takes it once the app registered its hook, which lags a cold start. */
  private fun deliverShare() {
    val json = pendingShare ?: return
    val view = content ?: return
    if (shareAttempts++ > SHARE_ATTEMPTS) return
    view.postDelayed({
      view.evaluateJavascript(
        "window.__cconnectPaste ? (window.__cconnectPaste(${JSONObject.quote(json)}, $pendingOpened), true) : false",
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
    link.onForeground()
    browser.resume()
    content?.evaluateJavascript("window.__cconnectResume && window.__cconnectResume()", null)
  }

  override fun onPause() {
    super.onPause()
    link.onBackground()
    browser.pause()
  }

  override fun onDestroy() {
    link.closeAll()
    browser.closeAll()
    super.onDestroy()
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean =
    browser.dispatch(event) || super.dispatchTouchEvent(event)

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
    webView.addJavascriptInterface(googleAuth, "AndroidGoogleAuth")
    webView.addJavascriptInterface(link, "AndroidLink")
    webView.addJavascriptInterface(browser, "AndroidBrowser")
    PastedContent(webView).install()
    deliverShare()
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
    dictation.onPermissionResult(grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED)
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
    fun accent(): String {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return ""
      return String.format("#%06X", 0xFFFFFF and getColor(android.R.color.system_accent1_500))
    }

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
