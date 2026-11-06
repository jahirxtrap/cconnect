"""PC resource usage, server logs and server restart."""

import asyncio
import os

from fastapi import APIRouter, Header, Query, WebSocket, WebSocketDisconnect

from core import paths
from core.access import key_matches
from core.config import RESTART_EXIT_CODE
from core.responses import api_response
from core.ws import accept_authorized, send_event
from services import directories, live_sessions, processes, repo, system_monitor, system_watch

router = APIRouter(tags=["system"])

_EXIT_DELAY = 0.5
_STOP_STATUS = {processes.STOPPED: 200, processes.LOCKED: 403}
_STOP_MISSING = 404


@router.post("/system/processes/{pid}/stop")
async def stop_process(pid: int, x_security_key: str = Header("")):
    stopped = await processes.stop(pid, key_matches(x_security_key))
    return api_response(status=_STOP_STATUS.get(stopped, _STOP_MISSING))


@router.get("/system")
def get_system():
    return api_response(data=system_monitor.snapshot())


@router.get("/system/logs")
def get_system_logs(after: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=500)):
    return api_response(data=system_monitor.logs(after, limit))


def _exit_after(code: int) -> None:
    async def _later():
        await asyncio.sleep(_EXIT_DELAY)
        await live_sessions.close_processes()
        flag = paths.RESTART_FLAG if code == RESTART_EXIT_CODE else paths.STOP_FLAG
        flag.touch()
        os._exit(code)

    asyncio.get_running_loop().create_task(_later())


@router.post("/system/restart")
async def restart_server():
    _exit_after(RESTART_EXIT_CODE)
    return api_response()


@router.post("/system/stop")
async def stop_server():
    _exit_after(0)
    return api_response()


@router.get("/system/update")
def get_update():
    return api_response(data=repo.status())


@router.post("/system/update/check")
async def check_update():
    return api_response(data=await asyncio.to_thread(repo.check))


@router.post("/system/update")
async def update_server():
    return api_response(data=await asyncio.to_thread(repo.pull))


@router.get("/system/dirs")
def list_dirs(
    path: str = Query("", description="Directory to list; empty starts at home"),
    files: bool = Query(False, description="Include files, for pickers choosing one"),
):
    """Folder tree for the path pickers, for the clients that have no native file dialog."""
    return api_response(data=directories.listing(path, files))


@router.websocket("/system/ws")
async def system_ws(ws: WebSocket):
    if not await accept_authorized(ws):
        return
    queue = system_watch.hub.subscribe()
    try:
        while True:
            await send_event(ws, await queue.get())
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        system_watch.hub.unsubscribe(queue)
