package com.jahirtrap.cconnect.chat

import androidx.compose.runtime.Composable

actual fun readChatLocation(): ChatLocation? = null

actual fun syncChatLocation(tab: Int, sessionId: String?, projectKey: String?, view: Boolean) {}

@Composable
actual fun ChatPopstate(onLocation: (ChatLocation?) -> Unit) {}
