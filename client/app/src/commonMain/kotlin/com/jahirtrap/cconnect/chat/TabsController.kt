package com.jahirtrap.cconnect.chat

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import com.jahirtrap.cconnect.data.SessionInfo
import com.jahirtrap.cconnect.data.Settings
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

object TabsController {
    class Tab(val id: String, val ctx: TabContext) {
        val owner: ViewModelStoreOwner = object : ViewModelStoreOwner {
            override val viewModelStore = ViewModelStore()
        }
        val factory: ViewModelProvider.Factory = chatViewModelFactory(ctx)
        var title by mutableStateOf<String?>(null)
        var color by mutableStateOf<String?>(null)
        var running by mutableStateOf(false)
        var sessionId: String? = null
        var projectKey: String? = null
    }

    private val settings = Settings()
    private var counter = 0
    private fun nextId(): String = "tab${counter++}"

    private fun defaultTab(): Tab =
        Tab(nextId(), TabContext(settings.activeEnvironment?.id, settings.activeEnvironment?.directory.orEmpty()))

    private fun restore(): Pair<List<Tab>, Int> {
        val raw = settings.tabsState
        if (raw.isBlank()) return listOf(defaultTab()) to 0
        return runCatching {
            val obj = Json.parseToJsonElement(raw).jsonObject
            val tabs = (obj["tabs"]?.jsonArray ?: emptyList()).map { el ->
                val o = el.jsonObject
                val sid = o["sid"]?.jsonPrimitive?.contentOrNull
                val proj = o["proj"]?.jsonPrimitive?.contentOrNull
                val title = o["title"]?.jsonPrimitive?.contentOrNull
                val color = o["color"]?.jsonPrimitive?.contentOrNull
                Tab(
                    nextId(),
                    TabContext(o["env"]?.jsonPrimitive?.contentOrNull, o["cwd"]?.jsonPrimitive?.contentOrNull.orEmpty(), sid, proj, title, color),
                ).also { t ->
                    t.title = title
                    t.color = color
                    t.sessionId = sid
                    t.projectKey = proj
                }
            }.ifEmpty { listOf(defaultTab()) }
            tabs to (obj["active"]?.jsonPrimitive?.intOrNull ?: 0).coerceIn(0, tabs.lastIndex)
        }.getOrDefault(listOf(defaultTab()) to 0)
    }

    private val restored = restore()
    private val _tabs = mutableStateListOf<Tab>().apply { addAll(restored.first) }
    val tabs: List<Tab> get() = _tabs

    var activeId by mutableStateOf(_tabs[restored.second].id)
        private set

    val active: Tab get() = _tabs.firstOrNull { it.id == activeId } ?: _tabs.first()

    val stripScroll = ScrollState(0)

    val selectorsScroll = ScrollState(0)

    val queueScroll = ScrollState(0)

    val attachmentsScroll = ScrollState(0)

    var lastToolbarHeightPx by mutableStateOf(0)

    private val messageScrolls = mutableMapOf<String, LazyListState>()
    private val expandedBlocks = mutableMapOf<String, SnapshotStateMap<Long, Boolean>>()
    private val followBottoms = mutableMapOf<String, MutableState<Boolean>>()

    fun messageScroll(tabId: String): LazyListState = messageScrolls.getOrPut(tabId) { LazyListState() }

    fun expandedBlocks(tabId: String): SnapshotStateMap<Long, Boolean> =
        expandedBlocks.getOrPut(tabId) { mutableStateMapOf() }

    fun followBottom(tabId: String): MutableState<Boolean> =
        followBottoms.getOrPut(tabId) { mutableStateOf(true) }

    init {
        _tabs.forEach { bind(it) }
    }

    private fun bind(tab: Tab): Tab {
        tab.ctx.onChange = { persist() }
        return tab
    }

    fun openTab(environmentId: String?, cwd: String): Tab {
        val tab = bind(Tab(nextId(), TabContext(environmentId, cwd)))
        _tabs.add(tab)
        activeId = tab.id
        syncActiveEnv()
        persist()
        return tab
    }

    fun newTab(): Tab {
        val envId = active.ctx.environmentId ?: settings.activeEnvironment?.id
        val dir = settings.environments.firstOrNull { it.id == envId }?.directory.orEmpty()
        return openTab(envId, dir)
    }

    fun openSessionTab(environmentId: String?, cwd: String, sessionId: String, projectKey: String, title: String? = null, color: String? = null): Tab {
        val tab = bind(Tab(nextId(), TabContext(environmentId, cwd, sessionId, projectKey, title, color)).also {
            it.sessionId = sessionId
            it.projectKey = projectKey
            it.title = title
            it.color = color
        })
        _tabs.add(tab)
        activeId = tab.id
        syncActiveEnv()
        persist()
        return tab
    }

    fun updateActive(title: String?, color: String?, running: Boolean, sessionId: String?, projectKey: String?) {
        val tab = active
        tab.running = running
        var changed = tab.sessionId != sessionId || tab.projectKey != projectKey
        tab.sessionId = sessionId
        tab.projectKey = projectKey
        if (sessionId == null) {
            if (tab.title != null) { tab.title = null; changed = true }
            if (tab.color != null) { tab.color = null; changed = true }
        } else {
            if (title != null && tab.title != title) { tab.title = title; changed = true }
            if (tab.color != color) { tab.color = color; changed = true }
        }
        if (changed) persist()
    }

    fun applyLiveSessions(sessions: List<SessionInfo>) {
        if (sessions.isEmpty()) return
        val byId = sessions.associateBy { it.sessionId }
        var changed = false
        _tabs.forEach { tab ->
            val sid = tab.sessionId ?: return@forEach
            val s = byId[sid] ?: return@forEach
            val newTitle = s.title ?: s.preview ?: sid.take(8)
            if (tab.title != newTitle) { tab.title = newTitle; changed = true }
            if (tab.color != s.color) { tab.color = s.color; changed = true }
        }
        if (changed) persist()
    }

    fun selectTab(id: String) {
        if (id == activeId || _tabs.none { it.id == id }) return
        activeId = id
        syncActiveEnv()
        persist()
    }

    fun closeTab(id: String) {
        val idx = _tabs.indexOfFirst { it.id == id }
        if (idx < 0) return
        val tab = _tabs.removeAt(idx)
        tab.owner.viewModelStore.clear()
        messageScrolls.remove(id)
        expandedBlocks.remove(id)
        followBottoms.remove(id)
        if (_tabs.isEmpty()) _tabs.add(bind(defaultTab()))
        if (activeId == id) activeId = _tabs[idx.coerceAtMost(_tabs.lastIndex)].id
        syncActiveEnv()
        persist()
    }

    fun selectNext() {
        val i = _tabs.indexOfFirst { it.id == activeId }
        if (i < 0 || _tabs.size < 2) return
        selectTab(_tabs[(i + 1) % _tabs.size].id)
    }

    fun selectPrev() {
        val i = _tabs.indexOfFirst { it.id == activeId }
        if (i < 0 || _tabs.size < 2) return
        selectTab(_tabs[(i - 1 + _tabs.size) % _tabs.size].id)
    }

    fun moveActive(delta: Int) {
        val i = _tabs.indexOfFirst { it.id == activeId }
        if (i < 0) return
        val j = (i + delta).coerceIn(0, _tabs.lastIndex)
        if (i == j) return
        _tabs.add(j, _tabs.removeAt(i))
        persist()
    }

    fun moveTab(id: String, toIndex: Int) {
        val from = _tabs.indexOfFirst { it.id == id }
        if (from < 0) return
        val to = toIndex.coerceIn(0, _tabs.lastIndex)
        if (from == to) return
        _tabs.add(to, _tabs.removeAt(from))
        persist()
    }

    fun closeActive() = closeTab(activeId)

    private fun syncActiveEnv() {
        val envId = active.ctx.environmentId ?: return
        if (settings.activeEnvironmentId != envId) settings.activeEnvironmentId = envId
    }

    private fun persist() {
        val activeIdx = _tabs.indexOfFirst { it.id == activeId }.coerceAtLeast(0)
        val json = buildJsonObject {
            put("active", activeIdx)
            putJsonArray("tabs") {
                _tabs.forEach { t ->
                    addJsonObject {
                        t.ctx.environmentId?.let { put("env", it) }
                        put("cwd", t.ctx.cwd)
                        t.sessionId?.let { put("sid", it) }
                        t.projectKey?.let { put("proj", it) }
                        t.title?.let { put("title", it) }
                        t.color?.let { put("color", it) }
                    }
                }
            }
        }
        runCatching { settings.tabsState = json.toString() }
        syncUrl()
    }

    private fun syncUrl() {
        val idx = _tabs.indexOfFirst { it.id == activeId }.coerceAtLeast(0)
        val a = active
        syncChatLocation(idx, a.sessionId, a.projectKey)
    }
}
