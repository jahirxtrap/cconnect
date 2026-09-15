"""Git operations the commit panel performs, on top of the single git runner."""

import re
import threading
from pathlib import Path
from typing import Optional

from services import git, project_files

_TIMEOUT = 30
_NETWORK_TIMEOUT = 300
_LOG_SUBJECTS = 15
_LOG_IDENTITIES = 50
_LOG_ENTRIES = 75
_DIFF_BUDGET = 60_000
_UNTRACKED_LINES = 40
_EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
_COMMIT_HASH = re.compile(r"[0-9a-fA-F]{4,40}")
_FIELD = "\x00"
_FIELD_FORMAT = "%x00"

_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def lock_for(repo: Path) -> threading.Lock:
    """One lock per repository, so a commit never lands mid-edit from another turn."""
    with _locks_guard:
        return _locks.setdefault(str(repo), threading.Lock())


def _read(repo: Path, *args: str, timeout: int = _TIMEOUT) -> Optional[str]:
    result = git.run(repo, *args, timeout=timeout)
    return result.stdout.strip() if result.returncode == 0 else None


def _write(repo: Path, *args: str, timeout: int = _TIMEOUT) -> dict:
    result = git.run(repo, *args, timeout=timeout, writes=True)
    return {
        "ok": result.returncode == 0,
        "output": (result.stdout + result.stderr).strip(),
    }


def _branch_state(repo: Path) -> dict:
    """Branch, upstream and ahead/behind from a single status call."""
    state = {"branch": "", "detached": False, "upstream": "", "ahead": 0, "behind": 0}
    reported = _read(repo, "status", "--porcelain=v2", "--branch")
    for line in (reported or "").splitlines():
        if not line.startswith("# branch."):
            continue
        field, _, value = line[len("# branch."):].partition(" ")
        if field == "head":
            state["detached"] = value == "(detached)"
            state["branch"] = "" if state["detached"] else value
        elif field == "upstream":
            state["upstream"] = value
        elif field == "ab":
            for part in value.split():
                if part.startswith("+"):
                    state["ahead"] = int(part[1:] or 0)
                elif part.startswith("-"):
                    state["behind"] = int(part[1:] or 0)
    return state


def repos(root: Path) -> list[dict]:
    """Every repository under a project root, with the state its header shows."""
    listed = []
    for repo in project_files._repos_under(root):
        state = _branch_state(repo)
        listed.append({
            "path": str(repo),
            "name": repo.name,
            "relative": _relative_root(root, repo),
            **state,
            "remote": "" if state["upstream"] else _first_remote(repo),
        })
    return listed


def _first_remote(repo: Path) -> str:
    listed = (_read(repo, "remote") or "").splitlines()
    return listed[0] if listed else ""


def _relative_root(root: Path, repo: Path) -> str:
    try:
        return repo.relative_to(root).as_posix()
    except ValueError:
        return ""


def resolve(root: Path, repo_path: str) -> Optional[Path]:
    """The repository a request names, rejected unless it is one this root owns."""
    wanted = Path(repo_path) if repo_path else None
    for repo in project_files._repos_under(root):
        if wanted is None or repo == wanted:
            return repo
    return None


def _untracked(repo: Path, paths: list[str]) -> list[str]:
    reported = _read(repo, "ls-files", "--others", "--exclude-standard", "--", *paths)
    return [line for line in (reported or "").splitlines() if line]


def identities(repo: Path) -> dict:
    """Who this repository commits as, and the alternatives worth offering."""
    scoped: dict[str, dict[str, str]] = {}
    for line in (_read(repo, "config", "--list", "--show-scope") or "").splitlines():
        scope, _, setting = line.partition("\t")
        key, _, value = setting.partition("=")
        if key in ("user.name", "user.email"):
            scoped.setdefault(scope, {})[key.split(".")[1]] = value
    merged: dict[str, str] = {}
    for scope in ("system", "global", "local", "worktree", "command"):
        merged.update(scoped.get(scope, {}))
    effective = {"name": merged.get("name", ""), "email": merged.get("email", "")}
    options = [effective] if effective["email"] else []
    globals_ = scoped.get("global", {})
    if globals_.get("email"):
        options.append({"name": globals_.get("name", ""), "email": globals_["email"]})
    reported = _read(repo, "log", f"-n{_LOG_IDENTITIES}", f"--format=%an{_FIELD_FORMAT}%ae")
    for line in (reported or "").splitlines():
        name, _, email = line.partition(_FIELD)
        if email:
            options.append({"name": name, "email": email})
    seen: dict[str, dict] = {}
    for option in options:
        seen.setdefault(option["email"].lower(), option)
    return {"effective": effective, "options": list(seen.values())}


def last_message(repo: Path) -> str:
    return _read(repo, "log", "-1", "--format=%B") or ""


def log(repo: Path, limit: int = _LOG_ENTRIES, before: str = "") -> list[dict]:
    """The commits behind HEAD, newest first, starting after the one named by `before`."""
    count = max(1, min(limit, _LOG_ENTRIES))
    fields = _FIELD_FORMAT.join(("%h", "%an", "%ct", "%s"))
    start = [f"{before}~1"] if _COMMIT_HASH.fullmatch(before) else []
    reported = _read(repo, "log", f"-n{count}", f"--format={fields}", *start)
    listed = []
    for line in (reported or "").splitlines():
        parts = line.split(_FIELD)
        if len(parts) != 4 or not parts[2].isdigit():
            continue
        listed.append({"hash": parts[0], "author": parts[1], "date": int(parts[2]), "subject": parts[3]})
    return listed


def subjects(repo: Path, skip: int = 0) -> list[str]:
    listed = log(repo, _LOG_SUBJECTS + skip)[skip:]
    return [entry["subject"] for entry in listed if entry["subject"]]


def _amend_base(repo: Path) -> str:
    return _read(repo, "rev-parse", "--verify", "--quiet", "HEAD~1") or _EMPTY_TREE


def _head_files(repo: Path) -> list[str]:
    reported = _read(repo, "show", "--pretty=", "--name-only", "HEAD")
    return [line for line in (reported or "").splitlines() if line]


def diff_context(repo: Path, paths: list[str], base: str = "HEAD") -> dict:
    """Everything a commit message can be written from, inside a size budget."""
    stat = _read(repo, "diff", "--stat", base, "--", *paths) or ""
    patch = _read(repo, "diff", base, "--", *paths) or ""
    truncated = len(patch) > _DIFF_BUDGET
    if truncated:
        patch = patch[:_DIFF_BUDGET].rsplit("\n", 1)[0]
    added = []
    for path in _untracked(repo, paths):
        try:
            lines = (repo / path).read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        added.append({"path": path, "head": lines[:_UNTRACKED_LINES], "more": len(lines) > _UNTRACKED_LINES})
    return {"stat": stat, "patch": patch, "truncated": truncated, "added": added}


def message_context(repo: Path, paths: list[str], note: str = "", amend: bool = False) -> str:
    """The prompt a commit subject is written from: recent style, then what changed."""
    branch = _read(repo, "rev-parse", "--abbrev-ref", "HEAD") or ""
    targets = sorted(set(paths) | set(_head_files(repo))) if amend else paths
    context = diff_context(repo, targets, _amend_base(repo) if amend else "HEAD")
    sections = [f"Repository: {repo.name}", f"Branch: {branch}"]
    recent = subjects(repo, skip=1 if amend else 0)
    if recent:
        sections.append("Recent subjects in this repository:\n" + "\n".join(f"- {line}" for line in recent))
    if amend:
        current = last_message(repo).strip()
        sections.append(f"Current message being rewritten:\n{current or '(none)'}")
    if note:
        sections.append(f"What was asked for:\n{note}")
    sections.append("Files changed:\n" + (context["stat"] or "(none)"))
    for entry in context["added"]:
        head = "\n".join(entry["head"])
        tail = "\n(truncated)" if entry["more"] else ""
        sections.append(f"New file {entry['path']}:\n{head}{tail}")
    if context["patch"]:
        cut = "\n(diff truncated)" if context["truncated"] else ""
        sections.append(f"Diff:\n{context['patch']}{cut}")
    return "\n\n".join(sections)


def commit(repo: Path, paths: list[str], message: str, author: str = "", amend: bool = False) -> dict:
    """Commit exactly the paths given, leaving the index alone for everything else."""
    with lock_for(repo):
        new = _untracked(repo, paths) if paths else []
        if new:
            staged = _write(repo, "add", "--", *new)
            if not staged["ok"]:
                return staged
        args = ["commit", "-m", message]
        if amend:
            args.append("--amend")
        if author:
            args += [f"--author={author}"]
        if paths:
            args += ["--", *paths]
        elif amend:
            args.append("--only")
        result = _write(repo, *args)
    if result["ok"]:
        result["head"] = _read(repo, "log", "-1", f"--format=%h{_FIELD_FORMAT}%s") or ""
    return result


def revert(repo: Path, paths: list[str]) -> dict:
    """Throw the working-tree changes away: tracked paths back to HEAD, new files removed."""
    with lock_for(repo):
        new = _untracked(repo, paths)
        tracked = [path for path in paths if path not in new]
        if tracked:
            restored = _write(repo, "restore", "--staged", "--worktree", "--", *tracked)
            if not restored["ok"]:
                return restored
        if new:
            return _write(repo, "clean", "-f", "--", *new)
        return {"ok": True, "output": ""}


def pull(repo: Path) -> dict:
    with lock_for(repo):
        return _write(repo, "pull", "--ff-only", timeout=_NETWORK_TIMEOUT)


def push(repo: Path, force: bool = False, upstream: bool = False) -> dict:
    args = ["push"]
    if force:
        args.append("--force-with-lease")
    if upstream:
        branch = _read(repo, "rev-parse", "--abbrev-ref", "HEAD") or ""
        remote = (_read(repo, "remote") or "").splitlines()
        if not branch or not remote:
            return {"ok": False, "output": "no remote to publish the branch to"}
        args += ["--set-upstream", remote[0], branch]
    with lock_for(repo):
        return _write(repo, *args, timeout=_NETWORK_TIMEOUT)
