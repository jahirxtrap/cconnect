"""Read-only browsing of a project's working directory, filtered by what git tracks."""

import re
import subprocess
from pathlib import Path
from typing import Optional

from loguru import logger

from services import chat_list, files, git

_GIT_TIMEOUT = 30
_SEARCH_LIMIT = 200
_CONTIGUOUS_BONUS = 4
_NAME_BONUS = 200
_HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))?")

_repos: dict[str, Optional[Path]] = {}
_indexes: dict[str, Optional[set[str]]] = {}
_statuses: dict[str, dict[str, str]] = {}


def root_for(project_key: str) -> Optional[Path]:
    entry = next(
        (item for item in chat_list.hub.projects() if item["project_key"] == project_key), None
    )
    path = Path(entry["path"]).expanduser() if entry and entry.get("path") else None
    return path if path and path.is_dir() else None


def repo_of(folder: Path) -> Optional[Path]:
    """The repository a folder belongs to, walked up without spawning git."""
    key = str(folder)
    if key in _repos:
        return _repos[key]
    current = folder
    found: Optional[Path] = None
    while True:
        if (current / ".git").exists():
            found = current
            break
        if current.parent == current:
            break
        current = current.parent
    _repos[key] = found
    return found


def _git(root: Path, *args: str) -> Optional[str]:
    try:
        result = git.run(root, *args, timeout=_GIT_TIMEOUT)
    except (OSError, subprocess.SubprocessError) as exc:
        logger.debug(f"git {args[0]} in {root} failed: {type(exc).__name__}: {exc}")
        return None
    return result.stdout if result.returncode == 0 else None


def _build_index(repo: Path) -> Optional[set[str]]:
    listed = _git(repo, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    if listed is None:
        return None
    tracked = {path for path in listed.split("\0") if path}
    for path in list(tracked):
        parent = path.rpartition("/")[0]
        while parent:
            tracked.add(f"{parent}/")
            parent = parent.rpartition("/")[0]
    return tracked


def index_of(repo: Path) -> Optional[set[str]]:
    key = str(repo)
    if key not in _indexes:
        _indexes[key] = _build_index(repo)
    return _indexes[key]


def _build_status(repo: Path) -> dict[str, str]:
    reported = _git(repo, "status", "--porcelain", "-z")
    if not reported:
        return {}
    status: dict[str, str] = {}
    skip = False
    for field in (item for item in reported.split("\0") if item):
        if skip:
            skip = False
            continue
        code, path = field[:2], field[3:]
        if not path:
            continue
        status[path] = code.strip() or code
        skip = code.startswith("R") or code.startswith("C")
    return status


def statuses(repo: Path) -> dict[str, str]:
    key = str(repo)
    if key not in _statuses:
        _statuses[key] = _build_status(repo)
    return _statuses[key]


def _relative(base: Path, path: Path) -> str:
    return "" if path == base else path.relative_to(base).as_posix()


def _tracked(index: Optional[set[str]], relpath: str, is_dir: bool) -> bool:
    return index is not None and (f"{relpath}/" in index if is_dir else relpath in index)


def _visible(index: Optional[set[str]], relpath: str, name: str, is_dir: bool, unlocked: bool) -> bool:
    """Ignored entries need the key; with no repo to ask, the dot convention takes over."""
    if unlocked:
        return True
    if index is None:
        return not name.startswith(".")
    return _tracked(index, relpath, is_dir)


def _children(folder: Path, repo: Optional[Path], index, unlocked: bool) -> list[Path]:
    listed = []
    for child in folder.iterdir():
        try:
            inside = _relative(repo, child) if repo else ""
            if _visible(index, inside, child.name, child.is_dir(), unlocked):
                listed.append(child)
        except OSError:
            continue
    return listed


def _compact(folder: Path, repo: Optional[Path], index, unlocked: bool) -> tuple[str, Path]:
    """A chain of folders holding nothing but one folder reads as one row, like an IDE."""
    name = folder.name
    current = folder
    while True:
        try:
            inner = _children(current, repo, index, unlocked)
        except OSError:
            break
        if len(inner) != 1 or not inner[0].is_dir():
            break
        current = inner[0]
        name = f"{name}/{current.name}"
    return name, current


def listing(root: Path, relpath: str = "", unlocked: bool = False) -> dict:
    target = files.resolve(root, relpath)
    if not target.is_dir():
        raise ValueError("not a directory")
    repo = repo_of(target)
    index = index_of(repo) if repo else None
    marks = statuses(repo) if repo else {}
    entries = []
    for child in _children(target, repo, index, unlocked):
        try:
            is_dir = child.is_dir()
            name, deepest = _compact(child, repo, index, unlocked) if is_dir else (child.name, child)
            inside = _relative(repo, deepest) if repo else ""
            entries.append({
                **files.entry(deepest, deepest.stat(), is_dir, name),
                "path": _relative(root, deepest),
                "status": marks.get(inside, ""),
                "ignored": index is not None and not _tracked(index, inside, is_dir),
                "repo": is_dir and (deepest / ".git").exists(),
            })
        except OSError:
            continue
    entries.sort(key=lambda item: (not item["is_dir"], item["name"].lower()))
    return {
        "path": _relative(root, target),
        "entries": entries,
        "tracked": repo_of(root) is not None,
        "unlocked": unlocked,
    }


def _match(path: str, needle: str, at: int) -> Optional[tuple[int, int]]:
    score = 0
    streak = 0
    start = -1
    for wanted in needle:
        found = path.find(wanted, at)
        if found < 0:
            return None
        if start < 0:
            start = found
        streak = streak + 1 if found == at else 0
        score += _CONTIGUOUS_BONUS * streak - (found - at)
        at = found + 1
    return score, start


def _score(path: str, needle: str) -> Optional[int]:
    name_at = path.rfind("/") + 1
    best: Optional[int] = None
    for offset in {0, name_at}:
        found = _match(path, needle, offset)
        if found is None:
            continue
        score, start = found
        if start >= name_at:
            score += _NAME_BONUS * (2 if start == name_at else 1)
        best = score if best is None else max(best, score)
    return None if best is None else best - len(path)


def search(root: Path, query: str, limit: int = _SEARCH_LIMIT) -> list[dict]:
    needle = query.strip().lower()
    repo = repo_of(root)
    index = index_of(repo) if repo else None
    if not needle or index is None:
        return []
    marks = statuses(repo)
    scored = []
    for path in index:
        if path.endswith("/"):
            continue
        score = _score(path.lower(), needle)
        if score is not None:
            scored.append((score, path))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [
        {"name": path.rpartition("/")[2], "path": path, "status": marks.get(path, "")}
        for _, path in scored[:limit]
    ]


def _repos_under(root: Path) -> list[Path]:
    """The project's own repository, or the ones its children hold when it is just a folder."""
    repo = repo_of(root)
    if repo is not None:
        return [repo]
    try:
        return [child for child in root.iterdir() if child.is_dir() and (child / ".git").exists()]
    except OSError:
        return []


def changes(root: Path) -> list[dict]:
    listed = []
    for repo in _repos_under(root):
        for path, status in statuses(repo).items():
            absolute = repo / path
            try:
                relative = absolute.relative_to(root).as_posix()
            except ValueError:
                continue
            listed.append({
                "name": absolute.name,
                "path": relative,
                "status": status,
                "repo_root": str(repo),
                "repo_path": path,
            })
    listed.sort(key=lambda item: item["path"].lower())
    return listed


def resolve_file(root: Path, relpath: str, unlocked: bool = False) -> Optional[Path]:
    path = files.resolve(root, relpath)
    if not path.is_file():
        return None
    repo = repo_of(path.parent)
    index = index_of(repo) if repo else None
    inside = _relative(repo, path) if repo else ""
    if not _visible(index, inside, path.name, False, unlocked):
        return None
    return path


def diff(root: Path, relpath: str) -> dict:
    """Which lines of the file on disk are new, and what was removed just before each one."""
    path = files.resolve(root, relpath)
    repo = repo_of(path.parent)
    if repo is None or not path.is_file():
        return {"added": [], "removed": {}}
    reported = _git(repo, "diff", "--unified=0", "HEAD", "--", _relative(repo, path))
    added: list[int] = []
    removed: dict[int, list[str]] = {}
    at = 0
    for line in (reported or "").splitlines():
        header = _HUNK.match(line)
        if header:
            start, length = header.groups()
            at = int(start) + (1 if length == "0" else 0)
            continue
        if not at:
            continue
        if line.startswith("+"):
            added.append(at)
            at += 1
        elif line.startswith("-"):
            removed.setdefault(at, []).append(line[1:])
        elif line.startswith(" "):
            at += 1
    return {"added": added, "removed": {str(key): value for key, value in removed.items()}}


def invalidate() -> None:
    _repos.clear()
    _indexes.clear()
    _statuses.clear()
