package com.jahirtrap.cconnect.data.remote

import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

object SystemApi {

    data class DirEntry(val name: String, val path: String, val isDir: Boolean)

    data class DirListing(
        val path: String,
        val parent: String?,
        val roots: List<String>,
        val entries: List<DirEntry>,
    )

    data class DiskInfo(
        val mount: String,
        val used: Long,
        val total: Long,
        val percent: Float,
    )

    data class GpuInfo(
        val name: String,
        val percent: Float,
        val memUsed: Long,
        val memTotal: Long,
        val memPercent: Float,
        val temp: Int?,
    )

    data class BatteryInfo(
        val percent: Float,
        val plugged: Boolean,
        val secsLeft: Long?,
    )

    data class SystemInfo(
        val hostname: String,
        val os: String,
        val osId: String,
        val arch: String,
        val cpuName: String?,
        val uptime: Double,
        val cpuPercent: Float,
        val cpuCores: Int,
        val memoryUsed: Long,
        val memoryTotal: Long,
        val memoryPercent: Float,
        val gpu: GpuInfo?,
        val battery: BatteryInfo?,
        val disks: List<DiskInfo>,
        val netRx: Double = 0.0,
        val netTx: Double = 0.0,
    )

    data class LogEntry(
        val ts: Double,
        val level: String,
        val message: String,
    )

    sealed interface Event {
        data class Info(val info: SystemInfo) : Event
        data class Logs(val items: List<LogEntry>) : Event
    }

    suspend fun restart(): Boolean = Http.post("/system/restart", buildJsonObject {}) != null

    /** Folder tree for the path picker, for the platforms without a native file dialog. */
    suspend fun dirs(path: String, files: Boolean = false): DirListing? {
        val data = Http.get("/system/dirs", mapOf("path" to path, "files" to files.toString()))?.jsonObject
            ?: return null
        return DirListing(
            path = data["path"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            parent = data["parent"]?.jsonPrimitive?.contentOrNull,
            roots = data["roots"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }.orEmpty(),
            entries = data["entries"]?.jsonArray?.map { element ->
                val entry = element.jsonObject
                DirEntry(
                    name = entry["name"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    path = entry["path"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    isDir = entry["is_dir"]?.jsonPrimitive?.contentOrNull == "true",
                )
            }.orEmpty(),
        )
    }

    fun stream(): Flow<Event> = callbackFlow {
        val socket = openWebSocket(Backend.systemWsUrl, Backend.authHeaders, object : WsListener {
            override fun onOpen() {}

            override fun onMessage(text: String) {
                val o = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
                when (o["type"]?.jsonPrimitive?.contentOrNull) {
                    "system" -> trySend(Event.Info(parseInfo(o)))
                    "logs" -> trySend(Event.Logs(o["items"]?.jsonArray?.map { parseLog(it.jsonObject) }.orEmpty()))
                }
            }

            override fun onFailure(reason: String) {
                close(RuntimeException(reason))
            }

            override fun onClosed(reason: String) {
                close()
            }
        }, pingSeconds = 15)
        awaitClose { socket.cancel() }
    }

    private fun parseInfo(o: JsonObject): SystemInfo {
        val cpu = o["cpu"]?.jsonObject
        val memory = o["memory"]?.jsonObject
        return SystemInfo(
            hostname = o["hostname"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            os = o["os"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            osId = o["os_id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            arch = o["arch"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            cpuName = o["cpu_name"]?.jsonPrimitive?.contentOrNull,
            uptime = o["uptime"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
            cpuPercent = cpu?.get("percent")?.jsonPrimitive?.floatOrNull ?: 0f,
            cpuCores = cpu?.get("cores")?.jsonPrimitive?.intOrNull ?: 0,
            memoryUsed = memory?.get("used")?.jsonPrimitive?.longOrNull ?: 0L,
            memoryTotal = memory?.get("total")?.jsonPrimitive?.longOrNull ?: 0L,
            memoryPercent = memory?.get("percent")?.jsonPrimitive?.floatOrNull ?: 0f,
            gpu = (o["gpu"] as? JsonObject)?.let { gpu ->
                GpuInfo(
                    name = gpu["name"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    percent = gpu["percent"]?.jsonPrimitive?.floatOrNull ?: 0f,
                    memUsed = gpu["mem_used"]?.jsonPrimitive?.longOrNull ?: 0L,
                    memTotal = gpu["mem_total"]?.jsonPrimitive?.longOrNull ?: 0L,
                    memPercent = gpu["mem_percent"]?.jsonPrimitive?.floatOrNull ?: 0f,
                    temp = gpu["temp"]?.jsonPrimitive?.intOrNull,
                )
            },
            battery = (o["battery"] as? JsonObject)?.let { battery ->
                BatteryInfo(
                    percent = battery["percent"]?.jsonPrimitive?.floatOrNull ?: 0f,
                    plugged = battery["plugged"]?.jsonPrimitive?.contentOrNull == "true",
                    secsLeft = battery["secsleft"]?.jsonPrimitive?.longOrNull,
                )
            },
            disks = o["disks"]?.jsonArray?.map { el ->
                val d = el.jsonObject
                DiskInfo(
                    mount = d["mount"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    used = d["used"]?.jsonPrimitive?.longOrNull ?: 0L,
                    total = d["total"]?.jsonPrimitive?.longOrNull ?: 0L,
                    percent = d["percent"]?.jsonPrimitive?.floatOrNull ?: 0f,
                )
            }.orEmpty(),
            netRx = o["network"]?.jsonObject?.get("rx")?.jsonPrimitive?.doubleOrNull ?: 0.0,
            netTx = o["network"]?.jsonObject?.get("tx")?.jsonPrimitive?.doubleOrNull ?: 0.0,
        )
    }

    private fun parseLog(o: JsonObject): LogEntry = LogEntry(
        ts = o["ts"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
        level = o["level"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        message = o["message"]?.jsonPrimitive?.contentOrNull.orEmpty(),
    )
}
