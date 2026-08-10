package com.jahirtrap.cconnect.data

import com.jahirtrap.cconnect.data.SshProfile
import com.jahirtrap.cconnect.data.SshStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

// Shared with the Tauri client: same keys so a backup moves between both apps.
object SettingsBackup {

    private const val APP = "cconnect"
    private const val FORMAT = 1

    fun export(): String {
        val settings = Settings()
        val ssh = SshStore()
        return buildJsonObject {
            put("app", APP)
            put("version", FORMAT)
            putJsonObject("settings") {
                put("theme_mode", settings.themeMode)
                put("dynamic_color", settings.dynamicColor)
                put("accent_index", settings.accentIndex)
                put("font_style", settings.fontStyle)
                put("language", settings.language)
                put("show_timestamps", settings.showTimestamps)
                put("markdown_preview_formatted", settings.markdownPreviewFormatted)
                put("notify_task_done", settings.notifyTaskDone)
                put("notify_interaction", settings.notifyInteraction)
                put("sidebar_expanded", settings.sidebarExpanded)
                put("minimize_to_tray", settings.minimizeToTray)
                put("window_maximized", settings.windowMaximized)
                put("cwd", settings.cwd)
                put("environment_locked", settings.environmentLocked)
                put("project_locked", settings.projectLocked)
                put("file_sort_field", settings.fileSortField)
                put("file_sort_ascending", settings.fileSortAscending)
                put("local_server_enabled", settings.localServerEnabled)
                put("local_server_dir", settings.localServerDir)
                put("local_server_python", settings.localServerPython)
                put("local_server_python_path", settings.localServerPythonPath)
                put("local_server_mode", settings.localServerMode)
                put("local_server_public_host", settings.localServerPublicHost)
            }
            settings.activeEnvironmentId?.let { put("active_environment", it) }
            putJsonArray("environments") {
                settings.environments.forEach { environment ->
                    addJsonObject {
                        put("id", environment.id)
                        put("name", environment.name)
                        put("kind", environment.kind)
                        put("host", environment.host)
                        environment.port?.let { put("port", it) }
                        put("auth_kind", environment.authKind)
                        put("auth_token", environment.authToken)
                        put("auth_user", environment.authUser)
                        put("auth_password", environment.authPassword)
                        put("auth_header_name", environment.authHeaderName)
                        put("auth_header_value", environment.authHeaderValue)
                        put("directory", environment.directory)
                        put("account", environment.account)
                        put("model", environment.model)
                        put("effort", environment.effort)
                        put("permission_mode", environment.permissionMode)
                        environment.streaming?.let { put("streaming", it) }
                        environment.accentIndex?.let { put("accent_index", it) }
                    }
                }
            }
            putJsonArray("ssh") {
                ssh.profiles.forEach { profile ->
                    addJsonObject {
                        put("id", profile.id)
                        put("name", profile.name)
                        put("host", profile.host)
                        put("port", profile.port)
                        put("user", profile.user)
                        put("password", profile.password)
                        profile.os?.let { put("os", it) }
                    }
                }
            }
        }.toString()
    }

    fun import(raw: String): Boolean {
        val root = runCatching { Json.parseToJsonElement(raw).jsonObject }.getOrNull() ?: return false
        if (root["app"]?.jsonPrimitive?.contentOrNull != APP) return false
        val settings = Settings()

        root["settings"]?.jsonObject?.let { values ->
            values.text("theme_mode")?.let { settings.themeMode = it }
            values.flag("dynamic_color")?.let { settings.dynamicColor = it }
            values.number("accent_index")?.let { settings.accentIndex = it }
            values.text("font_style")?.let { settings.fontStyle = it }
            values.text("language")?.let { settings.language = it }
            values.flag("show_timestamps")?.let { settings.showTimestamps = it }
            values.flag("markdown_preview_formatted")?.let { settings.markdownPreviewFormatted = it }
            values.flag("notify_task_done")?.let { settings.notifyTaskDone = it }
            values.flag("notify_interaction")?.let { settings.notifyInteraction = it }
            values.flag("sidebar_expanded")?.let { settings.sidebarExpanded = it }
            values.flag("minimize_to_tray")?.let { settings.minimizeToTray = it }
            values.flag("window_maximized")?.let { settings.windowMaximized = it }
            values.text("cwd")?.let { settings.cwd = it }
            values.flag("environment_locked")?.let { settings.environmentLocked = it }
            values.flag("project_locked")?.let { settings.projectLocked = it }
            values.text("file_sort_field")?.let { settings.fileSortField = it }
            values.flag("file_sort_ascending")?.let { settings.fileSortAscending = it }
            values.flag("local_server_enabled")?.let { settings.localServerEnabled = it }
            values.text("local_server_dir")?.let { settings.localServerDir = it }
            values.text("local_server_python")?.let { settings.localServerPython = it }
            values.text("local_server_python_path")?.let { settings.localServerPythonPath = it }
            values.text("local_server_mode")?.let { settings.localServerMode = it }
            values.text("local_server_public_host")?.let { settings.localServerPublicHost = it }
        }

        root["environments"]?.jsonArray?.let { list ->
            val environments = list.mapNotNull { element ->
                val item = element.jsonObject
                val id = item.text("id") ?: return@mapNotNull null
                EnvironmentProfile(
                    id = id,
                    name = item.text("name").orEmpty(),
                    kind = item.text("kind") ?: "http",
                    host = item.text("host").orEmpty(),
                    port = item.number("port"),
                    authKind = item.text("auth_kind") ?: "none",
                    authToken = item.text("auth_token").orEmpty(),
                    authUser = item.text("auth_user").orEmpty(),
                    authPassword = item.text("auth_password").orEmpty(),
                    authHeaderName = item.text("auth_header_name").orEmpty(),
                    authHeaderValue = item.text("auth_header_value").orEmpty(),
                    directory = item.text("directory").orEmpty(),
                    account = item.text("account").orEmpty(),
                    model = item.text("model").orEmpty(),
                    effort = item.text("effort").orEmpty(),
                    permissionMode = item.text("permission_mode").orEmpty(),
                    streaming = item.flag("streaming"),
                    accentIndex = item.number("accent_index"),
                )
            }
            if (environments.isNotEmpty()) settings.environments = environments
        }
        root.text("active_environment")?.let { settings.activeEnvironmentId = it }

        root["ssh"]?.jsonArray?.let { list ->
            val profiles = list.mapNotNull { element ->
                val item = element.jsonObject
                val id = item.text("id") ?: return@mapNotNull null
                SshProfile(
                    id = id,
                    name = item.text("name").orEmpty(),
                    host = item.text("host").orEmpty(),
                    port = item.number("port") ?: 22,
                    user = item.text("user").orEmpty(),
                    password = item.text("password").orEmpty(),
                    os = item.text("os"),
                )
            }
            if (profiles.isNotEmpty()) SshStore().profiles = profiles
        }
        SelectionLock.reload()
        return true
    }

    private fun JsonObject.text(key: String): String? = this[key]?.jsonPrimitive?.contentOrNull
    private fun JsonObject.flag(key: String): Boolean? = this[key]?.jsonPrimitive?.booleanOrNull
    private fun JsonObject.number(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull
}
