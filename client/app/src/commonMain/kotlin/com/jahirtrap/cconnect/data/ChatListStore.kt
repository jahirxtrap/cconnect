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

    private val _categories = MutableStateFlow<List<ChatCategory>>(emptyList())
    val categories: StateFlow<List<ChatCategory>> = _categories.asStateFlow()

    private val _placement = MutableStateFlow<Map<String, ChatPlacement>>(emptyMap())
    val placement: StateFlow<Map<String, ChatPlacement>> = _placement.asStateFlow()

    private val socket = ChatListSocket(scope, config, this)

    init {
        socket.connect()
    }

    fun applySnapshot(
        projects: List<ProjectInfo>,
        sessions: List<SessionInfo>,
        categories: List<ChatCategory> = emptyList(),
        placement: List<ChatPlacement> = emptyList(),
    ) {
        _projects.value = projects.sortedByDescending { it.lastActive ?: 0.0 }
        _sessions.value = sessions.sortedByDescending { it.lastActive ?: 0.0 }
        _categories.value = categories.sortedBy { it.position }
        _placement.value = placement.associateBy { it.sessionId }
        _loading.value = false
    }

    fun upsertCategory(category: ChatCategory) {
        if (category.id.isBlank()) return
        _categories.update { list -> (list.filterNot { it.id == category.id } + category).sortedBy { it.position } }
    }

    // The existing positions are dealt out in the new order: made-up ones would sort wrong
    // against the real position the server sends back for the moved category.
    fun moveCategory(categoryId: String, index: Int) {
        _categories.update { list ->
            val from = list.indexOfFirst { it.id == categoryId }
            if (from < 0) return@update list
            val target = index.coerceIn(0, list.lastIndex)
            if (target == from) return@update list
            val positions = list.map { it.position }.sorted()
            val reordered = list.toMutableList().apply { add(target, removeAt(from)) }
            reordered.mapIndexed { slot, category -> category.copy(position = positions[slot]) }
        }
    }

    fun removeCategory(categoryId: String) {
        _categories.update { list -> list.filterNot { it.id == categoryId } }
        _placement.update { map ->
            map.mapValues { (_, item) -> if (item.categoryId == categoryId) item.copy(categoryId = null) else item }
        }
    }

    fun upsertPlacement(item: ChatPlacement) {
        if (item.sessionId.isBlank()) return
        _placement.update { it + (item.sessionId to item) }
    }

    fun removePlacement(sessionId: String) {
        _placement.update { it - sessionId }
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
        removePlacement(sessionId)
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
