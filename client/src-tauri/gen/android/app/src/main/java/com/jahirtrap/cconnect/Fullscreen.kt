package com.jahirtrap.cconnect

import android.graphics.Bitmap
import android.net.Uri
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class Fullscreen(private val activity: ComponentActivity, private val inner: WebChromeClient) : WebChromeClient() {
  private var shown: View? = null
  private var callback: CustomViewCallback? = null

  private val back = object : OnBackPressedCallback(false) {
    override fun handleOnBackPressed() = onHideCustomView()
  }

  init {
    activity.onBackPressedDispatcher.addCallback(activity, back)
  }

  private val bars: WindowInsetsControllerCompat
    get() = WindowCompat.getInsetsController(activity.window, activity.window.decorView)

  override fun onShowCustomView(view: View, callback: CustomViewCallback) {
    if (shown != null) {
      callback.onCustomViewHidden()
      return
    }
    shown = view
    this.callback = callback
    (activity.window.decorView as ViewGroup).addView(
      view,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    bars.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    bars.hide(WindowInsetsCompat.Type.systemBars())
    back.isEnabled = true
  }

  override fun onHideCustomView() {
    val view = shown ?: return
    (activity.window.decorView as ViewGroup).removeView(view)
    bars.show(WindowInsetsCompat.Type.systemBars())
    back.isEnabled = false
    shown = null
    callback?.onCustomViewHidden()
    callback = null
  }

  override fun onPermissionRequest(request: PermissionRequest) = inner.onPermissionRequest(request)

  override fun onPermissionRequestCanceled(request: PermissionRequest) = inner.onPermissionRequestCanceled(request)

  override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult) =
    inner.onJsAlert(view, url, message, result)

  override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult) =
    inner.onJsConfirm(view, url, message, result)

  override fun onJsPrompt(view: WebView, url: String, message: String, defaultValue: String?, result: JsPromptResult) =
    inner.onJsPrompt(view, url, message, defaultValue, result)

  override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) =
    inner.onGeolocationPermissionsShowPrompt(origin, callback)

  override fun onShowFileChooser(
    webView: WebView,
    filePathCallback: ValueCallback<Array<Uri>>,
    fileChooserParams: FileChooserParams,
  ) = inner.onShowFileChooser(webView, filePathCallback, fileChooserParams)

  override fun onConsoleMessage(consoleMessage: ConsoleMessage) = inner.onConsoleMessage(consoleMessage)

  override fun onReceivedTitle(view: WebView, title: String) = inner.onReceivedTitle(view, title)

  override fun onReceivedIcon(view: WebView, icon: Bitmap) = inner.onReceivedIcon(view, icon)

  override fun getDefaultVideoPoster(): Bitmap? = inner.defaultVideoPoster

  override fun onProgressChanged(view: WebView, newProgress: Int) = inner.onProgressChanged(view, newProgress)

  override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message) =
    inner.onCreateWindow(view, isDialog, isUserGesture, resultMsg)

  override fun onCloseWindow(window: WebView) = inner.onCloseWindow(window)
}
