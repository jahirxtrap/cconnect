package com.jahirtrap.cconnect.chat

class TabContext(
    environmentId: String?,
    cwd: String,
    val initialSessionId: String? = null,
    val initialProjectKey: String? = null,
    val initialTitle: String? = null,
    val initialColor: String? = null,
) {
    var onChange: (() -> Unit)? = null

    var pendingCategoryId: String? = null

    var environmentId: String? = environmentId
        set(value) {
            if (field == value) return
            field = value
            onChange?.invoke()
        }

    var cwd: String = cwd
        set(value) {
            if (field == value) return
            field = value
            onChange?.invoke()
        }
}
