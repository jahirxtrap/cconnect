"""Standardized API response helpers."""

import os
from email.utils import formatdate
from http import HTTPStatus
from math import ceil
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

import orjson
from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.staticfiles import NotModifiedResponse

FILE_HEADERS = {"Content-Encoding": "identity", "Cache-Control": "no-cache"}


def _held(request: Request, etag: str) -> bool:
    return etag in [tag.strip(" W/") for tag in request.headers.get("if-none-match", "").split(",")]


Render = Callable[[], Optional[tuple[str, bytes]]]


def _rendered(request: Request, headers: dict[str, str], render: Render) -> Optional[Response]:
    if _held(request, headers["ETag"]):
        return NotModifiedResponse(headers)
    made = render()
    if made is None:
        return None
    media_type, data = made
    return Response(data, media_type=media_type, headers=headers)


def derived_response(request: Request, source: Path, variant: str, render: Render) -> Optional[Response]:
    """A file made from `source`, answered 304 without making it again while the browser holds this version; None when it cannot be made."""
    stat = os.stat(source)
    etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}-{variant}"'
    return _rendered(request, {**FILE_HEADERS, "ETag": etag, "Last-Modified": formatdate(stat.st_mtime, usegmt=True)}, render)


Rendering = tuple[str, Render, bool]


def rendition_response(request: Request, source: Path, rendering: Optional[Rendering]) -> Optional[Response]:
    """The rendition of `source`, keyed by its variant; None serves the file itself when the rendering allows it."""
    if rendering is None:
        return None
    variant, render, original_allowed = rendering
    made = derived_response(request, source, variant, render)
    if made is None and not original_allowed:
        raise HTTPException(status_code=404, detail="no rendition of this file")
    return made


def fixed_response(request: Request, name: str, render: Render) -> Optional[Response]:
    """Content that never changes under its name, answered 304 without reading it while the browser holds it."""
    return _rendered(request, {**FILE_HEADERS, "ETag": f'"{name}"'}, render)


def file_response(request: Request, path: Path, **options: Any) -> Response:
    response = FileResponse(path, stat_result=os.stat(path), headers=FILE_HEADERS, **options)
    if _held(request, response.headers["etag"]):
        return NotModifiedResponse(response.headers)
    return response


class ORJSONResponse(JSONResponse):
    """orjson serializes plain payloads; jsonable_encoder covers the types it rejects."""

    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content, default=jsonable_encoder)


def _default_message_for(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "OK" if 200 <= status < 300 else "Error"


def api_response(
    data: Any = None,
    message: Optional[str] = None,
    status: int = 200,
    success: Optional[bool] = None,
) -> ORJSONResponse:
    """Standardized envelope: {success, status, message, data}. data omitted when None."""
    resolved_success = success if success is not None else (200 <= status < 300)
    resolved_message = message if message is not None else _default_message_for(status)
    body: dict[str, Any] = {
        "success": resolved_success,
        "status": status,
        "message": resolved_message,
    }
    if data is not None:
        body["data"] = data
    return ORJSONResponse(content=body, status_code=status)


def paginated_response(
    items: Iterable[Any],
    total: int,
    page: int,
    per_page: int,
    message: Optional[str] = None,
) -> ORJSONResponse:
    """Wrap a paginated list in the standard envelope. Data payload shape:
    {items, total, page, per_page, total_pages}."""
    return api_response(
        data={
            "items": list(items),
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": ceil(total / per_page) if total and per_page else 0,
        },
        message=message,
    )
