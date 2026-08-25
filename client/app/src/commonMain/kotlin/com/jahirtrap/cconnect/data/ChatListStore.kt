package com.jahirtrap.cconnect.data

import com.jahirtrap.cconnect.data.remote.BackendConfig
import com.jahirtrap.cconnect.data.remote.ChatListSocket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class ListBackend internal constructor(scope: CoroutineScope, config: () -> BackendConfig) {
    private val _projects = MutableStateFlow<List<ProjectInfo>>(emptyList())
    val projects: StateFlow<List<ProjectInfo>> = _projects.asStateFlow()

    private val _sessions = MutableStateFlow<List<SessionInfo>>(emptyList())
    val sessions: StateFlow<List<SessionInfo>> = _sessions.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val socket = ChatListSocket(scope, config, this)

    init {
        socket.connect()
    }

    fun applySnapshot(projects: List<ProjectInfo>, sessions: List<SessionInfo>) {
        _projects.value = projects.sortedByDescending { it.lastActive ?: 0.0 }
        _sessions.value = sessions.sortedByDescending { it.lastActive ?: 0.0 }
        _loading.value = false
    }

    fun upsertSession(session: SessionInfo) {
        if (session.sessionId.isBlank()) return
        _sessions.update { list ->
            (list.filterNot { it.sessionId == session.sessionId } + session)
                .sortedByDescending { it.lastActive ?: 0.0 }
        }
    }

    fun removeSession(sessionId: String) {
        _sessions.update { list -> list.filterNot { it.sessionId == sessionId } }
    }

    fun upsertProject(project: ProjectInfo) {
        if (project.projectKey.isBlank()) return
        _projects.update { list ->
            (list.filterNot { it.projectKey == project.projectKey } + project)
                .sortedByDescending { it.lastActive ?: 0.0 }
        }
    }

    fun removeProject(projectKey: String) {
        _projects.update { list -> list.filterNot { it.projectKey == projectKey } }
        _sessions.update { list -> list.filterNot { it.projectKey == projectKey } }
    }

    fun onReconnecting() {
        // Activity is what the server was doing; with the socket down it is a leftover, and the
        // sidebar kept a chat spinning as "working" next to a "server unavailable" header.
        _sessions.update { list -> list.map { if (it.activity != null) it.copy(activity = null) else it } }
        if (_projects.value.isEmpty() && _sessions.value.isEmpty()) _loading.value = true
    }
}

object ChatListStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val backends = mutableMapOf<String, ListBackend>()

    fun forConfig(config: BackendConfig): ListBackend? {
        if (!config.isConfigured) return null
        val key = config.baseUrl + "|" + config.authHeaders.joinToString(",") { "${it.first}=${it.second}" }
        return backends.getOrPut(key) { ListBackend(scope, { config }) }
    }
}
