package com.jahirtrap.cconnect

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

private const val CHANNEL_ID = "cconnect.chat"
private const val PING_SECONDS = 20L
private val BUSY = setOf("working", "slow", "compacting")

class BackgroundLink(private val context: Context) {
  private val client = OkHttpClient.Builder()
    .pingInterval(PING_SECONDS, TimeUnit.SECONDS)
    .readTimeout(0, TimeUnit.MILLISECONDS)
    .build()

  private var socket: WebSocket? = null
  private var doneTitle = ""
  private var waitingTitle = ""
  private val activity = mutableMapOf<String, String>()
  private val titles = mutableMapOf<String, String>()

  fun open(payload: String) {
    close()
    val config = runCatching { JSONObject(payload) }.getOrNull() ?: return
    val url = config.optString("url")
    if (url.isEmpty()) return
    doneTitle = config.optString("done")
    waitingTitle = config.optString("waiting")
    activity.clear()
    titles.clear()
    socket = client.newWebSocket(
      Request.Builder().url(url.replaceFirst("ws", "http")).build(),
      object : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) = onEvent(text)
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
          socket = null
        }
      },
    )
  }

  fun close() {
    socket?.cancel()
    socket = null
  }

  private fun onEvent(text: String) {
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
}
