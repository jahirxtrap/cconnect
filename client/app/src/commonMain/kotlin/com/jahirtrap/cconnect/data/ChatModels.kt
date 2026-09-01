package com.jahirtrap.cconnect.data

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class Role { USER, ASSISTANT, THINKING, WORKING, TOOL, TOOL_RESULT, SUMMARY, INTERACTION, FILE_CHANGE, COMPACT, SYSTEM, API_ERROR, INTERRUPTED, PLAN, AGENT, NOTIFICATION, SESSION_MESSAGE }

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
    val agentResult: AgentResult? = null,
    val thinkingTokens: Int? = null,
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

data class AgentResult(
    val status: String?,
    val durationMs: Long?,
    val tokens: Int?,
    val toolUses: Int?,
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


const val VALUE_SEPARATOR = "\u001F"

data class ComponentConfirm(
    val title: String? = null,
    val text: String,
    val confirmLabel: String? = null,
)

data class ComponentCondition(
    val id: String,
    val equalTo: String? = null,
    val oneOf: List<String>? = null,
    val truthy: Boolean? = null,
)

data class ComponentOption(
    val value: String,
    val label: String,
    val description: String? = null,
    val preview: String? = null,
    val style: String? = null,
    val icon: String? = null,
    val labelKey: String? = null,
    val confirm: ComponentConfirm? = null,
)

data class ComponentElement(
    val type: String,
    val id: String? = null,
    val label: String? = null,
    val text: String? = null,
    val textKey: String? = null,
    val placeholder: String? = null,
    val placeholderKey: String? = null,
    val value: String? = null,
    val checked: Boolean = false,
    val multiline: Boolean = false,
    val lines: Int? = null,
    val secret: Boolean = false,
    val multiple: Boolean = false,
    val required: Boolean = false,
    val color: String? = null,
    val alertAbove: Float? = null,
    val alertBelow: Float? = null,
    val showIf: ComponentCondition? = null,
    val format: String? = null,
    val display: String? = null,
    val min: Float? = null,
    val max: Float? = null,
    val step: Float? = null,
    val minLength: Int? = null,
    val maxLength: Int? = null,
    val pattern: String? = null,
    val error: String? = null,
    val open: Boolean = false,
    val pick: String? = null,
    val start: String? = null,
    val accept: String? = null,
    val options: List<ComponentOption> = emptyList(),
    val block: String? = null,
    val blocks: List<ComponentElement> = emptyList(),
)

data class InteractionData(
    val requestId: String,
    val kind: String,
    val options: List<InteractionOption> = emptyList(),   // permission chips
    val title: String? = null,
    val titleKey: String? = null,
    val icon: String? = null,
    val resolved: String? = null,
    val resolvedText: String? = null,
    val submitted: Boolean = false,
    val declined: Boolean = false,                           // "Chat about this" — questions dismissed
    val activePage: Int = 0,
    val blocks: List<ComponentElement> = emptyList(),        // kind == "component"
    val submitLabel: String? = null,
    val submitKey: String? = null,
    val dismiss: ComponentOption? = null,
    val present: String? = null,
    val dismissedBy: String? = null,
    val values: Map<String, String> = emptyMap(),            // component draft, id -> value
)

private val NESTED = setOf("page", "group")

fun componentLeaves(blocks: List<ComponentElement>): List<ComponentElement> =
    blocks.flatMap { if (it.type in NESTED) componentLeaves(it.blocks) else listOf(it) }

fun componentAnswerable(blocks: List<ComponentElement>): Boolean = blocks.any {
    if (it.type in NESTED) componentAnswerable(it.blocks) else it.type == "buttons" || it.id != null
}

fun Float.toComponentNumber(): String =
    if (this == toLong().toFloat()) toLong().toString() else toString()

private fun answered(raw: String): Boolean = raw.isNotEmpty() && raw != "false"

fun componentHidden(element: ComponentElement, values: Map<String, String>): Boolean {
    val rule = element.showIf ?: return false
    val raw = values[rule.id].orEmpty()
    val parts = raw.split(VALUE_SEPARATOR).filter { it.isNotEmpty() }
    rule.equalTo?.let { return it !in parts }
    rule.oneOf?.let { list -> return parts.none { it in list } }
    rule.truthy?.let { return if (it) !answered(raw) else answered(raw) }
    return false
}

private fun matches(pattern: String, value: String): Boolean = try {
    Regex(pattern).containsMatchIn(value)
} catch (_: IllegalArgumentException) {
    true
}

fun componentInvalid(element: ComponentElement, values: Map<String, String>): Boolean {
    val id = element.id
    if (element.type == "buttons" || element.type == "notes" || id == null) return false
    val raw = values[id].orEmpty()
    if (raw.isEmpty()) return element.required
    if (element.format == "number") {
        val value = raw.toFloatOrNull() ?: return true
        if (element.min != null && value < element.min) return true
        if (element.max != null && value > element.max) return true
        return false
    }
    if (element.type != "input") return false
    if (element.minLength != null && raw.length < element.minLength) return true
    if (element.maxLength != null && raw.length > element.maxLength) return true
    return element.pattern != null && !matches(element.pattern, raw)
}

fun componentBlocked(blocks: List<ComponentElement>, values: Map<String, String>): Boolean = blocks.any { element ->
    if (componentHidden(element, values)) return@any false
    when (element.type) {
        "page" -> {
            val fields = componentLeaves(element.blocks)
                .filter { it.type != "notes" && !componentHidden(it, values) }
            if (element.required && fields.none { !values[it.id.orEmpty()].isNullOrEmpty() }) true
            else componentBlocked(element.blocks, values)
        }

        "group" -> componentBlocked(element.blocks, values)
        else -> componentInvalid(element, values)
    }
}

fun componentHiddenIds(
    blocks: List<ComponentElement>,
    values: Map<String, String>,
    inherited: Boolean = false,
): Set<String> {
    val out = mutableSetOf<String>()
    for (element in blocks) {
        val hidden = inherited || componentHidden(element, values)
        if (element.blocks.isNotEmpty()) out += componentHiddenIds(element.blocks, values, hidden)
        else if (hidden && element.id != null) out += element.id
    }
    return out
}

fun componentValues(blocks: List<ComponentElement>, values: Map<String, String>): Map<String, String> {
    val hidden = componentHiddenIds(blocks, values)
    return values.filter { (key, value) -> value.isNotEmpty() && key !in hidden }
}

val InteractionData.pending: Boolean
    get() = when (kind) {
        "component" -> componentAnswerable(blocks) && !(submitted || declined)
        else -> resolved == null
    }

data class ModelOption(val id: String, val label: String)

data class PermissionMode(val id: String, val label: String)

data class CommandOption(
    val name: String,
    val description: String,
    val kind: String,
    val requireConfirmation: Boolean = false,
    val argumentHint: String = "",
    val aliases: List<String> = emptyList(),
) {
    fun answersTo(token: String): Boolean =
        name.equals(token, ignoreCase = true) || aliases.any { it.equals(token, ignoreCase = true) }

    fun contains(token: String): Boolean =
        name.contains(token, ignoreCase = true) || aliases.any { it.contains(token, ignoreCase = true) }
}

/** The word after a leading slash, or null once the command name is complete. */
fun commandToken(text: String): String? {
    val body = text.trimStart()
    if (!body.startsWith("/")) return null
    val token = body.drop(1).substringBefore(' ').substringBefore('\n')
    return if (body.length > token.length + 1) null else token
}

fun List<CommandOption>.resolve(text: String): CommandOption? {
    val body = text.trim()
    if (!body.startsWith("/")) return null
    val token = body.drop(1).split(' ', '\n').first()
    return if (token.isEmpty()) null else firstOrNull { it.answersTo(token) }
}

data class McpTool(
    val name: String,
    val description: String,
    val group: String? = null,
    val groupDescription: String? = null,
)

data class FastMode(val state: String = "off", val disabledReason: String? = null)

data class ClaudeModel(
    val id: String,
    val label: String,
    val description: String = "",
    val resolvedModel: String = "",
    val effortLevels: List<String> = emptyList(),
    val contextWindow: Int? = null,
    val fastMode: Boolean = false,
    val autoMode: Boolean = false,
)

data class TodoItem(val id: String? = null, val content: String, val status: String, val activeForm: String = "")

data class Capabilities(
    val permissionModes: List<PermissionMode> = listOf(PermissionMode("default", "Default")),
    val models: List<ClaudeModel> = emptyList(),
    val outputStyles: List<String> = emptyList(),
    val fastMode: FastMode = FastMode(),
    val colors: List<String> = listOf("red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"),
    val commands: List<CommandOption> = emptyList(),
    val accounts: List<ModelOption> = emptyList(),
    val mcpTools: List<McpTool> = emptyList(),
    val defaults: CapabilitiesDefaults = CapabilitiesDefaults(),
    val serverVersion: String? = null,
    val supportedApp: String? = null,   // version range the server accepts, e.g. ">=1.0.8"
    val cliVersion: String? = null,     // Claude Code version active on the server
    val supportedCli: String? = null,   // Claude Code range this app's features expect
) {
    fun effortLevelsFor(model: String): List<String> =
        models.firstOrNull { it.id == model }?.effortLevels.orEmpty()

    fun contextWindowFor(model: String): Int? =
        models.firstOrNull { it.id == model }?.contextWindow
}

data class CapabilitiesDefaults(
    val permissionMode: String = "bypassPermissions",
    val effort: String = "xhigh",
    val model: String = "opus[1m]",
    val account: String = "default",
)

sealed interface ServerEvent {
    data object Connecting : ServerEvent
    data object Open : ServerEvent
    data class Ready(val sessionId: String?, val project: String? = null, val channel: String? = null, val running: Boolean = false, val resumed: Boolean = false, val committedCount: Int? = null, val queued: List<QueuedMessage> = emptyList(), val activity: String? = null, val cwd: String? = null) : ServerEvent
    data class Activity(val state: String?) : ServerEvent
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
    data class Component(val title: String?, val titleKey: String?, val icon: String?, val blocks: List<ComponentElement>) : ServerEvent
    data class Plan(val markdown: String) : ServerEvent
    data class Agent(val id: String?, val subagentType: String?, val description: String?, val labelOnly: Boolean) : ServerEvent
    data class AgentDone(val id: String?, val result: AgentResult) : ServerEvent
    data class ThinkingTokens(val tokens: Int) : ServerEvent
    data class HookFailed(val name: String?, val text: String) : ServerEvent
    data class Notification(val summary: String, val status: String?) : ServerEvent
    data class SessionMessageEvent(val name: String?, val text: String) : ServerEvent
    data class Todos(val items: List<TodoItem>) : ServerEvent
    data class Task(val id: String, val content: String?, val status: String?) : ServerEvent
    data class Result(val sessionId: String?) : ServerEvent
    data class Context(val contextTokens: Int?) : ServerEvent
    data object Done : ServerEvent
    data object Interrupted : ServerEvent
    data object Attached : ServerEvent
    data class Err(val message: String) : ServerEvent
    data class ApiError(val message: String) : ServerEvent
    data class Closed(val reason: String) : ServerEvent
    data class Queued(val id: String?, val text: String) : ServerEvent
    data class Queue(val items: List<QueuedMessage> = emptyList()) : ServerEvent
    data class Dequeued(
        val ids: List<String> = emptyList(),
        val text: String? = null,
        val timestamp: Long? = null,
    ) : ServerEvent
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
        val titleKey: String? = null,
        val icon: String? = null,
        val options: List<InteractionOption>,
        val blocks: List<ComponentElement> = emptyList(),
        val submitLabel: String? = null,
        val submitKey: String? = null,
        val dismiss: ComponentOption? = null,
        val present: String? = null,
        val replay: Boolean = false,
    ) : ServerEvent
    data class InteractionResolved(val requestId: String, val optionId: String?, val values: Map<String, String>? = null, val dismissed: Boolean = false) : ServerEvent
}

data class VisibilityPrefs(
    val simple: String? = null,
    val thinking: String? = null,
    val toolUse: String? = null,
    val fileChange: String? = null,
    val compact: String? = null,
    val working: String? = null,
    val tokens: String? = null,
) {
    fun toJson(): JsonObject = buildJsonObject {
        simple?.let { put("simple", it == "on") }
        thinking?.let { put("thinking", it) }
        toolUse?.let { put("tool_use", it) }
        fileChange?.let { put("file_change", it) }
        compact?.let { put("compact", it) }
        working?.let { put("working", it) }
        tokens?.let { put("tokens", it == "on") }
    }
}
