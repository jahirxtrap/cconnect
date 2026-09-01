package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.AgentResult
import com.jahirtrap.cconnect.data.ChatCategory
import com.jahirtrap.cconnect.data.ChatPlacement
import com.jahirtrap.cconnect.data.CompactData
import com.jahirtrap.cconnect.data.DiffLine
import com.jahirtrap.cconnect.data.InteractionData
import com.jahirtrap.cconnect.data.InteractionOption
import com.jahirtrap.cconnect.data.diffKindOf
import com.jahirtrap.cconnect.data.ProjectInfo
import com.jahirtrap.cconnect.data.SessionInfo
import com.jahirtrap.cconnect.data.SessionMessage
import com.jahirtrap.cconnect.data.TrashedSession
import com.jahirtrap.cconnect.data.VALUE_SEPARATOR
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.add
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import com.jahirtrap.cconnect.data.VisibilityPrefs

object SessionsApi {

    fun parseProject(o: JsonObject): ProjectInfo = ProjectInfo(
        projectKey = o["project_key"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        path = o["path"]?.jsonPrimitive?.contentOrNull,
        name = o["name"]?.jsonPrimitive?.contentOrNull,
        sessionCount = o["session_count"]?.jsonPrimitive?.intOrNull ?: 0,
        lastActive = o["last_active"]?.jsonPrimitive?.doubleOrNull,
        customName = o["custom_name"]?.jsonPrimitive?.contentOrNull == "true",
    )

    fun parseSession(o: JsonObject): SessionInfo = SessionInfo(
        sessionId = o["session_id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        projectKey = o["project_key"]?.jsonPrimitive?.contentOrNull,
        path = o["path"]?.jsonPrimitive?.contentOrNull,
        lastActive = o["last_active"]?.jsonPrimitive?.doubleOrNull,
        size = o["size"]?.jsonPrimitive?.longOrNull ?: 0L,
        preview = o["preview"]?.jsonPrimitive?.contentOrNull,
        title = o["title"]?.jsonPrimitive?.contentOrNull,
        color = o["color"]?.jsonPrimitive?.contentOrNull,
        activity = o["activity"]?.jsonPrimitive?.contentOrNull,
    )

    fun parseCategory(o: JsonObject): ChatCategory = ChatCategory(
        id = o["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        name = o["name"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        position = o["position"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
        color = o["color"]?.jsonPrimitive?.contentOrNull,
    )

    fun parsePlacement(o: JsonObject): ChatPlacement = ChatPlacement(
        sessionId = o["session_id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        categoryId = o["category_id"]?.jsonPrimitive?.contentOrNull,
        position = o["position"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
    )

    private fun JsonObject.toCategory(): ChatCategory? =
        parseCategory(this).takeIf { it.id.isNotEmpty() }

    data class MessagesPage(
        val items: List<SessionMessage>,
        val startIndex: Int,
        val hasMore: Boolean,
        val contextTokens: Int? = null,
    )

    suspend fun sessionMessages(
        sessionId: String,
        project: String,
        limit: Int = 200,
        beforeIndex: Int? = null,
        visibility: VisibilityPrefs = VisibilityPrefs(),
        trashed: Boolean = false,
    ): MessagesPage? {
        val query = mutableMapOf("project" to project, "limit" to limit.toString())
        if (beforeIndex != null) query["before_index"] = beforeIndex.toString()
        if (trashed) query["trashed"] = "true"
        visibility.simple?.let { query["simple"] = (it == "on").toString() }
        visibility.thinking?.let { query["thinking"] = it }
        visibility.toolUse?.let { query["tool_use"] = it }
        visibility.fileChange?.let { query["file_change"] = it }
        visibility.compact?.let { query["compact"] = it }
        visibility.working?.let { query["working"] = it }
        val data = Http.get("/sessions/$sessionId/messages", query)?.jsonObject ?: return null
        val items = data["items"]?.jsonArray?.map(::parseSessionMessage) ?: emptyList()
        return MessagesPage(
            items = items,
            startIndex = data["start_index"]?.jsonPrimitive?.intOrNull ?: 0,
            hasMore = data["has_more"]?.jsonPrimitive?.contentOrNull == "true",
            contextTokens = data["context_tokens"]?.jsonPrimitive?.intOrNull,
        )
    }

    fun parseSessionMessage(el: JsonElement): SessionMessage {
        val o = el.jsonObject
        val type = o["type"]?.jsonPrimitive?.contentOrNull
        val text = when (type) {
            "file_change", "compact" -> ""
            "interaction" -> o["input"]?.jsonPrimitive?.contentOrNull.orEmpty()
            "agent" -> o["description"]?.jsonPrimitive?.contentOrNull.orEmpty()
            else -> o["text"]?.jsonPrimitive?.contentOrNull.orEmpty()
        }
        val interaction = if (type == "interaction") parseInteraction(o) else null
        val diffLines = if (type == "file_change") {
            o["diff_lines"]?.jsonArray?.map { d ->
                val od = d.jsonObject
                DiffLine(
                    kind = diffKindOf(od["kind"]?.jsonPrimitive?.contentOrNull),
                    text = od["text"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                )
            }
        } else null
        val compact = if (type == "compact") CompactData(
            trigger = o["trigger"]?.jsonPrimitive?.contentOrNull,
            preTokens = o["pre_tokens"]?.jsonPrimitive?.intOrNull,
            postTokens = o["post_tokens"]?.jsonPrimitive?.intOrNull,
            summary = o["summary"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        ) else null
        val agentResult = (o["agent_result"] as? JsonObject)?.let { r ->
            AgentResult(
                status = r["status"]?.jsonPrimitive?.contentOrNull,
                durationMs = r["duration_ms"]?.jsonPrimitive?.longOrNull,
                tokens = r["tokens"]?.jsonPrimitive?.intOrNull,
                toolUses = r["tool_uses"]?.jsonPrimitive?.intOrNull,
            )
        }
        return SessionMessage(
            type = type,
            role = o["role"]?.jsonPrimitive?.contentOrNull,
            text = text,
            name = o["name"]?.jsonPrimitive?.contentOrNull ?: o["tool_name"]?.jsonPrimitive?.contentOrNull ?: o["subagent_type"]?.jsonPrimitive?.contentOrNull,
            path = o["path"]?.jsonPrimitive?.contentOrNull,
            interaction = interaction,
            diffLines = diffLines,
            compact = compact,
            agentResult = agentResult,
            thinkingTokens = if (type == "thinking") o["tokens"]?.jsonPrimitive?.intOrNull else null,
            index = o["index"]?.jsonPrimitive?.intOrNull ?: -1,
            labelOnly = o["label"]?.jsonPrimitive?.booleanOrNull == true,
            result = o["result"]?.jsonPrimitive?.contentOrNull,
            parent = o["parent"]?.jsonPrimitive?.contentOrNull,
            toolUseId = o["id"]?.jsonPrimitive?.contentOrNull,
            images = o["images"]?.jsonArray?.mapNotNull { ref ->
                val r = ref.jsonObject
                val uuid = r["uuid"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val index = r["index"]?.jsonPrimitive?.intOrNull ?: return@mapNotNull null
                "$uuid/$index"
            }?.takeIf { it.isNotEmpty() },
            timestamp = o["ts"]?.jsonPrimitive?.longOrNull,
        )
    }

    private fun parseInteraction(o: kotlinx.serialization.json.JsonObject): InteractionData {
        val kind = o["kind"]?.jsonPrimitive?.contentOrNull ?: "questions"
        if (kind == "component") {
            val values = o["values"]?.jsonObject?.mapValues { (_, value) ->
                if (value is JsonArray) value.joinToString(VALUE_SEPARATOR) { it.jsonPrimitive.content }
                else value.jsonPrimitive.content
            } ?: emptyMap()
            val shown = o["shown"]?.jsonPrimitive?.booleanOrNull == true
            return InteractionData(
                requestId = if (shown) "shown" else "resumed",
                kind = kind,
                title = o["title"]?.jsonPrimitive?.contentOrNull,
                titleKey = o["title_key"]?.jsonPrimitive?.contentOrNull,
                icon = o["icon"]?.jsonPrimitive?.contentOrNull,
                submitLabel = o["submit"]?.jsonPrimitive?.contentOrNull,
                submitKey = o["submit_key"]?.jsonPrimitive?.contentOrNull,
                dismiss = (o["dismiss"] as? JsonObject)?.toDismiss(),
                blocks = o["blocks"]?.jsonArray?.mapNotNull { it.jsonObject.toElement() } ?: emptyList(),
                values = values,
                submitted = !shown,
                declined = o["declined"]?.jsonPrimitive?.booleanOrNull == true,
                dismissedBy = o["dismissed_by"]?.jsonPrimitive?.contentOrNull,
            )
        }
        val res = o["resolved"]?.jsonPrimitive?.contentOrNull ?: "allow"
        return InteractionData(requestId = "resumed", kind = kind, resolved = res, options = listOf(InteractionOption(id = res)))
    }

    private fun parseOption(el: JsonElement): InteractionOption? {
        val it = el.jsonObject
        val id = it["id"]?.jsonPrimitive?.contentOrNull ?: return null
        return InteractionOption(
            id = id,
            label = it["label"]?.jsonPrimitive?.contentOrNull,
            description = it["description"]?.jsonPrimitive?.contentOrNull,
            preview = it["preview"]?.jsonPrimitive?.contentOrNull,
        )
    }

    data class RewindPoint(
        val id: String,
        val rewindId: String,
        val text: String,
    )

    data class RewindPreview(
        val canRewind: Boolean,
        val error: String?,
        val filesChanged: List<String>,
        val insertions: Int,
        val deletions: Int,
    )

    suspend fun checkpoints(sessionId: String, project: String): List<RewindPoint> =
        Http.get("/sessions/$sessionId/checkpoints", mapOf("project" to project))?.jsonArray?.mapNotNull { el ->
            val o = el.jsonObject
            RewindPoint(
                id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                rewindId = o["rewind_id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                text = o["text"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            )
        } ?: emptyList()

    private fun parseRewindResult(el: JsonElement?): RewindPreview? {
        val o = el?.jsonObject ?: return null
        return RewindPreview(
            canRewind = o["can_rewind"]?.jsonPrimitive?.booleanOrNull == true,
            error = o["error"]?.jsonPrimitive?.contentOrNull,
            filesChanged = o["files_changed"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList(),
            insertions = o["insertions"]?.jsonPrimitive?.intOrNull ?: 0,
            deletions = o["deletions"]?.jsonPrimitive?.intOrNull ?: 0,
        )
    }

    suspend fun rewindPreview(sessionId: String, project: String, userMessageId: String): RewindPreview? =
        parseRewindResult(Http.post("/sessions/$sessionId/rewind/preview", buildJsonObject {
            put("project", project)
            put("user_message_id", userMessageId)
        }))

    // mode: "both" (code + conversation) or "conversation".
    suspend fun rewind(sessionId: String, project: String, point: RewindPoint, mode: String): RewindPreview? =
        parseRewindResult(Http.post("/sessions/$sessionId/rewind", buildJsonObject {
            put("project", project)
            put("user_message_id", point.id)
            put("rewind_id", point.rewindId)
            put("mode", mode)
        }))

    suspend fun deleteSession(sessionId: String, project: String): Boolean =
        Http.delete("/sessions/$sessionId", mapOf("project" to project)) != null

    suspend fun renameSession(sessionId: String, project: String, title: String): Boolean =
        Http.post("/sessions/$sessionId/rename", buildJsonObject {
            put("project", project)
            put("title", title)
        }) != null

    suspend fun autoRenameSession(sessionId: String, project: String, account: String = ""): String? =
        Http.post("/sessions/$sessionId/auto-rename", buildJsonObject {
            put("project", project)
            put("account", account)
        })?.jsonObject?.get("title")?.jsonPrimitive?.contentOrNull

    suspend fun setSessionColor(sessionId: String, project: String, color: String): Boolean =
        Http.post("/sessions/$sessionId/color", buildJsonObject {
            put("project", project)
            put("color", color)
        }) != null

    suspend fun createCategory(name: String, color: String?): ChatCategory? =
        Http.post("/sessions/categories", buildJsonObject {
            put("name", name)
            color?.let { put("color", it) }
        })?.jsonObject?.toCategory()

    suspend fun updateCategory(
        id: String,
        name: String? = null,
        color: String? = null,
        index: Int? = null,
    ): ChatCategory? =
        Http.patch("/sessions/categories/$id", buildJsonObject {
            name?.let { put("name", it) }
            color?.let { put("color", it) }
            index?.let { put("index", it) }
        })?.jsonObject?.toCategory()

    suspend fun deleteCategory(id: String): Boolean =
        Http.delete("/sessions/categories/$id") != null

    suspend fun placeSession(sessionId: String, categoryId: String?, index: Int?): Boolean =
        Http.post("/sessions/$sessionId/category", buildJsonObject {
            put("category_id", categoryId)
            index?.let { put("index", it) }
        }) != null

    suspend fun seedOrder(sessionIds: List<String>): Boolean =
        Http.post("/sessions/order", buildJsonObject {
            putJsonArray("session_ids") { sessionIds.forEach { add(it) } }
        }) != null

    suspend fun deleteProject(projectKey: String): Boolean =
        Http.delete("/sessions/projects/$projectKey") != null

    data class Trash(val enabled: Boolean, val items: List<TrashedSession>)

    suspend fun trash(): Trash {
        val data = Http.get("/sessions/trash")?.jsonObject
        val items = (data?.get("items") as? JsonArray).orEmpty().mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            TrashedSession(
                sessionId = o["session_id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                projectKey = o["project_key"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                title = o["title"]?.jsonPrimitive?.contentOrNull,
                path = o["path"]?.jsonPrimitive?.contentOrNull,
                deletedAt = o["deleted_at"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
            ).takeIf { it.sessionId.isNotEmpty() }
        }
        return Trash(data?.get("enabled")?.jsonPrimitive?.booleanOrNull == true, items)
    }

    suspend fun restoreTrashed(sessionId: String): Boolean =
        Http.post("/sessions/trash/$sessionId/restore") != null

    suspend fun purgeTrashed(sessionId: String): Boolean =
        Http.delete("/sessions/trash/$sessionId") != null

    suspend fun emptyTrash(): Boolean =
        Http.delete("/sessions/trash") != null

    suspend fun addProject(path: String, name: String? = null): Boolean =
        Http.post("/sessions/projects", buildJsonObject {
            put("path", path)
            put("name", name)
        }) != null

    suspend fun renameProject(projectKey: String, name: String, path: String?): Boolean =
        Http.patch("/sessions/projects/$projectKey", buildJsonObject {
            put("name", name)
            put("path", path)
        }) != null

    suspend fun moveSession(sessionId: String, project: String, cwd: String): String? =
        Http.post("/sessions/$sessionId/move", buildJsonObject {
            put("project", project)
            put("cwd", cwd)
        })?.jsonObject?.get("project_key")?.jsonPrimitive?.contentOrNull
}
