package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.Capabilities
import com.jahirtrap.cconnect.data.CapabilitiesDefaults
import com.jahirtrap.cconnect.data.CommandOption
import com.jahirtrap.cconnect.data.ModelOption
import com.jahirtrap.cconnect.data.PermissionMode
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
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

    suspend fun capabilities(): Capabilities? {
        val data = Http.get("/capabilities")?.jsonObject ?: return null
        val fallback = Capabilities()
        return Capabilities(
            permissionModes = data["permission_modes"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                PermissionMode(id, o["label"]?.jsonPrimitive?.contentOrNull ?: id)
            } ?: fallback.permissionModes,
            effortLevels = data["effort_levels"]?.jsonArray
                ?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: fallback.effortLevels,
            models = data["models"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                ModelOption(id, o["label"]?.jsonPrimitive?.contentOrNull ?: id)
            } ?: fallback.models,
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
                )
            } ?: fallback.commands,
            accounts = data["accounts"]?.jsonArray?.mapNotNull { el ->
                val o = el.jsonObject
                val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                ModelOption(id, o["label"]?.jsonPrimitive?.contentOrNull ?: id)
            } ?: fallback.accounts,
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
