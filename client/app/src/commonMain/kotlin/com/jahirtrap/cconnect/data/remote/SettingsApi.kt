package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.ServerDefaults
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Backend-owned generation settings (the source of truth lives in the backend DB).
// CLI source/version is handled separately by CliApi.
object SettingsApi {

    data class Snapshot(
        val account: String,
        val model: String,
        val effort: String,
        val permissionMode: String,
        val streaming: Boolean,
        val todoTools: Boolean,
        val showThinking: String,
        val showToolUse: String,
        val showFileChange: String,
        val showCompact: String,
        val showWorking: String,
    )

    private fun effectiveStr(o: JsonObject, key: String, fallback: String): String =
        o[key]?.jsonObject?.get("effective")?.jsonPrimitive?.contentOrNull ?: fallback

    private fun effectiveBool(o: JsonObject, key: String, fallback: Boolean): Boolean =
        o[key]?.jsonObject?.get("effective")?.jsonPrimitive?.booleanOrNull ?: fallback

    private fun parse(o: JsonObject) = Snapshot(
        account = effectiveStr(o, "account", ""),
        model = effectiveStr(o, "model", "opus"),
        effort = effectiveStr(o, "effort", "xhigh"),
        permissionMode = effectiveStr(o, "permission_mode", "bypassPermissions"),
        streaming = effectiveBool(o, "streaming", true),
        todoTools = effectiveBool(o, "todo_tools", false),
        showThinking = effectiveStr(o, "show_thinking", "full"),
        showToolUse = effectiveStr(o, "show_tool_use", "label"),
        showFileChange = effectiveStr(o, "show_file_change", "full"),
        showCompact = effectiveStr(o, "show_compact", "full"),
        showWorking = effectiveStr(o, "show_working", "label"),
    )

    suspend fun get(): Snapshot? = Http.get("/settings")?.jsonObject?.let(::parse)

    suspend fun update(
        account: String? = null,
        model: String? = null,
        effort: String? = null,
        permissionMode: String? = null,
        streaming: Boolean? = null,
        todoTools: Boolean? = null,
        showThinking: String? = null,
        showToolUse: String? = null,
        showFileChange: String? = null,
        showCompact: String? = null,
        showWorking: String? = null,
    ): Snapshot? = Http.post("/settings", buildJsonObject {
        if (account != null) put("account", account)
        if (model != null) put("model", model)
        if (effort != null) put("effort", effort)
        if (permissionMode != null) put("permission_mode", permissionMode)
        if (streaming != null) put("streaming", streaming)
        if (todoTools != null) put("todo_tools", todoTools)
        if (showThinking != null) put("show_thinking", showThinking)
        if (showToolUse != null) put("show_tool_use", showToolUse)
        if (showFileChange != null) put("show_file_change", showFileChange)
        if (showCompact != null) put("show_compact", showCompact)
        if (showWorking != null) put("show_working", showWorking)
    })?.jsonObject?.let(::parse)?.also { ServerDefaults.bump() }

    suspend fun reset(): Snapshot? =
        Http.post("/settings/reset")?.jsonObject?.let(::parse)?.also { ServerDefaults.bump() }
}
