import io
import os
import zipfile
from pathlib import Path
from typing import Optional

from core import paths
from services.directory_watch import DirectoryWatchHub
from services.pack_format import EXTENSION, SCHEMA, PackFormatError, preview_of, read_pack

_read: dict[str, tuple[int, int, Optional[dict]]] = {}


def file_of(name: str) -> Optional[Path]:
    target = paths.PACKS_DIR / name
    inside = target.parent == paths.PACKS_DIR and name.endswith(EXTENSION)
    return target if inside and target.is_file() else None


def _info(file: Path) -> Optional[dict]:
    stat = file.stat()
    cached = _read.get(file.name)
    if cached is not None and cached[:2] == (stat.st_mtime_ns, stat.st_size):
        return cached[2]
    try:
        info: Optional[dict] = read_pack(file.read_bytes())
    except (PackFormatError, OSError):
        info = None
    _read[file.name] = (stat.st_mtime_ns, stat.st_size, info)
    return info


def entries() -> list[dict]:
    listed = []
    for file in sorted(paths.PACKS_DIR.glob(f"*{EXTENSION}")):
        info = _info(file)
        if info is not None:
            listed.append({**info, "file": file.name, "size": file.stat().st_size})
    return listed


def _zipped(folder: Path) -> bytes:
    files = [path for path in sorted(folder.rglob("*")) if path.is_file()]
    for path in files:
        if path.stat().st_size > SCHEMA["maxFileBytes"]:
            raise PackFormatError("size", path.relative_to(folder).as_posix(), str(SCHEMA["maxFileBytes"]))
    if sum(path.stat().st_size for path in files) > SCHEMA["maxPackBytes"]:
        raise PackFormatError("size", folder.name, str(SCHEMA["maxPackBytes"]))
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(folder).as_posix())
    return buffer.getvalue()


def save(source: Path) -> dict:
    data = _zipped(source) if source.is_dir() else source.read_bytes()
    info = read_pack(data)
    target = paths.PACKS_DIR / f"{info['id']}{EXTENSION}"
    staged = target.with_suffix(f"{EXTENSION}.tmp")
    staged.write_bytes(data)
    os.replace(staged, target)
    return info


def remove(name: str) -> bool:
    target = file_of(name)
    if target is None:
        return False
    target.unlink()
    return True


def preview(name: str) -> Optional[tuple[bytes, str]]:
    target = file_of(name)
    if target is None:
        return None
    try:
        return preview_of(target.read_bytes())
    except PackFormatError:
        return None


def _snapshot(_path: str) -> dict:
    try:
        listed = entries()
    except OSError:
        listed = []
    return {"type": "snapshot", "packs": listed}


watch = DirectoryWatchHub(paths.PACKS_DIR, _snapshot)
