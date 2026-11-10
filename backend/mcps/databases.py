import asyncio
import json
import re
from pathlib import Path
from typing import Any, Callable, Optional

from mcps import SERVER
from mcps.definition import Definition, reply
from mcps.shared_files import listing
from services import database_data, database_engines, databases, sessions, shared

CAPABILITY = "databases"
GROUP = "databases"
GROUP_SUMMARY = "Inspect, query, change and manage the database connections of the app's Databases panel."
PREFIX = "db_"
INSPECT = "db_inspect"
QUERY = "db_query"
EXECUTE = "db_execute"
MANAGE = "db_manage"
QUERY_TOOLS = (f"mcp__{SERVER}__{QUERY}", f"mcp__{SERVER}__{EXECUTE}")
MANAGE_TOOL = f"mcp__{SERVER}__{MANAGE}"
DEFAULT_LIMIT = 50
CELL_CHARS = 200
NULL = "\\N"
FAILURES = (databases.DatabaseError, database_engines.EngineError)

ENGINES = "engines"
ADD = "add"
UPDATE = "update"
REMOVE = "remove"
TEST = "test"
INSTALL = "install"
UNINSTALL = "uninstall"
OPEN = "open"
EXPORT = "export"
ACTIONS = [ENGINES, ADD, UPDATE, REMOVE, TEST, INSTALL, UNINSTALL, OPEN, EXPORT]

ROWS_HEADER = re.compile(r"^\[(\d+)\] (\d+) rows?(, more from offset \d+)?$")
CHANGED_HEADER = re.compile(r"^\[(\d+)\] (\d+) rows? (?:inserted|updated|deleted|affected)\b.*?(?:, (\d+) shown)?$")
STRUCTURE_HEADER = re.compile(r"^\[(\d+)\] (?:created|altered) (?:table|view) .*, (\d+) columns?$")
CHANGES_HEADER = re.compile(r"^\[(\d+)\] altered (?:table|view) .*, (\d+) column changes?$")
NO_CHANGES_HEADER = re.compile(r"^\[(\d+)\] altered (?:table|view) .*, no column changes$")
DONE_HEADER = re.compile(r"^\[(\d+)\] .+$")
CHANGE_PLACES = {"inserted": "into", "updated": "in", "deleted": "from"}
STRUCTURE_COLUMNS = ["column", "type", "primary key", "nullable", "auto", "default"]
CHANGE_COLUMNS = ["change", "column", "type", "nullable", "default", "was"]
YES = "yes"
NO = "no"
EXPORTED = re.compile(r"^Wrote (.+) and showed it to the user", re.MULTILINE)
ESCAPES = {"t": "\t", "n": "\n", "r": "\r"}

CONNECTION = {"type": "string", "description": f"The connection's id, from {INSPECT}."}
DATABASE = {
    "type": "string",
    "description": f"One of the databases {INSPECT} lists for a connection that names none; the connection's own when left out.",
}
SQL = {"type": "string", "description": "One or more statements separated by semicolons."}
LIMIT = {"type": "integer", "description": f"Rows per statement, {DEFAULT_LIMIT} by default and at most {database_data.MAX_ROWS}."}
OFFSET = {"type": "integer", "description": "Rows to skip in each statement's result, to read on past the last answer."}

DB_INSPECT = Definition(
    INSPECT,
    "What the database connections of the user's Databases panel hold. Without connection it lists the connections;"
    " with one it lists its schemas, or the server's databases when the connection names none of its own; with"
    " database it looks inside one of those; with schema it lists that schema's tables and views; with table it"
    " describes the table: columns, primary key, foreign keys and indexes. Use it before writing SQL against a"
    " database you have not looked at.",
    {
        "type": "object",
        "properties": {
            "connection": {"type": "string", "description": "The connection's id. Left out, the answer lists the connections."},
            "database": DATABASE,
            "schema": {"type": "string", "description": "A schema from the list: its tables and views, or where table is."},
            "table": {"type": "string", "description": "A table or view to describe, in schema or in the default one."},
        },
    },
)

DB_QUERY = Definition(
    QUERY,
    "Run SQL that only reads on a database connection: SELECT, WITH, EXPLAIN, SHOW, DESCRIBE. It runs in a"
    " transaction that is rolled back and refuses anything that writes. Every statement answers on its own: a"
    f" header, then its rows tab-separated under their columns, at most {DEFAULT_LIMIT} unless limit asks for more,"
    f" NULL written as {NULL} and long values cut; the header says the offset that reads on.",
    {
        "type": "object",
        "properties": {"connection": CONNECTION, "database": DATABASE, "sql": SQL, "limit": LIMIT, "offset": OFFSET},
        "required": ["connection", "sql"],
    },
)

DB_EXECUTE = Definition(
    EXECUTE,
    "Run SQL that changes a database connection: INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, and CREATE or DROP"
    " DATABASE. The statements run in one transaction, committed only if every one succeeds; a batch with one that"
    " no transaction admits (CREATE DATABASE, VACUUM, CREATE INDEX CONCURRENTLY) runs without one and cannot be"
    f" undone. Answers like {QUERY}. Only for a change the user asked for; refused on a read-only connection.",
    DB_QUERY.schema,
)

DB_MANAGE = Definition(
    MANAGE,
    "Manage the user's Databases panel: its connections, the drivers on the server and the database files it opens."
    " engines lists every engine with its form, default port, the options its URL takes and its driver. add creates"
    " a connection and update changes the fields given; remove deletes the connection, never the database; test"
    " connects without saving. install and uninstall put an engine's driver on the server or take it off. open"
    " opens a SQLite or DuckDB file as a connection for this session. export writes a table or a query to the"
    " shared folder as CSV, or a table as SQL inserts, and shows the file to the user.",
    {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ACTIONS},
            "connection": {"type": "string", "description": "update, remove, test and export: the connection's id. test without it checks the fields given."},
            "engine": {"type": "string", "description": "add, install and uninstall: an engine id from engines."},
            "name": {"type": "string", "description": "add and update: the name the panel shows."},
            "path": {"type": "string", "description": "add and update: a file engine's database file on the server. open: the file to open, absolute or from the chat's folder."},
            "host": {"type": "string", "description": "add and update: the server a server engine connects to."},
            "port": {"type": "integer", "description": "add and update: its port; the engine's default when left out."},
            "database": {"type": "string", "description": "add and update: the database a server engine opens; left out, the connection lists the server's. export: one of those."},
            "user": {"type": "string", "description": "add and update: the user a server engine signs in as."},
            "password": {"type": "string", "description": "add and update: its password, kept on the server and never shown again."},
            "options": {
                "type": "object",
                "additionalProperties": {"type": "string"},
                "description": "add and update: the query parameters of a server engine's URL, such as Snowflake's warehouse.",
            },
            "url": {"type": "string", "description": "add and update: the custom engine's SQLAlchemy URL."},
            "packages": {
                "type": "array",
                "items": {"type": "string"},
                "description": "add and update: the pip packages the custom engine's driver needs. install: the packages to put on the server.",
            },
            "read_only": {"type": "boolean", "description": "add and update: run every query in a transaction that is rolled back."},
            "ssh": {
                "type": "object",
                "properties": {
                    "host": {"type": "string", "description": "The machine the tunnel goes through."},
                    "port": {"type": "integer", "description": "Its SSH port, 22 when left out."},
                    "user": {"type": "string", "description": "The user it signs in as."},
                    "key": {"type": "string", "description": "A private key file on the server; left out, the ssh agent's."},
                },
                "description": "add and update: an SSH tunnel through another machine, with the server's ssh client.",
            },
            "schema": {"type": "string", "description": "export: the table's schema, the default one when left out."},
            "table": {"type": "string", "description": "export: the table to write."},
            "sql": {"type": "string", "description": "export: a query that reads, written instead of a table."},
            "format": {"type": "string", "enum": list(database_data.TABLE_FORMATS), "description": "export: csv, or sql for a table's inserts; csv when left out."},
        },
        "required": ["action"],
    },
)

FIELDS = tuple(name for name in databases.FIELDS if name in DB_MANAGE.schema["properties"])


def needs_key(name: str, args: dict) -> bool:
    return name.startswith(PREFIX)


def _counted(number: int, word: str) -> str:
    return f"{number} {word}{'' if number == 1 else 's'}"


def _cell(value: Any) -> str:
    if value is None:
        return NULL
    if isinstance(value, bool):
        text = "true" if value else "false"
    elif isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        text = str(value)
    if len(text) > CELL_CHARS:
        text = f"{text[:CELL_CHARS]}…(+{len(text) - CELL_CHARS})"
    return text.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def _field(raw: str) -> Optional[str]:
    if raw == NULL:
        return None
    text: list[str] = []
    chars = iter(raw)
    for char in chars:
        if char == "\\":
            following = next(chars, "")
            text.append(ESCAPES.get(following, following))
        else:
            text.append(char)
    return "".join(text)


def _tsv(columns: list[Any], rows: list[list[Any]]) -> list[str]:
    return ["\t".join(map(_cell, columns)), *("\t".join(map(_cell, row)) for row in rows)]


def _flag(value: bool) -> str:
    return YES if value else NO


def _object_name(found: Optional[dict]) -> str:
    return _named(found["schema"], found["name"]) if found and found["name"] else ""


def _rows_block(index: int, item: dict, offset: int) -> list[str]:
    more = f", more from offset {offset + len(item['rows'])}" if item["more"] else ""
    return [f"[{index}] {_counted(len(item['rows']), 'row')}{more}", *_tsv(item["columns"], item["rows"])]


def _changed_block(index: int, item: dict) -> list[str]:
    found = item["effect"]
    count = item["affected"]
    if count is None:
        return [f"[{index}] done"]
    verb = found["action"] if found and found["action"] in CHANGE_PLACES else "affected"
    place = f" {CHANGE_PLACES[verb]} {_object_name(found)}" if verb in CHANGE_PLACES and _object_name(found) else ""
    if item["columns"] is None:
        return [f"[{index}] {_counted(count, 'row')} {verb}{place}"]
    return [f"[{index}] {_counted(count, 'row')} {verb}{place}, {len(item['rows'])} shown", *_tsv(item["columns"], item["rows"])]


def _structure_block(index: int, item: dict) -> list[str]:
    found = item["effect"]
    changes = item.get("changes")
    lead = f"[{index}] {found['action']} {found['object']} {_object_name(found)}"
    if changes is not None:
        if not changes:
            return [f"{lead}, no column changes"]
        rows = [[change["change"], change["name"], change["type"], _flag(change["nullable"]), change["default"], change["was_type"]] for change in changes]
        return [f"{lead}, {_counted(len(changes), 'column change')}", *_tsv(CHANGE_COLUMNS, rows)]
    columns = item["structure"]
    rows = [[column["name"], column["type"], _flag(column["primary_key"]), _flag(column["nullable"]), _flag(column["auto"]), column["default"]] for column in columns]
    return [f"{lead}, {_counted(len(columns), 'column')}", *_tsv(STRUCTURE_COLUMNS, rows)]


def _done_block(index: int, item: dict) -> list[str]:
    found = item["effect"]
    if item["affected"] is not None:
        return [f"[{index}] {_counted(item['affected'], 'row')} affected"]
    if found and found["object"] and _object_name(found):
        return [f"[{index}] {found['action']} {found['object']} {_object_name(found)}"]
    return [f"[{index}] done"]


def render(result: dict, offset: int) -> str:
    blocks = []
    for index, item in enumerate(result["results"], 1):
        kind = item["kind"]
        if kind == database_data.ROWS:
            lines = _rows_block(index, item, offset)
        elif kind == database_data.CHANGED:
            lines = _changed_block(index, item)
        elif kind == database_data.STRUCTURE:
            lines = _structure_block(index, item)
        else:
            lines = _done_block(index, item)
        blocks.append("\n".join(lines))
    tail = f"{result['elapsed']} ms"
    if result["wrote"]:
        tail += ", committed" if result["transaction"] else ", run without a transaction"
    return "\n\n".join([*blocks, tail])


def _table_at(lines: list[str], start: int, count: int) -> tuple[list[str], list[list[Optional[str]]]]:
    header = lines[start] if start < len(lines) else ""
    columns = [_field(name) or "" for name in header.split("\t")]
    rows = [[_field(value) for value in line.split("\t")] for line in lines[start + 1:start + 1 + count]]
    return columns, rows


def _column_of(row: list[Optional[str]]) -> dict:
    name, kind, primary, nullable, auto, default = (row + [None] * len(STRUCTURE_COLUMNS))[:len(STRUCTURE_COLUMNS)]
    return {
        "name": name or "",
        "type": kind or "",
        "primary_key": primary == YES,
        "nullable": nullable == YES,
        "auto": auto == YES,
        "default": default,
    }


def _change_of(row: list[Optional[str]]) -> dict:
    change, name, kind, nullable, default, was = (row + [None] * len(CHANGE_COLUMNS))[:len(CHANGE_COLUMNS)]
    return {
        "change": change if change in ("added", "removed", "changed") else "changed",
        "name": name or "",
        "type": kind or "",
        "nullable": nullable == YES,
        "default": default,
        "was_type": was,
    }


def statements_of(text: str) -> list[dict]:
    lines = text.split("\n")
    found: list[dict] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        index += 1
        empty = {"index": 0, "kind": database_data.DONE, "columns": None, "rows": None, "affected": None, "more": False, "structure": None, "changes": None}
        if match := ROWS_HEADER.match(line):
            count = int(match.group(2))
            columns, rows = _table_at(lines, index, count)
            found.append({**empty, "index": int(match.group(1)), "kind": database_data.ROWS, "columns": columns, "rows": rows, "more": bool(match.group(3))})
            index += 1 + count
        elif match := CHANGED_HEADER.match(line):
            item = {**empty, "index": int(match.group(1)), "kind": database_data.CHANGED, "affected": int(match.group(2))}
            if match.group(3) is not None:
                shown = int(match.group(3))
                columns, rows = _table_at(lines, index, shown)
                item = {**item, "columns": columns, "rows": rows, "more": item["affected"] > shown}
                index += 1 + shown
            found.append(item)
        elif match := CHANGES_HEADER.match(line):
            count = int(match.group(2))
            _, rows = _table_at(lines, index, count)
            found.append({**empty, "index": int(match.group(1)), "kind": database_data.STRUCTURE, "changes": [_change_of(row) for row in rows]})
            index += 1 + count
        elif match := NO_CHANGES_HEADER.match(line):
            found.append({**empty, "index": int(match.group(1)), "kind": database_data.STRUCTURE, "changes": []})
        elif match := STRUCTURE_HEADER.match(line):
            count = int(match.group(2))
            _, rows = _table_at(lines, index, count)
            found.append({**empty, "index": int(match.group(1)), "kind": database_data.STRUCTURE, "structure": [_column_of(row) for row in rows]})
            index += 1 + count
        elif match := DONE_HEADER.match(line):
            found.append({**empty, "index": int(match.group(1))})
    return found


def query_view(tool_name: str, raw: Any) -> dict:
    if tool_name not in QUERY_TOOLS or not isinstance(raw, dict):
        return {}
    connection = str(raw.get("connection") or "")
    found = databases.find(connection) if connection else None
    return {"query": {
        "connection": connection,
        "name": found["name"] if found else connection,
        "database": str(raw["database"]) if raw.get("database") else None,
        "sql": str(raw.get("sql") or ""),
        "writes": tool_name.endswith(EXECUTE),
        "saved": found is not None and not databases.is_file(connection),
    }}


def tool_mode(tool_name: str, mode: str) -> str:
    return "full" if tool_name in QUERY_TOOLS else mode


def result_view(tool_name: str, text: str, raw: Any) -> dict:
    if tool_name not in QUERY_TOOLS:
        return {}
    found = statements_of(text or "")
    known = database_data.effects(str(raw.get("connection") or ""), str(raw.get("sql") or "")) if isinstance(raw, dict) else []
    return {"statements": [
        {**{key: value for key, value in item.items() if key != "index"}, "effect": known[item["index"] - 1] if 0 < item["index"] <= len(known) else None}
        for item in found
    ]}


def exported(tool_name: str, raw: Any, text: str, project_key: str) -> list[dict]:
    if tool_name != MANAGE_TOOL or not isinstance(raw, dict) or raw.get("action") != EXPORT:
        return []
    match = EXPORTED.search(text or "")
    return listing({"paths": [match.group(1)]}, project_key) if match else []


def _target(entry: dict) -> str:
    if entry["path"] or entry["url"]:
        return entry["path"] or entry["url"]
    port = entry["port"] or database_engines.spec(entry["engine"])["port"]
    place = f"{entry['host']}:{port}" if port else entry["host"]
    return f"{place}/{entry['database']}" if entry["database"] else place


def _connection_line(entry: dict) -> str:
    traits = [entry["engine"], _target(entry)]
    if entry["read_only"]:
        traits.append("read-only")
    if entry["ssh"]:
        traits.append(f"through {entry['ssh']['host']}")
    if not database_engines.driver_ready(entry):
        traits.append("driver missing")
    return f"{entry['id']}: {entry['name']}, {', '.join(traits)}"


def _connections_text() -> str:
    lines = [_connection_line(entry) for entry in databases.load()]
    return "\n".join(lines) if lines else f"No connections yet; {MANAGE} with add creates one."


def _catalog_text(found: dict) -> str:
    if found["databases"] is not None:
        return f"Databases: {', '.join(found['databases'])}\nPass database to look inside one."
    names = [f"{name} (default)" if name == found["default"] else name for name in found["schemas"]]
    return f"Schemas: {', '.join(names) or 'none'}"


def _objects_text(found: dict) -> str:
    return f"Tables: {', '.join(found['tables']) or 'none'}\nViews: {', '.join(found['views']) or 'none'}"


def _named(*parts: Optional[str]) -> str:
    return ".".join(part for part in parts if part)


def _column_line(column: dict) -> str:
    traits = [column["type"]]
    if column["primary_key"]:
        traits.append("primary key")
    if column["auto"]:
        traits.append("auto")
    if not column["nullable"]:
        traits.append("not null")
    if column["default"] is not None:
        traits.append(f"default {column['default']}")
    if column["options"]:
        traits.append(f"one of {', '.join(column['options'])}")
    comment = f" ({column['comment']})" if column["comment"] else ""
    return f"{column['name']}: {', '.join(traits)}{comment}"


def _table_text(info: dict) -> str:
    comment = f" ({info['comment']})" if info["comment"] else ""
    lines = [f"{'View' if info['kind'] == 'view' else 'Table'} {_named(info['schema'], info['name'])}{comment}"]
    lines.extend(_column_line(column) for column in info["columns"])
    lines.extend(
        f"Foreign key {', '.join(key['columns'])} -> {_named(key['schema'], key['table'])} ({', '.join(key['referred'])})"
        for key in info["foreign_keys"]
    )
    lines.extend(
        f"Index {index['name'] or ''} ({', '.join(index['columns'])}){', unique' if index['unique'] else ''}"
        for index in info["indexes"]
    )
    if info["definition"]:
        lines.append(f"Definition: {' '.join(info['definition'].split())}")
    return "\n".join(lines)


def _engines_text() -> str:
    lines = []
    for item in database_engines.listed():
        traits = [item["form"]]
        if item["port"]:
            traits.append(f"port {item['port']}")
        traits.append("driver installed" if item["installed"] else f"driver {' '.join(item['packages'])} missing")
        if item["options"]:
            traits.append(f"options {', '.join(item['options'])}")
        lines.append(f"{item['id']}: {item['label'] or 'Custom SQLAlchemy URL'}, {', '.join(traits)}")
    return "\n".join(lines)


def _failure(exc: Exception) -> str:
    reason = getattr(exc, "reason", "")
    if reason == database_data.WRITES:
        return f"That SQL writes. {QUERY} only reads; {EXECUTE} runs a change the user asked for."
    statement = getattr(exc, "statement", None)
    detail = getattr(exc, "detail", "")
    return f"Failed ({reason}){f' at statement {statement}' if statement else ''}{f': {detail}' if detail else ''}"


async def _answer(work: Callable[[], str]) -> dict:
    try:
        return reply(await asyncio.to_thread(work))
    except FAILURES as exc:
        return reply(_failure(exc))


def _scope(args: dict) -> databases.Scope:
    return databases.Scope(str(args.get("connection") or ""), args.get("database") or None)


def _limit(args: dict) -> int:
    return min(max(int(args.get("limit") or DEFAULT_LIMIT), 1), database_data.MAX_ROWS)


def _offset(args: dict) -> int:
    return max(int(args.get("offset") or 0), 0)


def _fields(args: dict) -> dict:
    return {name: args[name] for name in FIELDS if name in args}


def _install(args: dict) -> str:
    if args.get("packages"):
        database_engines.install_packages(args["packages"])
        return f"Installed {' '.join(args['packages'])} on the server."
    database_engines.install(args.get("engine") or "")
    return f"Installed the driver of {args.get('engine')} on the server."


def _tested(found: dict) -> str:
    return f"Connected, server {found['server']}." if found.get("server") else "Connected."


def _export_file(args: dict, folder: Path) -> str:
    scope = _scope(args)
    if args.get("sql"):
        written = database_data.export_query(scope, args["sql"], folder)
    else:
        written = database_data.export_table(
            scope, args.get("schema") or None, args.get("table") or "", None, False, "", args.get("format") or database_data.CSV, folder,
        )
    return Path(written).name


def make_tools(context: dict) -> list:
    if CAPABILITY not in (context.get("capabilities") or ()):
        return []

    session_info = context.get("session_info")
    emit = context.get("emit")

    def cwd() -> str:
        return ((session_info() or {}).get("cwd") if session_info else None) or ""

    def project_key() -> str:
        return sessions.project_key_for(cwd()) if cwd() else ""

    def opened(raw: str) -> Path:
        path = Path(raw).expanduser()
        return path if path.is_absolute() or not cwd() else Path(cwd()) / path

    async def export(args: dict) -> dict:
        key = project_key()
        try:
            name = await asyncio.to_thread(_export_file, args, shared.project_dir(key))
        except FAILURES as exc:
            return reply(_failure(exc))
        delivered = listing({"paths": [name]}, key)
        if emit is not None:
            await emit({"type": "shared", "files": delivered})
        return reply(f"Wrote {name} and showed it to the user: {delivered[0]['url']}")

    @DB_INSPECT
    async def db_inspect(args):
        if not args.get("connection"):
            return await _answer(_connections_text)
        scope = _scope(args)
        schema = args.get("schema") or None
        if args.get("table"):
            return await _answer(lambda: _table_text(database_data.table(scope, schema, args["table"])))
        if schema:
            return await _answer(lambda: _objects_text(database_data.objects(scope, schema)))
        return await _answer(lambda: _catalog_text(database_data.schemas(scope)))

    @DB_QUERY
    async def db_query(args):
        offset = _offset(args)
        return await _answer(lambda: render(database_data.query(_scope(args), args["sql"], False, _limit(args), offset), offset))

    @DB_EXECUTE
    async def db_execute(args):
        offset = _offset(args)
        return await _answer(lambda: render(database_data.query(_scope(args), args["sql"], True, _limit(args), offset), offset))

    @DB_MANAGE
    async def db_manage(args):
        action = args.get("action")
        connection = args.get("connection") or ""
        engine = args.get("engine") or ""
        if action == ENGINES:
            return await _answer(_engines_text)
        if action == ADD:
            return await _answer(lambda: _connection_line(databases.create(_fields(args))))
        if action == UPDATE:
            return await _answer(lambda: _connection_line(databases.update(connection, _fields(args))))
        if action == REMOVE:
            return await _answer(lambda: databases.remove(connection) or f"Removed {connection}; the database itself is untouched.")
        if action == TEST:
            return await _answer(lambda: _tested(databases.test(_fields(args), connection or None)))
        if action == INSTALL:
            return await _answer(lambda: _install(args))
        if action == UNINSTALL:
            return await _answer(lambda: databases.uninstall_driver(engine) or f"Uninstalled the driver of {engine}.")
        if action == OPEN:
            return await _answer(lambda: _connection_line(databases.open_path(opened(args.get("path") or ""))))
        if action == EXPORT:
            return await export(args)
        return reply(f"action is one of {', '.join(ACTIONS)}.")

    return [db_inspect, db_query, db_execute, db_manage]
