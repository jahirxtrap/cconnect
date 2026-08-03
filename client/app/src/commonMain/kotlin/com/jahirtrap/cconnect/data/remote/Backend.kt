package com.jahirtrap.cconnect.data.remote

object Backend {
    var kind: String = "http"
    var host: String = ""
    var port: Int? = null
    var authKind: String = "none"
    var authToken: String = ""
    var authUser: String = ""
    var authPassword: String = ""
    var authHeaderName: String = ""
    var authHeaderValue: String = ""

    fun snapshot(): BackendConfig = BackendConfig(
        kind, host, port, authKind, authToken, authUser, authPassword, authHeaderName, authHeaderValue,
    )

    val baseUrl: String get() = snapshot().baseUrl
    val wsUrl: String get() = snapshot().wsUrl
    val systemWsUrl: String get() = snapshot().systemWsUrl
    val speedtestWsUrl: String get() = snapshot().speedtestWsUrl
    val isConfigured: Boolean get() = host.isNotBlank()
    val authHeaders: List<Pair<String, String>> get() = snapshot().authHeaders
}
