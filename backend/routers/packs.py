import mimetypes

from fastapi import APIRouter, Header, HTTPException, WebSocket
from fastapi.responses import FileResponse, Response

from core.access import key_matches
from core.responses import FILE_HEADERS, api_response
from core.ws import stream_watch
from services import packs
from services.pack_format import MIME

router = APIRouter(tags=["Packs"])


@router.websocket("/packs/ws")
async def packs_ws(ws: WebSocket):
    await stream_watch(ws, packs.watch, lambda queue, _message: packs.watch.set_path(queue, ""))


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
async def pack_preview(name: str):
    found = packs.preview(name)
    if found is None:
        raise HTTPException(status_code=404, detail="not found")
    data, extension = found
    return Response(content=data, media_type=mimetypes.guess_type(f"preview.{extension}")[0] or "application/octet-stream")
