import mimetypes

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, WebSocket
from fastapi.responses import FileResponse, Response

from core.access import key_matches
from core.responses import FILE_HEADERS, api_response
from core.ws import stream_watch
from services import attachments, packs
from services.pack_format import MIME, PackFormatError

router = APIRouter(tags=["Packs"])


@router.websocket("/packs/ws")
async def packs_ws(ws: WebSocket):
    await stream_watch(ws, packs.watch, lambda queue, _message: packs.watch.set_path(queue, ""))


@router.get("/packs/fetch")
def fetch_pack(url: str):
    try:
        data = packs.fetch(url)
    except PackFormatError as exc:
        return api_response(status=422, message=str(exc))
    except httpx.HTTPError as exc:
        return api_response(status=502, message=str(exc))
    return Response(content=data, media_type=MIME, headers=FILE_HEADERS)


@router.get("/packs/{name}")
async def download_pack(name: str):
    target = packs.file_of(name)
    if target is None:
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(target, media_type=MIME, filename=name, headers=FILE_HEADERS)


@router.delete("/packs/{name}")
async def delete_pack(name: str, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    if not packs.remove(name):
        raise HTTPException(status_code=404, detail="not found")
    return api_response()


@router.get("/packs/{name}/preview")
def pack_preview(name: str, size: int | None = Query(None, ge=1)):
    found = packs.preview(name)
    if found is None:
        raise HTTPException(status_code=404, detail="not found")
    data, extension = found
    limit = attachments.thumbnail_size(size)
    small = attachments.shrunk(data, limit, cover=True, stills_only=True, reduce_only=True) if limit else None
    if small is not None:
        media_type, data = small
        return Response(content=data, media_type=media_type)
    return Response(content=data, media_type=mimetypes.guess_type(f"preview.{extension}")[0] or "application/octet-stream")
