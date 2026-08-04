package com.jahirtrap.cconnect.service

import kotlinx.coroutines.flow.StateFlow

enum class LocalServerState { Stopped, Starting, RunningManaged, RunningExternal, Failed }

enum class LocalServerError { BadDir, NoPython, LaunchFailed, Crashed }

data class LocalServerInfo(
    val managed: Boolean = false,
    val ready: Boolean = false,
    val error: LocalServerError? = null,
    val errorDetail: String? = null,
    val publicUrl: String? = null,
    val token: String? = null,
)

data class LocalServerConfig(
    val dir: String,
    val python: String,
    val pythonPath: String,
    val mode: String,
    val probePort: Int,
    val publicHost: String = "",
)

expect object LocalServer {
    val status: StateFlow<LocalServerInfo>
    fun start(config: LocalServerConfig)
    fun stop()
    fun restart(config: LocalServerConfig)
}

expect fun pickDirectory(): String?
expect fun pickExecutable(): String?
