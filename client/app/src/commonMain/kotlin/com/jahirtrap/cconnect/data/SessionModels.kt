package com.jahirtrap.cconnect.data

data class ProjectInfo(
    val projectKey: String,
    val path: String?,
    val name: String?,
    val sessionCount: Int,
    val lastActive: Double?,
    val customName: Boolean = false,
)

fun projectLabel(project: ProjectInfo): String = project.name ?: project.path ?: project.projectKey

data class ChatCategory(
    val id: String,
    val name: String,
    val position: Double,
    val color: String?,
)

data class ChatPlacement(
    val sessionId: String,
    val categoryId: String?,
    val position: Double,
)

data class SessionInfo(
    val sessionId: String,
    val projectKey: String?,
    val path: String?,
    val lastActive: Double?,
    val size: Long,
    val preview: String?,
    val title: String?,
    val color: String?,
    val activity: String? = null,
)

data class TrashedSession(
    val sessionId: String,
    val projectKey: String,
    val title: String?,
    val path: String?,
    val deletedAt: Double,
)

data class SessionMessage(
    val type: String?,
    val role: String?,
    val text: String,
    val name: String? = null,
    val path: String? = null,
    val interaction: InteractionData? = null,
    val diffLines: List<DiffLine>? = null,
    val compact: CompactData? = null,
    val index: Int = -1,
    val labelOnly: Boolean = false,
    val result: String? = null,
    val images: List<String>? = null,
    val timestamp: Long? = null,
    val parent: String? = null,
    val toolUseId: String? = null,
)

private val VISIBLE_ROLES = setOf(Role.TOOL, Role.WORKING, Role.INTERRUPTED)

fun SessionMessage.toRole(): Role = when (type) {
    "text" -> if (role == "assistant") Role.ASSISTANT else Role.USER
    "thinking" -> Role.THINKING
    "working" -> Role.WORKING
    "notification" -> Role.NOTIFICATION
    "tool_use" -> Role.TOOL
    "tool_result" -> Role.TOOL_RESULT
    "file_change" -> Role.FILE_CHANGE
    "interaction" -> Role.INTERACTION
    "compact" -> Role.COMPACT
    "summary" -> Role.SUMMARY
    "agent" -> Role.AGENT
    "plan" -> Role.PLAN
    "api_error" -> Role.API_ERROR
    "interrupted" -> Role.INTERRUPTED
    else -> Role.SYSTEM
}

fun SessionMessage.visible(): Boolean = text.isNotBlank() ||
    interaction != null ||
    !diffLines.isNullOrEmpty() ||
    compact != null ||
    labelOnly ||
    !images.isNullOrEmpty() ||
    toRole() in VISIBLE_ROLES

data class SharedEntry(
    val name: String,
    val isDir: Boolean,
    val size: Long,
    val modified: Double,
    val items: Int = 0,
)
