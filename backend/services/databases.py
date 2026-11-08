import hashlib
import threading
from pathlib import Path
from typing import Any, Callable, NamedTuple, Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError
from sqlalchemy.pool import NullPool

from core.db import Session
from core.models import DatabaseConnection
from core.slugs import slug, unique
from services import database_engines, database_tunnels, project_files, shared

FIELDS = ("name", "engine", "host", "port", "database", "user", "password", "path", "url", "packages", "options", "read_only", "ssh")
FALLBACK_ID = "database"
FILE_PREFIX = "file:"
FILE_ID_LENGTH = 16
MAX_PORT = 65535

MISSING = "missing"
INVALID = "invalid"
DRIVER = "driver"
CONNECT_FAILED = "connect"


class DatabaseError(Exception):
    def __init__(self, reason: str, detail: str = "", statement: Optional[int] = None):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail
        self.statement = statement


class Scope(NamedTuple):
    connection: str
    database: Optional[str] = None


def detail_of(exc: Exception) -> str:
    return str(getattr(exc, "orig", None) or exc).strip()


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _port(value: Any) -> Optional[int]:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if 0 < number <= MAX_PORT else None


def _ssh(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict) or not _text(raw.get("host")):
        return None
    return {"host": _text(raw["host"]), "port": _port(raw.get("port")), "user": _text(raw.get("user")), "key": _text(raw.get("key"))}


def _options(raw: Any) -> dict[str, str]:
    return {_text(key): _text(value) for key, value in raw.items() if _text(key)} if isinstance(raw, dict) else {}


def _packages(raw: Any) -> list[str]:
    items = raw.replace(",", " ").split() if isinstance(raw, str) else raw if isinstance(raw, list) else []
    return [_text(item) for item in items if _text(item)]


def _split_url(raw: Any, password: str) -> tuple[str, str]:
    typed = _text(raw)
    try:
        made = make_url(typed)
    except ArgumentError:
        return "", password
    if made.password is None:
        return typed, password
    bare = URL.create(made.drivername, username=made.username, host=made.host, port=made.port, database=made.database, query=made.query)
    return bare.render_as_string(hide_password=False), password or made.password


def clean(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    engine = raw.get("engine")
    if engine not in database_engines.ENGINES:
        return None
    item = database_engines.ENGINES[engine]
    form = item["form"]
    server = form == database_engines.SERVER
    typed = str(raw.get("password") or "")
    address, password = _split_url(raw.get("url"), typed) if form == database_engines.URL_FORM else ("", typed)
    entry = {
        "id": _text(raw.get("id")),
        "name": _text(raw.get("name")),
        "engine": engine,
        "host": _text(raw.get("host")) if server else "",
        "port": _port(raw.get("port")) if server else None,
        "database": _text(raw.get("database")) if server else "",
        "user": _text(raw.get("user")) if server else "",
        "password": "" if form == database_engines.FILE else password,
        "path": _text(raw.get("path")) if form == database_engines.FILE else "",
        "url": address,
        "packages": _packages(raw.get("packages")) if form == database_engines.URL_FORM else [],
        "options": _options(raw.get("options")) if server else {},
        "read_only": raw.get("read_only") is True,
        "ssh": None if form == database_engines.FILE else _ssh(raw.get("ssh")),
    }
    located = {
        database_engines.FILE: entry["path"],
        database_engines.URL_FORM: entry["url"],
        database_engines.SERVER: entry["host"] or not item["host"],
    }[form]
    if not entry["id"] or not entry["name"] or not located:
        return None
    return entry


def _entry(row: DatabaseConnection) -> Optional[dict]:
    ssh = {"host": row.ssh_host, "port": row.ssh_port, "user": row.ssh_user, "key": row.ssh_key} if row.ssh_host else None
    return clean({
        "id": row.id,
        "name": row.name,
        "engine": row.engine,
        "host": row.host,
        "port": row.port,
        "database": row.database_name,
        "user": row.username,
        "password": row.password,
        "path": row.path,
        "url": row.url,
        "packages": row.packages,
        "options": row.options,
        "read_only": row.read_only,
        "ssh": ssh,
    })


def _columns(entry: dict) -> dict:
    ssh = entry["ssh"] or {}
    return {
        "name": entry["name"],
        "engine": entry["engine"],
        "host": entry["host"],
        "port": entry["port"],
        "database_name": entry["database"],
        "username": entry["user"],
        "password": entry["password"],
        "path": entry["path"],
        "url": entry["url"],
        "packages": entry["packages"],
        "options": entry["options"],
        "read_only": entry["read_only"],
        "ssh_host": ssh.get("host"),
        "ssh_port": ssh.get("port"),
        "ssh_user": ssh.get("user"),
        "ssh_key": ssh.get("key"),
    }


def load() -> list[dict]:
    with Session() as session:
        rows = session.query(DatabaseConnection).order_by(DatabaseConnection.created_at).all()
    return [entry for entry in map(_entry, rows) if entry]


_files: dict[str, dict] = {}


def _saved(connection_id: str) -> Optional[dict]:
    with Session() as session:
        row = session.get(DatabaseConnection, connection_id)
    return _entry(row) if row is not None else None


def find(connection_id: str) -> Optional[dict]:
    return _saved(connection_id) or _files.get(connection_id)


def _required(found: Any, connection_id: str) -> Any:
    if found is None:
        raise DatabaseError(MISSING, connection_id)
    return found


def require(connection_id: str) -> dict:
    return _required(find(connection_id), connection_id)


def _located(project: Optional[str], relpath: str, unlocked: bool) -> Optional[Path]:
    if project is None:
        return shared.resolve_file(relpath)
    root = project_files.root_for(project)
    return project_files.resolve_file(root, relpath, unlocked) if root else None


def is_file(connection_id: str) -> bool:
    return connection_id.startswith(FILE_PREFIX)


def open_path(found: Path) -> dict:
    target = found.resolve()
    if not target.is_file():
        raise DatabaseError(MISSING, str(found))
    digest = hashlib.sha256(str(target).encode("utf-8")).hexdigest()[:FILE_ID_LENGTH]
    entry = clean({"id": f"{FILE_PREFIX}{digest}", "name": target.name, "engine": database_engines.file_engine(target), "path": str(target)})
    _files[entry["id"]] = entry
    return entry


def open_file(project: Optional[str], relpath: str, unlocked: bool) -> dict:
    try:
        found = _located(project, relpath, unlocked)
    except ValueError as exc:
        raise DatabaseError(INVALID, relpath) from exc
    if found is None:
        raise DatabaseError(MISSING, relpath)
    return open_path(found)


def listed(entry: dict) -> dict:
    return {**{key: value for key, value in entry.items() if key != "password"}, "has_password": bool(entry["password"])}


def listable(entry: dict) -> bool:
    item = database_engines.spec_of(entry)
    own = make_url(entry["url"]).database if item["form"] == database_engines.URL_FORM else entry["database"]
    return bool(item["databases"]) and not own


def scoped(scope: Scope) -> dict:
    entry = require(scope.connection)
    if not scope.database:
        return entry
    if not listable(entry):
        raise DatabaseError(INVALID, scope.database)
    return {**entry, "database": scope.database}


def _merged(fields: dict, current: Optional[dict] = None) -> dict:
    changes = {key: value for key, value in fields.items() if key in FIELDS}
    entry = clean({**(current or {}), **changes, "id": (current or {}).get("id") or fields.get("id")})
    if entry is None:
        raise DatabaseError(INVALID)
    return entry


def create(fields: dict) -> dict:
    with Session() as session:
        taken = {ident for (ident,) in session.query(DatabaseConnection.id)}
        entry = _merged({**fields, "id": unique(slug(_text(fields.get("name"))) or FALLBACK_ID, taken)})
        session.add(DatabaseConnection(id=entry["id"], **_columns(entry)))
        session.commit()
    return entry


def update(connection_id: str, fields: dict) -> dict:
    with Session() as session:
        row = _required(session.get(DatabaseConnection, connection_id), connection_id)
        entry = _merged(fields, _required(_entry(row), connection_id))
        for column, value in _columns(entry).items():
            setattr(row, column, value)
        session.commit()
    close(connection_id)
    return entry


def remove(connection_id: str) -> None:
    with Session() as session:
        session.delete(_required(session.get(DatabaseConnection, connection_id), connection_id))
        session.commit()
    close(connection_id)


_engines: dict[tuple[str, str], tuple[Engine, Optional[database_tunnels.Tunnel]]] = {}
_lock = threading.Lock()


def _target(entry: dict, item: dict) -> tuple[str, Optional[int]]:
    if item["form"] != database_engines.URL_FORM:
        return entry["host"], entry["port"] or item["port"]
    made = make_url(entry["url"])
    return made.host or "", made.port or (database_engines.backend_spec(entry["url"]) or {}).get("port")


def _open(entry: dict) -> tuple[Engine, Optional[database_tunnels.Tunnel]]:
    item = database_engines.spec_of(entry)
    if not database_engines.driver_ready(entry):
        raise DatabaseError(DRIVER, " ".join(entry["packages"]) or entry["engine"])
    tunnel = None
    host = port = None
    if entry["ssh"]:
        tunnel = database_tunnels.Tunnel(entry["ssh"], *_target(entry, item))
        try:
            port = tunnel.open()
        except database_tunnels.TunnelError as exc:
            raise DatabaseError(exc.reason, exc.detail) from exc
        host = "127.0.0.1"
    try:
        engine = create_engine(
            database_engines.url(entry, host, port),
            pool_pre_ping=True,
            poolclass=NullPool if item["form"] == database_engines.FILE else None,
            connect_args=database_engines.connect_args(item),
        )
    except (SQLAlchemyError, ImportError, ValueError) as exc:
        if tunnel is not None:
            tunnel.close()
        raise DatabaseError(CONNECT_FAILED, detail_of(exc)) from exc
    return engine, tunnel


def _dispose(held: tuple[Engine, Optional[database_tunnels.Tunnel]]) -> None:
    engine, tunnel = held
    engine.dispose()
    if tunnel is not None:
        tunnel.close()


def engine_for(scope: Scope) -> tuple[Engine, dict]:
    entry = scoped(scope)
    slot = (scope.connection, scope.database or "")
    with _lock:
        held = _engines.get(slot)
        if held is not None and held[1] is not None and not held[1].alive:
            _dispose(_engines.pop(slot))
            held = None
        if held is None:
            held = _engines[slot] = _open(entry)
    return held[0], entry


def _release(matches: Callable[[tuple[str, str]], bool]) -> None:
    with _lock:
        held = [_engines.pop(slot) for slot in [slot for slot in _engines if matches(slot)]]
    for item in held:
        _dispose(item)


def close(connection_id: str) -> None:
    _release(lambda slot: slot[0] == connection_id)


def release_others(scope: Scope) -> None:
    _release(lambda slot: slot[0] == scope.connection and slot[1] != (scope.database or ""))


def uninstall_driver(engine: str) -> None:
    shared = set(database_engines.driver_of(engine))
    for entry in [*load(), *_files.values()]:
        if entry["engine"] in shared:
            close(entry["id"])
    database_engines.uninstall(engine)


def close_all() -> None:
    _release(lambda slot: True)


def test(fields: dict, connection_id: Optional[str] = None) -> dict:
    current = find(connection_id) if connection_id else None
    probe = {"id": FALLBACK_ID, "name": FALLBACK_ID}
    entry = _merged({**fields, **probe}, {**current, **probe} if current else None)
    held = _open(entry)
    asked = database_engines.spec_of(entry)["version"]
    try:
        with held[0].connect() as connection:
            reported = held[0].dialect.server_version_info
            version = connection.exec_driver_sql(asked).scalar() if asked else ".".join(str(part) for part in reported or ())
    except Exception as exc:
        raise DatabaseError(CONNECT_FAILED, detail_of(exc)) from exc
    finally:
        _dispose(held)
    return {"server": str(version) if version else None}
