"""Browse, download, upload and manage files in the backend's shared/ folder from the mobile app."""

import asyncio
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse
from starlette.requests import ClientDisconnect
from loguru import logger
from pydantic import BaseModel

from core.responses import api_response
from core.ws import send_event
from middleware.public_auth import ws_bearer_ok
from services import shared as shared_service
from services.shared_watch import hub as watch_hub

router = APIRouter(tags=["Shared"])


@router.websocket("/shared/ws")
async def shared_ws(ws: WebSocket):
    if not ws_bearer_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    queue = watch_hub.subscribe()

    async def pump():
        while True:
            await send_event(ws, await queue.get())

    pump_task = asyncio.create_task(pump())
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "watch":
                watch_hub.set_path(queue, msg.get("path") or "")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"shared_ws ended: {type(exc).__name__}: {exc}")
    finally:
        pump_task.cancel()
        watch_hub.unsubscribe(queue)


class FolderBody(BaseModel):
    path: str


class RenameEntryBody(BaseModel):
    path: str
    name: str


class TransferBody(BaseModel):
    paths: list[str]
    dest: str


class PathsBody(BaseModel):
    paths: list[str]


@router.post("/shared/folder")
def create_shared_folder(body: FolderBody):
    try:
        shared_service.create_folder(body.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return api_response()


@router.post("/shared/rename")
def rename_shared(body: RenameEntryBody):
    try:
        renamed = shared_service.rename_entry(body.path, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not renamed:
        raise HTTPException(status_code=404, detail="not found")
    return api_response()


@router.post("/shared/paths")
def shared_paths(body: PathsBody):
    try:
        return api_response(data=shared_service.absolute_paths(body.paths))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/shared/move")
def move_shared(body: TransferBody):
    try:
        count = shared_service.move_entries(body.paths, body.dest)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return api_response(data={"count": count})


@router.post("/shared/copy")
def copy_shared(body: TransferBody):
    try:
        count = shared_service.copy_entries(body.paths, body.dest)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return api_response(data={"count": count})


@router.get("/shared-search")
def search_shared(q: str, path: str = ""):
    try:
        return api_response(data=shared_service.search_entries(path, q))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class CompressBody(BaseModel):
    paths: list[str]
    format: str = "zip"
    name: str | None = None


class ExtractBody(BaseModel):
    path: str
    dest: str | None = None
    into_folder: bool = True
    members: list[str] | None = None
    base: str = ""


@router.get("/shared-capabilities")
def shared_capabilities():
    return api_response(data=shared_service.capabilities())


@router.post("/shared/compress")
def compress_shared(body: CompressBody):
    try:
        rel = shared_service.compress_entries(body.paths, body.format, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if rel is None:
        raise HTTPException(status_code=400, detail="nothing to compress")
    return api_response(data={"path": rel})


@router.post("/shared/extract")
def extract_shared(body: ExtractBody):
    try:
        rel = shared_service.extract_entry(body.path, body.dest, body.into_folder, body.members, body.base)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if rel is None:
        raise HTTPException(status_code=400, detail="not a supported archive")
    return api_response(data={"path": rel})


@router.get("/shared-archive")
def list_archive(path: str, inner: str = ""):
    try:
        return api_response(data=shared_service.archive_entries(path, inner))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/shared-archive-file")
def archive_file(path: str, inner: str):
    try:
        result = shared_service.archive_member_stream(path, inner)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if result is None:
        raise HTTPException(status_code=404, detail="member not found")
    chunks, filename, size = result
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    if size:
        headers["Content-Length"] = str(size)
    return StreamingResponse(chunks, headers=headers, media_type="application/octet-stream")


@router.put("/shared/{path:path}")
async def upload_shared(path: str, request: Request):
    try:
        saved = await shared_service.save_upload(path, request.stream())
    except ClientDisconnect:
        raise HTTPException(status_code=499, detail="upload cancelled by client")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return api_response(data={"path": saved})


@router.get("/shared/{path:path}")
def download_shared(path: str):
    try:
        resolved = shared_service.resolve_file(path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if resolved is None:
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(
        resolved,
        filename=resolved.name,
        content_disposition_type="inline",
        headers={"Content-Encoding": "identity"},
    )


@router.delete("/shared/{path:path}")
def delete_shared(path: str):
    try:
        deleted = shared_service.delete_entry(path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="not found")
    return api_response()
