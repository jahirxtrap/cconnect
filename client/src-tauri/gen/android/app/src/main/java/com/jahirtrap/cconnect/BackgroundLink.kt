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
private const val BATCH_LIMIT = 200
private const val ACTIVITY = "activity"
private const val READY = "ready"
private const val WAITING = "waiting"
private const val NAME_SLOT = "{1}"
private const val TAP = "tap"
private const val EXTRA_SOCKET = "cconnect.notification.socket"
private const val EXTRA_SESSION = "cconnect.notification.session"
private val BUSY = setOf("working", "retrying", "compacting")

class BackgroundLink(private val context: Context, private val view: () -> WebView?) {
  private val client = OkHttpClient.Builder()
    .pingInterval(PING_SECONDS, TimeUnit.SECONDS)
    .readTimeout(0, TimeUnit.MILLISECONDS)
    .build()

  private val sockets = ConcurrentHashMap<String, WebSocket>()
  private val queued = ConcurrentHashMap<String, MutableList<String>>()
  private val activity = ConcurrentHashMap<String, String>()
  private val titles = ConcurrentHashMap<String, String>()
  private val agents = ConcurrentHashMap<String, String>()
  private val subjects = ConcurrentHashMap<String, String>()
  private val states = ConcurrentHashMap<String, String>()
  private val outbox = ArrayDeque<String>()
  private var draining = false

  @Volatile private var awake = true
  @Volatile private var doneTitle = ""
  @Volatile private var waitingTitle = ""
  @Volatile private var claudeName = ""

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
    agents.clear()
    subjects.clear()
    states.clear()
  }

  @JavascriptInterface
  fun reset() = closeAll()

  @JavascriptInterface
  fun notifications(done: String, waiting: String, claude: String) {
    doneTitle = done
    waitingTitle = waiting
    claudeName = claude
  }

  @JavascriptInterface
  fun open(id: String, url: String, agent: String) {
    close(id)
    if (agent.isNotEmpty()) agents[id] = agent
    sockets[id] = client.newWebSocket(
      Request.Builder().url(url.replaceFirst("ws", "http")).build(),
      object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) = emit(id, "open", "")
        override fun onMessage(webSocket: WebSocket, text: String) {
          if (agents.containsKey(id) && text.contains(ACTIVITY)) follow(id, text)
          if (!awake) watch(id, text)
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
  fun describe(id: String, subject: String) {
    subjects[id] = subject
  }

  @JavascriptInterface
  fun close(id: String) {
    sockets.remove(id)?.cancel()
    queued.remove(id)
    agents.remove(id)
    subjects.remove(id)
    states.remove(id)
  }

  private fun follow(id: String, text: String) {
    val event = runCatching { JSONObject(text) }.getOrNull() ?: return
    when (event.optString("type")) {
      READY -> states[id] = event.optString(ACTIVITY)
      ACTIVITY -> moved(id, event.optString("state"))
    }
  }

  private fun moved(id: String, now: String) {
    val before = states.put(id, now).orEmpty()
    val agent = agents[id] ?: return
    if (!awake) changed(id, "", before, now, agent, subjects[id].orEmpty())
  }

  private fun changed(socket: String, session: String, before: String, now: String, name: String, body: String) {
    if (now == WAITING && before != WAITING) notify(socket, session, titled(waitingTitle, name), body)
    else if (before in BUSY && now !in BUSY && now != WAITING) notify(socket, session, titled(doneTitle, name), body)
  }

  private fun titled(template: String, name: String) = template.replace(NAME_SLOT, name)

  fun tapped(intent: Intent) {
    val socket = intent.getStringExtra(EXTRA_SOCKET) ?: return
    val session = intent.getStringExtra(EXTRA_SESSION).orEmpty()
    intent.removeExtra(EXTRA_SOCKET)
    intent.removeExtra(EXTRA_SESSION)
    emit(socket, TAP, session)
  }

  private fun watch(socket: String, text: String) {
    val event = runCatching { JSONObject(text) }.getOrNull() ?: return
    when (event.optString("type")) {
      "snapshot" -> {
        val sessions = event.optJSONArray("sessions") ?: return
        for (index in 0 until sessions.length()) remember(sessions.optJSONObject(index) ?: continue)
      }
      "session_changed" -> announce(socket, event.optJSONObject("session") ?: return)
    }
  }

  private fun remember(session: JSONObject) {
    val id = session.optString("session_id")
    if (id.isEmpty()) return
    activity[id] = session.optString("activity")
    titles[id] = session.optString("title")
  }

  private fun announce(socket: String, session: JSONObject) {
    val id = session.optString("session_id")
    if (id.isEmpty()) return
    val before = activity[id] ?: ""
    val now = session.optString("activity")
    remember(session)
    changed(socket, id, before, now, claudeName, titles[id].orEmpty())
  }

  private fun notify(socket: String, session: String, title: String, body: String) {
    if (title.isEmpty()) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, context.getString(R.string.app_name), NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    val key = session.ifEmpty { socket }.hashCode()
    val open = PendingIntent.getActivity(
      context,
      key,
      Intent(context, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .putExtra(EXTRA_SOCKET, socket)
        .putExtra(EXTRA_SESSION, session),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    manager.notify(
      key,
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
    synchronized(outbox) {
      outbox.addLast(frame)
      if (draining) return
      draining = true
    }
    drain()
  }

  private fun drain() {
    val target = view()
    if (target == null) {
      synchronized(outbox) {
        outbox.clear()
        draining = false
      }
      return
    }
    target.post {
      val batch = synchronized(outbox) {
        List(minOf(outbox.size, BATCH_LIMIT)) { outbox.removeFirst() }
      }
      target.evaluateJavascript("window.__cconnectLink && window.__cconnectLink([${batch.joinToString(",")}])") {
        val more = synchronized(outbox) {
          draining = outbox.isNotEmpty()
          draining
        }
        if (more) drain()
      }
    }
  }
}
