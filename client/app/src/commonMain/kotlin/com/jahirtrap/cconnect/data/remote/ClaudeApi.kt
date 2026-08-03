package com.jahirtrap.cconnect.data.remote

import kotlinx.serialization.json.JsonElement

import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

object ClaudeApi {

    data class Plugin(
        val name: String,
        val marketplace: String?,
        val version: String?,
        val scope: String?,
        val enabled: Boolean,
        val description: String? = null,
    )

    data class Marketplace(val name: String, val repo: String?)

    data class Skill(
        val name: String,
        val id: String,
        val description: String?,
        val plugin: String?,
        val pluginName: String?,
        val enabled: Boolean,
    )

    data class McpServer(val name: String, val type: String?, val detail: String?, val enabled: Boolean = true)

    data class Extensions(val plugins: List<Plugin>, val marketplaces: List<Marketplace>)

    data class CatalogPlugin(
        val name: String,
        val description: String?,
        val version: String?,
        val installed: Boolean,
    )

    data class Memory(val scope: String, val name: String, val description: String?)

    data class Memories(val global: List<Memory>, val project: List<Memory>)

    data class ActionResult(val ok: Boolean, val message: String)

    data class UsageWindow(val id: String, val percent: Float, val resetsAt: String?)

    data class Usage(val plan: String?, val windows: List<UsageWindow>, val error: String?)

    suspend fun usage(account: String? = null): Usage? {
        val query = account?.takeIf { it.isNotBlank() }?.let { mapOf("account" to it) } ?: emptyMap()
        val o = Http.get("/claude/usage", query)?.jsonObject ?: return null
        return Usage(
            plan = o["plan"]?.jsonPrimitive?.contentOrNull,
            windows = o["windows"]?.jsonArray?.map { el ->
                val w = el.jsonObject
                UsageWindow(
                    id = w["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    percent = w["percent"]?.jsonPrimitive?.floatOrNull ?: 0f,
                    resetsAt = w["resets_at"]?.jsonPrimitive?.contentOrNull,
                )
            }.orEmpty(),
            error = o["error"]?.jsonPrimitive?.contentOrNull,
        )
    }

    data class ServiceComponent(val name: String, val status: String)

    data class ServiceIncident(
        val name: String,
        val impact: String,
        val status: String,
        val latest: String?,
        val updatedAt: String?,
        val shortlink: String?,
    )

    data class ServiceStatus(
        val indicator: String,
        val description: String,
        val components: List<ServiceComponent>,
        val incidents: List<ServiceIncident>,
        val error: String?,
    )

    suspend fun status(): ServiceStatus? {
        val o = Http.get("/claude/status")?.jsonObject ?: return null
        return ServiceStatus(
            indicator = o["indicator"]?.jsonPrimitive?.contentOrNull ?: "none",
            description = o["description"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            components = o["components"]?.jsonArray?.mapNotNull { el ->
                val c = el.jsonObject
                ServiceComponent(
                    name = c["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                    status = c["status"]?.jsonPrimitive?.contentOrNull ?: "operational",
                )
            }.orEmpty(),
            incidents = o["incidents"]?.jsonArray?.mapNotNull { el ->
                val i = el.jsonObject
                ServiceIncident(
                    name = i["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                    impact = i["impact"]?.jsonPrimitive?.contentOrNull ?: "none",
                    status = i["status"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    latest = i["latest"]?.jsonPrimitive?.contentOrNull,
                    updatedAt = i["updated_at"]?.jsonPrimitive?.contentOrNull,
                    shortlink = i["shortlink"]?.jsonPrimitive?.contentOrNull,
                )
            }.orEmpty(),
            error = o["error"]?.jsonPrimitive?.contentOrNull,
        )
    }

    suspend fun userPrompt(): String? =
        Http.get("/claude/prompt")?.jsonObject?.get("text")?.jsonPrimitive?.contentOrNull

    suspend fun setUserPrompt(text: String): Boolean =
        Http.put("/claude/prompt", buildJsonObject { put("text", text) }) != null

    suspend fun projectPrompt(project: String): String? =
        Http.get("/claude/project-prompt", mapOf("project" to project))?.jsonObject?.get("text")?.jsonPrimitive?.contentOrNull

    suspend fun setProjectPrompt(project: String, text: String): Boolean =
        Http.put("/claude/project-prompt", buildJsonObject { put("project", project); put("text", text) }) != null

    suspend fun extensions(): Extensions? {
        val data = Http.get("/claude/plugins")?.jsonObject ?: return null
        val plugins = data["plugins"]?.jsonArray?.mapNotNull { el ->
            val o = el.jsonObject
            Plugin(
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                marketplace = o["marketplace"]?.jsonPrimitive?.contentOrNull,
                version = o["version"]?.jsonPrimitive?.contentOrNull,
                scope = o["scope"]?.jsonPrimitive?.contentOrNull,
                enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
                description = o["description"]?.jsonPrimitive?.contentOrNull,
            )
        } ?: emptyList()
        val marketplaces = data["marketplaces"]?.jsonArray?.mapNotNull { el ->
            val o = el.jsonObject
            Marketplace(
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                repo = o["repo"]?.jsonPrimitive?.contentOrNull,
            )
        } ?: emptyList()
        return Extensions(plugins, marketplaces)
    }

    suspend fun skills(): List<Skill>? = Http.get("/claude/skills")?.jsonArray?.mapNotNull { el ->
        val o = el.jsonObject
        Skill(
            name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
            id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
            description = o["description"]?.jsonPrimitive?.contentOrNull,
            plugin = o["plugin"]?.jsonPrimitive?.contentOrNull,
            pluginName = o["plugin_name"]?.jsonPrimitive?.contentOrNull,
            enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
        )
    }

    suspend fun skillFiles(plugin: String?, skillId: String): List<String> {
        val query = mutableMapOf("skill" to skillId)
        if (plugin != null) query["plugin"] = plugin
        return Http.get("/claude/skills/files", query)?.jsonObject?.get("files")?.jsonArray
            ?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()
    }

    fun skillFileUrl(plugin: String?, skillId: String, file: String = "SKILL.md"): String =
        "${Backend.baseUrl}/claude/skills/file?skill=${UrlCodec.encode(skillId)}" +
            (plugin?.let { "&plugin=${UrlCodec.encode(it)}" } ?: "") +
            "&file=${UrlCodec.encode(file)}"

    suspend fun mcp(): List<McpServer>? = Http.get("/claude/mcp")?.jsonArray?.mapNotNull { el ->
        val o = el.jsonObject
        McpServer(
            name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
            type = o["type"]?.jsonPrimitive?.contentOrNull,
            detail = o["detail"]?.jsonPrimitive?.contentOrNull,
            enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
        )
    }

    suspend fun mcpToggle(name: String, enabled: Boolean): ActionResult = actionResult(
        Http.post("/claude/mcp/toggle", buildJsonObject { put("name", name); put("enabled", enabled) })
    )

    private fun actionResult(data: JsonElement?): ActionResult {
        val o = data?.jsonObject ?: return ActionResult(false, "")
        return ActionResult(
            ok = o["ok"]?.jsonPrimitive?.booleanOrNull ?: false,
            message = o["message"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        )
    }

    suspend fun pluginAction(action: String, plugin: String): ActionResult =
        actionResult(Http.post("/claude/plugins/action", buildJsonObject {
            put("action", action)
            put("plugin", plugin)
        }))

    suspend fun marketplaceAction(action: String, target: String): ActionResult =
        actionResult(Http.post("/claude/marketplaces/action", buildJsonObject {
            put("action", action)
            put("target", target)
        }))

    suspend fun catalog(marketplace: String): List<CatalogPlugin>? =
        Http.get("/claude/marketplaces/${UrlCodec.encode(marketplace)}/catalog")?.jsonArray?.mapNotNull { el ->
            val o = el.jsonObject
            CatalogPlugin(
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                description = o["description"]?.jsonPrimitive?.contentOrNull,
                version = o["version"]?.jsonPrimitive?.contentOrNull,
                installed = o["installed"]?.jsonPrimitive?.booleanOrNull ?: false,
            )
        }

    suspend fun mcpAdd(name: String, target: String, transport: String): ActionResult =
        actionResult(Http.post("/claude/mcp", buildJsonObject {
            put("name", name)
            put("target", target)
            put("transport", transport)
        }))

    suspend fun mcpRemove(name: String): ActionResult =
        actionResult(Http.delete("/claude/mcp/${UrlCodec.encode(name)}"))

    suspend fun memories(project: String?): Memories? {
        val query = if (project.isNullOrEmpty()) emptyMap() else mapOf("project" to project)
        val data = Http.get("/claude/memories", query)?.jsonObject ?: return null
        fun parse(key: String) = data[key]?.jsonArray?.mapNotNull { el ->
            val o = el.jsonObject
            Memory(
                scope = o["scope"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                description = o["description"]?.jsonPrimitive?.contentOrNull,
            )
        } ?: emptyList()
        return Memories(global = parse("global"), project = parse("project"))
    }

    fun memoryUrl(scope: String, project: String?, name: String): String =
        "${Backend.baseUrl}/claude/memories/file?scope=${UrlCodec.encode(scope)}" +
            "&name=${UrlCodec.encode(name)}&project=${UrlCodec.encode(project.orEmpty())}"

    suspend fun deleteMemory(scope: String, project: String?, name: String): Boolean =
        Http.delete("/claude/memories", mapOf(
            "scope" to scope,
            "name" to name,
            "project" to project.orEmpty(),
        )) != null
}
