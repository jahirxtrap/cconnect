package com.jahirtrap.cconnect.chat

import androidx.compose.runtime.Composable

data class ChatLocation(val tab: Int, val sessionId: String, val projectKey: String, val view: Boolean)

expect fun readChatLocation(): ChatLocation?

expect fun syncChatLocation(tab: Int, sessionId: String?, projectKey: String?, view: Boolean)

@Composable
expect fun ChatPopstate(onLocation: (ChatLocation?) -> Unit)
