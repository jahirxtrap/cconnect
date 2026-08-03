"""Host network status, Wi-Fi control and bandwidth tests."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.responses import api_response
from middleware.public_auth import ws_bearer_ok
from schemas.network import SudoRequest, WifiConnectRequest, InterfaceRequest, RadioRequest
from services import network, speedtest

router = APIRouter(tags=["network"])


@router.get("/network")
async def get_network():
    if not network.SUPPORTED:
        return api_response(data={"supported": False})
    return api_response(data={
        "supported": True,
        "wired_control": network.WIRED_CONTROL,
        "needs_password": network.WIRED_CONTROL and not network.has_sudo_password(),
        "speedtest": speedtest.available(),
        "connectivity": network.connectivity(),
        "wifi_radio": network.wifi_radio_state(),
        "wifi_ssid": network.wifi_current(),
        "interfaces": network.interfaces(),
    })


@router.get("/network/wifi")
async def scan_wifi():
    if not network.SUPPORTED:
        return api_response(status=404)
    return api_response(data={"networks": network.wifi_scan()})


@router.post("/network/wifi/connect")
async def connect_wifi(payload: WifiConnectRequest):
    if not network.SUPPORTED:
        return api_response(status=404)
    ssid, password = payload.ssid, payload.password
    return api_response(data=await network.run_guarded(
        f"connect:{ssid}",
        lambda: network.wifi_connect(ssid, password),
        kind="wifi",
    ))


@router.post("/network/wifi/radio")
async def set_wifi_radio(payload: RadioRequest):
    if not network.SUPPORTED:
        return api_response(status=404)
    enabled = payload.enabled
    return api_response(data=await network.run_guarded(
        f"radio:{'on' if enabled else 'off'}",
        lambda: network.wifi_set_radio(enabled),
        kind="wifi",
    ))


@router.post("/network/interface")
async def set_interface(payload: InterfaceRequest):
    if not network.WIRED_CONTROL:
        return api_response(status=404)
    name, enabled = payload.name, payload.enabled
    return api_response(data=await network.run_guarded(
        f"interface:{name}",
        lambda: network.set_interface(name, enabled),
        kind="wired",
        target=name,
    ))


@router.post("/network/auth")
async def set_auth(payload: SudoRequest):
    if not network.WIRED_CONTROL:
        return api_response(status=404)
    network.set_sudo_password(payload.password)
    return api_response(data={"ok": True})


@router.get("/network/job/{job_id}")
async def get_job(job_id: str):
    job = network.job(job_id)
    if job is None:
        return api_response(status=404)
    return api_response(data=job)


@router.websocket("/network/speedtest/ws")
async def speedtest_ws(ws: WebSocket):
    if not ws_bearer_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    try:
        async for event in speedtest.run():
            await ws.send_json(event)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        try:
            await ws.close()
        except RuntimeError:
            pass
