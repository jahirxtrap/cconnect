package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.DiffLine
import com.jahirtrap.cconnect.data.InteractionOption
import com.jahirtrap.cconnect.data.InteractionQuestion
import com.jahirtrap.cconnect.data.QuestionDraft
import com.jahirtrap.cconnect.data.ServerEvent
import com.jahirtrap.cconnect.data.TodoItem
import com.jahirtrap.cconnect.data.diffKindOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
class ChatSocket(private val scope: CoroutineScope, private val config: () -> BackendConfig) {
    private var ws: WsConnection? = null

    // Per-connect token so callbacks from a superseded socket are ignored — lets a drop auto-reconnect cleanly.
    private var generation = 0
    private var closed = true
    private var reconnectAttempts = 0
    private var reconnectJob: Job? = null

    // Resume cursor across reconnects: re-attach by channel, replay events after lastSeq.
    // Per-lane because each LiveSession seq-counts independently (main + quick-chat side).
    private var channel: String? = null
    private var lastSeq = 0
    private var sideChannel: String? = null
    private var sideLastSeq = 0
    private var sideResume: String? = null

    // Boolean = side lane (quick chat) vs main lane.
    private val _events = MutableSharedFlow<Triple<Boolean, String?, ServerEvent>>(extraBufferCapacity = 256)
    val events: SharedFlow<Triple<Boolean, String?, ServerEvent>> = _events

    private fun emit(side: Boolean, event: ServerEvent, parent: String? = null) {
        scope.launch { _events.emit(Triple(side, parent, event)) }
    }

    fun connect() {
        closed = false
        reconnectAttempts = 0
        reconnectJob?.cancel()
        open()
    }

    fun resetResume() {
        channel = null
        lastSeq = 0
        sideChannel = null
        sideLastSeq = 0
        sideResume = null
    }

    private fun open() {
        val gen = ++generation
        ws?.cancel()
        emit(false, ServerEvent.Connecting)
        ws = openWebSocket(config().wsUrl, config().authHeaders, object : WsListener {
            override fun onOpen() {
                if (gen != generation) return
                reconnectAttempts = 0
                emit(false, ServerEvent.Open)
            }

            override fun onMessage(text: String) {
                if (gen != generation) return
                parse(text)?.let { (side, parent, event) -> emit(side, event, parent) }
            }

            override fun onFailure(reason: String) {
                if (gen != generation) return
                onDrop(reason)
            }

            override fun onClosed(reason: String) {
                if (gen != generation) return
                onDrop(reason.ifBlank { "closed" })
            }
        })
    }

    private fun onDrop(reason: String) {
        emit(false, ServerEvent.Closed(reason))
        if (closed) return
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            val backoff = minOf(15_000L, 1000L shl minOf(reconnectAttempts, 4))
            reconnectAttempts++
            delay(backoff)
            if (!closed) open()
        }
    }

    fun sendStart(
        cwd: String,
        permissionMode: String,
        resume: String?,
        model: String,
        effort: String,
        partial: Boolean,
        account: String = "",
    ) {
        send(buildJsonObject {
            put("type", "start")
            put("cwd", cwd)
            put("permission_mode", permissionMode)
            if (resume != null) put("resume", resume) else put("resume", JsonNull)
            put("fork", false)
            if (account.isNotEmpty()) put("account", account)
            put("model", model)
            put("effort", effort)
            put("partial", partial)
            put("base_url", config().baseUrl)
            channel?.let { put("channel", it) }
            put("last_seq", lastSeq)
            sideChannel?.let { put("side_channel", it) }
            sideResume?.let { put("side_resume", it) }
            if (sideChannel != null) put("side_last_seq", sideLastSeq)
        })
    }

    fun sendPrompt(text: String, attachments: List<String> = emptyList(), id: String? = null) {
        send(buildJsonObject {
            put("type", "prompt")
            put("text", text)
            if (attachments.isNotEmpty()) putJsonArray("attachments") { attachments.forEach { add(it) } }
            if (id != null) put("id", id)
        })
    }

    fun sendSetPermissionMode(mode: String) {
        send(buildJsonObject {
            put("type", "set_permission_mode")
            put("mode", mode)
        })
    }

    fun sendSetGeneration(
        model: String? = null,
        effort: String? = null,
        partial: Boolean? = null,
        account: String? = null,
        cwd: String? = null,
    ) {
        send(buildJsonObject {
            put("type", "set_generation")
            cwd?.let { put("cwd", it) }
            model?.let { put("model", it) }
            effort?.let { put("effort", it) }
            partial?.let { put("partial", it) }
            account?.let { put("account", it) }
        })
    }

    fun sendInterrupt(lane: String? = null) {
        send(buildJsonObject {
            put("type", "interrupt")
            if (lane != null) put("lane", lane)
        })
    }

    fun sendAsk(text: String, resume: String?) {
        if (resume != null) sideResume = resume
        send(buildJsonObject {
            put("type", "ask")
            put("text", text)
            if (resume != null) put("resume", resume)
        })
    }

    fun sendUsage() {
        send(buildJsonObject { put("type", "usage") })
    }

    fun sendLoadHistory(sessionId: String, project: String, beforeIndex: Int, limit: Int = 100) {
        send(buildJsonObject {
            put("type", "load_history")
            put("session_id", sessionId)
            put("project", project)
            put("before_index", beforeIndex)
            put("limit", limit)
        })
    }

    fun sendInteractionResponse(requestId: String, optionId: String, freeText: String?) {
        send(buildJsonObject {
            put("type", "interaction_response")
            put("id", requestId)
            put("option_id", optionId)
            if (!freeText.isNullOrBlank()) put("free_text", freeText)
        })
    }

    fun sendQuestionsResponse(requestId: String, answers: List<QuestionDraft>) {
        send(buildJsonObject {
            put("type", "interaction_response")
            put("id", requestId)
            putJsonArray("answers") {
                answers.forEach { d ->
                    addJsonObject {
                        putJsonArray("selected") { d.selected.forEach { add(it) } }
                        if (d.freeText.isNotBlank()) put("free_text", d.freeText)
                        if (d.notes.isNotBlank()) put("notes", d.notes)
                    }
                }
            }
        })
    }

    fun sendQuestionsChat(requestId: String) {
        send(buildJsonObject {
            put("type", "interaction_response")
            put("id", requestId)
            put("chat", true)
        })
    }

    fun close() {
        closed = true
        reconnectJob?.cancel()
        generation++
        ws?.close(1000, null)
        ws = null
        resetResume()
    }

    private fun send(payload: JsonObject) {
        ws?.send(payload.toString())
    }

    private fun parse(text: String): Triple<Boolean, String?, ServerEvent>? {
        val obj = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return null
        fun str(key: String): String? = obj[key]?.jsonPrimitive?.contentOrNull
        fun flag(key: String): Boolean = obj[key]?.jsonPrimitive?.booleanOrNull == true
        val parent = str("parent")
        val type = str("type")
        if (type == "ready") {
            // New channel = fresh server session (replay restarts at 1); reset the cursor.
            val newChannel = str("channel")
            if (newChannel != null && newChannel != channel) {
                channel = newChannel
                lastSeq = 0
            }
            return Triple(false, null, ServerEvent.Ready(str("session_id"), str("project"), newChannel, flag("running"), flag("resumed"), obj["committed_count"]?.jsonPrimitive?.intOrNull))
        }
        val ch = str("channel")
        val side = ch != null && channel != null && ch != channel
        if (side && ch != sideChannel) {
            sideChannel = ch
            sideLastSeq = 0
        }
        val seq = obj["seq"]?.jsonPrimitive?.intOrNull
        if (seq != null) {
            val last = if (side) sideLastSeq else lastSeq
            if (type != "interaction_request" && seq <= last) return null
            if (seq > last) { if (side) sideLastSeq = seq else lastSeq = seq }
        }
        val event = when (type) {
            "assistant_text" -> ServerEvent.AssistantText(str("text").orEmpty())
            "thinking" -> ServerEvent.Thinking(str("text").orEmpty(), labelOnly = flag("label"))
            "tool_use" -> ServerEvent.ToolUse(str("id"), str("name"), str("input"), result = str("result"))
            "tool_result" -> ServerEvent.ToolResult(str("tool_use_id"), str("content"))
            "file_change" -> ServerEvent.FileChange(
                str("id"),
                str("path").orEmpty(),
                obj["diff_lines"]?.jsonArray?.map { el ->
                    val o = el.jsonObject
                    DiffLine(
                        kind = diffKindOf(o["kind"]?.jsonPrimitive?.contentOrNull),
                        text = o["text"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    )
                } ?: emptyList(),
                labelOnly = flag("label"),
            )
            "compacting" -> ServerEvent.Compacting(trigger = str("trigger"))
            "status" -> ServerEvent.Status(kind = str("kind").orEmpty())
            "compact" -> ServerEvent.Compact(
                trigger = str("trigger"),
                preTokens = obj["pre_tokens"]?.jsonPrimitive?.intOrNull,
                postTokens = obj["post_tokens"]?.jsonPrimitive?.intOrNull,
                summary = str("summary").orEmpty(),
            )
            "ask_text" -> ServerEvent.AskText(str("text").orEmpty())
            "ask_working" -> ServerEvent.AskWorking
            "ask_session" -> ServerEvent.AskSession(str("session_id").orEmpty())
            "ask_done" -> ServerEvent.AskDone
            "command" -> ServerEvent.Command(str("markdown").orEmpty())
            "plan" -> ServerEvent.Plan(str("markdown").orEmpty())
            "notification" -> ServerEvent.Notification(str("text").orEmpty(), str("result"))
            "queued" -> ServerEvent.Queued(str("id"), str("text").orEmpty())
            "dequeued" -> ServerEvent.Dequeued(
                obj["ids"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList(),
                str("text"),
            )
            "agent" -> ServerEvent.Agent(str("id"), str("subagent_type"), str("description"), flag("label"))
            "compact_summary" -> ServerEvent.CompactSummary(
                trigger = str("trigger"),
                preTokens = obj["pre_tokens"]?.jsonPrimitive?.intOrNull,
                postTokens = obj["post_tokens"]?.jsonPrimitive?.intOrNull,
                summary = str("summary").orEmpty(),
            )
            "todos" -> ServerEvent.Todos(
                obj["items"]?.jsonArray?.map { el ->
                    val o = el.jsonObject
                    TodoItem(
                        content = o["content"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                        status = o["status"]?.jsonPrimitive?.contentOrNull ?: "pending",
                        activeForm = o["active_form"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    )
                } ?: emptyList()
            )
            "task" -> ServerEvent.Task(str("id").orEmpty(), str("content"), str("status"))
            "result" -> ServerEvent.Result(str("session_id"), obj["context_tokens"]?.jsonPrimitive?.intOrNull)
            "context" -> ServerEvent.Context(obj["context_tokens"]?.jsonPrimitive?.intOrNull)
            "done" -> ServerEvent.Done
            "interrupted" -> ServerEvent.Interrupted
            "error" -> ServerEvent.Err(
                obj["message"]?.jsonPrimitive?.contentOrNull
                    ?: obj["message"]?.toString()
                    ?: "error"
            )
            "api_error" -> ServerEvent.ApiError(str("text").orEmpty())
            "history_chunk" -> ServerEvent.HistoryChunk(
                sessionId = str("session_id").orEmpty(),
                startIndex = obj["start_index"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: 0,
                items = obj["items"]?.jsonArray?.map { SessionsApi.parseSessionMessage(it) } ?: emptyList(),
                hasMore = obj["has_more"]?.jsonPrimitive?.contentOrNull == "true",
            )
            "interaction_request" -> ServerEvent.InteractionRequest(
                requestId = str("id").orEmpty(),
                kind = str("kind") ?: "permission",
                toolName = str("tool_name"),
                toolUseId = str("tool_use_id"),
                input = str("input"),
                title = str("title"),
                options = obj["options"]?.jsonArray?.map { it.jsonObject.toOption() } ?: emptyList(),
                questions = obj["questions"]?.jsonArray?.map { el ->
                    val q = el.jsonObject
                    InteractionQuestion(
                        header = q["header"]?.jsonPrimitive?.contentOrNull,
                        question = q["question"]?.jsonPrimitive?.contentOrNull,
                        multiSelect = q["multi_select"]?.jsonPrimitive?.booleanOrNull == true,
                        options = q["options"]?.jsonArray?.map { it.jsonObject.toOption() } ?: emptyList(),
                    )
                } ?: emptyList(),
            )
            "interaction_resolved" -> ServerEvent.InteractionResolved(
                requestId = str("id").orEmpty(),
                optionId = str("option_id"),
            )
            else -> null
        }
        if (event is ServerEvent.AskSession) sideResume = event.sessionId
        return event?.let { Triple(side, parent, it) }
    }
}

private fun JsonObject.toOption() = InteractionOption(
    id = this["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
    label = this["label"]?.jsonPrimitive?.contentOrNull,
    description = this["description"]?.jsonPrimitive?.contentOrNull,
    preview = this["preview"]?.jsonPrimitive?.contentOrNull,
)
