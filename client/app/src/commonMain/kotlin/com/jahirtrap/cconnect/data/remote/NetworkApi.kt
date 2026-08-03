package com.jahirtrap.cconnect.data.remote

import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

object NetworkApi {

    data class Interface(
        val name: String,
        val description: String?,
        val kind: String,
        val up: Boolean,
        val linkSpeed: String?,
        val network: String?,
        val internet: Boolean,
    )

    data class WifiNetwork(
        val ssid: String,
        val signal: Int?,
        val security: String?,
        val active: Boolean,
        val known: Boolean,
    )

    data class Status(
        val supported: Boolean,
        val wiredControl: Boolean = false,
        val needsPassword: Boolean = false,
        val speedtest: Boolean = false,
        val connectivity: String = "unknown",
        val wifiRadio: Boolean? = null,
        val wifiSsid: String? = null,
        val interfaces: List<Interface> = emptyList(),
    )

    data class Job(val id: String, val status: String, val message: String?, val recovered: Boolean?)

    data class SpeedtestResult(
        val download: Double?,
        val upload: Double?,
        val ping: Double?,
        val jitter: Double?,
        val server: String?,
        val isp: String?,
    )

    sealed interface SpeedtestEvent {
        data class Progress(val stage: String, val progress: Float, val bandwidth: Double?) : SpeedtestEvent
        data class Done(val result: SpeedtestResult) : SpeedtestEvent
        data class Failed(val message: String) : SpeedtestEvent
    }

    suspend fun status(): Status? {
        val data = Http.get("/network")?.jsonObject ?: return null
        if (data["supported"]?.jsonPrimitive?.booleanOrNull != true) return Status(supported = false)
        return Status(
            supported = true,
            wiredControl = data["wired_control"]?.jsonPrimitive?.booleanOrNull ?: false,
            needsPassword = data["needs_password"]?.jsonPrimitive?.booleanOrNull ?: false,
            speedtest = data["speedtest"]?.jsonPrimitive?.booleanOrNull ?: false,
            connectivity = data["connectivity"]?.jsonPrimitive?.contentOrNull ?: "unknown",
            wifiRadio = data["wifi_radio"]?.jsonPrimitive?.booleanOrNull,
            wifiSsid = data["wifi_ssid"]?.jsonPrimitive?.contentOrNull,
            interfaces = data["interfaces"]?.jsonArray?.map { parseInterface(it.jsonObject) }.orEmpty(),
        )
    }

    suspend fun scan(): List<WifiNetwork> =
        Http.get("/network/wifi")?.jsonObject?.get("networks")?.jsonArray
            ?.map { parseNetwork(it.jsonObject) }.orEmpty()

    suspend fun connect(ssid: String, password: String?): Job? = Http.post("/network/wifi/connect", buildJsonObject {
        put("ssid", ssid)
        password?.let { put("password", it) }
    })?.jsonObject?.let(::parseJob)

    suspend fun setRadio(enabled: Boolean): Job? = Http.post("/network/wifi/radio", buildJsonObject {
        put("enabled", enabled)
    })?.jsonObject?.let(::parseJob)

    suspend fun setInterface(name: String, enabled: Boolean): Job? = Http.post("/network/interface", buildJsonObject {
        put("name", name)
        put("enabled", enabled)
    })?.jsonObject?.let(::parseJob)

    suspend fun authorize(password: String): Boolean =
        Http.post("/network/auth", buildJsonObject { put("password", password) }) != null

    suspend fun job(id: String): Job? = Http.get("/network/job/$id")?.jsonObject?.let(::parseJob)

    fun speedtest(): Flow<SpeedtestEvent> = callbackFlow {
        val socket = openWebSocket(Backend.speedtestWsUrl, Backend.authHeaders, object : WsListener {
            override fun onOpen() {}

            override fun onMessage(text: String) {
                val o = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
                when (o["type"]?.jsonPrimitive?.contentOrNull) {
                    "progress" -> trySend(
                        SpeedtestEvent.Progress(
                            stage = o["stage"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                            progress = o["progress"]?.jsonPrimitive?.floatOrNull ?: 0f,
                            bandwidth = o["bandwidth"]?.jsonPrimitive?.doubleOrNull,
                        )
                    )
                    "result" -> trySend(
                        SpeedtestEvent.Done(
                            SpeedtestResult(
                                download = o["download"]?.jsonPrimitive?.doubleOrNull,
                                upload = o["upload"]?.jsonPrimitive?.doubleOrNull,
                                ping = o["ping"]?.jsonPrimitive?.doubleOrNull,
                                jitter = o["jitter"]?.jsonPrimitive?.doubleOrNull,
                                server = o["server"]?.jsonPrimitive?.contentOrNull,
                                isp = o["isp"]?.jsonPrimitive?.contentOrNull,
                            )
                        )
                    )
                    "error" -> trySend(SpeedtestEvent.Failed(o["message"]?.jsonPrimitive?.contentOrNull.orEmpty()))
                }
            }

            override fun onFailure(reason: String) {
                trySend(SpeedtestEvent.Failed(reason))
                close()
            }

            override fun onClosed(reason: String) { close() }
        }, pingSeconds = 0)
        awaitClose { socket.cancel() }
    }

    private fun parseInterface(o: JsonObject) = Interface(
        name = o["name"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        description = o["description"]?.jsonPrimitive?.contentOrNull,
        kind = o["kind"]?.jsonPrimitive?.contentOrNull ?: "other",
        up = o["up"]?.jsonPrimitive?.booleanOrNull ?: false,
        linkSpeed = o["link_speed"]?.jsonPrimitive?.contentOrNull,
        network = o["network"]?.jsonPrimitive?.contentOrNull,
        internet = o["internet"]?.jsonPrimitive?.booleanOrNull ?: false,
    )

    private fun parseNetwork(o: JsonObject) = WifiNetwork(
        ssid = o["ssid"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        signal = o["signal"]?.jsonPrimitive?.intOrNull,
        security = o["security"]?.jsonPrimitive?.contentOrNull,
        active = o["active"]?.jsonPrimitive?.booleanOrNull ?: false,
        known = o["known"]?.jsonPrimitive?.booleanOrNull ?: false,
    )

    private fun parseJob(o: JsonObject) = Job(
        id = o["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        status = o["status"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        message = o["message"]?.jsonPrimitive?.contentOrNull,
        recovered = o["recovered"]?.jsonPrimitive?.booleanOrNull,
    )
}
