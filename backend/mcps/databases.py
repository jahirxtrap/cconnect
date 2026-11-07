import asyncio
import json

from claude_agent_sdk import tool

from services import database_data, database_engines, databases

GROUP = "databases"
GROUP_SUMMARY = "Read, create and manage the database connections of the app's Databases panel; changes take the security key."
EXECUTE = "db_execute"
MANAGE = "db_manage"
DEFAULT_LIMIT = 200
ENGINES = "engines"
ADD = "add"
UPDATE = "update"
REMOVE = "remove"
TEST = "test"
INSTALL = "install"
UNINSTALL = "uninstall"
ACTIONS = [ENGINES, ADD, UPDATE, REMOVE, TEST, INSTALL, UNINSTALL]
KEYED_ACTIONS = (ADD, UPDATE, REMOVE, TEST)

CONNECTIONS = (
    "The database connections of the app's Databases panel: id, name, engine, where it points and whether it is"
    " read-only. Call it first to get the id the other db tools take."
)

SCHEMA = (
    "What a database connection holds. With only connection it lists the schemas, or the server's databases when"
    " the connection names none of its own; give one of them as database to look inside it. With schema it lists"
    " that schema's tables and views; with table it describes that table: columns with their types, primary key,"
    " foreign keys and indexes. Use it before writing SQL against a database you have not looked at."
)

QUERY = (
    "Run read-only SQL on a database connection: SELECT, WITH, EXPLAIN, SHOW, DESCRIBE. It runs in a transaction"
    f" that is rolled back and refuses anything that writes. Answers JSON with columns and rows, at most {DEFAULT_LIMIT}"
    f" rows unless limit asks for more (up to {database_data.MAX_ROWS}), and whether rows were left out."
)

EXECUTE_DESCRIPTION = (
    "Run SQL that changes a database connection: INSERT, UPDATE, DELETE, CREATE, ALTER, DROP. The statements run"
    " together and are committed only if every one succeeds. Only when the user asked for the change; for reading"
    " use db_query. Refused on a connection the user marked read-only."
)

MANAGE_DESCRIPTION = (
    "Manage the Databases panel the user sees. engines lists every engine a connection can use, with its form, default"
    " port, the options its URL usually takes and whether its driver is installed. add creates a connection, update"
    " changes one (only the fields given), remove deletes it and test connects without saving. install and uninstall"
    " put an engine's driver on the server or take it off; a custom connection names its own pip packages, installed"
    " with install and packages. A file engine takes path; a server engine takes host, port, database, user, password"
    " and options (its URL query, such as Snowflake's warehouse); the custom engine takes url, any SQLAlchemy URL."
    " Passwords stay on the server and are never shown again."
)

CONNECTION = {"type": "string", "description": "The connection's id, from db_connections."}
SQL = {"type": "string", "description": "One or more statements separated by semicolons."}
DATABASE = {
    "type": "string",
    "description": "One of the databases db_schema lists for a connection that names none of its own. The connection's own when left out.",
}

SCHEMA_INPUT = {
    "type": "object",
    "properties": {
        "connection": CONNECTION,
        "database": DATABASE,
        "schema": {"type": "string", "description": "A schema from the list. Its tables and views when table is left out."},
        "table": {"type": "string", "description": "A table or view in schema, or in the default schema when schema is left out."},
    },
    "required": ["connection"],
}

QUERY_INPUT = {
    "type": "object",
    "properties": {
        "connection": CONNECTION,
        "database": DATABASE,
        "sql": SQL,
        "limit": {"type": "integer", "description": f"Rows to return. {DEFAULT_LIMIT} by default."},
    },
    "required": ["connection", "sql"],
}

EXECUTE_INPUT = {
    "type": "object",
    "properties": {"connection": CONNECTION, "database": DATABASE, "sql": SQL},
    "required": ["connection", "sql"],
}

MANAGE_INPUT = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ACTIONS},
        "connection": {"type": "string", "description": "update, remove and test: the connection's id. test without it checks the fields given."},
        "engine": {"type": "string", "description": "add, install and uninstall: an engine id from engines."},
        "name": {"type": "string", "description": "add and update: the name the panel shows."},
        "path": {"type": "string", "description": "A file engine's database file on the server."},
        "host": {"type": "string"},
        "port": {"type": "integer"},
        "database": {"type": "string"},
        "user": {"type": "string"},
        "password": {"type": "string"},
        "options": {"type": "object", "additionalProperties": {"type": "string"}, "description": "Query parameters of a server engine's URL."},
        "url": {"type": "string", "description": "The custom engine's SQLAlchemy URL."},
        "packages": {"type": "array", "items": {"type": "string"}, "description": "The custom engine's pip packages, or what install puts on the server."},
        "read_only": {"type": "boolean"},
        "ssh": {
            "type": "object",
            "properties": {"host": {"type": "string"}, "port": {"type": "integer"}, "user": {"type": "string"}, "key": {"type": "string"}},
            "description": "An SSH tunnel through another machine, with the server's ssh client and a key or agent.",
        },
    },
    "required": ["action"],
}

FIELDS = tuple(name for name in databases.FIELDS if name in MANAGE_INPUT["properties"])


def needs_key(name: str, args: dict) -> bool:
    if name == EXECUTE:
        return True
    return name == MANAGE and (args.get("action") in KEYED_ACTIONS or (args.get("action") == INSTALL and bool(args.get("packages"))))


def _text(body: str) -> dict:
    return {"content": [{"type": "text", "text": body}]}


def _json(value: object) -> dict:
    return _text(json.dumps(value, ensure_ascii=False, default=str))


def _target(entry: dict) -> str:
    if entry["path"] or entry["url"]:
        return entry["path"] or entry["url"]
    port = entry["port"] or database_engines.spec(entry["engine"])["port"]
    place = f"{entry['host']}:{port}" if port else entry["host"]
    return f"{place}/{entry['database']}" if entry["database"] else place


def _connection(entry: dict) -> dict:
    return {
        "id": entry["id"],
        "name": entry["name"],
        "engine": entry["engine"],
        "target": _target(entry),
        "ssh": entry["ssh"]["host"] if entry["ssh"] else None,
        "read_only": entry["read_only"],
        "driver": database_engines.driver_ready(entry),
    }


def _failure(exc: Exception) -> dict:
    if exc.reason == database_data.WRITES:
        return _text(f"That SQL writes. db_query only reads; use {EXECUTE} for a change the user asked for.")
    detail = f": {exc.detail}" if exc.detail else ""
    return _text(f"Failed ({exc.reason}){detail}")


def _limited(limit: int):
    def shape(result: dict) -> dict:
        found = result["rows"]
        return result if found is None or len(found) <= limit else {**result, "rows": found[:limit], "truncated": True}

    return shape


async def _run(work, *args, shape=None) -> dict:
    try:
        result = await asyncio.to_thread(work, *args)
    except (databases.DatabaseError, database_engines.EngineError) as exc:
        return _failure(exc)
    return _json(shape(result) if shape else result)


def _fields(args: dict) -> dict:
    return {name: args[name] for name in FIELDS if name in args}


def _scope(args: dict) -> databases.Scope:
    return databases.Scope(args["connection"], args.get("database") or None)


def _install(args: dict) -> None:
    if args.get("packages"):
        database_engines.install_packages(args["packages"])
    else:
        database_engines.install(args.get("engine") or "")


def _uninstall(engine: str) -> None:
    for same in database_engines.driver_of(engine):
        databases.close_engine(same)
    database_engines.uninstall(engine)


@tool("db_connections", CONNECTIONS, {"type": "object", "properties": {}})
async def db_connections(args):
    return _json([_connection(entry) for entry in databases.load()])


@tool("db_schema", SCHEMA, SCHEMA_INPUT)
async def db_schema(args):
    scope = _scope(args)
    schema = args.get("schema") or None
    if args.get("table"):
        return await _run(database_data.table, scope, schema, args["table"])
    if schema:
        return await _run(database_data.objects, scope, schema)
    return await _run(database_data.schemas, scope)


@tool("db_query", QUERY, QUERY_INPUT)
async def db_query(args):
    limit = min(max(int(args.get("limit") or DEFAULT_LIMIT), 1), database_data.MAX_ROWS)
    return await _run(database_data.query, _scope(args), args["sql"], False, shape=_limited(limit))


@tool(EXECUTE, EXECUTE_DESCRIPTION, EXECUTE_INPUT)
async def db_execute(args):
    return await _run(database_data.query, _scope(args), args["sql"], True)


@tool(MANAGE, MANAGE_DESCRIPTION, MANAGE_INPUT)
async def db_manage(args):
    action = args.get("action")
    connection = args.get("connection") or ""
    if action == ENGINES:
        return _json(database_engines.listed())
    if action == ADD:
        return await _run(lambda: _connection(databases.create(_fields(args))))
    if action == UPDATE:
        return await _run(lambda: _connection(databases.update(connection, _fields(args))))
    if action == REMOVE:
        return await _run(lambda: databases.remove(connection) or {"removed": connection})
    if action == TEST:
        return await _run(databases.test, _fields(args), connection or None)
    if action == INSTALL:
        return await _run(lambda: _install(args) or {"installed": args.get("packages") or args.get("engine")})
    if action == UNINSTALL:
        return await _run(lambda: _uninstall(args.get("engine") or "") or {"uninstalled": args.get("engine")})
    return _text(f"action is one of {', '.join(ACTIONS)}.")


tools = [db_connections, db_schema, db_query, db_execute, db_manage]
