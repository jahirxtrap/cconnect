import io
import json
import re
import zipfile
from pathlib import PurePosixPath

from core import paths
from core.slugs import slug

SCHEMA = json.loads((paths.BUILTIN_PACKS_DIR / "schema.json").read_text(encoding="utf-8"))
BUILTIN_IDS: list[str] = json.loads((paths.BUILTIN_PACKS_DIR / "builtin.json").read_text(encoding="utf-8"))

MANIFEST: str = SCHEMA["manifest"]
EXTENSION: str = SCHEMA["extension"]
MIME: str = SCHEMA["mime"]

_COLOR = re.compile(r"^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$", re.IGNORECASE)
_LOCAL_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_FONT_STYLE = re.compile(r"^[a-z ]*$", re.IGNORECASE)
_MANIFEST_FIELDS = {"schema", "id", "name", "version", "author", "contributors", "description", "preview", "use"}
_THEME_FIELDS = {"name", "kind", "extends", "accent", "syntax", "colors"}
_TERMINAL_FIELDS = {"name", "colors"}
_ACCENT_FIELDS = {"id", "name", "color"}
_BACKGROUND_FIELDS = {"name", "fit", *SCHEMA["backgroundEffects"]}
_ACCENTS_FILE = "accents.json"
_FONT_DEPTH = 4

_MESSAGES = {
    "archive": "The pack could not be opened as a zip archive",
    "manifest": "The pack has no {0} at its root",
    "json": "{0} is not valid JSON",
    "schema": "The pack uses version {0} of the format, newer than this server reads",
    "field": "{0}: the field {1} is missing or not valid",
    "color": "{0}: {2} is not a valid color in {1}; use #rgb, #rgba, #rrggbb or #rrggbbaa",
    "key": "{0}: the key {1} does not exist",
    "reference": "{0}: {1} points to {2}, which does not exist",
    "cycle": "{0}: the themes inherit from each other in a circle",
    "size": "{0} is over the {1} byte limit",
    "format": "{0} is not in a supported format or place",
    "reserved": "The id {0} belongs to a built-in pack",
    "duplicate": "{0} repeats an id already in the pack",
    "empty": "The pack has nothing to install",
}


class PackFormatError(ValueError):
    def __init__(self, code: str, *details: str):
        self.code = code
        super().__init__(_MESSAGES[code].format(*details))


def _extension(path: str) -> str:
    return path.rsplit(".", 1)[-1].lower() if "." in path else ""


def _base(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    dot = name.rfind(".")
    return name[:dot] if dot > 0 else name


def _builtin_known() -> tuple[set[str], set[str]]:
    themes, syntax = set(), set()
    for pack in BUILTIN_IDS:
        for file in (paths.BUILTIN_PACKS_DIR / pack / "themes").glob("*.json"):
            themes.add(slug(file.stem))
            syntax.add(json.loads(file.read_text(encoding="utf-8"))["syntax"])
    return themes, syntax


KNOWN_THEMES, KNOWN_SYNTAX = _builtin_known()


class _Archive:
    def __init__(self, data: bytes):
        if len(data) > SCHEMA["maxPackBytes"]:
            raise PackFormatError("size", MANIFEST, str(SCHEMA["maxPackBytes"]))
        try:
            archive = zipfile.ZipFile(io.BytesIO(data))
            infos = [info for info in archive.infolist() if not info.is_dir()]
        except zipfile.BadZipFile as exc:
            raise PackFormatError("archive") from exc
        total = 0
        for info in infos:
            if info.file_size > SCHEMA["maxFileBytes"]:
                raise PackFormatError("size", info.filename, str(SCHEMA["maxFileBytes"]))
            total += info.file_size
            parts = info.filename.replace("\\", "/").split("/")
            if info.filename.startswith("/") or any(part in ("", ".", "..") for part in parts):
                raise PackFormatError("format", info.filename)
        if total > SCHEMA["maxPackBytes"]:
            raise PackFormatError("size", MANIFEST, str(SCHEMA["maxPackBytes"]))
        names = [info.filename.replace("\\", "/") for info in infos]
        roots = {name.split("/")[0] for name in names}
        root = ""
        if MANIFEST not in names and len(roots) == 1 and f"{next(iter(roots))}/{MANIFEST}" in names:
            root = f"{next(iter(roots))}/"
        self._archive = archive
        self._names = {name[len(root):]: info for name, info in zip(names, infos) if name.startswith(root)}
        self.paths = list(self._names)

    def read(self, path: str) -> bytes:
        return self._archive.read(self._names[path])

    def json(self, path: str):
        try:
            return json.loads(self.read(path).decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise PackFormatError("json", path) from exc


def _fields(archive: _Archive, path: str) -> dict:
    value = archive.json(path)
    if not isinstance(value, dict):
        raise PackFormatError("json", path)
    return value


def _only(fields: dict, allowed: set[str], path: str):
    unknown = next((key for key in fields if key not in allowed), None)
    if unknown is not None:
        raise PackFormatError("key", path, unknown)


def _text(fields: dict, key: str, path: str, required: bool = False):
    value = fields.get(key)
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value.strip():
        raise PackFormatError("field", path, key)
    return value.strip()


def _color(value, path: str, key: str):
    if not isinstance(value, str) or not _COLOR.match(value):
        raise PackFormatError("color", path, key, str(value))


def _colors(fields: dict, keys: list[str], path: str):
    raw = fields.get("colors")
    if raw is None:
        return
    if not isinstance(raw, dict):
        raise PackFormatError("field", path, "colors")
    for key, value in raw.items():
        if key not in keys:
            raise PackFormatError("key", path, f"colors.{key}")
        _color(value, path, f"colors.{key}")


def _entries(archive: _Archive, folder: str) -> list[tuple[str, str]]:
    seen, entries = set(), []
    for path in archive.paths:
        if not path.startswith(f"{folder}/"):
            continue
        local = slug(_base(path))
        if len(path.split("/")) != 2 or _extension(path) != "json" or not local:
            raise PackFormatError("format", path)
        if local in seen:
            raise PackFormatError("duplicate", path)
        seen.add(local)
        entries.append((path, local))
    return entries


def _manifest(archive: _Archive) -> dict:
    if MANIFEST not in archive.paths:
        raise PackFormatError("manifest", MANIFEST)
    fields = _fields(archive, MANIFEST)
    _only(fields, _MANIFEST_FIELDS, MANIFEST)
    schema = fields.get("schema")
    if not isinstance(schema, int) or isinstance(schema, bool):
        raise PackFormatError("field", MANIFEST, "schema")
    if schema > SCHEMA["schema"]:
        raise PackFormatError("schema", str(schema))
    name = _text(fields, "name", MANIFEST, required=True)
    pack_id = _text(fields, "id", MANIFEST) or slug(name)
    if not _LOCAL_ID.match(pack_id):
        raise PackFormatError("field", MANIFEST, "id")
    if pack_id in BUILTIN_IDS:
        raise PackFormatError("reserved", pack_id)
    contributors = fields.get("contributors", [])
    if not isinstance(contributors, list) or any(not isinstance(item, str) or not item.strip() for item in contributors):
        raise PackFormatError("field", MANIFEST, "contributors")
    preview = _text(fields, "preview", MANIFEST)
    if preview is not None and preview not in archive.paths:
        raise PackFormatError("reference", MANIFEST, "preview", preview)
    if preview is not None and _extension(preview) not in SCHEMA["imageFormats"]:
        raise PackFormatError("format", preview)
    use = fields.get("use", [])
    if not isinstance(use, list) or any(not isinstance(item, str) or not item.strip() for item in use):
        raise PackFormatError("field", MANIFEST, "use")
    return {
        "id": pack_id,
        "name": name,
        "version": _text(fields, "version", MANIFEST, required=True),
        "author": _text(fields, "author", MANIFEST),
        "contributors": [item.strip() for item in contributors],
        "description": _text(fields, "description", MANIFEST),
        "preview": preview,
        "use": [item.strip() for item in use],
    }


def _themes(archive: _Archive) -> set[str]:
    entries = _entries(archive, "themes")
    own_themes = {local for _, local in entries}
    own_syntax = {local for _, local in _entries(archive, "syntax")}
    parents: dict[str, str | None] = {}
    for path, local in entries:
        fields = _fields(archive, path)
        _only(fields, _THEME_FIELDS, path)
        kind = _text(fields, "kind", path, required=True)
        if kind not in SCHEMA["themeKinds"]:
            raise PackFormatError("field", path, "kind")
        _text(fields, "name", path, required=True)
        parent = _text(fields, "extends", path)
        if parent is not None and parent not in own_themes and parent not in KNOWN_THEMES:
            raise PackFormatError("reference", path, "extends", parent)
        syntax = _text(fields, "syntax", path)
        if syntax is not None and syntax not in own_syntax and syntax not in KNOWN_SYNTAX:
            raise PackFormatError("reference", path, "syntax", syntax)
        if "accent" in fields:
            _color(fields["accent"], path, "accent")
        _colors(fields, SCHEMA["colors"], path)
        parents[local] = parent if parent in own_themes else None
    for path, local in entries:
        trail, current = set(), local
        while current is not None:
            if current in trail:
                raise PackFormatError("cycle", path)
            trail.add(current)
            current = parents.get(current)
    return own_themes


def _terminals(archive: _Archive) -> set[str]:
    entries = _entries(archive, "terminal")
    for path, _local in entries:
        fields = _fields(archive, path)
        _only(fields, _TERMINAL_FIELDS, path)
        _text(fields, "name", path, required=True)
        _colors(fields, SCHEMA["terminal"], path)
    return {local for _, local in entries}


def _syntax_colors(value, path: str, key: str):
    if not isinstance(value, dict):
        return
    for field, entry in value.items():
        if field == "fontStyle":
            if not isinstance(entry, str) or not _FONT_STYLE.match(entry):
                raise PackFormatError("field", path, f"{key}.{field}")
        elif isinstance(entry, str):
            _color(entry, path, f"{key}.{field}")


def _syntax(archive: _Archive) -> int:
    entries = _entries(archive, "syntax")
    for path, _local in entries:
        fields = _fields(archive, path)
        rules = fields.get("tokenColors", fields.get("settings"))
        if not isinstance(rules, list):
            raise PackFormatError("field", path, "tokenColors")
        _syntax_colors(fields.get("colors"), path, "colors")
        for index, rule in enumerate(rules):
            _syntax_colors(rule.get("settings") if isinstance(rule, dict) else None, path, f"tokenColors.{index}")
        _text(fields, "name", path)
    return len(entries)


def _accents(archive: _Archive) -> set[str]:
    if _ACCENTS_FILE not in archive.paths:
        return set()
    entries = archive.json(_ACCENTS_FILE)
    if not isinstance(entries, list):
        raise PackFormatError("json", _ACCENTS_FILE)
    seen = set()
    for index, entry in enumerate(entries):
        path = f"{_ACCENTS_FILE}[{index}]"
        if not isinstance(entry, dict):
            raise PackFormatError("json", path)
        _only(entry, _ACCENT_FIELDS, path)
        name = _text(entry, "name", path, required=True)
        local = _text(entry, "id", path) or slug(name)
        if not _LOCAL_ID.match(local):
            raise PackFormatError("field", path, "id")
        if local in seen:
            raise PackFormatError("duplicate", path)
        seen.add(local)
        _color(entry.get("color"), path, "color")
    return seen


def _fonts(archive: _Archive) -> dict[str, str]:
    families: dict[str, str] = {}
    for path in archive.paths:
        if not path.startswith("fonts/"):
            continue
        parts = path.split("/")
        local = slug(parts[2]) if len(parts) > 2 else ""
        valid = len(parts) == _FONT_DEPTH and parts[1] in SCHEMA["fontKinds"] and local and parts[3]
        if not valid or _extension(path) not in SCHEMA["fontFormats"]:
            raise PackFormatError("format", path)
        key = f"{parts[1]}/{local}"
        if families.get(key, parts[2]) != parts[2]:
            raise PackFormatError("duplicate", path)
        families[key] = parts[2]
    return families


def _backgrounds(archive: _Archive) -> set[str]:
    images, settings = {}, {}
    for path in archive.paths:
        if not path.startswith("backgrounds/"):
            continue
        local = slug(_base(path))
        extension = _extension(path)
        known = extension == "json" or extension in SCHEMA["imageFormats"]
        if len(path.split("/")) != 2 or not local or not known:
            raise PackFormatError("format", path)
        target = settings if extension == "json" else images
        if local in target:
            raise PackFormatError("duplicate", path)
        target[local] = path
    for local, path in settings.items():
        if local not in images:
            raise PackFormatError("reference", path, "backgrounds", local)
        fields = _fields(archive, path)
        _only(fields, _BACKGROUND_FIELDS, path)
        _text(fields, "name", path)
        for key, limits in SCHEMA["backgroundEffects"].items():
            value = fields.get(key)
            if value is None:
                continue
            valid = isinstance(value, (int, float)) and not isinstance(value, bool)
            if not valid or not limits["min"] <= value <= limits["max"]:
                raise PackFormatError("field", path, key)
        if "fit" in fields and fields["fit"] not in SCHEMA["backgroundFits"]:
            raise PackFormatError("field", path, "fit")
    return set(images)


def read_pack(data: bytes) -> dict:
    archive = _Archive(data)
    info = _manifest(archive)
    themes = _themes(archive)
    terminals = _terminals(archive)
    syntax = _syntax(archive)
    accents = _accents(archive)
    fonts = _fonts(archive)
    backgrounds = _backgrounds(archive)
    contents = {
        "themes": len(themes),
        "terminals": len(terminals),
        "syntax": syntax,
        "accents": len(accents),
        "fonts": len(fonts),
        "backgrounds": len(backgrounds),
    }
    if not any(contents.values()):
        raise PackFormatError("empty")
    usable = themes | terminals | accents | {key.partition("/")[2] for key in fonts} | backgrounds
    for local in info["use"]:
        if local not in usable:
            raise PackFormatError("reference", MANIFEST, "use", local)
    return {**info, "contents": contents}


def preview_of(data: bytes) -> tuple[bytes, str] | None:
    archive = _Archive(data)
    preview = _manifest(archive)["preview"]
    return (archive.read(preview), PurePosixPath(preview).suffix.lstrip(".").lower()) if preview else None
