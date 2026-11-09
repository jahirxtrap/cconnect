"""HTML pages the apps show, each served with the files of its folder under an address of its own."""

import posixpath
import re
import secrets
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Callable, Optional

from core import paths
from services import project_files, shared

PATH = "/api/pages"
LIMIT = 256
HTML_SUFFIXES = (".html", ".htm")
FRAME_SCRIPT = b"<script>" + (paths.SCRIPTS_DIR / "page_frame.js").read_bytes() + b"</script>"
ANCHORS = (re.compile(rb"<head\b[^>]*>", re.IGNORECASE), re.compile(rb"<!doctype[^>]*>", re.IGNORECASE))

Resolver = Callable[[str], Optional[Path]]


@dataclass
class Page:
    entry: str
    html: str
    folder: str
    resolve: Resolver


_pages: "OrderedDict[str, Page]" = OrderedDict()
_lock = Lock()


def _shared(path: str) -> Optional[Path]:
    try:
        return shared.resolve_file(path)
    except ValueError:
        return None


def _project(root: Path, unlocked: bool) -> Resolver:
    def resolve(path: str) -> Optional[Path]:
        try:
            return project_files.resolve_file(root, path, unlocked)
        except ValueError:
            return None

    return resolve


def resolver_for(in_shared: bool, project: Optional[str], unlocked: bool) -> Optional[Resolver]:
    """How a page reaches its files: from Shared, or from a project with the access its opener had."""
    if in_shared:
        return _shared
    root = project_files.root_for(project) if project else None
    return _project(root, unlocked) if root else None


def open_page(entry: str, html: str, path: str, resolve: Resolver) -> str:
    page_id = secrets.token_urlsafe(24)
    with _lock:
        _pages[page_id] = Page(entry, html, posixpath.dirname(path.strip("/")), resolve)
        while len(_pages) > LIMIT:
            _pages.popitem(last=False)
    return page_id


def close_page(page_id: str) -> None:
    with _lock:
        _pages.pop(page_id, None)


def page(page_id: str) -> Optional[Page]:
    with _lock:
        found = _pages.get(page_id)
        if found is not None:
            _pages.move_to_end(page_id)
        return found


def framed(html: bytes) -> bytes:
    """The page with the script that keeps pinch and Ctrl+wheel off the app and takes the app's zoom and keys."""
    anchor = next((match for match in (pattern.search(html) for pattern in ANCHORS) if match), None)
    at = anchor.end() if anchor else 0
    return html[:at] + FRAME_SCRIPT + html[at:]


def file_of(found: Page, rest: str) -> Optional[Path]:
    """A file of the page's folder or below; anything outside it is not there."""
    joined = posixpath.normpath(posixpath.join(found.folder, rest))
    if joined.startswith("..") or posixpath.isabs(joined):
        return None
    if found.folder and not joined.startswith(f"{found.folder}/"):
        return None
    return found.resolve(joined)
