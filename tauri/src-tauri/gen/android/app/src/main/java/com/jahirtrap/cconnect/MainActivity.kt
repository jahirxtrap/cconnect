package com.jahirtrap.cconnect

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override val handleBackNavigation = false

  private lateinit var downloads: Downloads
  private var pendingSave: Triple<String, String, String>? = null
  private var content: WebView? = null

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
    downloads = Downloads(this) { url, filename, headers ->
      pendingSave = Triple(url, filename, headers)
      createDocument.launch(filename)
    }
    super.onCreate(savedInstanceState)
    onBackPressedDispatcher.addCallback(this, backCallback)
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
    webView.addJavascriptInterface(downloads, "AndroidDownloads")
    webView.addJavascriptInterface(Background(), "AndroidBackground")
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
