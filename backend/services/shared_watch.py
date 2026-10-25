"""Live updates for the shared folder over WebSocket."""

from core import paths
from services import shared as shared_service
from services.directory_watch import DirectoryWatchHub


def _snapshot(path: str) -> dict:
    try:
        entries = shared_service.list_entries(path)
    except Exception:
        entries = []
    return {"type": "snapshot", "path": path, "entries": entries}


hub = DirectoryWatchHub(paths.SHARED_DIR, _snapshot)
