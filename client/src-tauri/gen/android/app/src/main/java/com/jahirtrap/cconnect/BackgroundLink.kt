package com.jahirtrap.cconnect

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

private const val CHANNEL_ID = "cconnect.chat"
private const val PING_SECONDS = 20L
private const val QUEUE_LIMIT = 2000
private val BUSY = setOf("working", "slow", "compacting")

class BackgroundLink(private val context: Context, private val view: () -> WebView?) {
  private val client = OkHttpClient.Builder()
    .pingInterval(PING_SECONDS, TimeUnit.SECONDS)
    .readTimeout(0, TimeUnit.MILLISECONDS)
    .build()

  private val sockets = ConcurrentHashMap<String, WebSocket>()
  private val queued = ConcurrentHashMap<String, MutableList<String>>()
  private val activity = ConcurrentHashMap<String, String>()
  private val titles = ConcurrentHashMap<String, String>()

  @Volatile private var awake = true
  @Volatile private var doneTitle = ""
  @Volatile private var waitingTitle = ""

  fun onForeground() {
    awake = true
    for (id in queued.keys.toList()) {
      val pending = queued.remove(id) ?: continue
      for (frame in pending) deliver(frame)
    }
  }

  fun onBackground() {
    awake = false
  }

  fun closeAll() {
    for (socket in sockets.values) socket.cancel()
    sockets.clear()
    queued.clear()
  }

  @JavascriptInterface
  fun reset() = closeAll()

  @JavascriptInterface
  fun notifications(done: String, waiting: String) {
    doneTitle = done
    waitingTitle = waiting
  }

  @JavascriptInterface
  fun open(id: String, url: String) {
    sockets.remove(id)?.cancel()
    queued.remove(id)
    sockets[id] = client.newWebSocket(
      Request.Builder().url(url.replaceFirst("ws", "http")).build(),
      object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) = emit(id, "open", "")
        override fun onMessage(webSocket: WebSocket, text: String) {
          if (!awake) watch(text)
          emit(id, "message", text)
        }
        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = emit(id, "close", reason)
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) =
          emit(id, "close", t.message ?: "failed")
      },
    )
  }

  @JavascriptInterface
  fun send(id: String, text: String) {
    sockets[id]?.send(text)
  }

  @JavascriptInterface
  fun close(id: String) {
    sockets.remove(id)?.cancel()
    queued.remove(id)
  }

  private fun watch(text: String) {
    val event = runCatching { JSONObject(text) }.getOrNull() ?: return
    when (event.optString("type")) {
      "snapshot" -> {
        val sessions = event.optJSONArray("sessions") ?: return
        for (index in 0 until sessions.length()) remember(sessions.optJSONObject(index) ?: continue)
      }
      "session_changed" -> announce(event.optJSONObject("session") ?: return)
    }
  }

  private fun remember(session: JSONObject) {
    val id = session.optString("session_id")
    if (id.isEmpty()) return
    activity[id] = session.optString("activity")
    titles[id] = session.optString("title")
  }

  private fun announce(session: JSONObject) {
    val id = session.optString("session_id")
    if (id.isEmpty()) return
    val before = activity[id] ?: ""
    val now = session.optString("activity")
    remember(session)
    val name = titles[id].orEmpty()
    if (now == "waiting" && before != "waiting") notify(id, waitingTitle, name)
    else if (before in BUSY && now !in BUSY && now != "waiting") notify(id, doneTitle, name)
  }

  private fun notify(id: String, title: String, body: String) {
    if (title.isEmpty()) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, context.getString(R.string.app_name), NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    val open = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_IMMUTABLE,
    )
    manager.notify(
      id.hashCode(),
      Notification.Builder(context, CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(body)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentIntent(open)
        .setAutoCancel(true)
        .build(),
    )
  }

  private fun emit(id: String, kind: String, payload: String) {
    val frame = JSONObject().put("id", id).put("kind", kind).put("payload", payload).toString()
    if (awake) {
      deliver(frame)
      return
    }
    val pending = queued.getOrPut(id) { mutableListOf() }
    synchronized(pending) {
      if (pending.size >= QUEUE_LIMIT) pending.removeAt(0)
      pending.add(frame)
    }
  }

  private fun deliver(frame: String) {
    val target = view() ?: return
    target.post {
      target.evaluateJavascript("window.__cconnectLink && window.__cconnectLink($frame)", null)
    }
  }
}
