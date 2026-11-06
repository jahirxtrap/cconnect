package com.jahirtrap.cconnect

import org.json.JSONObject

private const val PERCENT = 100

internal fun transferPercent(bytes: Long, total: Long): Int = if (total > 0) (bytes * PERCENT / total).toInt() else -1

internal fun transferState(status: String, bytes: Long, total: Long): JSONObject =
    JSONObject().put("status", status).put("bytes", bytes).put("total", total)
