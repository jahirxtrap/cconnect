package com.jahirtrap.cconnect.data

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class Role { USER, ASSISTANT, THINKING, WORKING, TOOL, TOOL_RESULT, SUMMARY, INTERACTION, FILE_CHANGE, COMPACT, SYSTEM, API_ERROR, INTERRUPTED, PLAN, AGENT, NOTIFICATION }

enum class SendStatus { SENT, ERROR }

data class QueuedMessage(val id: String, val text: String, val attachments: List<String> = emptyList(), val uploading: Boolean = false, val silent: Boolean = false)

data class ChatMessage(
    val id: Long,
    val role: Role,
    val text: String = "",
    val toolName: String? = null,
    val toolUseId: String? = null,
    val interaction: InteractionData? = null,
    val path: String? = null,
    val diffLines: List<DiffLine>? = null,
    val compact: CompactData? = null,
    val sourceIndex: Int = -1,
    val labelOnly: Boolean = false,
    val result: String? = null,
    val ephemeral: Boolean = false,
    val attachments: List<String>? = null,
    val images: List<String>? = null,
    val timestamp: Long? = null,
    val children: List<ChatMessage> = emptyList(),
    val sendStatus: SendStatus = SendStatus.SENT,
)

data class CompactData(
    val trigger: String?,    // "auto" | "manual"
    val preTokens: Int?,
    val postTokens: Int?,
    val summary: String,
)

enum class DiffKind { HEADER, HUNK, ADD, DEL, CTX }

data class DiffLine(val kind: DiffKind, val text: String)

fun diffKindOf(value: String?): DiffKind = when (value) {
    "header" -> DiffKind.HEADER
    "hunk" -> DiffKind.HUNK
    "add" -> DiffKind.ADD
    "del" -> DiffKind.DEL
    else -> DiffKind.CTX
}

data class InteractionOption(
    val id: String,
    val label: String? = null,
    val description: String? = null,
    val preview: String? = null,
)

data class InteractionQuestion(
    val header: String? = null,
    val question: String? = null,
    val multiSelect: Boolean = false,
    val options: List<InteractionOption> = emptyList(),
)

data class QuestionDraft(
    val selected: Set<String> = emptySet(),
    val freeText: String = "",
    val notes: String = "",
)

data class InteractionData(
    val requestId: String,
    val kind: String,
    val options: List<InteractionOption> = emptyList(),   // permission chips
    val title: String? = null,
    val resolved: String? = null,
    val resolvedText: String? = null,
    val questions: List<InteractionQuestion> = emptyList(),  // kind == "questions"
    val drafts: List<QuestionDraft> = emptyList(),           // parallel to questions, pre-submit
    val submitted: Boolean = false,
    val declined: Boolean = false,                           // "Chat about this" — questions dismissed
    val summary: List<String> = emptyList(),                 // per-question answer text after submit
    val notes: List<String> = emptyList(),                   // per-question note text after submit
    val activeQuestion: Int = 0,
)

val InteractionData.pending: Boolean
    get() = if (kind == "questions") !(submitted || declined) else resolved == null

data class ModelOption(val id: String, val label: String)

data class PermissionMode(val id: String, val label: String)

data class CommandOption(
    val name: String,
    val description: String,
    val kind: String,
    val requireConfirmation: Boolean = false,
)

data class TodoItem(val id: String? = null, val content: String, val status: String, val activeForm: String = "")

data class Capabilities(
    val permissionModes: List<PermissionMode> = listOf(PermissionMode("default", "Default")),
    val effortLevels: List<String> = listOf("low", "medium", "high", "xhigh", "max"),
    val models: List<ModelOption> = listOf(ModelOption("opus", "Opus 4.7")),
    val colors: List<String> = listOf("red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"),
    val commands: List<CommandOption> = emptyList(),
    val accounts: List<ModelOption> = emptyList(),
    val defaults: CapabilitiesDefaults = CapabilitiesDefaults(),
    val serverVersion: String? = null,
    val supportedApp: String? = null,   // version range the server accepts, e.g. ">=1.0.8"
    val cliVersion: String? = null,     // Claude Code version active on the server
    val supportedCli: String? = null,   // Claude Code range this app's features expect
)

data class CapabilitiesDefaults(
    val permissionMode: String = "bypassPermissions",
    val effort: String = "xhigh",
    val model: String = "opus[1m]",
    val account: String = "default",
)

sealed interface ServerEvent {
    data object Connecting : ServerEvent
    data object Open : ServerEvent
    data class Ready(val sessionId: String?, val project: String? = null, val channel: String? = null, val running: Boolean = false, val resumed: Boolean = false, val committedCount: Int? = null) : ServerEvent
    data class AssistantText(val text: String) : ServerEvent
    data class Thinking(val text: String, val labelOnly: Boolean = false) : ServerEvent
    data class ToolUse(val id: String?, val name: String?, val input: String?, val result: String? = null) : ServerEvent
    data class ToolResult(val toolUseId: String?, val content: String?) : ServerEvent
    data class FileChange(val id: String?, val path: String, val diffLines: List<DiffLine>, val labelOnly: Boolean = false) : ServerEvent
    data class Compacting(val trigger: String?) : ServerEvent
    data class Status(val kind: String) : ServerEvent
    data class Compact(val trigger: String?, val preTokens: Int?, val postTokens: Int?, val summary: String) : ServerEvent
    data class CompactSummary(val trigger: String?, val preTokens: Int?, val postTokens: Int?, val summary: String) : ServerEvent
    data class AskText(val text: String) : ServerEvent
    data object Working : ServerEvent
    data object AskWorking : ServerEvent
    data class AskSession(val sessionId: String) : ServerEvent
    data object AskDone : ServerEvent
    data class Command(val markdown: String) : ServerEvent
    data class Plan(val markdown: String) : ServerEvent
    data class Agent(val id: String?, val subagentType: String?, val description: String?, val labelOnly: Boolean) : ServerEvent
    data class Notification(val summary: String, val status: String?) : ServerEvent
    data class Todos(val items: List<TodoItem>) : ServerEvent
    data class Task(val id: String, val content: String?, val status: String?) : ServerEvent
    data class Result(val sessionId: String?, val contextTokens: Int? = null) : ServerEvent
    data class Context(val contextTokens: Int?) : ServerEvent
    data object Done : ServerEvent
    data object Interrupted : ServerEvent
    data class Err(val message: String) : ServerEvent
    data class ApiError(val message: String) : ServerEvent
    data class Closed(val reason: String) : ServerEvent
    data class Queued(val id: String?, val text: String) : ServerEvent
    data class Dequeued(val ids: List<String> = emptyList(), val text: String? = null) : ServerEvent
    data class HistoryChunk(
        val sessionId: String,
        val startIndex: Int,
        val items: List<SessionMessage>,
        val hasMore: Boolean,
    ) : ServerEvent
    data class InteractionRequest(
        val requestId: String,
        val kind: String,
        val toolName: String?,
        val toolUseId: String?,
        val input: String?,
        val title: String?,
        val options: List<InteractionOption>,
        val questions: List<InteractionQuestion> = emptyList(),
    ) : ServerEvent
    data class InteractionResolved(val requestId: String, val optionId: String?) : ServerEvent
}

data class VisibilityPrefs(
    val simple: Boolean? = null,
    val thinking: String? = null,
    val toolUse: String? = null,
    val fileChange: String? = null,
    val compact: String? = null,
) {
    fun toJson(): JsonObject = buildJsonObject {
        simple?.let { put("simple", it) }
        thinking?.let { put("thinking", it) }
        toolUse?.let { put("tool_use", it) }
        fileChange?.let { put("file_change", it) }
        compact?.let { put("compact", it) }
    }
}
