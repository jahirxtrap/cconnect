"""Icons that plugins and MCP servers declare, checked and re-encoded before an app shows them."""

import base64
import hashlib
from pathlib import Path
from typing import Optional
from urllib.parse import unquote_to_bytes, urlparse

import httpx

from core.db import Session
from core.models import McpCatalog
from services.attachments import shrunk

ICON_SIDE = 256
MAX_BYTES = 1 << 20
FETCH_TIMEOUT = 10
SVG = "image/svg+xml"
_SVG_HEAD = 1024
_VERSION_CHARS = 16
_DATA = "data"
_HTTPS = "https"
_BASE64 = ";base64"


def file_of(root: Path, manifest: dict) -> Optional[Path]:
    declared = manifest.get("icon")
    if not isinstance(declared, str) or not declared:
        return None
    base = root.resolve()
    path = (base / declared).resolve()
    return path if path.is_relative_to(base) and path.is_file() else None


def file_version(path: Path) -> str:
    stat = path.stat()
    return f"{stat.st_mtime_ns:x}-{stat.st_size:x}"


def uri_version(uri: str) -> str:
    return hashlib.sha256(uri.encode()).hexdigest()[:_VERSION_CHARS]


def _declared_uri(catalog: dict) -> Optional[str]:
    info = (catalog.get("initialize") or {}).get("serverInfo") or {}
    icons = info.get("icons")
    sources = (icon.get("src") for icon in icons if isinstance(icon, dict)) if isinstance(icons, list) else ()
    return next((src for src in sources if isinstance(src, str) and urlparse(src).scheme in (_DATA, _HTTPS)), None)


def declared_uris(names: list[str]) -> dict[str, str]:
    with Session() as session:
        rows = session.query(McpCatalog.name, McpCatalog.catalog).filter(McpCatalog.name.in_(names)).all()
    return {name: uri for name, catalog in rows if (uri := _declared_uri(catalog))}


def fetched(uri: str) -> Optional[bytes]:
    scheme = urlparse(uri).scheme
    if scheme == _DATA:
        header, _, body = uri.partition(",")
        try:
            return base64.b64decode(body, validate=True) if header.endswith(_BASE64) else unquote_to_bytes(body)
        except ValueError:
            return None
    if scheme != _HTTPS:
        return None
    data = bytearray()
    try:
        with httpx.stream("GET", uri, timeout=FETCH_TIMEOUT, follow_redirects=False) as response:
            if response.status_code != httpx.codes.OK:
                return None
            for chunk in response.iter_bytes():
                data += chunk
                if len(data) > MAX_BYTES:
                    return None
    except httpx.HTTPError:
        return None
    return bytes(data)


def _is_svg(data: bytes) -> bool:
    head = data[:_SVG_HEAD].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    return head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in head)


def rendered(data: Optional[bytes]) -> Optional[tuple[str, bytes]]:
    """An SVG as it is, any other image decoded and encoded again; None for anything that is not an image."""
    if not data or len(data) > MAX_BYTES:
        return None
    return (SVG, data) if _is_svg(data) else shrunk(data, ICON_SIDE)
