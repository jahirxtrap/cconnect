"""File serving from the shared drop folder (PC <-> phone), with subfolders."""

import shutil
import subprocess
import tarfile
import tempfile
import time
import zipfile
from contextlib import suppress
from pathlib import Path
from typing import Optional

from core import paths
from services import files, shared_links

try:
    import py7zr
except ImportError:
    py7zr = None
try:
    import rarfile
    if not shutil.which("unrar"):
        for _cand in (r"C:\Program Files\WinRAR\UnRAR.exe", r"C:\Program Files (x86)\WinRAR\UnRAR.exe"):
            if Path(_cand).exists():
                rarfile.UNRAR_TOOL = _cand
                break
except ImportError:
    rarfile = None

COMPRESS_FORMATS = {"zip": ".zip", "7z": ".7z", "rar": ".rar", "tar.gz": ".tar.gz", "tar.xz": ".tar.xz"}
_ARCHIVE_SUFFIXES = (".zip", ".7z", ".rar", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz")


def _base() -> Path:
    paths.SHARED_DIR.mkdir(parents=True, exist_ok=True)
    return paths.SHARED_DIR


def project_dir(project_key: str) -> Path:
    """Where a project's shared files live; the root itself when there is no project."""
    base = _base()
    if not project_key:
        return base
    target = base / project_key
    target.mkdir(parents=True, exist_ok=True)
    return target


def _resolve(relpath: str) -> Path:
    return files.resolve(_base(), relpath)


def _entry_for(path: Path) -> dict:
    if not shared_links.is_link(path.name):
        return {**files.entry(path, path.stat(), path.is_dir()), "file": path.name}
    target = shared_links.target_of(path)
    name = shared_links.visible_name(path.name)
    reachable = target.is_file() if target else False
    stat = target.stat() if reachable else path.stat()
    return {
        **files.entry(path, stat, False, name),
        "size": stat.st_size if reachable else 0,
        "file": path.name,
        "link": str(target) if target else "",
        "missing": not reachable,
    }


def outside(path: Path) -> bool:
    root = _base().resolve()
    return path.resolve() != root and root not in path.resolve().parents


def content_path(path: Path) -> Path:
    """What a path holds: the file a reference points at, or the reference itself when it is broken."""
    if not shared_links.is_link(path.name):
        return path
    target = shared_links.target_of(path)
    return target if target and target.is_file() else path


def list_entries(relpath: str = "") -> list[dict]:
    target = _resolve(relpath)
    if not target.is_dir():
        raise ValueError("not a directory")
    entries = [_entry_for(e) for e in target.iterdir() if not e.name.startswith(".")]
    entries.sort(key=lambda f: (not f["is_dir"], -f["modified"]))
    return entries


def resolve_file(relpath: str) -> Optional[Path]:
    path = _resolve(relpath)
    if not path.is_file():
        return None
    return content_path(path)


def visible_of(relpath: str) -> str:
    return shared_links.visible_name(_resolve(relpath).name)


def absolute_paths(relpaths: list[str]) -> list[str]:
    return [str(content_path(_resolve(rel))) for rel in relpaths]


def create_link(source: str, dest: str = "", name: str = "", replace: bool = False) -> str:
    """Point at a file from the shared folder instead of copying it in."""
    origin = Path(source).expanduser()
    if not origin.is_file():
        raise ValueError("no such file")
    dest_dir = _resolve(dest)
    dest_dir.mkdir(parents=True, exist_ok=True)
    if not dest_dir.is_dir():
        raise ValueError("destination is not a folder")
    shown = shared_links.visible_name(name.strip() or origin.name)
    if not replace:
        target = _dedup_target(dest_dir, shared_links.link_name(shown))
    else:
        taken = _occupied(dest_dir, shown)
        if taken is not None and not taken.is_dir():
            taken.unlink()
        target = dest_dir / shared_links.link_name(shown)
    shared_links.write(target, origin.resolve())
    return target.relative_to(_base().resolve()).as_posix()


def materialize(relpath: str) -> Optional[str]:
    """Turn a reference into a real copy, under the name it was showing."""
    path = _resolve(relpath)
    if not path.is_file() or not shared_links.is_link(path.name):
        return None
    origin = shared_links.target_of(path)
    if origin is None or not origin.is_file():
        raise ValueError("the file it points at is gone")
    target = _dedup_target(path.parent, shared_links.visible_name(path.name))
    shutil.copy2(origin, target)
    path.unlink(missing_ok=True)
    return target.relative_to(_base().resolve()).as_posix()


async def save_upload(relpath: str, chunks, policy: str = "keep") -> str:
    path = _resolve(relpath)
    if path == _base().resolve() or path.is_dir():
        raise ValueError("invalid destination")
    path.parent.mkdir(parents=True, exist_ok=True)
    taken = _occupied(path.parent, path.name)
    if policy == "replace" and taken is not None:
        taken.unlink()
    elif policy == "skip" and taken is not None:
        return taken.relative_to(_base().resolve()).as_posix()
    path = _reserve_target(path.parent, path.name)
    tmp = path.parent / f".{path.name}.part"
    try:
        with tmp.open("wb") as fh:
            async for chunk in chunks:
                fh.write(chunk)
        tmp.replace(path)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    finally:
        tmp.unlink(missing_ok=True)
    return path.relative_to(_base().resolve()).as_posix()


def create_folder(relpath: str) -> None:
    path = _resolve(relpath)
    if path == _base().resolve():
        raise ValueError("invalid folder name")
    if _occupied(path.parent, path.name) is not None:
        raise ValueError("already exists")
    path.mkdir(parents=True)


def rename_entry(relpath: str, new_name: str) -> bool:
    shown = shared_links.visible_name(new_name)
    if not shown or "/" in shown or "\\" in shown or shown.startswith("."):
        raise ValueError("invalid name")
    path = _resolve(relpath)
    if path == _base().resolve():
        raise ValueError("cannot rename the shared root")
    if not path.exists():
        return False
    taken = _occupied(path.parent, shown)
    if taken is not None and taken != path:
        raise ValueError("already exists")
    path.rename(path.with_name(shared_links.link_name(shown) if shared_links.is_link(path.name) else shown))
    return True


def _candidates(dest_dir: Path, name: str):
    parsed = Path(name)
    stem, suffix = parsed.stem, parsed.suffix
    yield dest_dir / name
    index = 1
    while True:
        yield dest_dir / f"{stem} ({index}){suffix}"
        index += 1


def _occupied(dest_dir: Path, name: str) -> Optional[Path]:
    """Whatever already answers to a name, in whichever of its two forms is on disk."""
    shown = shared_links.visible_name(name)
    for candidate in (dest_dir / shown, dest_dir / shared_links.link_name(shown)):
        if candidate.exists():
            return candidate
    return None


def _dedup_target(dest_dir: Path, name: str) -> Path:
    free = next(c for c in _candidates(dest_dir, shared_links.visible_name(name)) if _occupied(dest_dir, c.name) is None)
    return free.with_name(shared_links.link_name(free.name)) if shared_links.is_link(name) else free


def _reserve_target(dest_dir: Path, name: str) -> Path:
    for target in _candidates(dest_dir, name):
        if _occupied(dest_dir, target.name) is not None:
            continue
        try:
            target.touch(exist_ok=False)
            return target
        except FileExistsError:
            continue
    raise ValueError("no destination available")


def _resolve_transfer(relpaths: list[str], dest: str) -> tuple[list[Path], Path]:
    dest_dir = _resolve(dest)
    if not dest_dir.is_dir():
        raise ValueError("destination is not a folder")
    sources = []
    for rel in relpaths:
        src = _resolve(rel)
        if src == _base().resolve():
            raise ValueError("cannot transfer the shared root")
        if not src.exists():
            continue
        if src.is_dir() and (dest_dir == src or src in dest_dir.parents):
            raise ValueError("cannot transfer a folder into itself")
        sources.append(src)
    return sources, dest_dir


def _clashes(src: Path, dest_dir: Path, prefix: str = "") -> list[str]:
    """Files that already exist at the destination; folders merge instead of clashing."""
    label = f"{prefix}{shared_links.visible_name(src.name)}"
    taken = _occupied(dest_dir, src.name)
    if not src.is_dir() or taken is None or not taken.is_dir():
        return [label] if taken is not None else []
    found: list[str] = []
    for child in src.iterdir():
        found.extend(_clashes(child, taken, f"{label}/"))
    return found


def transfer_clashes(relpaths: list[str], dest: str) -> list[str]:
    sources, dest_dir = _resolve_transfer(relpaths, dest)
    found: list[str] = []
    for src in sources:
        if src.parent == dest_dir:
            continue
        found.extend(_clashes(src, dest_dir))
    return found


def _place(src: Path, dest_dir: Path, policy: str, move: bool) -> bool:
    target = dest_dir / src.name

    if src.is_dir() and target.is_dir():
        for child in list(src.iterdir()):
            _place(child, target, policy, move)
        if move:
            with suppress(OSError):
                src.rmdir()
        return True

    taken = _occupied(dest_dir, src.name)
    if taken is not None:
        if policy == "skip":
            return False
        if policy == "replace":
            if taken.is_dir():
                shutil.rmtree(taken)
            else:
                taken.unlink()
        else:
            target = _dedup_target(dest_dir, src.name)

    if move:
        shutil.move(str(src), str(target))
    elif src.is_dir():
        shutil.copytree(src, target)
    else:
        shutil.copy2(src, target)
    return True


def move_entries(relpaths: list[str], dest: str, policy: str = "keep") -> int:
    sources, dest_dir = _resolve_transfer(relpaths, dest)
    moved = 0
    for src in sources:
        if src.parent == dest_dir:
            continue
        if _place(src, dest_dir, policy, move=True):
            moved += 1
    return moved


def copy_entries(relpaths: list[str], dest: str, policy: str = "keep") -> int:
    sources, dest_dir = _resolve_transfer(relpaths, dest)
    copied = 0
    for src in sources:
        if _place(src, dest_dir, policy, move=False):
            copied += 1
    return copied


def delete_entry(relpath: str) -> bool:
    path = _resolve(relpath)
    if path == _base().resolve():
        raise ValueError("cannot delete the shared root")
    if path.is_dir():
        shutil.rmtree(path)
        return True
    if path.is_file():
        path.unlink()
        return True
    return False


def archive_kind(name: str) -> Optional[str]:
    low = name.lower()
    if low.endswith(".zip"):
        return "zip"
    if low.endswith(".7z"):
        return "7z"
    if low.endswith(".rar"):
        return "rar"
    if low.endswith((".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz")):
        return "tar"
    return None


def _archive_stem(name: str) -> str:
    low = name.lower()
    for suffix in sorted(_ARCHIVE_SUFFIXES, key=len, reverse=True):
        if low.endswith(suffix):
            return name[: -len(suffix)]
    return Path(name).stem


def _rar_tool() -> Optional[str]:
    tool = shutil.which("rar")
    if tool:
        return tool
    candidates = (r"C:\Program Files\WinRAR\Rar.exe", r"C:\Program Files (x86)\WinRAR\Rar.exe")
    return next((c for c in candidates if Path(c).exists()), None)


def capabilities() -> dict:
    formats = ["zip"]
    if py7zr is not None:
        formats.append("7z")
    if _rar_tool() is not None:
        formats.append("rar")
    formats += ["tar.gz", "tar.xz"]
    return {"compress_formats": formats}


def _staged(src: Path, dest: Path) -> Path:
    """A file under the name the archive has to store it with, without copying when the volume allows it."""
    try:
        dest.hardlink_to(src)
    except OSError:
        shutil.copy2(src, dest)
    return dest


def compress_entries(relpaths: list[str], fmt: str = "zip", name: Optional[str] = None) -> Optional[str]:
    if fmt not in COMPRESS_FORMATS:
        raise ValueError("unsupported format")
    if fmt == "7z" and py7zr is None:
        raise ValueError("7z support is not installed")
    if fmt == "rar" and _rar_tool() is None:
        raise ValueError("rar compression requires the rar CLI (RARLAB)")
    sources = [p for p in (_resolve(rel) for rel in relpaths) if p.exists() and p != _base().resolve()]
    if not sources:
        return None
    base_name = (name or "").strip()
    if "/" in base_name or "\\" in base_name or base_name.startswith("."):
        raise ValueError("invalid name")
    parent = sources[0].parent
    packed = [(content_path(src), shared_links.visible_name(src.name)) for src in sources]
    if not base_name:
        base_name = Path(packed[0][1]).stem if len(sources) == 1 else parent.name or "shared"
    target = _dedup_target(parent, base_name + COMPRESS_FORMATS[fmt])
    if fmt == "zip":
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
            for src, arcname in packed:
                if src.is_dir():
                    for child in sorted(src.rglob("*")):
                        if child.is_file():
                            archive.write(child, Path(arcname) / child.relative_to(src))
                else:
                    archive.write(src, arcname)
    elif fmt == "7z":
        with py7zr.SevenZipFile(target, "w") as archive:
            for src, arcname in packed:
                if src.is_dir():
                    archive.writeall(src, arcname)
                else:
                    archive.write(src, arcname)
    elif fmt == "rar":
        with tempfile.TemporaryDirectory(dir=str(parent), prefix=".rar-", ignore_cleanup_errors=True) as staging:
            listed = [
                _staged(src, Path(staging) / arcname) if src.name != arcname else src
                for src, arcname in packed
            ]
            result = subprocess.run(
                [_rar_tool(), "a", "-ep1", "-idq", str(target), *[str(item) for item in listed]],
                cwd=str(parent), capture_output=True, text=True,
            )
        if result.returncode != 0:
            target.unlink(missing_ok=True)
            raise ValueError(f"rar failed: {result.stderr.strip() or result.returncode}")
    else:
        with tarfile.open(target, "w:gz" if fmt == "tar.gz" else "w:xz") as archive:
            for src, arcname in packed:
                archive.add(src, arcname=arcname)
    return str(target.relative_to(_base().resolve())).replace("\\", "/")


def _archive_members(src: Path, kind: str) -> list[tuple[str, bool, int, float]]:
    members: list[tuple[str, bool, int, float]] = []
    if kind == "zip" or kind == "rar":
        if kind == "rar" and rarfile is None:
            raise ValueError("rar support is not installed")
        opener = zipfile.ZipFile if kind == "zip" else rarfile.RarFile
        with opener(src) as archive:
            for info in archive.infolist():
                mtime = time.mktime(info.date_time + (0, 0, -1)) if info.date_time else 0.0
                members.append((info.filename.replace("\\", "/").strip("/"), info.is_dir(), info.file_size or 0, mtime))
    elif kind == "tar":
        with tarfile.open(src) as archive:
            for info in archive.getmembers():
                if info.isfile() or info.isdir():
                    members.append((info.name.lstrip("./").strip("/"), info.isdir(), info.size, float(info.mtime)))
    elif kind == "7z":
        if py7zr is None:
            raise ValueError("7z support is not installed")
        with py7zr.SevenZipFile(src) as archive:
            for info in archive.list():
                mtime = info.creationtime.timestamp() if info.creationtime else 0.0
                members.append((info.filename.replace("\\", "/").strip("/"), info.is_directory, info.uncompressed or 0, mtime))
    return [m for m in members if m[0]]


def archive_entries(relpath: str, inner: str = "") -> list[dict]:
    src = content_path(_resolve(relpath))
    kind = archive_kind(src.name) if src.is_file() else None
    if kind is None:
        raise ValueError("not a supported archive")
    prefix = inner.strip("/")
    prefix = f"{prefix}/" if prefix else ""
    children: dict[str, dict] = {}
    counts: dict[str, set] = {}
    for path, is_dir, size, mtime in _archive_members(src, kind):
        if not path.startswith(prefix) or path == prefix.rstrip("/"):
            continue
        head, sep, tail = path[len(prefix):].partition("/")
        if not head:
            continue
        if sep or is_dir:
            entry = children.setdefault(head, {"name": head, "is_dir": True, "size": 0, "modified": 0.0, "items": 0})
            entry["modified"] = max(entry["modified"], mtime)
            if sep and tail:
                counts.setdefault(head, set()).add(tail.split("/", 1)[0])
        else:
            children[head] = {"name": head, "is_dir": False, "size": size, "modified": mtime, "items": None}
    for name, kids in counts.items():
        children[name]["items"] = len(kids)
    entries = sorted(children.values(), key=lambda f: (not f["is_dir"], -f["modified"]))
    return entries


def archive_member_stream(relpath: str, inner: str):
    src = content_path(_resolve(relpath))
    kind = archive_kind(src.name) if src.is_file() else None
    if kind is None:
        return None
    target = inner.strip("/")
    match = next((m for m in _archive_members(src, kind) if m[0] == target and not m[1]), None)
    if match is None:
        return None

    def chunks():
        if kind == "zip" or kind == "rar":
            opener = zipfile.ZipFile if kind == "zip" else rarfile.RarFile
            with opener(src) as archive:
                inner_name = next(i.filename for i in archive.infolist() if i.filename.replace("\\", "/").strip("/") == target)
                with archive.open(inner_name) as fh:
                    while chunk := fh.read(64 * 1024):
                        yield chunk
        elif kind == "tar":
            with tarfile.open(src) as archive:
                info = next(i for i in archive.getmembers() if i.name.lstrip("./").strip("/") == target)
                fh = archive.extractfile(info)
                while chunk := fh.read(64 * 1024):
                    yield chunk
        else:
            with py7zr.SevenZipFile(src) as archive:
                inner_name = next(i.filename for i in archive.list() if i.filename.replace("\\", "/").strip("/") == target)
                buffer = archive.read([inner_name])[inner_name]
                while chunk := buffer.read(64 * 1024):
                    yield chunk

    return chunks(), Path(target).name, match[2] or None


def extract_entry(
    relpath: str,
    dest: Optional[str] = None,
    into_folder: bool = True,
    members: Optional[list[str]] = None,
    base: str = "",
) -> Optional[str]:
    entry = _resolve(relpath)
    src = content_path(entry)
    kind = archive_kind(src.name) if src.is_file() else None
    if kind is None:
        return None
    dest_dir = _resolve(dest) if dest else entry.parent
    if not dest_dir.is_dir():
        raise ValueError("destination is not a folder")
    out = dest_dir
    if into_folder:
        out = _dedup_target(dest_dir, _archive_stem(shared_links.visible_name(entry.name)) or "extracted")
        out.mkdir(parents=True)
    out_res = out.resolve()
    base_prefix = base.strip("/")
    base_prefix = f"{base_prefix}/" if base_prefix else ""
    selected = [m.strip("/") for m in members if m.strip("/")] if members else None

    def wanted(path: str) -> bool:
        return selected is None or any(path == s or path.startswith(f"{s}/") for s in selected)

    def out_path(path: str, is_dir: bool) -> Optional[Path]:
        rel = path[len(base_prefix):] if base_prefix and path.startswith(base_prefix) else path
        target = out / rel
        if not target.resolve().is_relative_to(out_res):
            return None
        if not is_dir and target.exists():
            target = _dedup_target(target.parent, target.name)
        return target

    def place(path: str, is_dir: bool, opener) -> None:
        target = out_path(path, is_dir)
        if target is None:
            return
        if is_dir:
            target.mkdir(parents=True, exist_ok=True)
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        with opener() as fh, target.open("wb") as o:
            shutil.copyfileobj(fh, o)

    if kind == "zip" or kind == "rar":
        if kind == "rar" and rarfile is None:
            raise ValueError("rar support is not installed")
        opener = zipfile.ZipFile if kind == "zip" else rarfile.RarFile
        with opener(src) as archive:
            for info in archive.infolist():
                path = info.filename.replace("\\", "/").strip("/")
                if path and wanted(path):
                    place(path, info.is_dir(), lambda i=info: archive.open(i))
    elif kind == "tar":
        with tarfile.open(src) as archive:
            for info in archive.getmembers():
                path = info.name.lstrip("./").strip("/")
                if path and wanted(path) and (info.isfile() or info.isdir()):
                    place(path, info.isdir(), lambda i=info: archive.extractfile(i))
    else:
        if py7zr is None:
            raise ValueError("7z support is not installed")
        with py7zr.SevenZipFile(src) as archive:
            names = [i.filename for i in archive.list()]
            targets = [n for n in names if wanted(n.replace("\\", "/").strip("/"))] if selected else None
            with tempfile.TemporaryDirectory(dir=str(dest_dir)) as tmp:
                if targets is None:
                    archive.extractall(path=tmp)
                else:
                    archive.extract(path=tmp, targets=targets)
                for child in sorted(Path(tmp).rglob("*")):
                    rel = child.relative_to(tmp).as_posix()
                    target = out_path(rel, child.is_dir())
                    if target is None:
                        continue
                    if child.is_dir():
                        target.mkdir(parents=True, exist_ok=True)
                    else:
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(child), str(target))
    return str(out.relative_to(_base().resolve())).replace("\\", "/") or "/"


def search_entries(relpath: str, query: str, limit: int = 200) -> list[dict]:
    base = _resolve(relpath)
    needle = query.strip().lower()
    if not base.is_dir() or not needle:
        return []
    results = []
    for child in sorted(base.rglob("*")):
        if needle not in shared_links.visible_name(child.name).lower():
            continue
        relative = str(child.relative_to(base)).replace("\\", "/")
        results.append({**_entry_for(child), "name": shared_links.visible_name(relative), "file": relative})
        if len(results) >= limit:
            break
    return results
