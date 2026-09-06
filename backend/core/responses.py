"""Standardized API response helpers."""

from http import HTTPStatus
from math import ceil
from typing import Any, Iterable, Optional

import orjson
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


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
