"""Host network status, Wi-Fi control and bandwidth tests."""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.responses import api_response
from core.ws import accept_authorized, send_event
from schemas.network import SudoRequest, WifiConnectRequest, InterfaceRequest, RadioRequest
from services import network, speedtest

router = APIRouter(tags=["network"])


@router.get("/network")
async def get_network():
    if not network.SUPPORTED:
        return api_response(data={"supported": False})
    return api_response(data={**await asyncio.to_thread(network.status), "speedtest": speedtest.available()})


@router.get("/network/wifi")
async def scan_wifi():
    if not network.SUPPORTED:
        return api_response(status=404)
    return api_response(data={"networks": await asyncio.to_thread(network.wifi_scan)})


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
    if not await accept_authorized(ws):
        return
    try:
        async for event in speedtest.run():
            await send_event(ws, event)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        try:
            await ws.close()
        except RuntimeError:
            pass
