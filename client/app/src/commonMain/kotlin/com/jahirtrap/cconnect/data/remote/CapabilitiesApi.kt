package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.AccountOption
import com.jahirtrap.cconnect.data.CLIENT_CAPABILITIES
import com.jahirtrap.cconnect.data.Capabilities
import com.jahirtrap.cconnect.data.CapabilitiesDefaults
import com.jahirtrap.cconnect.data.ClaudeModel
import com.jahirtrap.cconnect.data.CommandOption
import com.jahirtrap.cconnect.data.FastMode
import com.jahirtrap.cconnect.data.McpTool
import com.jahirtrap.cconnect.data.ModelOption
import com.jahirtrap.cconnect.data.PermissionMode
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object CapabilitiesApi {

    data class VersionInfo(
        val serverVersion: String?,
        val supportedApp: String?,
        val cliVersion: String?,
        val supportedCli: String?,
    )

    suspend fun versionInfo(): VersionInfo? {
        val data = Http.get("/health")?.jsonObject ?: return null
        return VersionInfo(
            serverVersion = data["version"]?.jsonPrimitive?.contentOrNull,
            supportedApp = data["supported_app"]?.jsonPrimitive?.contentOrNull,
            cliVersion = data["cli_version"]?.jsonPrimitive?.contentOrNull,
            supportedCli = data["supported_cli"]?.jsonPrimitive?.contentOrNull,
        )
    }

    suspend fun capabilities(account: String = ""): Capabilities? {
        val query = buildMap {
            put("capabilities", CLIENT_CAPABILITIES.joinToString(","))
            if (account.isNotBlank()) put("account", account)
        }
        val data = Http.get("/capabilities", query)?.jsonObject ?: return null
        val fallback = Capabilities()
        return Capabilities(
            permissionModes = data["permission_modes"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                PermissionMode(id, o["label"]?.jsonPrimitive?.contentOrNull ?: id)
            } ?: fallback.permissionModes,
            models = data["models"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                ClaudeModel(
                    id = id,
                    label = o["label"]?.jsonPrimitive?.contentOrNull ?: id,
                    description = o["description"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    resolvedModel = o["resolved_model"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    effortLevels = o["effort_levels"]?.jsonArray
                        ?.mapNotNull { it.jsonPrimitive.contentOrNull }.orEmpty(),
                    contextWindow = o["context_window"]?.jsonPrimitive?.intOrNull,
                    fastMode = o["fast_mode"]?.jsonPrimitive?.booleanOrNull ?: false,
                    autoMode = o["auto_mode"]?.jsonPrimitive?.booleanOrNull ?: false,
                )
            } ?: fallback.models,
            outputStyles = data["output_styles"]?.jsonArray
                ?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: fallback.outputStyles,
            fastMode = data["fast_mode"]?.jsonObject?.let { o ->
                FastMode(
                    state = o["state"]?.jsonPrimitive?.contentOrNull ?: "off",
                    disabledReason = o["disabled_reason"]?.jsonPrimitive?.contentOrNull,
                )
            } ?: fallback.fastMode,
            colors = data["colors"]?.jsonArray
                ?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: fallback.colors,
            commands = data["commands"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                CommandOption(
                    name = name,
                    description = o["description"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    kind = o["kind"]?.jsonPrimitive?.contentOrNull ?: "prompt",
                    requireConfirmation = o["require_confirmation"]?.jsonPrimitive?.booleanOrNull ?: false,
                    argumentHint = o["argument_hint"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    aliases = o["aliases"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }.orEmpty(),
                )
            } ?: fallback.commands,
            accounts = data["accounts"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                AccountOption(
                    id,
                    o["label"]?.jsonPrimitive?.contentOrNull ?: id,
                    o["provider"]?.jsonPrimitive?.booleanOrNull ?: false,
                )
            } ?: fallback.accounts,
            mcpTools = data["mcp_tools"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                McpTool(
                    name,
                    o["description"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    o["group"]?.jsonPrimitive?.contentOrNull,
                    o["group_description"]?.jsonPrimitive?.contentOrNull,
                )
            } ?: fallback.mcpTools,
            defaults = data["defaults"]?.jsonObject?.let { o ->
                CapabilitiesDefaults(
                    permissionMode = o["permission_mode"]?.jsonPrimitive?.contentOrNull ?: fallback.defaults.permissionMode,
                    effort = o["effort"]?.jsonPrimitive?.contentOrNull ?: fallback.defaults.effort,
                    model = o["model"]?.jsonPrimitive?.contentOrNull ?: fallback.defaults.model,
                    account = o["account"]?.jsonPrimitive?.contentOrNull ?: fallback.defaults.account,
                )
            } ?: fallback.defaults,
            serverVersion = data["version"]?.jsonPrimitive?.contentOrNull,
            supportedApp = data["supported_app"]?.jsonPrimitive?.contentOrNull,
            cliVersion = data["cli_version"]?.jsonPrimitive?.contentOrNull,
            supportedCli = data["supported_cli"]?.jsonPrimitive?.contentOrNull,
        )
    }
}
