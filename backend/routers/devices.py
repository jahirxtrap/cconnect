"""The Devices panel: the Android devices adb sees and the emulators of the SDK, behind the security key, each screen mirrored over a socket."""

import asyncio
import json
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

from fastapi import APIRouter, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core.access import key_matches
from core.responses import api_response
from core.ws import opening_message, refuse, send_event
from services import adb, device_screen, device_tools, devices, project_files, shared, terminal
from services.devices import hub

router = APIRouter(tags=["Devices"])

SCREENSHOTS_FOLDER = "devices"
PNG = "png"
LOGCAT = "logcat"

FAILURES = (devices.DeviceError, device_tools.ToolsError, adb.AdbError)


class PairRequest(BaseModel):
    address: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=32)


class AddressRequest(BaseModel):
    address: str = Field(min_length=1, max_length=255)


class NameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ApkRequest(BaseModel):
    project: Optional[str] = None
    path: str = Field(min_length=1, max_length=4096)


def _failed(exc: Exception) -> Response:
    data = {"reason": exc.reason, "detail": exc.detail}
    return api_response(status=404 if exc.reason == devices.MISSING else 422, data=data)


async def _keyed(key: str, work: Callable[[], Awaitable[Any]]) -> Response:
    if not key_matches(key):
        return api_response(status=403)
    try:
        return api_response(data=await work())
    except FAILURES as exc:
        return _failed(exc)


async def _state() -> dict:
    await hub.ready()
    return hub.snapshot()


async def _changed(work: Awaitable[Any]) -> dict:
    await work
    return hub.snapshot()


async def _saved_changed(work: Callable[[], Any]) -> dict:
    await asyncio.to_thread(work)
    hub.reload_saved()
    return hub.snapshot()


async def _connect_saved(device_id: str) -> None:
    address = hub.address_for(await asyncio.to_thread(devices.find_saved, device_id))
    if not address:
        raise devices.DeviceError(devices.INVALID, device_id)
    await devices.connect(address)


async def _screenshot(serial: str) -> dict:
    found = hub.ready_device(serial)
    image = await devices.screenshot(serial)
    target = shared.dated_file(shared.project_dir("") / SCREENSHOTS_FOLDER, shared.file_safe(found["name"]) or shared.file_safe(serial), PNG)
    await asyncio.to_thread(target.write_bytes, image)
    return {"path": shared.relative(target)}


def _apk(body: ApkRequest) -> Optional[Path]:
    direct = Path(body.path)
    if body.project is None and direct.is_absolute():
        return direct if direct.is_file() else None
    try:
        return project_files.located(body.project, body.path, True)
    except ValueError as exc:
        raise devices.DeviceError(devices.INVALID, body.path) from exc


async def _install(serial: str, body: ApkRequest) -> dict:
    hub.ready_device(serial)
    found = _apk(body)
    if found is None:
        raise devices.DeviceError(devices.MISSING, body.path)
    return {"output": await adb.install(serial, str(found))}


async def _logcat(serial: str) -> dict:
    found = hub.ready_device(serial)
    return terminal.listed(terminal.spawn(None, f"{LOGCAT} {found['name']}", argv=[adb.executable(), "-s", serial, LOGCAT]))


@router.get("/devices")
async def list_devices(x_security_key: str = Header("")):
    return await _keyed(x_security_key, _state)


@router.post("/devices/tools/install")
async def install_tools(x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _changed(hub.install_tools()))


@router.post("/devices/pairing")
async def start_pairing(x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    await hub.ready()
    return api_response(data=hub.start_pairing())


@router.delete("/devices/pairing")
async def stop_pairing(x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    hub.stop_pairing()
    return api_response()


@router.post("/devices/pair")
async def pair_device(body: PairRequest, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _changed(devices.pair(body.address, body.code)))


@router.post("/devices/connect")
async def connect_device(body: AddressRequest, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _changed(devices.connect(body.address)))


@router.post("/devices/{serial}/disconnect")
async def disconnect_device(serial: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _changed(devices.disconnect(serial)))


@router.patch("/devices/saved/{device_id}")
async def rename_device(device_id: str, body: NameRequest, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _saved_changed(lambda: devices.rename(device_id, body.name)))


@router.delete("/devices/saved/{device_id}")
async def forget_device(device_id: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _saved_changed(lambda: devices.forget(device_id)))


@router.post("/devices/saved/{device_id}/connect")
async def connect_saved(device_id: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _changed(_connect_saved(device_id)))


@router.post("/devices/emulators/{name}/start")
async def start_emulator(name: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _changed(asyncio.to_thread(devices.start_emulator, name)))


@router.post("/devices/emulators/{name}/stop")
async def stop_emulator(name: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _changed(devices.stop_emulator(name)))


@router.post("/devices/{serial}/screenshot")
async def screenshot_device(serial: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _screenshot(serial))


@router.post("/devices/{serial}/install")
async def install_apk(serial: str, body: ApkRequest, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _install(serial, body))


@router.post("/devices/{serial}/logcat")
async def open_logcat(serial: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: _logcat(serial))


@router.websocket("/devices/ws")
async def devices_ws(ws: WebSocket):
    opening = await opening_message(ws)
    if opening is None:
        return
    if not key_matches(str(opening.get("key") or "")):
        await refuse(ws)
        return
    queue = hub.subscribe()

    async def outgoing():
        while True:
            await send_event(ws, await queue.get())

    pump = asyncio.create_task(outgoing())
    try:
        while True:
            await ws.receive_json()
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        pass
    finally:
        pump.cancel()
        hub.unsubscribe(queue)


def _dispatch(session: device_screen.ScreenSession, payload: dict) -> None:
    kind = payload.get("type")
    if kind == "touch":
        session.touch(str(payload.get("action") or ""), int(payload.get("pointer") or 0), int(payload.get("x") or 0), int(payload.get("y") or 0))
    elif kind == "scroll":
        session.scroll(int(payload.get("x") or 0), int(payload.get("y") or 0), float(payload.get("horizontal") or 0), float(payload.get("vertical") or 0))
    elif kind == "key":
        session.key(str(payload.get("name") or ""), str(payload.get("action") or ""), device_screen.modifiers_of(payload))
    elif kind == "press":
        session.press(str(payload.get("name") or ""))
    elif kind == "text":
        session.text(str(payload.get("value") or ""))
    elif kind == "display":
        session.display_power(payload.get("on") is True)
    elif kind == "rotate":
        session.rotate()
    elif kind == "keyframe":
        session.ask_key()


@router.websocket("/devices/{serial}/screen")
async def device_screen_ws(ws: WebSocket, serial: str):
    opening = await opening_message(ws)
    if opening is None:
        return
    if not key_matches(str(opening.get("key") or "")):
        await refuse(ws)
        return
    session = device_screen.session(serial)
    viewer: asyncio.Queue = asyncio.Queue()

    async def outgoing():
        while True:
            kind, body = await viewer.get()
            if kind == device_screen.VIDEO:
                await ws.send_bytes(body[1])
            elif kind == device_screen.FRAME:
                await ws.send_bytes(body)
            else:
                await send_event(ws, body)

    pump = asyncio.create_task(outgoing())
    try:
        try:
            await hub.ready()
            hub.ready_device(serial)
            await session.watch(viewer, opening.get("video") is True, int(opening.get("width") or 0), int(opening.get("height") or 0))
        except FAILURES as exc:
            await send_event(ws, {"type": "error", "reason": exc.reason, "detail": exc.detail})
        while True:
            _dispatch(session, await ws.receive_json())
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        pass
    finally:
        pump.cancel()
        await session.unwatch(viewer)
