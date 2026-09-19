"""Read-only file browsing inside a project's working directory."""

import asyncio

from urllib.parse import quote

from fastapi import APIRouter, Header, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse
from loguru import logger

from core.access import key_matches
from core.responses import api_response
from core.ws import send_event
from middleware.public_auth import ws_bearer_ok
from services import project_files, project_watch

router = APIRouter()


def _root(project_key: str):
    root = project_files.root_for(project_key)
    if root is None:
        raise HTTPException(status_code=404, detail="project not found")
    return root


@router.get("/projects/{project_key}/tree")
def project_tree(project_key: str, path: str = Query(""), x_security_key: str = Header("")):
    try:
        return api_response(
            data=project_files.listing(_root(project_key), path, key_matches(x_security_key))
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/projects/{project_key}/search")
def project_search(project_key: str, q: str):
    return api_response(data=project_files.search(_root(project_key), q))


@router.get("/projects/{project_key}/changes")
def project_changes(project_key: str):
    return api_response(data=project_files.changes(_root(project_key)))


@router.get("/projects/{project_key}/diff")
def project_diff(project_key: str, path: str):
    try:
        return api_response(data=project_files.diff(_root(project_key), path))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.websocket("/projects/ws")
async def projects_ws(ws: WebSocket):
    if not ws_bearer_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    queue = project_watch.hub.subscribe()

    async def pump():
        while True:
            await send_event(ws, await queue.get())

    pump_task = asyncio.create_task(pump())
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "watch":
                project_watch.hub.watch(queue, str(msg.get("project_key") or ""))
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"projects_ws ended: {type(exc).__name__}: {exc}")
    finally:
        pump_task.cancel()
        project_watch.hub.unsubscribe(queue)


@router.get("/projects/{project_key}/archive")
def project_archive(project_key: str, path: str, inner: str = Query(""), x_security_key: str = Header("")):
    try:
        return api_response(
            data=project_files.archive_listing(_root(project_key), path, inner, key_matches(x_security_key))
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/projects/{project_key}/archive-file")
def project_archive_file(project_key: str, path: str, inner: str, x_security_key: str = Header("")):
    try:
        result = project_files.archive_member(_root(project_key), path, inner, key_matches(x_security_key))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if result is None:
        raise HTTPException(status_code=404, detail="member not found")
    chunks, filename, size = result
    headers = {"Content-Disposition": f"inline; filename*=UTF-8''{quote(filename)}"}
    if size:
        headers["Content-Length"] = str(size)
    return StreamingResponse(chunks, headers=headers, media_type="application/octet-stream")


@router.get("/projects/{project_key}/file")
def project_file(project_key: str, path: str, x_security_key: str = Header("")):
    try:
        resolved = project_files.resolve_file(_root(project_key), path, key_matches(x_security_key))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if resolved is None:
        if project_files.deleted_at_head(_root(project_key), path):
            return Response(content=b"", media_type="text/plain")
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(
        resolved,
        filename=resolved.name,
        content_disposition_type="inline",
        headers={"Content-Encoding": "identity", "Cache-Control": "no-cache"},
    )
