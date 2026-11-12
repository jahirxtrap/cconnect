import importlib
import json
import re
from importlib import metadata
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError, NoSuchModuleError

from core import packages, paths

INSTALL_TIMEOUT = 900
OUTPUT_TAIL = 2000
CONNECT_SECONDS = 10
HEADER_BYTES = 64
SERVER_DISTRIBUTION = "cconnect"
CORE_DISTRIBUTION = "sqlalchemy"
REQUIREMENT_NAME = re.compile(r"[A-Za-z0-9._-]+")

FILE = "file"
SERVER = "server"
URL_FORM = "url"
CUSTOM = "custom"

DRIVER_KEYS = ("id", "label", "dialect", "form", "packages", "distributions", "host", "port", "connect_timeout", "connect_args")

INSTALL_FAILED = "install"
UNKNOWN_ENGINE = "engine"


class EngineError(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail


def _catalog() -> dict[str, dict[str, Any]]:
    raw = json.loads(paths.DATABASE_ENGINES_FILE.read_text(encoding="utf-8"))
    declared = {item["id"]: item for item in raw["engines"]}

    def resolved(item: dict) -> dict:
        parent = resolved(declared[item["extends"]]) if item.get("extends") else raw["defaults"]
        return {**parent, **{key: value for key, value in item.items() if key != "extends"}}

    return {engine: resolved(item) for engine, item in declared.items()}


ENGINES = _catalog()


def spec(engine: str) -> dict[str, Any]:
    found = ENGINES.get(engine)
    if found is None:
        raise EngineError(UNKNOWN_ENGINE, engine)
    return found


def backend_spec(url: str) -> Optional[dict[str, Any]]:
    try:
        backend = make_url(url).get_backend_name()
    except ArgumentError:
        return None
    return next((item for item in ENGINES.values() if item["dialect"] and item["dialect"].split("+")[0] == backend), None)


def spec_of(entry: dict) -> dict[str, Any]:
    item = spec(entry["engine"])
    if item["form"] != URL_FORM:
        return item
    borrowed = backend_spec(entry.get("url") or "")
    return {**item, **{key: value for key, value in (borrowed or {}).items() if key not in DRIVER_KEYS}}


def _signed(item: dict, head: bytes) -> bool:
    signature = item["signature"]
    if not signature:
        return False
    start = signature["offset"]
    expected = signature["text"].encode()
    return head[start:start + len(expected)] == expected


def file_engine(path: Path) -> str:
    try:
        with path.open("rb") as handle:
            head = handle.read(HEADER_BYTES)
    except OSError as exc:
        raise EngineError(UNKNOWN_ENGINE, path.name) from exc
    extension = path.suffix[1:].lower()
    found = next(
        (engine for engine, item in ENGINES.items() if (_signed(item, head) if head else extension in item["extensions"])),
        None,
    )
    if found is None:
        raise EngineError(UNKNOWN_ENGINE, path.name)
    return found


def _present(distribution: str) -> bool:
    try:
        metadata.distribution(distribution)
    except metadata.PackageNotFoundError:
        return False
    return True


def _loadable(url: str) -> bool:
    try:
        make_url(url).get_dialect().import_dbapi()
    except (ArgumentError, NoSuchModuleError, ImportError, AttributeError):
        return False
    return True


def installed(engine: str) -> bool:
    return all(_present(distribution) for distribution in spec(engine)["distributions"])


def driver_ready(entry: dict) -> bool:
    item = spec(entry["engine"])
    return _loadable(entry.get("url") or "") if item["form"] == URL_FORM else installed(entry["engine"])


def listed() -> list[dict]:
    return [
        {
            "id": engine,
            "label": item["label"],
            "form": item["form"],
            "host": item["host"],
            "port": item["port"],
            "packages": item["packages"],
            "options": item["options"],
            "quote": item["quote"],
            "installed": installed(engine),
        }
        for engine, item in ENGINES.items()
    ]


def _pins() -> list[str]:
    try:
        wanted = metadata.requires(SERVER_DISTRIBUTION) or []
    except metadata.PackageNotFoundError:
        wanted = [CORE_DISTRIBUTION]
    names = {REQUIREMENT_NAME.match(item).group(0) for item in wanted if "extra ==" not in item}
    return sorted(f"{name}=={metadata.version(name)}" for name in names | {CORE_DISTRIBUTION} if _present(name))


def _run(command: list[str]) -> None:
    result = packages.run(command, INSTALL_TIMEOUT)
    importlib.invalidate_caches()
    if result.returncode != 0:
        raise EngineError(INSTALL_FAILED, (result.stderr or result.stdout)[-OUTPUT_TAIL:])


def install_packages(wanted: list[str]) -> None:
    if wanted:
        _run(packages.install_command(*wanted, *_pins()))


def install(engine: str) -> None:
    install_packages(spec(engine)["packages"])


def kept_packages(entries: list[dict]) -> list[str]:
    catalog = {name for engine, item in ENGINES.items() if item["packages"] and installed(engine) for name in item["packages"]}
    custom = {name for entry in entries if entry.get("url") and _loadable(entry["url"]) for name in entry["packages"]}
    return sorted(catalog | custom)


def driver_of(engine: str) -> list[str]:
    wanted = spec(engine)["packages"]
    return [other for other, item in ENGINES.items() if wanted and item["packages"] == wanted]


def uninstall(engine: str) -> None:
    same = set(driver_of(engine))
    shared = {name for other, item in ENGINES.items() if other not in same and installed(other) for name in item["distributions"]}
    leaving = [name for name in spec(engine)["distributions"] if name not in shared and _present(name)]
    if leaving:
        _run(packages.uninstall_command(*leaving))


def connect_args(item: dict) -> dict:
    timeout = {item["connect_timeout"]: CONNECT_SECONDS} if item["connect_timeout"] else {}
    return {**item["connect_args"], **timeout}


def url(entry: dict, host: Optional[str] = None, port: Optional[int] = None) -> URL:
    item = spec_of(entry)
    if item["form"] == URL_FORM:
        made = make_url(entry["url"])
        return made.set(
            password=entry.get("password") or made.password,
            host=host or made.host,
            port=port or made.port,
            database=entry.get("database") or made.database or item["home"],
        )
    if item["form"] == FILE:
        return URL.create(item["dialect"], database=entry.get("path") or None)
    database = entry.get("database") or item["home"]
    into_query = item["database_query"] if database else None
    return URL.create(
        item["dialect"],
        username=entry.get("user") or None,
        password=entry.get("password") or None,
        host=host or entry.get("host") or None,
        port=port or entry.get("port") or item["port"],
        database=None if into_query else database,
        query={**(entry.get("options") or {}), **({into_query: database} if into_query else {})},
    )
