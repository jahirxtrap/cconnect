import asyncio
import json
import shutil
from pathlib import Path

from claude_agent_sdk import tool

from mcps.shared_files import listing
from services import packs, sessions, shared
from services.pack_format import EXTENSION, KNOWN_SYNTAX, KNOWN_THEMES, MANIFEST, SCHEMA, PackFormatError

TOOL = "packs"

_EFFECTS = ", ".join(f"{name} {limits['min']}-{limits['max']}" for name, limits in SCHEMA["backgroundEffects"].items())

DESCRIPTION = (
    "Make and manage CConnect packs: themes, syntax highlighting, terminal colors, accent colors, fonts and chat "
    "backgrounds the app installs from one .ccpack file. guide returns the whole pack format with an example: call "
    "it before writing a pack. save validates a pack folder, or a .ccpack file, the way the app does and stores it "
    "in this server's library, where the app offers to install or update it; list shows the library; remove deletes "
    "a pack by id; export hands the user its .ccpack in the chat. A pack that does not validate comes back with the "
    "file and key to fix."
)

_EXAMPLE = {
    MANIFEST: {"schema": SCHEMA["schema"], "name": "Rose", "version": "1.0.0", "author": "Jane", "use": ["rose-dark", "rose"]},
    "themes/rose-dark.json": {
        "name": "Rose Dark",
        "kind": "dark",
        "extends": "cconnect-dark",
        "accent": "#ff5fa2",
        "colors": {"background": "#1a1016", "surface": "#24161f"},
    },
    "accents.json": [{"name": "Rose", "color": "#ff5fa2"}],
}

GUIDE = "\n".join(
    [
        f"A pack is a folder with {MANIFEST} at its root, written anywhere, then stored with save and its "
        "absolute path; the app offers it from there, and export hands the user the .ccpack.",
        f"{MANIFEST}: " + '{"schema": ' + str(SCHEMA["schema"]) + ', "name", "version", "author"?, '
        '"contributors"?: [names], "description"?, "id"?, "preview"?: path of an image in the pack, '
        '"use"?: [ids of this pack]}.',
        "preview is the pack's icon, drawn 44 px wide in the app's lists, while the app draws the pack's banner "
        "itself from its theme colors. Make it square, as an SVG or a raster no bigger than 256x256, with a creative "
        "motif of the pack's own and no text: a screenshot or fine detail turns to noise at that size.",
        "Every other file is optional and takes its id from its name.",
        "use is what the app's Use button applies, and without it the button is not offered: the first light "
        "theme, dark theme, terminal, accent and background listed, and the first font of each kind.",
        f"themes/<id>.json: {{name, kind: {' or '.join(SCHEMA['themeKinds'])}, extends?: theme id, accent?, "
        "syntax?: syntax id, colors: {token: color}}. A token left out comes from extends, or from the default "
        "theme of its kind, and the -bg, hover and scrollbar tokens derive from their base color.",
        "Theme tokens and what each paints:",
        *(f"- {key}: {SCHEMA['colorRoles'][key]}" for key in SCHEMA["colors"]),
        "The named colors a mod draws take red, green, yellow, blue, cyan and gray, and magenta takes purple.",
        "syntax/<id>.json: a VS Code color theme with tokenColors.",
        f"terminal/<id>.json: {{name, colors: {{key: color}}}} with keys {', '.join(SCHEMA['terminal'])}.",
        "accents.json: [{name, color, id?}].",
        f"fonts/<{'|'.join(SCHEMA['fontKinds'])}>/<Family>/<file>: {', '.join(SCHEMA['fontFormats'])}; weight "
        "and style are read from each file.",
        f"backgrounds/<id>.<{'|'.join(SCHEMA['imageFormats'])}>, optionally with backgrounds/<id>.json holding "
        f"name and the defaults {_EFFECTS}, fit {' or '.join(SCHEMA['backgroundFits'])}.",
        "Colors are #rgb, #rgba, #rrggbb or #rrggbbaa.",
        f"Built-in themes to extend: {', '.join(sorted(KNOWN_THEMES))}.",
        f"Built-in syntax: {', '.join(sorted(KNOWN_SYNTAX))}.",
        "Example, one dark theme with its accent, both applied by Use:",
        *(f"{path}: {json.dumps(content)}" for path, content in _EXAMPLE.items()),
    ]
)

INPUT = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["guide", "save", "list", "remove", "export"]},
        "path": {"type": "string", "description": "save: the pack folder or a .ccpack file, by absolute path."},
        "id": {"type": "string", "description": "remove and export: the pack id, as list shows it."},
    },
    "required": ["action"],
}


def _text(message: str) -> dict:
    return {"content": [{"type": "text", "text": message}]}


def exported(pack_id: str, project_key: str) -> list[dict]:
    return listing({"paths": [f"{pack_id}{EXTENSION}"]}, project_key)


def _summary(info: dict) -> str:
    contents = ", ".join(f"{kind}: {count}" for kind, count in info["contents"].items() if count)
    return f"{info['name']} {info['version']} ({info['id']}): {contents}"


def make_tools(context: dict) -> list:
    session_info = context.get("session_info")
    emit = context.get("emit")

    def cwd() -> str:
        return ((session_info() or {}).get("cwd") if session_info else None) or ""

    async def save(raw: str) -> dict:
        source = Path(raw).expanduser()
        if not source.is_absolute() and cwd():
            source = Path(cwd(), source)
        if not source.exists():
            return _text(f"{source} does not exist.")
        try:
            info = await asyncio.to_thread(packs.save, source)
        except PackFormatError as exc:
            return _text(f"The pack is not valid: {exc}.")
        return _text(f"Saved to the library, where the app offers it: {_summary(info)}.")

    async def export(pack_id: str) -> dict:
        target = packs.file_of(f"{pack_id}{EXTENSION}")
        if target is None:
            return _text(f"No pack with id {pack_id} in the library.")
        project_key = sessions.project_key_for(cwd()) if cwd() else ""
        shutil.copy2(target, shared.project_dir(project_key) / target.name)
        delivered = exported(pack_id, project_key)
        if emit is not None:
            await emit({"type": "shared", "files": delivered})
        return _text(f"Shared, and already shown to the user: {delivered[0]['url']}")

    @tool(TOOL, DESCRIPTION, INPUT)
    async def packs_tool(args):
        action = args.get("action")
        if action == "guide":
            return _text(GUIDE)
        if action == "list":
            entries = packs.entries()
            return _text("\n".join(_summary(entry) for entry in entries) or "The library is empty.")
        if action == "save":
            raw = (args.get("path") or "").strip()
            return await save(raw) if raw else _text("Pass the path of the pack folder or .ccpack file.")
        pack_id = (args.get("id") or "").strip()
        if not pack_id:
            return _text("Pass the id of the pack.")
        if action == "remove":
            removed = packs.remove(f"{pack_id}{EXTENSION}")
            return _text(f"Removed {pack_id}." if removed else f"No pack with id {pack_id} in the library.")
        if action == "export":
            return await export(pack_id)
        return _text(f"action is one of {', '.join(INPUT['properties']['action']['enum'])}.")

    return [packs_tool]
