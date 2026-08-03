package com.jahirtrap.cconnect.data.remote

import com.jahirtrap.cconnect.data.EnvironmentProfile
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

data class BackendConfig(
    val kind: String = "http",
    val host: String = "",
    val port: Int? = null,
    val authKind: String = "none",
    val authToken: String = "",
    val authUser: String = "",
    val authPassword: String = "",
    val authHeaderName: String = "",
    val authHeaderValue: String = "",
) {
    private val secure: Boolean get() = kind == "https"
    private val portSuffix: String
        get() {
            val p = port ?: return ""
            val default = if (secure) 443 else 80
            return if (p == default) "" else ":$p"
        }

    val baseUrl: String get() = "${if (secure) "https" else "http"}://$host$portSuffix/api"
    val wsUrl: String get() = "${if (secure) "wss" else "ws"}://$host$portSuffix/api/chat/ws"
    val systemWsUrl: String get() = "${if (secure) "wss" else "ws"}://$host$portSuffix/api/system/ws"
    val listWsUrl: String get() = "${if (secure) "wss" else "ws"}://$host$portSuffix/api/list/ws"
    val sharedWsUrl: String get() = "${if (secure) "wss" else "ws"}://$host$portSuffix/api/shared/ws"
    val speedtestWsUrl: String get() = "${if (secure) "wss" else "ws"}://$host$portSuffix/api/network/speedtest/ws"
    val isConfigured: Boolean get() = host.isNotBlank()

    @OptIn(ExperimentalEncodingApi::class)
    private val authorizationHeader: String?
        get() = when (authKind) {
            "bearer" -> if (authToken.isBlank()) null else "Bearer $authToken"
            "basic" -> if (authUser.isBlank() && authPassword.isBlank()) null
            else "Basic " + Base64.Default.encode("$authUser:$authPassword".encodeToByteArray())
            else -> null
        }

    val authHeaders: List<Pair<String, String>>
        get() = buildList {
            authorizationHeader?.let { add("Authorization" to it) }
            if (authKind == "header" && authHeaderName.isNotBlank() && authHeaderValue.isNotBlank()) {
                add(authHeaderName to authHeaderValue)
            }
        }
}

fun EnvironmentProfile.toBackendConfig(): BackendConfig = BackendConfig(
    kind = kind,
    host = host,
    port = port,
    authKind = authKind,
    authToken = authToken,
    authUser = authUser,
    authPassword = authPassword,
    authHeaderName = authHeaderName,
    authHeaderValue = authHeaderValue,
)
