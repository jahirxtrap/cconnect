package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.ListBackend
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class ChatListSocket(
    private val scope: CoroutineScope,
    private val config: () -> BackendConfig,
    private val store: ListBackend,
) {
    private var ws: WsConnection? = null
    private var generation = 0
    private var closed = false
    private var reconnectAttempts = 0
    private var reconnectJob: Job? = null

    fun connect() {
        closed = false
        reconnectAttempts = 0
        reconnectJob?.cancel()
        open()
    }

    private fun open() {
        val gen = ++generation
        ws?.cancel()
        ws = openWebSocket(config().listWsUrl, config().authHeaders, object : WsListener {
            override fun onOpen() { if (gen == generation) reconnectAttempts = 0 }
            override fun onMessage(text: String) { if (gen == generation) parse(text) }
            override fun onFailure(reason: String) { if (gen == generation) onDrop() }
            override fun onClosed(reason: String) { if (gen == generation) onDrop() }
        })
    }

    private fun onDrop() {
        if (closed) return
        store.onReconnecting()
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            val backoff = minOf(15_000L, 1000L shl minOf(reconnectAttempts, 4))
            reconnectAttempts++
            delay(backoff)
            if (!closed) open()
        }
    }

    fun close() {
        closed = true
        reconnectJob?.cancel()
        generation++
        ws?.close(1000, null)
        ws = null
    }

    private fun parse(text: String) {
        val obj = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        when (obj["type"]?.jsonPrimitive?.contentOrNull) {
            "snapshot" -> store.applySnapshot(
                obj["projects"]?.jsonArray?.map { SessionsApi.parseProject(it.jsonObject) } ?: emptyList(),
                obj["sessions"]?.jsonArray?.map { SessionsApi.parseSession(it.jsonObject) } ?: emptyList(),
                obj["categories"]?.jsonArray?.map { SessionsApi.parseCategory(it.jsonObject) } ?: emptyList(),
                obj["placement"]?.jsonArray?.map { SessionsApi.parsePlacement(it.jsonObject) } ?: emptyList(),
            )
            "category_changed" -> obj["category"]?.let { store.upsertCategory(SessionsApi.parseCategory(it.jsonObject)) }
            "category_removed" -> obj["category_id"]?.jsonPrimitive?.contentOrNull?.let { store.removeCategory(it) }
            "placement_changed" -> obj["placement"]?.let { store.upsertPlacement(SessionsApi.parsePlacement(it.jsonObject)) }
            "placement_removed" -> obj["session_id"]?.jsonPrimitive?.contentOrNull?.let { store.removePlacement(it) }
            "session_changed" -> obj["session"]?.let { store.upsertSession(SessionsApi.parseSession(it.jsonObject)) }
            "session_removed" -> obj["session_id"]?.jsonPrimitive?.contentOrNull?.let { store.removeSession(it) }
            "project_changed" -> obj["project"]?.let { store.upsertProject(SessionsApi.parseProject(it.jsonObject)) }
            "project_removed" -> obj["project_key"]?.jsonPrimitive?.contentOrNull?.let { store.removeProject(it) }
        }
    }
}
