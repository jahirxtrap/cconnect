package com.jahirtrap.cconnect.chat

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jahirtrap.cconnect.BuildConfig
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.resources.connection_error
import com.jahirtrap.cconnect.resources.notif_task_done
import com.jahirtrap.cconnect.resources.notif_question
import com.jahirtrap.cconnect.resources.notif_permission
import com.jahirtrap.cconnect.resources.notif_component
import com.jahirtrap.cconnect.resources.permission_allow
import com.jahirtrap.cconnect.resources.permission_allow_always
import com.jahirtrap.cconnect.resources.permission_deny
import com.jahirtrap.cconnect.resources.plan
import com.jahirtrap.cconnect.data.AppCompat
import com.jahirtrap.cconnect.data.AppUpdater
import com.jahirtrap.cconnect.data.Capabilities
import com.jahirtrap.cconnect.data.ChatListStore
import com.jahirtrap.cconnect.data.ChatMessage
import com.jahirtrap.cconnect.data.QueuedMessage
import com.jahirtrap.cconnect.data.SendStatus
import com.jahirtrap.cconnect.data.EnvOverrides
import com.jahirtrap.cconnect.data.ServerDefaults
import com.jahirtrap.cconnect.data.EnvironmentProfile
import com.jahirtrap.cconnect.data.CommandOption
import com.jahirtrap.cconnect.data.CompactData
import com.jahirtrap.cconnect.data.ComponentElement
import com.jahirtrap.cconnect.data.DiffLine
import com.jahirtrap.cconnect.data.InteractionData
import com.jahirtrap.cconnect.data.InteractionOption
import com.jahirtrap.cconnect.data.pending
import com.jahirtrap.cconnect.data.VALUE_SEPARATOR
import com.jahirtrap.cconnect.data.ProjectInfo
import com.jahirtrap.cconnect.data.Role
import com.jahirtrap.cconnect.data.ServerEvent
import com.jahirtrap.cconnect.data.SessionInfo
import com.jahirtrap.cconnect.data.SessionMessage
import com.jahirtrap.cconnect.data.toRole
import com.jahirtrap.cconnect.data.visible
import com.jahirtrap.cconnect.data.Settings
import com.jahirtrap.cconnect.data.VisibilityPrefs
import com.jahirtrap.cconnect.data.remote.GitHubApi
import com.jahirtrap.cconnect.data.TodoItem
import com.jahirtrap.cconnect.data.remote.CapabilitiesApi
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.data.remote.toBackendConfig
import com.jahirtrap.cconnect.data.remote.ChatSocket
import com.jahirtrap.cconnect.data.remote.SessionsApi
import com.jahirtrap.cconnect.data.remote.SettingsApi
import com.jahirtrap.cconnect.files.AttachmentFile
import com.jahirtrap.cconnect.files.uploadAttachment
import com.jahirtrap.cconnect.service.Notifier
import com.jahirtrap.cconnect.data.remote.UrlCodec
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.getString
import com.jahirtrap.cconnect.data.nowMillis

enum class ConnectionState { Disconnected, Connecting, Connected }

private const val MESSAGE_TAIL_CAP = 500
private const val MESSAGE_INITIAL_CAP = 100

data class SideChatState(
    val boundSessionId: String? = null,    // the main conversation this side chat belongs to
    val sideSessionId: String? = null,     // SDK session of the side conversation, resumed for memory
    val messages: List<ChatMessage> = emptyList(),
    val streaming: Boolean = false,
)

data class ChatUiState(
    val connection: ConnectionState = ConnectionState.Connecting,
    val messages: List<ChatMessage> = emptyList(),
    val frozen: List<ChatMessage>? = null,
    val streaming: Boolean = false,
    val permissionMode: String = "bypassPermissions",
    val model: String = "opus[1m]",
    val effort: String = "xhigh",
    val streamTokens: Boolean = true,
    val account: String = "default",
    val accountOverride: String = "",
    val modelOverride: String = "",
    val effortOverride: String = "",
    val permissionOverride: String = "",
    val streamingOverride: Boolean? = null,
    val capabilities: Capabilities = Capabilities(),
    val capabilitiesReady: Boolean = false,
    val sessionId: String? = null,
    val activeProjectKey: String? = null,
    val sessionColor: String? = null,
    val todos: List<TodoItem> = emptyList(),
    val error: String? = null,
    val historyProjects: List<ProjectInfo> = emptyList(),
    val historySessions: List<SessionInfo> = emptyList(),
    val allSessions: List<SessionInfo> = emptyList(),
    val historyProjectKey: String? = null,
    val historyLoading: Boolean = true,
    val environments: List<EnvironmentProfile> = emptyList(),
    val activeEnvironmentId: String? = null,
    val oldestLoadedIndex: Int? = null,
    val transcriptLoading: Boolean = false,
    val transcriptPaging: Boolean = false,
    val transcriptExhausted: Boolean = false,
    val followBottom: Boolean = true,
    val compacting: Boolean = false,
    val streamStatus: String? = null,
    val sideChat: SideChatState? = null,             // persisted side conversation (kept while the session lives)
    val sideChatOpen: Boolean = false,               // whether the side panel is currently shown
    val sideFullscreen: Boolean = false,
    val showWorking: String = "label",               // quick-chat working indicator visibility (label/off)
    val visibility: VisibilityPrefs = VisibilityPrefs(),
    val serverVisibility: VisibilityPrefs = VisibilityPrefs(
        simple = "off",
        thinking = "full",
        toolUse = "label",
        fileChange = "full",
        compact = "full",
        working = "label",
    ),
    val pendingToolIds: Set<String> = emptySet(),    // tools still running (tool_use seen, no result yet)
    val contextTokens: Int? = null,                  // approx context-window tokens used on the last turn
    val rewindPoints: List<SessionsApi.RewindPoint> = emptyList(),
    val rewindLoading: Boolean = false,
    val rewindTarget: SessionsApi.RewindPoint? = null,
    val rewindPreview: SessionsApi.RewindPreview? = null,
    val rewindBusy: Boolean = false,
    val pendingInput: String? = null,                // rewound prompt to restore into the composer
    val latestRelease: GitHubApi.Release? = null,    // latest app release on GitHub, newer or not
    val updateAvailable: Boolean = false,            // that release is newer than this build
    val appOutdated: Boolean = false,                // server doesn't support this app version
    val serverOutdated: Boolean = false,             // this app doesn't support the server version
    val cliOutdated: Boolean = false,                // Claude Code on the server is older than required
    val versionNotices: List<CompatStatus> = emptyList(),  // dismissable startup notices
    val attachments: List<Attachment> = emptyList(), // files queued in the composer, uploaded on send
    val uploadingAttachments: Boolean = false,
    val queue: List<QueuedMessage> = emptyList(),
) {
    val view: List<ChatMessage> get() = frozen ?: messages
}

data class Attachment(
    val id: Long,
    val file: AttachmentFile,
    val name: String,
    val size: Long,
    val progress: Float = 0f,
)

enum class CompatStatus { AppOutdated, ServerOutdated, CliOutdated, UpdateAvailable }

class ChatViewModel(private val ctx: TabContext) : ViewModel() {
    private val settings = Settings()
    val showTimestamps: Boolean get() = settings.showTimestamps
    private val client = ChatSocket(viewModelScope) { activeEnv()?.toBackendConfig() ?: Backend.snapshot() }

    private fun activeEnv(): EnvironmentProfile? =
        settings.environments.firstOrNull { it.id == ctx.environmentId } ?: settings.activeEnvironment

    private fun baseUrl(): String = activeEnv()?.toBackendConfig()?.baseUrl ?: Backend.baseUrl

    private fun listConfig() = activeEnv()?.toBackendConfig() ?: Backend.snapshot()

    // Generation settings (model/effort/permission/streaming) are backend-owned
    private val _state = MutableStateFlow(
        Capabilities().defaults.let { d ->
            ChatUiState(
                permissionMode = d.permissionMode,
                model = d.model,
                effort = d.effort,
                streamTokens = true,
                environments = settings.environments,
                activeEnvironmentId = ctx.environmentId,
            )
        }
    )
    val state: StateFlow<ChatUiState> = _state.asStateFlow()

    var draft by mutableStateOf("")
    var sideDraft by mutableStateOf("")

    private var nextId = 0L
    private var currentAssistantId: Long? = null
    private var currentThinkingId: Long? = null
    private var optimisticChipId: String? = null
    private var optimisticMsgId: Long? = null
    private var interrupting = false
    private var turnFirstResponseId: Long? = null
    private var currentSideAssistantId: Long? = null
    private var connectInvoked = false
    private var historyJobs: List<Job> = emptyList()
    private var historyLoaded = false
    private var defaultProjectApplied = false
    private var initialConsumed = false
    private var pendingTrim: ((List<ChatMessage>) -> List<ChatMessage>)? = null

    init {
        if (ctx.cwd.isBlank()) ctx.cwd = activeEnv()?.directory.orEmpty()
        ctx.initialSessionId?.let { sid ->
            _state.update {
                it.copy(
                    sessionId = sid,
                    activeProjectKey = ctx.initialProjectKey,
                    sessionColor = ctx.initialColor,
                    transcriptLoading = true,
                )
            }
        }
        loadEnvOverrides()
        viewModelScope.launch {
            client.events.collect { (side, parent, event) -> if (side) onSideEvent(event) else onEvent(event, parent) }
        }
        viewModelScope.launch {
            EnvOverrides.revision.drop(1).collect { applyForeignOverrides() }
        }
        viewModelScope.launch {
            ServerDefaults.revision.drop(1).collect { refreshServerInfo() }
        }
    }

    private suspend fun consumeInitialSession(projectKey: String? = null) {
        val sid = ctx.initialSessionId
        if (sid == null) {
            initialConsumed = true
            return
        }
        val info = sessionInfoFor(sid, projectKey ?: ctx.initialProjectKey)
        initialConsumed = runCatching { loadSessionInto(info) }.getOrDefault(false)
    }

    private fun applyForeignOverrides() {
        val before = _state.value
        loadEnvOverrides()
        val after = _state.value
        if (after.accountOverride != before.accountOverride) pushGeneration(account = after.accountOverride)
        if (after.modelOverride != before.modelOverride) {
            pushGeneration(model = after.modelOverride.ifEmpty { after.model })
        }
        if (after.effortOverride != before.effortOverride) {
            pushGeneration(effort = after.effortOverride.ifEmpty { after.effort })
        }
        if (after.streamingOverride != before.streamingOverride) {
            pushGeneration(partial = after.streamingOverride ?: after.streamTokens)
        }
        if (after.permissionOverride != before.permissionOverride && after.connection == ConnectionState.Connected) {
            client.sendSetPermissionMode(after.permissionOverride.ifEmpty { after.permissionMode })
        }
    }

    private fun applyDefaultDirectory() {
        ctx.cwd = activeEnv()?.directory.orEmpty()
        defaultProjectApplied = false
    }

    private fun loadEnvOverrides() {
        val env = activeEnv()
        _state.update {
            it.copy(
                accountOverride = env?.account ?: "",
                modelOverride = env?.model ?: "",
                effortOverride = env?.effort ?: "",
                permissionOverride = env?.permissionMode ?: "",
                streamingOverride = env?.streaming,
            )
        }
    }

    fun connect() {
        if (activeEnv() == null) return
        if (connectInvoked && _state.value.connection != ConnectionState.Disconnected) return
        connectInvoked = true
        _state.update { it.copy(connection = ConnectionState.Connecting, error = null) }
        if (!releaseChecked) {
            releaseChecked = true
            AppUpdater.consumeIfInstalled(BuildConfig.VERSION_NAME)
            viewModelScope.launch { checkForUpdates() }
        }
        viewModelScope.launch {
            refreshServerInfo()
            loadEnvOverrides()
            _state.update { it.copy(capabilitiesReady = true) }
            if (!initialConsumed) consumeInitialSession()
            client.connect()
        }
    }

    private val dismissedNotices = mutableSetOf<CompatStatus>()

    private fun pushNotice(notices: List<CompatStatus>, notice: CompatStatus): List<CompatStatus> =
        if (notice in dismissedNotices || notice in notices) notices else notices + notice

    private fun evaluateCompat(
        serverVersion: String?,
        supportedApp: String?,
        cliVersion: String? = null,
        supportedCli: String? = null,
    ) {
        val appOutdated = !AppCompat.satisfies(BuildConfig.VERSION_NAME, supportedApp)
        val serverOutdated = !AppCompat.satisfies(serverVersion, AppCompat.SUPPORTED_SERVER)
        val cliOutdated = cliVersion != null && !AppCompat.satisfies(cliVersion, supportedCli)
        if (!appOutdated) dismissedNotices.remove(CompatStatus.AppOutdated)
        if (!serverOutdated) dismissedNotices.remove(CompatStatus.ServerOutdated)
        if (!cliOutdated) dismissedNotices.remove(CompatStatus.CliOutdated)
        _state.update {
            var notices = it.versionNotices
            notices = if (appOutdated) pushNotice(notices, CompatStatus.AppOutdated) else notices - CompatStatus.AppOutdated
            notices = if (serverOutdated) pushNotice(notices, CompatStatus.ServerOutdated) else notices - CompatStatus.ServerOutdated
            notices = if (cliOutdated) pushNotice(notices, CompatStatus.CliOutdated) else notices - CompatStatus.CliOutdated
            it.copy(appOutdated = appOutdated, serverOutdated = serverOutdated, cliOutdated = cliOutdated, versionNotices = notices)
        }
    }

    private fun applyRelease(release: GitHubApi.Release?) {
        val newer = release != null && AppCompat.compare(release.tag, BuildConfig.VERSION_NAME) > 0
        if (!newer) dismissedNotices.remove(CompatStatus.UpdateAvailable)
        _state.update {
            var notices = it.versionNotices
            notices = if (newer) pushNotice(notices, CompatStatus.UpdateAvailable) else notices - CompatStatus.UpdateAvailable
            it.copy(latestRelease = release ?: it.latestRelease, updateAvailable = newer, versionNotices = notices)
        }
    }

    private var releaseChecked = false

    suspend fun checkForUpdates() {
        applyRelease(GitHubApi.latestRelease())
    }

    private suspend fun refreshCompat() {
        val caps = CapabilitiesApi.capabilities()
        if (caps != null) {
            val current = _state.value
            val staleAccount = current.accountOverride.isNotEmpty() &&
                caps.accounts.none { it.id == current.accountOverride }
            val staleModel = current.modelOverride.isNotEmpty() &&
                caps.models.none { it.id == current.modelOverride }
            val staleEffort = current.effortOverride.isNotEmpty() &&
                caps.effortLevels.none { it == current.effortOverride }
            val stalePermission = current.permissionOverride.isNotEmpty() &&
                caps.permissionModes.none { it.id == current.permissionOverride }
            if (staleAccount || staleModel || staleEffort || stalePermission) {
                settings.updateEnvironment(ctx.environmentId) {
                    it.copy(
                        account = if (staleAccount) "" else it.account,
                        model = if (staleModel) "" else it.model,
                        effort = if (staleEffort) "" else it.effort,
                        permissionMode = if (stalePermission) "" else it.permissionMode,
                    )
                }
                EnvOverrides.bump()
            }
            _state.update {
                it.copy(
                    capabilities = caps,
                    account = caps.defaults.account,
                    accountOverride = if (staleAccount) "" else it.accountOverride,
                    modelOverride = if (staleModel) "" else it.modelOverride,
                    effortOverride = if (staleEffort) "" else it.effortOverride,
                    permissionOverride = if (stalePermission) "" else it.permissionOverride,
                )
            }
            evaluateCompat(caps.serverVersion, caps.supportedApp, caps.cliVersion, caps.supportedCli)
        } else {
            CapabilitiesApi.versionInfo()?.let {
                evaluateCompat(it.serverVersion, it.supportedApp, it.cliVersion, it.supportedCli)
            }
        }
    }

    fun refreshVersionInfo() {
        viewModelScope.launch { refreshCompat() }
    }

    private suspend fun refreshServerInfo() {
        refreshCompat()
        SettingsApi.get()?.let { s ->
            _state.update {
                it.copy(
                    visibility = localVisibility(),
                    model = s.model,
                    effort = s.effort,
                    permissionMode = s.permissionMode,
                    streamTokens = s.streaming,
                    showWorking = s.showWorking,
                    serverVisibility = VisibilityPrefs(
                        simple = if (s.simpleMode) "on" else "off",
                        thinking = s.showThinking,
                        toolUse = s.showToolUse,
                        fileChange = s.showFileChange,
                        compact = s.showCompact,
                        working = s.showWorking,
                    ),
                )
            }
        }
    }

    fun dismissNotice(notice: CompatStatus) {
        dismissedNotices.add(notice)
        _state.update { it.copy(versionNotices = it.versionNotices - notice) }
    }

    private fun startSession(resume: String?) {
        freezeView()
        if (_state.value.frozen == null && resume != null) _state.update { it.copy(transcriptLoading = true) }
        val s = _state.value
        client.sendStart(
            ctx.cwd,
            s.permissionOverride.ifEmpty { s.permissionMode },
            resume,
            s.modelOverride.ifEmpty { s.model },
            s.effortOverride.ifEmpty { s.effort },
            s.streamingOverride ?: s.streamTokens,
            s.accountOverride,
            localVisibility(),
        )
    }

    private fun effectiveWorking(): String {
        val s = _state.value
        return s.visibility.working ?: s.serverVisibility.working ?: s.showWorking
    }

    private fun localVisibility() = VisibilityPrefs(
        simple = settings.visibilitySimple.takeIf { it.isNotEmpty() },
        thinking = settings.visibilityThinking.takeIf { it.isNotEmpty() },
        toolUse = settings.visibilityToolUse.takeIf { it.isNotEmpty() },
        fileChange = settings.visibilityFileChange.takeIf { it.isNotEmpty() },
        compact = settings.visibilityCompact.takeIf { it.isNotEmpty() },
        working = settings.visibilityWorking.takeIf { it.isNotEmpty() },
    )

    fun applyVisibility(prefs: VisibilityPrefs) {
        settings.visibilitySimple = prefs.simple.orEmpty()
        settings.visibilityThinking = prefs.thinking.orEmpty()
        settings.visibilityToolUse = prefs.toolUse.orEmpty()
        settings.visibilityFileChange = prefs.fileChange.orEmpty()
        settings.visibilityCompact = prefs.compact.orEmpty()
        settings.visibilityWorking = prefs.working.orEmpty()
        _state.update { it.copy(visibility = prefs) }
        client.sendVisibility(prefs)
        val running = _state.value.streaming
        reloadOnDone = running
        viewModelScope.launch { reloadConversation(keepLive = running) }
    }

    private var reloadOnDone = false

    fun sendPrompt(text: String) {
        val trimmed = text.trim()
        val current = _state.value
        if (current.attachments.isEmpty()) {
            enqueueOutgoing(trimmed, emptyList())
            return
        }
        if (current.uploadingAttachments) return
        uploadJob = viewModelScope.launch {
            _state.update { it.copy(uploadingAttachments = true) }
            try {
                val saved = mutableListOf<String>()
                for (attachment in _state.value.attachments) {
                    val rel = uploadAttachment(
                        file = attachment.file,
                        path = "uploads/${attachment.name}",
                    ) { p ->
                        _state.update { st ->
                            st.copy(attachments = st.attachments.map { a -> if (a.id == attachment.id) a.copy(progress = p) else a })
                        }
                    }
                    if (rel == null) {
                        _state.update {
                            it.copy(
                                uploadingAttachments = false,
                                attachments = it.attachments.map { a -> a.copy(progress = 0f) },
                                error = getString(Res.string.connection_error),
                                pendingInput = trimmed.ifEmpty { null },
                            )
                        }
                        return@launch
                    }
                    saved += rel
                }
                _state.update { it.copy(attachments = emptyList(), uploadingAttachments = false) }
                enqueueOutgoing(trimmed, saved)
            } catch (e: CancellationException) {
                _state.update {
                    it.copy(
                        uploadingAttachments = false,
                        attachments = it.attachments.map { a -> a.copy(progress = 0f) },
                        pendingInput = trimmed.ifEmpty { null },
                    )
                }
                throw e
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        uploadingAttachments = false,
                        attachments = it.attachments.map { a -> a.copy(progress = 0f) },
                        error = getString(Res.string.connection_error),
                        pendingInput = trimmed.ifEmpty { null },
                    )
                }
            } finally {
                uploadJob = null
            }
        }
    }

    private var outgoingSeq = 0L
    private val outgoingTag = nowMillis().toString(36)
    private fun nextOutgoingId() = "q$outgoingTag-${outgoingSeq++}"
    private val sentIds = mutableSetOf<String>()

    private fun enqueueOutgoing(text: String, attachments: List<String>) {
        if (text.isEmpty() && attachments.isEmpty()) return
        if (!_state.value.streaming) {
            sentIds.clear()
            optimisticChipId = null
            optimisticMsgId = null
            if (_state.value.queue.any { !it.uploading }) {
                _state.update { it.copy(queue = it.queue.filter { q -> q.uploading }) }
            }
        }
        val silent = !_state.value.streaming && _state.value.queue.isEmpty() && sentIds.isEmpty()
        val id = nextOutgoingId()
        _state.update { it.copy(queue = it.queue + QueuedMessage(id, text, attachments = attachments, silent = silent)) }
        if (silent && (text.isNotEmpty() || attachments.isNotEmpty())) {
            val compacting = text == "/compact" || text.startsWith("/compact ")
            currentAssistantId = null
            currentThinkingId = null
            _state.update { st -> resetToInitialWindow(st).copy(streaming = true, compacting = compacting, streamStatus = null, error = null) }
            val isCommand = attachments.isEmpty() && _state.value.capabilities.commands.any { text == "/${it.name}" || text.startsWith("/${it.name} ") }
            if (isCommand) {
                if (!compacting) addMessage(Role.USER, text, ephemeral = true)
            } else {
                addMessage(Role.USER, text, attachments = attachments.map { it.removePrefix("uploads/") }.ifEmpty { null })
                optimisticChipId = id
                optimisticMsgId = _state.value.messages.lastOrNull()?.id
            }
        }
        pumpQueue()
    }

    private fun pumpQueue() {
        if (_state.value.connection != ConnectionState.Connected) return
        for (q in _state.value.queue) {
            if (q.uploading || q.id in sentIds) continue
            sentIds.add(q.id)
            client.sendPrompt(q.text, q.attachments, q.id)
        }
    }

    private fun drainQueue() {
        pumpQueue()
    }

    fun removeQueued(id: String) {
        if (id in sentIds) client.sendUnqueue(id)
        _state.update { it.copy(queue = it.queue.filterNot { q -> q.id == id }) }
        sentIds.remove(id)
    }

    private var uploadJob: Job? = null
    private var attachmentId = 0L

    fun addAttachments(files: List<AttachmentFile>) {
        if (files.isEmpty() || _state.value.uploadingAttachments) return
        val items = files.map { file ->
            Attachment(id = attachmentId++, file = file, name = file.name, size = file.size)
        }
        _state.update { it.copy(attachments = it.attachments + items) }
    }

    fun removeAttachment(id: Long) {
        if (_state.value.uploadingAttachments) return
        _state.update { it.copy(attachments = it.attachments.filterNot { a -> a.id == id }) }
    }

    fun stop() {
        if (_state.value.uploadingAttachments) {
            uploadJob?.cancel()
            return
        }
        if (_state.value.streaming) {
            interrupting = true
            _state.update { it.copy(streamStatus = it.streamStatus?.takeIf { s -> s == "failed" }) }
            client.sendInterrupt()
        }
    }

    fun stopSide() {
        if (_state.value.sideChat?.streaming == true) client.sendInterrupt("side")
    }

    fun submit(text: String) {
        val cmd = _state.value.capabilities.commands.firstOrNull { "/${it.name}" == text.trim() }
        if (cmd != null) runCommand(cmd) else sendPrompt(text)
    }

    fun runCommand(cmd: CommandOption) {
        when {
            cmd.kind == "usage" -> {
                addMessage(Role.USER, "/${cmd.name}")
                client.sendUsage()
            }
            cmd.kind == "client" && cmd.name == "clear" -> clearConversation()
            else -> sendPrompt("/${cmd.name}")
        }
    }

    private fun ChatUiState.boundSide(): SideChatState? = sideChat?.takeIf { it.boundSessionId == sessionId }

    private fun SideChatState?.promote(sid: String?): SideChatState? =
        if (this != null && boundSessionId == null && sid != null) copy(boundSessionId = sid) else this

    fun openSideChat() {
        _state.update { it.copy(sideChat = it.boundSide() ?: SideChatState(boundSessionId = it.sessionId), sideChatOpen = true) }
    }

    fun closeSideChat() {
        _state.update { it.copy(sideChatOpen = false, sideFullscreen = false) }
    }

    fun setSideFullscreen(value: Boolean) {
        if (_state.value.sideFullscreen == value) return
        _state.update { it.copy(sideFullscreen = value) }
    }

    fun clearSideChat() {
        currentSideAssistantId = null
        _state.update { it.copy(sideChat = SideChatState(boundSessionId = it.sessionId), sideChatOpen = true) }
    }

    fun sendSideQuestion(text: String) {
        val trimmed = text.trim()
        val sc = _state.value.sideChat ?: return
        if (trimmed.isEmpty() || sc.streaming) return
        currentSideAssistantId = null
        _state.update {
            val cur = it.sideChat ?: SideChatState(boundSessionId = it.sessionId)
            it.copy(sideChat = cur.copy(messages = cur.messages + ChatMessage(nextId++, Role.USER, trimmed), streaming = true))
        }
        client.sendAsk(trimmed, sc.sideSessionId)
    }

    fun clearConversation() {
        if (_state.value.streaming) return
        deleteActiveSession()
        newSession()
    }

    private fun deleteActiveSession() {
        val sid = _state.value.sessionId ?: return
        val proj = _state.value.activeProjectKey ?: return
        viewModelScope.launch { SessionsApi.deleteSession(sid, proj) }
        ChatListStore.forConfig(listConfig())?.removeSession(sid)
    }

    fun setPermissionMode(mode: String) {
        settings.updateEnvironment(ctx.environmentId) { it.copy(permissionMode = mode) }
        EnvOverrides.bump()
        _state.update { it.copy(permissionOverride = mode) }
        val effective = mode.ifEmpty { _state.value.permissionMode }
        if (_state.value.connection == ConnectionState.Connected) client.sendSetPermissionMode(effective)
    }

    private fun pushGeneration(
        model: String? = null,
        effort: String? = null,
        partial: Boolean? = null,
        account: String? = null,
        cwd: String? = null,
    ) {
        if (_state.value.connection == ConnectionState.Connected) {
            client.sendSetGeneration(model, effort, partial, account, cwd)
        }
    }

    fun setAccount(account: String) {
        settings.updateEnvironment(ctx.environmentId) { it.copy(account = account) }
        EnvOverrides.bump()
        _state.update { it.copy(accountOverride = account) }
        pushGeneration(account = account)
    }

    fun setModel(model: String) {
        settings.updateEnvironment(ctx.environmentId) { it.copy(model = model) }
        EnvOverrides.bump()
        _state.update { it.copy(modelOverride = model) }
        pushGeneration(model = model.ifEmpty { _state.value.model })
    }

    fun setEffort(effort: String) {
        settings.updateEnvironment(ctx.environmentId) { it.copy(effort = effort) }
        EnvOverrides.bump()
        _state.update { it.copy(effortOverride = effort) }
        pushGeneration(effort = effort.ifEmpty { _state.value.effort })
    }

    fun setStreaming(value: String) {
        val next = if (value.isEmpty()) null else value == "on"
        settings.updateEnvironment(ctx.environmentId) { it.copy(streaming = next) }
        EnvOverrides.bump()
        _state.update { it.copy(streamingOverride = next) }
        pushGeneration(partial = next ?: _state.value.streamTokens)
    }

    fun newSession() {
        currentAssistantId = null
        currentThinkingId = null
        optimisticChipId = null
        optimisticMsgId = null
        sentIds.clear()
        interrupting = false
        pendingTrim = null
        _state.update {
            it.copy(
                messages = emptyList(),
                frozen = null,
                sessionId = null,
                sessionColor = null,
                todos = emptyList(),
                streaming = false,
                streamStatus = null,
                queue = emptyList(),
                oldestLoadedIndex = null,
                transcriptLoading = false,
                transcriptPaging = false,
                transcriptExhausted = false,
                pendingToolIds = emptySet(),
            )
        }
        client.resetResume()
        startSession(resume = null)
    }

    fun refreshEnvironments() {
        ctx.environmentId = settings.activeEnvironment?.id
        _state.update { it.copy(environments = settings.environments, activeEnvironmentId = ctx.environmentId) }
    }

    fun selectEnvironment(id: String) {
        if (id == ctx.environmentId) return
        ctx.environmentId = id
        settings.activeEnvironmentId = id
        applyDefaultDirectory()
        currentAssistantId = null
        currentThinkingId = null
        client.close()
        _state.update {
            it.copy(
                activeEnvironmentId = id,
                connection = ConnectionState.Disconnected,
                capabilitiesReady = false,
                messages = emptyList(),
                frozen = null,
                sessionId = null,
                activeProjectKey = null,
                sessionColor = null,
                todos = emptyList(),
                streaming = false,
                streamStatus = null,
                historyProjects = emptyList(),
                historySessions = emptyList(),
                historyProjectKey = null,
                historyLoading = true,
                oldestLoadedIndex = null,
                transcriptLoading = false,
                transcriptPaging = false,
                transcriptExhausted = false,
            )
        }
        loadEnvOverrides()
        connect()
        loadHistory()
    }

    fun ensureHistoryLoaded() {
        if (!historyLoaded) loadHistory()
    }

    private fun observeHistory() {
        historyJobs.forEach { it.cancel() }
        val backend = ChatListStore.forConfig(listConfig()) ?: run { historyJobs = emptyList(); return }
        historyJobs = listOf(
            viewModelScope.launch {
                combine(backend.projects, backend.sessions, backend.loading) { p, s, l -> Triple(p, s, l) }.collect { (p, s, l) ->
                    val key = _state.value.historyProjectKey
                    _state.update {
                        it.copy(
                            historyProjects = withDefaultProject(p),
                            historySessions = if (key == null) s else s.filter { x -> x.projectKey == key },
                            allSessions = s,
                            historyLoading = l,
                        )
                    }
                }
            },
        )
    }

    fun withDefaultProject(projects: List<ProjectInfo>): List<ProjectInfo> {
        val dir = activeEnv()?.directory.orEmpty()
        if (dir.isBlank()) return projects
        val targetKey = projectKeyOf(dir)
        return if (projects.any { it.projectKey == targetKey || it.path == dir }) projects
        else listOf(ProjectInfo(targetKey, dir, null, 0, null)) + projects
    }

    fun defaultProjectKey(projects: List<ProjectInfo>): String? {
        val dir = activeEnv()?.directory.orEmpty()
        if (dir.isBlank()) return null
        val targetKey = projectKeyOf(dir)
        return projects.firstOrNull { it.projectKey == targetKey || it.path == dir }?.projectKey ?: targetKey
    }

    private fun projectKeyOf(path: String): String = path.replace(Regex("[^A-Za-z0-9]"), "-")

    private fun applyStoreSessions(all: List<SessionInfo>) {
        val key = _state.value.historyProjectKey
        _state.update { it.copy(historySessions = if (key == null) all else all.filter { s -> s.projectKey == key }) }
    }

    fun loadHistory() {
        historyLoaded = true
        if (!defaultProjectApplied) {
            defaultProjectApplied = true
            val known = ChatListStore.forConfig(listConfig())?.projects?.value.orEmpty()
            _state.update { it.copy(historyProjectKey = defaultProjectKey(known)) }
        }
        observeHistory()
    }

    fun selectHistoryProject(projectKey: String?) {
        _state.update { it.copy(historyProjectKey = projectKey) }
        if (projectKey != null) {
            _state.value.historyProjects.firstOrNull { it.projectKey == projectKey }?.path?.let {
                ctx.cwd = it
                if (_state.value.sessionId == null) pushGeneration(cwd = it)
            }
        }
        ChatListStore.forConfig(listConfig())?.let { applyStoreSessions(it.sessions.value) }
    }

    fun restoreSession(sessionId: String, projectKey: String) {
        if (_state.value.sessionId == sessionId) return
        openSession(sessionInfoFor(sessionId, projectKey))
    }

    private fun freezeView() {
        _state.update { if (it.frozen == null && it.messages.isNotEmpty()) it.copy(frozen = it.messages) else it }
    }

    fun openSession(session: SessionInfo) {
        viewModelScope.launch {
            freezeView()
            if (session.sessionId != _state.value.sessionId) {
                _state.update {
                    it.copy(
                        sessionId = session.sessionId,
                        activeProjectKey = session.projectKey ?: it.activeProjectKey,
                        sessionColor = session.color,
                        todos = emptyList(),
                        queue = emptyList(),
                        transcriptLoading = it.messages.isEmpty(),
                        transcriptPaging = false,
                    )
                }
            }
            if (!loadSessionInto(session)) {
                _state.update { it.copy(frozen = null, transcriptLoading = false) }
                return@launch
            }
            client.resetResume()
            startSession(resume = session.sessionId)
        }
    }

    private fun sessionInfoFor(sessionId: String, projectKey: String?): SessionInfo =
        ChatListStore.forConfig(listConfig())?.sessions?.value?.firstOrNull { it.sessionId == sessionId }
            ?: SessionInfo(sessionId, projectKey, null, null, 0L, null, null, null)

    private fun nestAgents(flat: List<Pair<ChatMessage, String?>>): List<ChatMessage> {
        val result = mutableListOf<ChatMessage>()
        val agentAt = mutableMapOf<String, Int>()
        for ((msg, parent) in flat) {
            if (parent != null) {
                val idx = agentAt[parent]
                if (idx != null && (msg.role == Role.TOOL || msg.role == Role.FILE_CHANGE)) {
                    result[idx] = result[idx].copy(children = result[idx].children + msg)
                }
                continue
            }
            if (msg.role == Role.AGENT && msg.toolUseId != null) agentAt[msg.toolUseId] = result.size
            result.add(msg)
        }
        return result
    }

    private suspend fun loadSessionInto(session: SessionInfo): Boolean {
        val projectKey = session.projectKey ?: return false
        val page = SessionsApi.sessionMessages(session.sessionId, projectKey, limit = 100, visibility = localVisibility()) ?: return false
        val visible = page.items.filter { it.visible() }
        val loaded = nestAgents(visible.mapIndexed { i, m ->
            ChatMessage(i.toLong(), m.toRole(), m.text, toolName = m.name, toolUseId = m.toolUseId, path = m.path, interaction = m.interaction, diffLines = m.diffLines, compact = m.compact, sourceIndex = m.index, labelOnly = m.labelOnly, result = m.result, images = imageUrls(m, session.sessionId, projectKey), timestamp = m.timestamp) to m.parent
        })
        nextId = visible.size.toLong()
        currentAssistantId = null
        currentThinkingId = null
        optimisticChipId = null
        optimisticMsgId = null
        sentIds.clear()
        interrupting = false
        pendingTrim = null
        session.path?.let { ctx.cwd = it }
        _state.update {
            it.copy(
                messages = loaded,
                sessionId = session.sessionId,
                activeProjectKey = projectKey,
                sessionColor = session.color,
                todos = emptyList(),
                queue = emptyList(),
                oldestLoadedIndex = page.startIndex.takeIf { page.items.isNotEmpty() },
                transcriptPaging = false,
                transcriptExhausted = !page.hasMore,
                sideChat = it.sideChat.promote(session.sessionId),
                pendingToolIds = emptySet(),
                contextTokens = page.contextTokens,
            )
        }
        return true
    }

    fun loadMoreHistory() {
        val s = _state.value
        val sid = s.sessionId ?: return
        val before = s.oldestLoadedIndex ?: return
        if (s.transcriptLoading || s.transcriptPaging || s.transcriptExhausted) return
        val proj = s.activeProjectKey ?: return
        _state.update { it.copy(transcriptPaging = true) }
        client.sendLoadHistory(sid, proj, beforeIndex = before)
    }

    private fun currentProjectKey(): String? =
        _state.value.activeProjectKey ?: ctx.cwd.takeIf { it.isNotBlank() }?.let(::projectKeyOf)

    fun loadRewindPoints() {
        val sid = _state.value.sessionId ?: return
        val proj = currentProjectKey() ?: return
        viewModelScope.launch {
            _state.update { it.copy(rewindLoading = true) }
            val points = SessionsApi.checkpoints(sid, proj)
            _state.update { it.copy(rewindPoints = points, rewindLoading = false) }
        }
    }

    fun selectRewindPoint(point: SessionsApi.RewindPoint) {
        val sid = _state.value.sessionId ?: return
        val proj = currentProjectKey() ?: return
        _state.update { it.copy(rewindTarget = point, rewindPreview = null) }
        viewModelScope.launch {
            val preview = SessionsApi.rewindPreview(sid, proj, point.id)
            _state.update { if (it.rewindTarget?.id == point.id) it.copy(rewindPreview = preview) else it }
        }
    }

    fun dismissRewind() {
        _state.update { it.copy(rewindTarget = null, rewindPreview = null, rewindBusy = false) }
    }

    fun confirmRewind(both: Boolean) {
        val s = _state.value
        val sid = s.sessionId ?: return
        val proj = currentProjectKey() ?: return
        val point = s.rewindTarget ?: return
        if (s.rewindBusy) return
        _state.update { it.copy(rewindBusy = true) }
        viewModelScope.launch {
            val result = SessionsApi.rewind(sid, proj, point, if (both) "both" else "conversation")
            if (result == null) {
                _state.update { it.copy(rewindBusy = false) }
                return@launch
            }
            reloadConversation()
            _state.update { it.copy(rewindTarget = null, rewindPreview = null, rewindBusy = false, pendingInput = point.text) }
        }
    }

    fun consumePendingInput() {
        _state.update { it.copy(pendingInput = null) }
    }

    private suspend fun reloadConversation(keepLive: Boolean = false) {
        val s = _state.value
        val sid = s.sessionId ?: return
        val proj = currentProjectKey() ?: return
        val page = SessionsApi.sessionMessages(sid, proj, limit = 100, visibility = localVisibility()) ?: return
        val visible = page.items.filter { it.visible() }
        val loaded = nestAgents(visible.mapIndexed { i, m ->
            ChatMessage(i.toLong(), m.toRole(), m.text, toolName = m.name, toolUseId = m.toolUseId, path = m.path, interaction = m.interaction, diffLines = m.diffLines, compact = m.compact, sourceIndex = m.index, labelOnly = m.labelOnly, result = m.result, images = imageUrls(m, sid, proj), timestamp = m.timestamp) to m.parent
        })
        val live = if (keepLive) s.messages.filter { it.sourceIndex < 0 } else emptyList()
        nextId = maxOf(visible.size.toLong(), live.maxOfOrNull { it.id + 1 } ?: 0L)
        if (!keepLive) {
            currentAssistantId = null
            currentThinkingId = null
        }
        optimisticChipId = null
        optimisticMsgId = null
        sentIds.retainAll(_state.value.queue.mapTo(mutableSetOf()) { it.id })
        interrupting = false
        pendingTrim = null
        _state.update {
            it.copy(
                messages = if (live.isEmpty()) loaded else loaded + live,
                todos = emptyList(),
                oldestLoadedIndex = page.startIndex.takeIf { page.items.isNotEmpty() },
                transcriptLoading = false,
                transcriptPaging = false,
                transcriptExhausted = !page.hasMore,
                pendingToolIds = emptySet(),
            )
        }
    }

    fun deleteSession(session: SessionInfo) {
        val projectKey = session.projectKey ?: return
        viewModelScope.launch {
            if (SessionsApi.deleteSession(session.sessionId, projectKey)) {
                ChatListStore.forConfig(listConfig())?.removeSession(session.sessionId)
                if (session.sessionId == _state.value.sessionId) newSession()
            }
        }
    }

    fun renameSession(session: SessionInfo, title: String) {
        val projectKey = session.projectKey ?: return
        val clean = title.trim()
        if (clean.isEmpty()) return
        viewModelScope.launch {
            if (SessionsApi.renameSession(session.sessionId, projectKey, clean)) {
                updateHistoryTitle(session.sessionId, clean)
            }
        }
    }

    fun autoRenameSession(session: SessionInfo) {
        val projectKey = session.projectKey ?: return
        viewModelScope.launch {
            SessionsApi.autoRenameSession(session.sessionId, projectKey)?.let { title ->
                updateHistoryTitle(session.sessionId, title)
            }
        }
    }

    fun setSessionColor(session: SessionInfo, color: String?) {
        val projectKey = session.projectKey ?: return
        viewModelScope.launch {
            if (SessionsApi.setSessionColor(session.sessionId, projectKey, color.orEmpty())) {
                ChatListStore.forConfig(listConfig())?.let { b ->
                    b.sessions.value.firstOrNull { it.sessionId == session.sessionId }?.let { b.upsertSession(it.copy(color = color)) }
                }
                _state.update { s -> s.copy(sessionColor = if (s.sessionId == session.sessionId) color else s.sessionColor) }
            }
        }
    }

    private fun updateHistoryTitle(sessionId: String, title: String) {
        ChatListStore.forConfig(listConfig())?.let { b ->
            b.sessions.value.firstOrNull { it.sessionId == sessionId }?.let { b.upsertSession(it.copy(title = title)) }
        }
    }

    private fun currentTabId(): String? = TabsController.tabs.firstOrNull { it.ctx === ctx }?.id

    private fun imageUrls(m: SessionMessage, sessionId: String, projectKey: String?): List<String>? =
        m.images?.map { ref ->
            "${baseUrl()}/sessions/$sessionId/images/$ref?project=${UrlCodec.encode(projectKey.orEmpty())}"
        }

    private fun onAgentChild(parent: String, event: ServerEvent) {
        val child: ChatMessage? = when (event) {
            is ServerEvent.ToolUse -> ChatMessage(nextId++, Role.TOOL, event.input.orEmpty(), toolName = event.name, toolUseId = event.id, result = event.result, timestamp = nowMillis())
            is ServerEvent.FileChange -> ChatMessage(nextId++, Role.FILE_CHANGE, "", toolUseId = event.id, path = event.path, diffLines = event.diffLines, labelOnly = event.labelOnly, timestamp = nowMillis())
            else -> null
        }
        _state.update { st ->
            st.copy(messages = st.messages.map { m ->
                if (m.role == Role.AGENT && m.toolUseId == parent) {
                    val kids = when {
                        event is ServerEvent.ToolResult && event.toolUseId != null && event.content != null ->
                            m.children.map { if (it.toolUseId == event.toolUseId) it.copy(result = event.content) else it }
                        child != null -> m.children + child
                        else -> m.children
                    }
                    m.copy(children = kids)
                } else m
            })
        }
    }

    private suspend fun onEvent(event: ServerEvent, parent: String? = null) {
        if (parent != null) {
            onAgentChild(parent, event)
            return
        }
        val trim = pendingTrim
        if (trim != null && event !is ServerEvent.Ready) {
            pendingTrim = null
            _state.update { it.copy(messages = trim(it.messages)) }
        }
        when (event) {
            is ServerEvent.Connecting -> _state.update {
                if (it.connection == ConnectionState.Connected) it
                else it.copy(connection = ConnectionState.Connecting)
            }
            is ServerEvent.Open -> startSession(_state.value.sessionId)
            is ServerEvent.Ready -> {
                if (!initialConsumed) consumeInitialSession(event.project)
                historyLoaded = false
                val n = event.committedCount
                pendingTrim = if (event.resumed && event.running) {
                    { list ->
                        val kept = list.filterNot { m -> m.ephemeral }
                        val awaiting = { m: ChatMessage -> m.interaction?.pending == true }
                        if (n != null) kept.filter { m -> awaiting(m) || m.sourceIndex in 0 until n }
                        else {
                            val lastUser = kept.indexOfLast { m -> m.role == Role.USER }
                            if (lastUser >= 0) kept.subList(0, lastUser + 1) + kept.drop(lastUser + 1).filter(awaiting)
                            else kept
                        }
                    }
                } else null
                _state.update {
                    val sid = event.sessionId ?: it.sessionId
                    it.copy(
                        connection = ConnectionState.Connected,
                        sessionId = sid,
                        activeProjectKey = event.project ?: it.activeProjectKey,
                        streaming = event.running,
                        sideChat = it.sideChat.promote(sid),
                        messages = if (pendingTrim == null) it.messages.filterNot { m -> m.ephemeral } else it.messages,
                        queue = event.queued + it.queue.filter { q -> q.uploading },
                    )
                }
                sentIds.addAll(event.queued.map { q -> q.id })
                viewModelScope.launch { refreshServerInfo() }
                drainQueue()
            }
            is ServerEvent.AssistantText -> {
                currentThinkingId = null
                currentAssistantId = append(currentAssistantId, Role.ASSISTANT, event.text)
            }
            is ServerEvent.Thinking -> {
                if (event.labelOnly) {
                    currentAssistantId = null
                    currentThinkingId = null
                    addMessage(Role.THINKING, "", labelOnly = true)
                } else if (event.text.isNotEmpty()) {
                    currentAssistantId = null
                    currentThinkingId = append(currentThinkingId, Role.THINKING, event.text)
                }
            }
            is ServerEvent.Working -> {
                currentAssistantId = null
                currentThinkingId = null
                if (_state.value.messages.lastOrNull()?.role != Role.WORKING) addMessage(Role.WORKING, "")
            }
            is ServerEvent.Plan -> {
                currentAssistantId = null
                currentThinkingId = null
                addMessage(Role.PLAN, event.markdown)
            }
            is ServerEvent.Notification -> {
                currentAssistantId = null
                currentThinkingId = null
                addMessage(Role.NOTIFICATION, event.summary, result = event.status)
            }
            is ServerEvent.Agent -> {
                currentAssistantId = null
                currentThinkingId = null
                addMessage(Role.AGENT, event.description.orEmpty(), toolName = event.subagentType, toolUseId = event.id, labelOnly = event.labelOnly)
                event.id?.let { id -> _state.update { it.copy(pendingToolIds = it.pendingToolIds + id) } }
            }
            is ServerEvent.ToolUse -> {
                currentAssistantId = null
                currentThinkingId = null
                addMessage(Role.TOOL, event.input.orEmpty(), toolName = event.name, toolUseId = event.id, result = event.result)
                event.id?.let { id -> _state.update { it.copy(pendingToolIds = it.pendingToolIds + id) } }
            }
            is ServerEvent.ToolResult -> {
                val tid = event.toolUseId
                _state.update { st ->
                    val pending = if (tid != null) st.pendingToolIds - tid else st.pendingToolIds
                    val msgs = if (tid != null && event.content != null)
                        st.messages.map { if (it.toolUseId == tid) it.copy(result = event.content) else it }
                    else st.messages
                    st.copy(pendingToolIds = pending, messages = msgs)
                }
            }
            is ServerEvent.FileChange -> {
                currentAssistantId = null
                currentThinkingId = null
                addMessage(Role.FILE_CHANGE, text = "", toolUseId = event.id, path = event.path, diffLines = event.diffLines, labelOnly = event.labelOnly)
            }
            is ServerEvent.Compacting -> _state.update { it.copy(compacting = true) }
            is ServerEvent.Status -> {
                if (!(interrupting && event.kind == "slow")) {
                    _state.update { it.copy(streamStatus = if (event.kind == "ok") null else event.kind) }
                }
            }
            is ServerEvent.Compact -> {
                currentAssistantId = null
                currentThinkingId = null
                turnFirstResponseId = null
                _state.update {
                    it.copy(
                        messages = listOf(ChatMessage(nextId++, Role.COMPACT, compact = CompactData(event.trigger, event.preTokens, event.postTokens, event.summary), timestamp = nowMillis())),
                        oldestLoadedIndex = null,
                        transcriptExhausted = true,
                        compacting = false,
                    )
                }
            }
            is ServerEvent.CompactSummary -> _state.update { st ->
                st.copy(messages = st.messages.map { m ->
                    if (m.role == Role.COMPACT && m.compact != null) {
                        m.copy(compact = CompactData(event.trigger, event.preTokens, event.postTokens, event.summary))
                    } else m
                })
            }
            is ServerEvent.Command -> {
                currentAssistantId = null
                currentThinkingId = null
                addMessage(Role.ASSISTANT, event.markdown, ephemeral = true)
            }
            is ServerEvent.Component -> {
                currentAssistantId = null
                currentThinkingId = null
                val data = InteractionData(
                    requestId = "shown",
                    kind = "component",
                    title = event.title,
                    titleKey = event.titleKey,
                    icon = event.icon,
                    blocks = event.blocks,
                )
                _state.update { st ->
                    st.copy(messages = st.messages + ChatMessage(nextId++, Role.INTERACTION, "", interaction = data, ephemeral = true))
                }
            }
            is ServerEvent.Todos -> _state.update { it.copy(todos = event.items) }
            is ServerEvent.Context -> _state.update { it.copy(contextTokens = event.contextTokens ?: it.contextTokens) }
            is ServerEvent.Task -> upsertTask(event)
            is ServerEvent.Result -> {
                currentAssistantId = null
                currentThinkingId = null
                turnFirstResponseId = null
                val st0 = _state.value
                val sid = event.sessionId ?: st0.sessionId
                val ctxTokens = event.contextTokens ?: st0.contextTokens
                val backend = ChatListStore.forConfig(listConfig())
                if (sid != null && backend != null && backend.sessions.value.none { it.sessionId == sid }) {
                    backend.upsertSession(
                        SessionInfo(
                            sessionId = sid,
                            projectKey = st0.activeProjectKey,
                            path = ctx.cwd,
                            lastActive = nowMillis() / 1000.0,
                            size = 0L,
                            preview = st0.messages.firstOrNull { it.role == Role.USER }?.text?.take(120),
                            title = null,
                            color = st0.sessionColor,
                        )
                    )
                }
                _state.update { it.copy(sessionId = sid, sideChat = it.sideChat.promote(sid), contextTokens = ctxTokens) }
            }
            is ServerEvent.Done -> {
                if (_state.value.streaming && settings.notifyTaskDone) {
                    Notifier.notify(
                        Notifier.Kind.TaskDone,
                        getString(Res.string.notif_task_done),
                        _state.value.messages.lastOrNull { it.role == Role.ASSISTANT }?.text
                            ?.lineSequence()?.firstOrNull { it.isNotBlank() }?.take(120),
                        targetTab = currentTabId(),
                    )
                }
                resetStreaming()
                interrupting = false
                turnFirstResponseId = null
                pumpQueue()
                if (reloadOnDone && !_state.value.streaming) {
                    reloadOnDone = false
                    viewModelScope.launch { reloadConversation() }
                }
            }
            is ServerEvent.Attached -> _state.update { it.copy(frozen = null, transcriptLoading = false) }
            is ServerEvent.Interrupted -> {
                interrupting = false
                currentAssistantId = null
                currentThinkingId = null
                turnFirstResponseId = null
                dismissPendingInteractions()
                addMessage(Role.INTERRUPTED, "")
                val keepWorking = _state.value.queue.isNotEmpty()
                _state.update {
                    it.copy(
                        streaming = keepWorking,
                        compacting = false,
                        pendingToolIds = emptySet(),
                        streamStatus = it.streamStatus?.takeIf { s -> s == "failed" },
                    )
                }
            }
            is ServerEvent.Err -> {
                resetStreaming()
                _state.update { st ->
                    val idx = st.messages.indexOfLast { it.role == Role.USER }
                    if (idx >= 0) st.copy(messages = st.messages.mapIndexed { i, m -> if (i == idx) m.copy(sendStatus = SendStatus.ERROR) else m }) else st
                }
            }
            is ServerEvent.ApiError -> {
                currentAssistantId = null
                currentThinkingId = null
                _state.update { it.copy(streamStatus = null) }
                addMessage(Role.API_ERROR, event.message)
            }
            is ServerEvent.InteractionRequest -> {
                if (_state.value.messages.none { it.interaction?.requestId == event.requestId }) {
                    currentAssistantId = null
                    currentThinkingId = null
                    val data = interactionDataOf(event)
                    val tuid = event.toolUseId
                    _state.update { st ->
                        val cleaned = if (tuid != null) st.messages.filterNot { it.role == Role.TOOL && it.toolUseId == tuid } else st.messages
                        st.copy(messages = cleaned + ChatMessage(nextId++, Role.INTERACTION, event.input.orEmpty(), event.toolName, tuid, data, timestamp = nowMillis()))
                    }
                    if (settings.notifyInteraction && !event.replay) {
                        val component = event.kind == "component"
                        val question = component && event.titleKey == "questions"
                        val isPlan = event.toolName == "ExitPlanMode"
                        val actions = if (component) emptyList() else event.options
                            .filter { it.id != "different" }
                            .mapNotNull { opt -> notificationOptionLabel(opt)?.let { Notifier.Action(it, event.requestId, opt.id) } }
                        val body = when {
                            component -> (data.title ?: componentHeadline(event.blocks))?.take(120)
                            isPlan -> event.input.orEmpty().lineSequence().firstOrNull { it.isNotBlank() }?.trimStart('#', ' ')?.trim()?.take(120)?.ifBlank { null } ?: getString(Res.string.plan)
                            else -> event.toolName
                        }
                        val title = when {
                            question -> Res.string.notif_question
                            component -> Res.string.notif_component
                            else -> Res.string.notif_permission
                        }
                        Notifier.notify(
                            Notifier.Kind.Interaction,
                            getString(title),
                            body,
                            actions,
                            targetTab = currentTabId(),
                        )
                    }
                }
            }
            is ServerEvent.InteractionResolved -> updateInteraction(event.requestId) {
                when {
                    it.kind == "questions" -> if (it.submitted || it.declined) it else it.copy(submitted = true)
                    it.kind == "component" -> if (it.submitted || it.declined) it else it.copy(
                        submitted = true,
                        declined = event.dismissed,
                        values = event.values ?: it.values,
                    )
                    it.resolved == null -> it.copy(resolved = event.optionId ?: "")
                    else -> it
                }
            }
            is ServerEvent.Closed -> {
                currentAssistantId = null
                currentThinkingId = null
                currentSideAssistantId = null
                _state.update {
                    it.copy(
                        connection = ConnectionState.Disconnected,
                        streaming = false,
                        frozen = null,
                        transcriptLoading = false,
                        error = event.reason,
                        sideChat = it.sideChat?.copy(streaming = false),
                    )
                }
            }
            is ServerEvent.Queued -> {
                val id = event.id
                if (id != null && id !in sentIds && _state.value.queue.none { it.id == id }) {
                    sentIds.add(id)
                    _state.update { it.copy(queue = it.queue + QueuedMessage(id, event.text)) }
                }
            }
            is ServerEvent.Dequeued -> {
                val text = event.text.orEmpty()
                val ids = event.ids.toSet()
                val opt = optimisticChipId
                val reconcile = opt != null && opt in ids
                val atts = _state.value.queue.filter { it.id in ids }
                    .flatMap { it.attachments }.map { it.removePrefix("uploads/") }.distinct().ifEmpty { null }
                if (text.isNotEmpty() || atts != null) {
                    val compacting = text == "/compact" || text.startsWith("/compact ")
                    val mid = optimisticMsgId
                    if (reconcile && mid != null) {
                        if (!compacting) _state.update { st -> st.copy(messages = st.messages.map { if (it.id == mid) it.copy(text = text) else it }) }
                    } else {
                        currentAssistantId = null
                        currentThinkingId = null
                        if (!_state.value.streaming) {
                            _state.update { st -> resetToInitialWindow(st).copy(streaming = true, compacting = compacting, streamStatus = null, error = null) }
                        }
                        if (!compacting) addMessage(Role.USER, text, attachments = atts)
                    }
                }
                if (reconcile) {
                    optimisticChipId = null
                    optimisticMsgId = null
                }
                if (ids.isNotEmpty()) {
                    _state.update { it.copy(queue = it.queue.filterNot { m -> m.id in ids }) }
                    sentIds.removeAll(ids)
                }
            }
            is ServerEvent.HistoryChunk -> onHistoryChunk(event)
            else -> {}
        }
    }

    private suspend fun onSideEvent(event: ServerEvent) {
        when (event) {
            is ServerEvent.AskWorking -> {
                if (_state.value.sideChat?.messages?.lastOrNull()?.role != Role.WORKING) {
                    currentSideAssistantId = null
                    _state.update { st ->
                        val sc = st.sideChat ?: return@update st
                        st.copy(sideChat = sc.copy(messages = sc.messages + ChatMessage(nextId++, Role.WORKING, "")))
                    }
                }
            }
            is ServerEvent.AskText -> _state.update { st ->
                val sc = st.sideChat ?: return@update st
                val id = currentSideAssistantId
                if (id == null) {
                    val newId = nextId++
                    currentSideAssistantId = newId
                    st.copy(sideChat = sc.copy(messages = sc.messages + ChatMessage(newId, Role.ASSISTANT, event.text)))
                } else {
                    st.copy(sideChat = sc.copy(messages = sc.messages.map { if (it.id == id) it.copy(text = it.text + event.text) else it }))
                }
            }
            is ServerEvent.AskSession -> _state.update { st ->
                st.copy(sideChat = st.sideChat?.copy(sideSessionId = event.sessionId))
            }
            is ServerEvent.InteractionRequest -> {
                currentSideAssistantId = null
                _state.update { st ->
                    val sc = st.sideChat ?: return@update st
                    if (sc.messages.any { it.interaction?.requestId == event.requestId }) return@update st
                    val data = interactionDataOf(event)
                    val tuid = event.toolUseId
                    val cleaned = if (tuid != null) sc.messages.filterNot { it.role == Role.TOOL && it.toolUseId == tuid } else sc.messages
                    st.copy(sideChat = sc.copy(messages = cleaned + ChatMessage(nextId++, Role.INTERACTION, event.input.orEmpty(), event.toolName, tuid, data)))
                }
            }
            is ServerEvent.Done, is ServerEvent.Interrupted -> {
                currentSideAssistantId = null
                _state.update { st ->
                    val sc = st.sideChat ?: return@update st
                    val msgs = if (event is ServerEvent.Interrupted) sc.messages + ChatMessage(nextId++, Role.INTERRUPTED, "") else sc.messages
                    st.copy(sideChat = sc.copy(streaming = false, messages = msgs))
                }
                if (event is ServerEvent.Interrupted) dismissSidePendingInteractions()
            }
            is ServerEvent.Err -> {
                currentSideAssistantId = null
                _state.update { st ->
                    val sc = st.sideChat ?: return@update st
                    st.copy(sideChat = sc.copy(streaming = false))
                }
            }
            else -> {}
        }
    }

    private fun dismissSidePendingInteractions() {
        _state.update { st ->
            val sc = st.sideChat ?: return@update st
            st.copy(sideChat = sc.copy(messages = sc.messages.filterNot { it.role == Role.INTERACTION && it.interaction?.pending == true }))
        }
    }

    private fun onHistoryChunk(event: ServerEvent.HistoryChunk) {
        if (event.sessionId != _state.value.sessionId) {
            _state.update { it.copy(transcriptLoading = false, transcriptPaging = false) }
            return
        }
        val older = event.items
            .filter { it.visible() }
        _state.update { st ->
            val prepended = older.mapIndexed { i, m ->
                ChatMessage(nextId + i, m.toRole(), m.text, toolName = m.name, path = m.path, interaction = m.interaction, diffLines = m.diffLines, compact = m.compact, sourceIndex = m.index, labelOnly = m.labelOnly, result = m.result, images = imageUrls(m, event.sessionId, st.activeProjectKey), timestamp = m.timestamp)
            }
            nextId += prepended.size
            st.copy(
                messages = prepended + st.messages,
                oldestLoadedIndex = event.startIndex,
                transcriptLoading = false,
                transcriptPaging = false,
                transcriptExhausted = !event.hasMore,
            )
        }
    }

    private fun upsertTask(event: ServerEvent.Task) {
        if (event.id.isBlank()) return
        _state.update { st ->
            if (event.status == "deleted") {
                return@update st.copy(todos = st.todos.filterNot { it.id == event.id })
            }
            val existing = st.todos.firstOrNull { it.id == event.id }
            val merged = TodoItem(
                id = event.id,
                content = event.content ?: existing?.content ?: "",
                status = event.status ?: existing?.status ?: "pending",
            )
            val todos = if (existing == null) st.todos + merged
            else st.todos.map { if (it.id == event.id) merged else it }
            st.copy(todos = todos)
        }
    }

    private suspend fun notificationOptionLabel(opt: InteractionOption): String? = when {
        !opt.label.isNullOrBlank() -> opt.label
        opt.id == "allow" -> getString(Res.string.permission_allow)
        opt.id == "allow_always" -> getString(Res.string.permission_allow_always)
        opt.id == "deny" -> getString(Res.string.permission_deny)
        else -> null
    }

    private fun resetStreaming() {
        currentAssistantId = null
        currentThinkingId = null
        _state.update { it.copy(streaming = false, compacting = false, pendingToolIds = emptySet(), streamStatus = it.streamStatus?.takeIf { s -> s == "failed" }) }
    }

    private fun dismissPendingInteractions() {
        _state.update { st ->
            if (st.messages.none { it.role == Role.INTERACTION && it.interaction?.pending == true }) return@update st
            st.copy(messages = st.messages.filterNot { it.role == Role.INTERACTION && it.interaction?.pending == true })
        }
    }

    private fun interactionDataOf(event: ServerEvent.InteractionRequest): InteractionData = InteractionData(
        requestId = event.requestId,
        kind = event.kind,
        options = event.options,
        title = event.title,
        titleKey = event.titleKey,
        icon = event.icon,
        blocks = event.blocks,
        submitLabel = event.submitLabel,
        submitKey = event.submitKey,
        dismiss = event.dismiss,
        values = componentValues(event.blocks),
    )

    private fun componentHeadline(blocks: List<ComponentElement>): String? = blocks.firstNotNullOfOrNull { element ->
        if (element.type == "page") componentHeadline(element.blocks) else element.text?.takeIf { element.type == "text" }
    }

    private fun componentValues(blocks: List<ComponentElement>): Map<String, String> {
        val out = mutableMapOf<String, String>()
        for (element in blocks) {
            if (element.type == "page") {
                out += componentValues(element.blocks)
                continue
            }
            val id = element.id ?: continue
            when (element.type) {
                "input", "notes" -> out[id] = element.value.orEmpty()
                "toggle" -> out[id] = element.checked.toString()
            }
        }
        return out
    }

    fun setComponentValue(requestId: String, id: String, value: String) {
        updateInteraction(requestId) { it.copy(values = it.values + (id to value)) }
    }

    fun toggleComponentOption(requestId: String, id: String, value: String, multiple: Boolean) {
        updateInteraction(requestId) { data ->
            val current = data.values[id].orEmpty()
            val next = if (!multiple) {
                if (current == value) "" else value
            } else {
                val picked = current.split(VALUE_SEPARATOR).filter { it.isNotEmpty() }.toMutableSet()
                if (!picked.add(value)) picked.remove(value)
                picked.joinToString(VALUE_SEPARATOR)
            }
            data.copy(values = data.values + (id to next))
        }
    }

    fun submitComponent(requestId: String, action: String? = null) {
        val data = findInteraction(requestId) ?: return
        if (data.submitted) return
        val values = data.values.toMutableMap()
        action?.let { (data.blocks.firstOrNull { el -> el.type == "buttons" }?.id)?.let { id -> values[id] = it } }
        client.sendComponentResponse(requestId, values.filterValues { it.isNotEmpty() })
        updateInteraction(requestId) { it.copy(submitted = true, values = values) }
    }

    private fun append(currentId: Long?, role: Role, delta: String): Long {
        if (currentId == null) {
            val newId = nextId++
            _state.update { applyTailCap(it.copy(messages = it.messages + ChatMessage(newId, role, delta, timestamp = nowMillis()))) }
            if (turnFirstResponseId == null) turnFirstResponseId = newId
            return newId
        }
        // .map allocates a fresh ChatMessage per item every chunk; replace just the slot.
        _state.update { st ->
            val idx = st.messages.indexOfLast { it.id == currentId }
            if (idx < 0) return@update st
            val updated = st.messages.toMutableList()
            updated[idx] = updated[idx].copy(text = updated[idx].text + delta)
            st.copy(messages = updated)
        }
        return currentId
    }

    private fun addMessage(
        role: Role,
        text: String,
        toolName: String? = null,
        toolUseId: String? = null,
        interaction: InteractionData? = null,
        path: String? = null,
        diffLines: List<DiffLine>? = null,
        compact: CompactData? = null,
        labelOnly: Boolean = false,
        result: String? = null,
        ephemeral: Boolean = false,
        attachments: List<String>? = null,
    ) {
        _state.update {
            applyTailCap(it.copy(messages = it.messages + ChatMessage(nextId++, role, text, toolName, toolUseId, interaction, path, diffLines, compact, labelOnly = labelOnly, result = result, ephemeral = ephemeral, attachments = attachments, timestamp = nowMillis())))
        }
        if (turnFirstResponseId == null && isResponseRole(role)) turnFirstResponseId = _state.value.messages.lastOrNull()?.id
    }

    private fun isResponseRole(role: Role): Boolean =
        role !in setOf(Role.USER, Role.API_ERROR, Role.INTERRUPTED, Role.SUMMARY, Role.SYSTEM)

    private fun applyTailCap(st: ChatUiState): ChatUiState = capFromTail(st, MESSAGE_TAIL_CAP)

    private fun resetToInitialWindow(st: ChatUiState): ChatUiState = capFromTail(st, MESSAGE_INITIAL_CAP)

    private fun capFromTail(st: ChatUiState, cap: Int): ChatUiState {
        if (!st.followBottom || st.messages.size <= cap) return st
        val drop = st.messages.size - cap
        val kept = st.messages.subList(drop, st.messages.size).toList()
        val newCursor = kept.firstOrNull { it.sourceIndex >= 0 }?.sourceIndex ?: st.oldestLoadedIndex
        return st.copy(
            messages = kept,
            oldestLoadedIndex = newCursor,
            transcriptExhausted = false,
        )
    }

    fun setFollowBottom(value: Boolean) {
        if (_state.value.followBottom == value) return
        _state.update { it.copy(followBottom = value) }
    }

    fun answerInteraction(requestId: String, optionId: String, freeText: String?) {
        val text = freeText?.trim()
        client.sendInteractionResponse(requestId, optionId, text)
        fun List<ChatMessage>.resolve() = map { m ->
            val data = m.interaction
            if (data != null && data.requestId == requestId && data.resolved == null) {
                m.copy(interaction = data.copy(resolved = optionId, resolvedText = text))
            } else m
        }
        _state.update { st ->
            st.copy(
                messages = st.messages.resolve(),
                sideChat = st.sideChat?.copy(messages = st.sideChat.messages.resolve()),
            )
        }
    }

    private fun updateInteraction(requestId: String, transform: (InteractionData) -> InteractionData) {
        fun List<ChatMessage>.apply() = map { m ->
            val data = m.interaction
            if (data != null && data.requestId == requestId) m.copy(interaction = transform(data)) else m
        }
        _state.update { st ->
            st.copy(
                messages = st.messages.apply(),
                sideChat = st.sideChat?.let { it.copy(messages = it.messages.apply()) },
            )
        }
    }

    private fun findInteraction(requestId: String): InteractionData? {
        val st = _state.value
        return (st.messages + (st.sideChat?.messages ?: emptyList()))
            .firstNotNullOfOrNull { m -> m.interaction?.takeIf { it.requestId == requestId } }
    }

    fun setActivePage(requestId: String, index: Int) =
        updateInteraction(requestId) { if (it.submitted || it.activePage == index) it else it.copy(activePage = index) }

    fun chatQuestions(requestId: String) {
        val data = findInteraction(requestId) ?: return
        if (data.submitted) return
        client.sendQuestionsChat(requestId)
        updateInteraction(requestId) { it.copy(submitted = true, declined = true) }
    }

    override fun onCleared() {
        client.close()
    }
}
