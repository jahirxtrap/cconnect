package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.ServerDefaults
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
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
        val outputStyle: String,
        val mcpDisabled: String,
        val showThinking: String,
        val showToolUse: String,
        val showFileChange: String,
        val showCompact: String,
        val showWorking: String,
        val showTokens: Boolean,
        val simpleMode: Boolean,
        val chatOrder: String,
        val trashEnabled: Boolean,
        val defaultCategory: String,
        val retentionDays: Long,
        val retentionMin: Long,
        val retentionMax: Long,
    )

    private fun effectiveStr(o: JsonObject, key: String, fallback: String): String =
        o[key]?.jsonObject?.get("effective")?.jsonPrimitive?.contentOrNull ?: fallback

    private fun effectiveBool(o: JsonObject, key: String, fallback: Boolean): Boolean =
        o[key]?.jsonObject?.get("effective")?.jsonPrimitive?.booleanOrNull ?: fallback

    private fun effectiveInt(o: JsonObject, key: String, fallback: Int): Int =
        o[key]?.jsonObject?.get("effective")?.jsonPrimitive?.intOrNull ?: fallback

    private fun effectiveLong(o: JsonObject, key: String, fallback: Long): Long =
        o[key]?.jsonObject?.get("effective")?.jsonPrimitive?.longOrNull ?: fallback

    private fun boundLong(o: JsonObject, key: String, bound: String, fallback: Long): Long =
        o[key]?.jsonObject?.get(bound)?.jsonPrimitive?.longOrNull ?: fallback

    private fun parse(o: JsonObject) = Snapshot(
        account = effectiveStr(o, "account", ""),
        model = effectiveStr(o, "model", "opus"),
        effort = effectiveStr(o, "effort", "xhigh"),
        permissionMode = effectiveStr(o, "permission_mode", "bypassPermissions"),
        streaming = effectiveBool(o, "streaming", true),
        todoTools = effectiveBool(o, "todo_tools", false),
        outputStyle = effectiveStr(o, "output_style", "default"),
        mcpDisabled = effectiveStr(o, "mcp_disabled", ""),
        showThinking = effectiveStr(o, "show_thinking", "full"),
        showToolUse = effectiveStr(o, "show_tool_use", "label"),
        showFileChange = effectiveStr(o, "show_file_change", "full"),
        showCompact = effectiveStr(o, "show_compact", "full"),
        showWorking = effectiveStr(o, "show_working", "label"),
        showTokens = effectiveBool(o, "show_tokens", false),
        simpleMode = effectiveBool(o, "simple_mode", false),
        chatOrder = effectiveStr(o, "chat_order", "auto"),
        trashEnabled = effectiveBool(o, "trash_enabled", false),
        defaultCategory = effectiveStr(o, "default_category", ""),
        retentionDays = effectiveLong(o, "retention_days", 30),
        retentionMin = boundLong(o, "retention_days", "minimum", 1),
        retentionMax = boundLong(o, "retention_days", "maximum", Long.MAX_VALUE),
    )

    suspend fun get(): Snapshot? = Http.get("/settings")?.jsonObject?.let(::parse)

    suspend fun update(
        account: String? = null,
        model: String? = null,
        effort: String? = null,
        permissionMode: String? = null,
        streaming: Boolean? = null,
        todoTools: Boolean? = null,
        outputStyle: String? = null,
        mcpDisabled: String? = null,
        showThinking: String? = null,
        showToolUse: String? = null,
        showFileChange: String? = null,
        showCompact: String? = null,
        showWorking: String? = null,
        showTokens: Boolean? = null,
        simpleMode: Boolean? = null,
        chatOrder: String? = null,
        trashEnabled: Boolean? = null,
        defaultCategory: String? = null,
        retentionDays: Long? = null,
    ): Snapshot? = Http.post("/settings", buildJsonObject {
        if (account != null) put("account", account)
        if (model != null) put("model", model)
        if (effort != null) put("effort", effort)
        if (permissionMode != null) put("permission_mode", permissionMode)
        if (streaming != null) put("streaming", streaming)
        if (todoTools != null) put("todo_tools", todoTools)
        if (outputStyle != null) put("output_style", outputStyle)
        if (mcpDisabled != null) put("mcp_disabled", mcpDisabled)
        if (showThinking != null) put("show_thinking", showThinking)
        if (showToolUse != null) put("show_tool_use", showToolUse)
        if (showFileChange != null) put("show_file_change", showFileChange)
        if (showCompact != null) put("show_compact", showCompact)
        if (showWorking != null) put("show_working", showWorking)
        if (showTokens != null) put("show_tokens", showTokens)
        if (simpleMode != null) put("simple_mode", simpleMode)
        if (chatOrder != null) put("chat_order", chatOrder)
        if (trashEnabled != null) put("trash_enabled", trashEnabled)
        if (defaultCategory != null) put("default_category", defaultCategory)
        if (retentionDays != null) put("retention_days", retentionDays)
    })?.jsonObject?.let(::parse)?.also { ServerDefaults.bump() }

    suspend fun reset(): Snapshot? =
        Http.post("/settings/reset")?.jsonObject?.let(::parse)?.also { ServerDefaults.bump() }
}
