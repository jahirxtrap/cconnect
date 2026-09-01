package com.jahirtrap.cconnect.data.remote

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

object AccountsApi {

    data class Provider(val baseUrl: String, val model: String)

    data class Account(
        val id: String,
        val label: String,
        val loggedIn: Boolean,
        val primary: Boolean,
        val provider: Provider? = null,
    )

    data class Snapshot(val accounts: List<Account>, val default: String)

    data class ProviderProbe(val baseUrl: String, val models: List<String>, val found: Boolean)

    suspend fun list(): Snapshot? {
        val data = Http.get("/accounts")?.jsonObject ?: return null
        return Snapshot(
            accounts = data["accounts"]?.jsonArray?.map { parse(it.jsonObject) }.orEmpty(),
            default = data["default"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        )
    }

    suspend fun create(label: String): Account? =
        Http.post("/accounts", buildJsonObject { put("label", label) })?.jsonObject?.let(::parse)

    suspend fun detectProvider(baseUrl: String = ""): ProviderProbe? {
        val query = if (baseUrl.isBlank()) "" else "?base_url=${UrlCodec.encode(baseUrl)}"
        val data = Http.get("/accounts/provider$query")?.jsonObject ?: return null
        return ProviderProbe(
            baseUrl = data["base_url"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            models = data["models"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }.orEmpty(),
            found = data["found"]?.jsonPrimitive?.booleanOrNull ?: false,
        )
    }

    suspend fun createProvider(label: String, baseUrl: String): Account? =
        Http.post("/accounts/provider", buildJsonObject {
            put("label", label)
            put("base_url", baseUrl)
        })?.jsonObject?.let(::parse)

    suspend fun rename(id: String, label: String): Boolean =
        Http.put("/accounts/$id", buildJsonObject { put("label", label) }) != null

    suspend fun delete(id: String): Boolean = Http.delete("/accounts/$id") != null


    suspend fun startLogin(id: String): String? =
        Http.post("/accounts/$id/login")?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull

    suspend fun submitCode(id: String, code: String): Boolean =
        Http.post("/accounts/$id/login/code", buildJsonObject { put("code", code) }) != null

    suspend fun cancelLogin(id: String) {
        Http.delete("/accounts/$id/login")
    }

    fun exportUrl(id: String): String = "${Backend.baseUrl}/accounts/${UrlCodec.encode(id)}/export"

    fun importUrl(label: String): String =
        "${Backend.baseUrl}/accounts/import?label=${UrlCodec.encode(label)}"

    private fun parse(o: JsonObject) = Account(
        id = o["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        label = o["label"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        loggedIn = o["logged_in"]?.jsonPrimitive?.booleanOrNull ?: false,
        primary = o["primary"]?.jsonPrimitive?.booleanOrNull ?: false,
        provider = (o["provider"] as? JsonObject)?.let {
            Provider(
                baseUrl = it["base_url"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                model = it["model"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            )
        },
    )
}
