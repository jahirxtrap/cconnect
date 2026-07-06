package com.jahirtrap.cconnect.service

import com.jahirtrap.cconnect.chat.TabsController
import kotlin.concurrent.Volatile

object Notifier {

    data class Action(val label: String, val requestId: String, val optionId: String)

    enum class Kind(val notifId: Int) {
        TaskDone(2),
        Interaction(3),
    }

    @Volatile
    var appInForeground: Boolean = false

    @Volatile
    private var pendingTab: String? = null

    fun init(onActivate: () -> Unit) = platformNotifier.init {
        routeToPendingTab()
        onActivate()
    }

    fun notify(kind: Kind, title: String, text: String?, actions: List<Action> = emptyList(), targetTab: String? = null) {
        if (appInForeground) return
        pendingTab = targetTab
        platformNotifier.notify(kind, title, text, actions)
    }

    fun routeToPendingTab() {
        val tab = pendingTab ?: return
        pendingTab = null
        TabsController.selectTab(tab)
    }

    fun cancel(kind: Kind) = platformNotifier.cancel(kind)
}

internal interface PlatformNotifier {
    fun init(onActivate: () -> Unit)
    fun notify(kind: Notifier.Kind, title: String, text: String?, actions: List<Notifier.Action>)
    fun cancel(kind: Notifier.Kind)
}

internal expect val platformNotifier: PlatformNotifier
