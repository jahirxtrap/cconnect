package com.jahirtrap.cconnect.data

data class EnvironmentProfile(
    val id: String,
    val name: String,
    val kind: String = "http",            // "http" | "https"
    val host: String,
    val port: Int? = null,                // null = implicit default for the scheme (443 for https)
    val authKind: String = "none",        // "none" | "bearer" | "basic" | "header"
    val authToken: String = "",
    val authUser: String = "",
    val authPassword: String = "",
    val authHeaderName: String = "",
    val authHeaderValue: String = "",
    val directory: String = "",
    val account: String = "",             // "" = inherit server default
    val model: String = "",               // "" = inherit server default
    val effort: String = "",              // "" = inherit server default
    val permissionMode: String = "",      // "" = inherit server default
    val streaming: Boolean? = null,       // null = inherit server default
) {
    val address: String get() = if (port != null) "$host:$port" else host
}
