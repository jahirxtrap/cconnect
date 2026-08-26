package com.jahirtrap.cconnect.data

import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.isWebPlatform
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class Settings {
    private val prefs = AppPrefs("cconnect")
    private val securePrefs = AppPrefs("cconnect_secure", secure = true)

    init {
        syncBackend()
    }

    var environments: List<EnvironmentProfile>
        get() = parseEnvironments(securePrefs.getString("environments", null))
        set(value) {
            securePrefs.edit { putString("environments", encodeEnvironments(value)) }
            syncBackend()
        }

    var activeEnvironmentId: String?
        get() = prefs.getString("active_environment", null)
        set(value) {
            prefs.edit { putString("active_environment", value) }
            syncBackend()
        }

    val activeEnvironment: EnvironmentProfile?
        get() = environments.let { list -> list.firstOrNull { it.id == activeEnvironmentId } ?: list.firstOrNull() }

    var notifyTaskDone: Boolean
        get() = prefs.getBoolean("notify_task_done", false)
        set(value) = prefs.edit { putBoolean("notify_task_done", value) }

    var notifyInteraction: Boolean
        get() = prefs.getBoolean("notify_interaction", true)
        set(value) = prefs.edit { putBoolean("notify_interaction", value) }

    var notifPermissionRequested: Boolean
        get() = prefs.getBoolean("notif_permission_requested", false)
        set(value) = prefs.edit { putBoolean("notif_permission_requested", value) }

    var markdownPreviewFormatted: Boolean
        get() = prefs.getBoolean("markdown_preview_formatted", true)
        set(value) = prefs.edit { putBoolean("markdown_preview_formatted", value) }

    var visibilitySimple: String
        get() = prefs.getString("visibility_simple", "").orEmpty()
        set(value) = prefs.edit { putString("visibility_simple", value) }

    var visibilityThinking: String
        get() = prefs.getString("visibility_thinking", "").orEmpty()
        set(value) = prefs.edit { putString("visibility_thinking", value) }

    var visibilityToolUse: String
        get() = prefs.getString("visibility_tool_use", "").orEmpty()
        set(value) = prefs.edit { putString("visibility_tool_use", value) }

    var visibilityFileChange: String
        get() = prefs.getString("visibility_file_change", "").orEmpty()
        set(value) = prefs.edit { putString("visibility_file_change", value) }

    var visibilityCompact: String
        get() = prefs.getString("visibility_compact", "").orEmpty()
        set(value) = prefs.edit { putString("visibility_compact", value) }

    var visibilityWorking: String
        get() = prefs.getString("visibility_working", "").orEmpty()
        set(value) = prefs.edit { putString("visibility_working", value) }

    var showTimestamps: Boolean
        get() = prefs.getBoolean("show_timestamps", false)
        set(value) = prefs.edit { putBoolean("show_timestamps", value) }

    var sidebarExpanded: Boolean
        get() = prefs.getBoolean("sidebar_expanded", false)
        set(value) = prefs.edit { putBoolean("sidebar_expanded", value) }

    var windowMaximized: Boolean
        get() = prefs.getBoolean("window_maximized", true)
        set(value) = prefs.edit { putBoolean("window_maximized", value) }

    var minimizeToTray: Boolean
        get() = prefs.getBoolean("minimize_to_tray", false)
        set(value) = prefs.edit { putBoolean("minimize_to_tray", value) }

    var localServerEnabled: Boolean
        get() = prefs.getBoolean("local_server_enabled", false)
        set(value) = prefs.edit { putBoolean("local_server_enabled", value) }

    var localServerDir: String
        get() = prefs.getString("local_server_dir", "") ?: ""
        set(value) = prefs.edit { putString("local_server_dir", value) }

    var localServerPython: String
        get() = prefs.getString("local_server_python", "auto") ?: "auto"
        set(value) = prefs.edit { putString("local_server_python", value) }

    var localServerPythonPath: String
        get() = prefs.getString("local_server_python_path", "") ?: ""
        set(value) = prefs.edit { putString("local_server_python_path", value) }

    var localServerMode: String
        get() = prefs.getString("local_server_mode", "local") ?: "local"
        set(value) = prefs.edit { putString("local_server_mode", value) }

    var localServerPublicHost: String
        get() = prefs.getString("local_server_public_host", "") ?: ""
        set(value) = prefs.edit { putString("local_server_public_host", value) }

    var tabsState: String
        get() = prefs.getString("tabs_state", "") ?: ""
        set(value) = prefs.edit { putString("tabs_state", value) }

    /** Which categories are folded, per device: a view state, not something to share. */
    var collapsedCategories: List<String>
        get() = (prefs.getString("collapsed_categories", "") ?: "").split(",").filter { it.isNotBlank() }
        set(value) = prefs.edit { putString("collapsed_categories", value.joinToString(",")) }

    /** Kept out of the list on this device only; the category and its chats stay untouched. */
    var hiddenCategories: List<String>
        get() = (prefs.getString("hidden_categories", "") ?: "").split(",").filter { it.isNotBlank() }
        set(value) = prefs.edit { putString("hidden_categories", value.joinToString(",")) }

    var hiddenProjects: List<String>
        get() = (prefs.getString("hidden_projects", "") ?: "").split(",").filter { it.isNotBlank() }
        set(value) = prefs.edit { putString("hidden_projects", value.joinToString(",")) }

    var environmentLocked: Boolean
        get() = prefs.getBoolean("environment_locked", false)
        set(value) = prefs.edit { putBoolean("environment_locked", value) }

    var projectLocked: Boolean
        get() = prefs.getBoolean("project_locked", false)
        set(value) = prefs.edit { putBoolean("project_locked", value) }

    var fileSortField: String
        get() = prefs.getString("file_sort_field", "date") ?: "date"
        set(value) = prefs.edit { putString("file_sort_field", value) }

    var fileSortAscending: Boolean
        get() = prefs.getBoolean("file_sort_ascending", false)
        set(value) = prefs.edit { putBoolean("file_sort_ascending", value) }

    fun upsertEnvironment(profile: EnvironmentProfile) {
        val list = environments.toMutableList()
        val i = list.indexOfFirst { it.id == profile.id }
        if (i >= 0) list[i] = profile else list.add(profile)
        environments = list
        if (activeEnvironmentId == null) activeEnvironmentId = profile.id
    }

    fun deleteEnvironment(id: String) {
        environments = environments.filterNot { it.id == id }
        if (activeEnvironmentId == id) activeEnvironmentId = environments.firstOrNull()?.id
    }

    fun updateActiveEnvironment(transform: (EnvironmentProfile) -> EnvironmentProfile) {
        val env = activeEnvironment ?: return
        upsertEnvironment(transform(env))
    }

    fun updateEnvironment(id: String?, transform: (EnvironmentProfile) -> EnvironmentProfile) {
        val env = environments.firstOrNull { it.id == id } ?: activeEnvironment ?: return
        upsertEnvironment(transform(env))
    }

    private fun syncBackend() {
        Backend.accentIndex = activeEnvironment?.accentIndex
        activeEnvironment?.let {
            Backend.kind = it.kind
            Backend.host = it.host
            Backend.port = it.port
            Backend.authKind = it.authKind
            Backend.authToken = it.authToken
            Backend.authUser = it.authUser
            Backend.authPassword = it.authPassword
            Backend.authHeaderName = it.authHeaderName
            Backend.authHeaderValue = it.authHeaderValue
        }
    }

    var cwd: String
        get() = prefs.getString("cwd", "") ?: ""
        set(value) = prefs.edit { putString("cwd", value) }

    // "" = follow system, otherwise a language tag like "en" / "es"
    var language: String
        get() = prefs.getString("language", "") ?: ""
        set(value) = prefs.edit { putString("language", value) }

    // "system" | "light" | "dark"
    var themeMode: String
        get() = prefs.getString("theme_mode", "system") ?: "system"
        set(value) = prefs.edit { putString("theme_mode", value) }

    var dynamicColor: Boolean
        get() = prefs.getBoolean("dynamic_color", true)
        set(value) = prefs.edit { putBoolean("dynamic_color", value) }

    var accentIndex: Int
        get() = prefs.getInt("accent_index", 4)
        set(value) = prefs.edit { putInt("accent_index", value) }

    var fontStyle: String
        get() = (if (isWebPlatform) "flat" else "system").let { def -> prefs.getString("font_style", def) ?: def }
        set(value) = prefs.edit { putString("font_style", value) }

    val isConfigured: Boolean
        get() = activeEnvironment != null

    // Reset app-local prefs (backend-owned settings reset via /api/settings/reset).
    fun resetDefaults() {
        prefs.edit {
            listOf("cwd", "language", "theme_mode", "dynamic_color", "accent_index", "font_style")
                .forEach { remove(it) }
        }
    }

    private fun parseEnvironments(raw: String?): List<EnvironmentProfile> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching {
            Json.parseToJsonElement(raw).jsonArray.map { el ->
                val o = el.jsonObject
                val legacySecure = o["secure"]?.jsonPrimitive?.booleanOrNull
                val legacyToken = o["token"]?.jsonPrimitive?.contentOrNull.orEmpty()
                val kindStored = o["kind"]?.jsonPrimitive?.contentOrNull
                val resolvedKind = kindStored?.let { if (it == "url") if (legacySecure == true) "https" else "http" else it }
                    ?: if (legacySecure == true) "https" else "http"
                val portRaw = o["port"]?.jsonPrimitive?.intOrNull
                val resolvedPort = when {
                    resolvedKind == "https" -> portRaw?.takeIf { it != 443 }
                    else -> portRaw ?: 8723
                }
                EnvironmentProfile(
                    id = o["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    name = o["name"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    kind = resolvedKind,
                    host = o["host"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    port = resolvedPort,
                    authKind = o["authKind"]?.jsonPrimitive?.contentOrNull
                        ?: if (legacyToken.isNotBlank()) "bearer" else "none",
                    authToken = o["authToken"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotEmpty() }
                        ?: legacyToken,
                    authUser = o["authUser"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    authPassword = o["authPassword"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    authHeaderName = o["authHeaderName"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    authHeaderValue = o["authHeaderValue"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    directory = o["directory"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    account = o["account"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    model = o["model"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    effort = o["effort"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    permissionMode = o["permissionMode"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    streaming = o["streaming"]?.jsonPrimitive?.booleanOrNull,
                    accentIndex = o["accentIndex"]?.jsonPrimitive?.intOrNull,
                )
            }
        }.getOrDefault(emptyList())
    }

    private fun encodeEnvironments(list: List<EnvironmentProfile>): String =
        buildJsonArray {
            list.forEach { p ->
                addJsonObject {
                    put("id", p.id)
                    put("name", p.name)
                    put("kind", p.kind)
                    put("host", p.host)
                    p.port?.let { put("port", it) }
                    put("authKind", p.authKind)
                    put("authToken", p.authToken)
                    put("authUser", p.authUser)
                    put("authPassword", p.authPassword)
                    put("authHeaderName", p.authHeaderName)
                    put("authHeaderValue", p.authHeaderValue)
                    put("directory", p.directory)
                    put("account", p.account)
                    put("model", p.model)
                    put("effort", p.effort)
                    put("permissionMode", p.permissionMode)
                    p.streaming?.let { put("streaming", it) }
                    p.accentIndex?.let { put("accentIndex", it) }
                }
            }
        }.toString()
}
