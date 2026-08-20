package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.BuildConfig
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

internal expect suspend fun githubGetText(url: String, accept: String?): String?
internal expect suspend fun githubReadCache(name: String): String?
internal expect suspend fun githubWriteCache(name: String, content: String)
internal expect val installerExtensions: List<String>

object GitHubApi {
    private const val OWNER = "jahirxtrap"
    private const val CONTRIBUTOR = "DiegoFernandoLojanTenesaca"
    private const val REPO = "cconnect"
    const val REPO_URL = "https://github.com/$OWNER/$REPO"
    const val RELEASES_URL = "$REPO_URL/releases"
    const val ALT_WEB_URL = "https://cconnect-tauri.pages.dev/"
    const val ALT_MARK = "-tauri"

    data class Release(val tag: String, val url: String, val installerUrl: String?, val altInstallerUrl: String? = null)
    data class ReleaseNotes(val tag: String, val body: String)
    data class Profile(val login: String, val name: String?, val avatarUrl: String, val url: String)

    private suspend fun fetch(url: String): JsonElement? =
        githubGetText(url, "application/vnd.github+json")?.let { runCatching { Json.parseToJsonElement(it) }.getOrNull() }

    private suspend fun readCache(name: String): JsonElement? =
        githubReadCache(name)?.let { runCatching { Json.parseToJsonElement(it) }.getOrNull() }

    private suspend fun writeCache(name: String, value: JsonElement) = githubWriteCache(name, value.toString())

    private fun installerFor(assets: List<JsonElement>, alt: Boolean): String? =
        installerExtensions.firstNotNullOfOrNull { ext ->
            assets.firstNotNullOfOrNull { asset ->
                val url = asset.jsonObject["browser_download_url"]?.jsonPrimitive?.contentOrNull
                val name = asset.jsonObject["name"]?.jsonPrimitive?.contentOrNull.orEmpty()
                url?.takeIf { it.endsWith(ext) && name.contains(ALT_MARK) == alt }
            }
        }

    suspend fun latestRelease(): Release? {
        val o = fetch("https://api.github.com/repos/$OWNER/$REPO/releases/latest")?.jsonObject ?: return null
        val assets = o["assets"]?.jsonArray.orEmpty()
        return Release(
            tag = o["tag_name"]?.jsonPrimitive?.contentOrNull ?: return null,
            url = o["html_url"]?.jsonPrimitive?.contentOrNull ?: REPO_URL,
            installerUrl = installerFor(assets, alt = false),
            altInstallerUrl = installerFor(assets, alt = true),
        )
    }

    suspend fun releaseNotes(): List<ReleaseNotes>? {
        val cached = readCache("github_changelog.json")?.jsonObject
        val cachedItems = cached?.get("items")?.jsonArray?.let(::notesOf)
        if (cached?.get("version")?.jsonPrimitive?.contentOrNull == BuildConfig.VERSION_NAME && cachedItems != null) {
            return cachedItems
        }
        val fetched = fetch("https://api.github.com/repos/$OWNER/$REPO/releases?per_page=50")?.jsonArray
        if (fetched != null) {
            writeCache("github_changelog.json", buildJsonObject {
                put("version", BuildConfig.VERSION_NAME)
                putJsonArray("items") {
                    notesOf(fetched).forEach { note ->
                        addJsonObject {
                            put("tag_name", note.tag)
                            put("body", note.body)
                        }
                    }
                }
            })
            return notesOf(fetched)
        }
        return cachedItems
    }

    private fun notesOf(items: JsonArray): List<ReleaseNotes> = items.mapNotNull { el ->
        val o = el.jsonObject
        ReleaseNotes(
            tag = o["tag_name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
            body = o["body"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        )
    }

    suspend fun claudeChangelog(cliVersion: String?): List<ReleaseNotes>? {
        val cached = readCache("claude_changelog.json")?.jsonObject
        val cachedItems = cached?.get("items")?.jsonArray?.let(::notesOf)
        if (cliVersion != null && cached?.get("version")?.jsonPrimitive?.contentOrNull == cliVersion && cachedItems != null) {
            return cachedItems
        }
        val raw = githubGetText("https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md", null)
        if (raw != null) {
            val parsed = parseClaudeChangelog(raw)
            writeCache("claude_changelog.json", buildJsonObject {
                put("version", cliVersion.orEmpty())
                putJsonArray("items") {
                    parsed.forEach { note ->
                        addJsonObject {
                            put("tag_name", note.tag)
                            put("body", note.body)
                        }
                    }
                }
            })
            return parsed
        }
        return cachedItems
    }

    private fun parseClaudeChangelog(markdown: String): List<ReleaseNotes> =
        markdown.split(Regex("(?m)^## ")).drop(1).take(30).mapNotNull { block ->
            val lines = block.trim().lines()
            val tag = lines.firstOrNull()?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            ReleaseNotes(tag, lines.drop(1).joinToString("\n").trim())
        }

    suspend fun ownerProfile(): Profile? = profile(OWNER, "github_profile.json")

    suspend fun contributorProfile(): Profile? =
        profile(CONTRIBUTOR, "github_profile_contributor.json")

    private suspend fun profile(login: String, cacheName: String): Profile? {
        readCache(cacheName)?.jsonObject?.let { profileOf(it, login) }?.let { return it }
        val o = fetch("https://api.github.com/users/$login")?.jsonObject ?: return null
        val result = profileOf(o, login) ?: return null
        writeCache(cacheName, buildJsonObject {
            put("login", result.login)
            result.name?.let { put("name", it) }
            put("avatar_url", result.avatarUrl)
            put("html_url", result.url)
        })
        return result
    }

    private fun profileOf(o: JsonObject, login: String): Profile? {
        return Profile(
            login = o["login"]?.jsonPrimitive?.contentOrNull ?: login,
            name = o["name"]?.jsonPrimitive?.contentOrNull,
            avatarUrl = o["avatar_url"]?.jsonPrimitive?.contentOrNull ?: return null,
            url = o["html_url"]?.jsonPrimitive?.contentOrNull ?: "https://github.com/$login",
        )
    }
}
