"""Handing a file to the user: puts it in the folder this backend serves and links it."""

import shutil
from pathlib import Path
from urllib.parse import quote

from core.config import SHARED_SCHEME
from mcps.definition import Definition, reply
from services import sessions, shared, shared_links

TOOL = "share_files"

SHARE_FILES = Definition(
    TOOL,
    "Give the user a file to download. Pass the paths of files you already wrote and this "
    "copies them into the folder this backend serves, then answers with a ready link for "
    "each one. Use it whenever the user asks you to share, send, export or pass them "
    "something, and quote the links it returns instead of writing any path yourself. "
    "One call takes every file you are handing over, however many there are: splitting "
    "them across calls only litters the chat with repeated blocks. "
    "Set link for a big file or one that lives in the project: it is referenced where it "
    "is instead of copied, and the user sees it marked as a reference.",
    {
        "type": "object",
        "properties": {
            "paths": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Files to hand over, by absolute path.",
            },
            "name": {
                "type": "string",
                "description": "Name it takes in the folder. Only with a single file.",
            },
            "link": {
                "type": "boolean",
                "description": "Reference the files where they are instead of copying them.",
            },
        },
        "required": ["paths"],
    },
    eager=True,
)


def _link(project_key: str, filename: str) -> str:
    segment = f"/{quote(project_key)}" if project_key else ""
    return f"{SHARED_SCHEME}{segment}/{quote(filename)}"


def listing(args: dict, project_key: str) -> list[dict]:
    """The files a call hands over, read from its arguments alone."""
    wanted = [str(item) for item in (args.get("paths") or []) if str(item).strip()]
    rename = (args.get("name") or "").strip() if len(wanted) == 1 else ""
    linked = args.get("link") is True
    entries = []
    for item in wanted:
        shown = rename or Path(item).name
        if linked:
            shown = shared_links.visible_name(shown)
        entries.append({"name": shown, "url": _link(project_key, shared_links.link_name(shown) if linked else shown)})
    return entries


def needs_key(name: str, args: dict) -> bool:
    return name == TOOL and args.get("link") is True


def make_tools(context: dict) -> list:
    session_info = context.get("session_info")
    emit = context.get("emit")

    @SHARE_FILES
    async def share_files(args):
        wanted = [str(item) for item in (args.get("paths") or []) if str(item).strip()]
        if not wanted:
            return reply("Pass the path of at least one file.")
        rename = (args.get("name") or "").strip()
        if rename and len(wanted) > 1:
            return reply("A name can only be given when sharing a single file.")

        cwd = (session_info() or {}).get("cwd") if session_info else None
        project_key = sessions.project_key_for(cwd) if cwd else ""
        folder = shared.project_dir(project_key)
        linked = args.get("link") is True
        delivered = listing(args, project_key)
        for item, handed in zip(wanted, delivered):
            source = Path(item).expanduser()
            if not source.is_absolute() and cwd:
                source = Path(cwd, source)
            if not source.is_file():
                return reply(f"{source} is not a file that exists.")
            if linked:
                shared.create_link(str(source), project_key, handed["name"], replace=True)
                continue
            target = folder / handed["name"]
            if target.resolve() != source.resolve():
                shutil.copy2(source, target)

        if emit is not None:
            await emit({"type": "shared", "files": delivered})
        listed = "\n".join(f"{item['name']}: {item['url']}" for item in delivered)
        return reply(f"Shared, and already shown to the user:\n{listed}")

    return [share_files]
