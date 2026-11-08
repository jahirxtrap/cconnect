import csv
import json
import logging
import math
import re
import threading
import time
import uuid
import warnings
from contextlib import contextmanager
from datetime import date, datetime, time as clock, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Iterator, Optional

import sqlglot
from sqlalchemy import Column, MetaData, Table, and_, delete, func, insert, inspect, select, text, types, update
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import NoSuchTableError, SQLAlchemyError
from sqlglot import exp
from sqlglot.errors import ParseError, TokenError
from sqlglot.tokens import TokenType

from services import database_engines, databases, shared

logging.getLogger("sqlglot").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", module="duckdb_engine")

PAGE_SIZES = (25, 50, 100, 200, 500, 1000)
DEFAULT_PAGE = 100
MAX_ROWS = 1000
QUERY_SECONDS = 60
MILLIS = 1000
EXPORT_SECONDS = 900
BINARY_PREVIEW = 32
SAFE_INTEGER = 2**53
SHORT_TEXT = 255
EXPORTS_FOLDER = "databases"
CSV = "csv"
SQL = "sql"
TABLE_FORMATS = (CSV, SQL)
TRUTHY = ("true", "1", "t", "yes")
COLON = ":"
ESCAPED_COLON = "\\:"

SKIP_CHUNK = 1000
OUTSIDE_TRANSACTION = re.compile(
    r"^\s*(CREATE\s+DATABASE|DROP\s+DATABASE|ALTER\s+DATABASE|ALTER\s+SYSTEM|VACUUM|REINDEX"
    r"|CREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY|DROP\s+INDEX\s+CONCURRENTLY|CREATE\s+TABLESPACE|DROP\s+TABLESPACE)\b",
    re.IGNORECASE,
)

READ_COMMANDS = ("EXPLAIN", "SHOW", "DESCRIBE", "DESC")
EXPLAIN_OPTIONS = re.compile(r"^\s*(\([^)]*\)|ANALYZE|ANALYSE|VERBOSE|QUERY\s+PLAN|FORMAT\s+\w+)\b", re.IGNORECASE)
READ_TREES = (exp.Select, exp.SetOperation, exp.Describe, exp.Show)
WRITE_NODES = (exp.Insert, exp.Update, exp.Delete, exp.Merge, exp.Create, exp.Drop, exp.Alter, exp.TruncateTable, exp.Into)
NO_PARAMETERS = {"no_parameters": True}
CHANGES = {exp.Insert: "inserted", exp.Update: "updated", exp.Delete: "deleted"}
DEFINITIONS = {exp.Create: "created", exp.Alter: "altered", exp.Drop: "dropped"}
SHAPED = ("table", "view")
SHAPING = ("created", "altered")
CHANGED_ALIAS = "cconnect_changed"
TOTAL_ALIAS = "cconnect_total"
RETURNING_CTE = "cte"

ROWS = "rows"
CHANGED = "changed"
STRUCTURE = "structure"
DONE = "done"

QUERY_FAILED = "query"
TIMEOUT = "timeout"
READ_ONLY = "read_only"
NOT_EDITABLE = "not_editable"
ROWS_CHANGED = "rows"
INVALID = "invalid"
WRITES = "writes"

KINDS = (
    (types.Boolean, "boolean"),
    (types.Enum, "enum"),
    (types.Integer, "integer"),
    ((types.Numeric, types.Float), "number"),
    ((types.JSON, types.ARRAY), "json"),
    (types.DateTime, "datetime"),
    (types.Date, "date"),
    (types.Time, "time"),
    (types.Text, "text"),
)


DataType = exp.DataType
FLOATS = {DataType.Type.DOUBLE, DataType.Type.FLOAT, DataType.Type.UDOUBLE}
BINARIES = {getattr(DataType.Type, name) for name in ("BINARY", "VARBINARY", "BLOB", "LONGBLOB", "MEDIUMBLOB", "TINYBLOB", "IMAGE") if hasattr(DataType.Type, name)}
DECLARED = (
    ({DataType.Type.BOOLEAN}, types.Boolean),
    (DataType.INTEGER_TYPES, types.Integer),
    (FLOATS, types.Float),
    (DataType.REAL_TYPES, lambda: types.Numeric(asdecimal=True)),
    ({DataType.Type.DATE, DataType.Type.DATE32}, types.Date),
    ({DataType.Type.TIME, DataType.Type.TIMETZ}, types.Time),
    (DataType.TEMPORAL_TYPES, types.DateTime),
    ({DataType.Type.JSON, DataType.Type.JSONB, *DataType.NESTED_TYPES}, types.JSON),
    (BINARIES, types.LargeBinary),
    ({DataType.Type.UUID}, types.Uuid),
    (DataType.TEXT_TYPES, types.String),
)


def declared_type(declared: str, dialect: str) -> Any:
    try:
        kind = DataType.build(declared, dialect=dialect).this
    except (ParseError, TokenError, ValueError):
        return types.NullType()
    return next((made() for group, made in DECLARED if kind in group), types.NullType())


def _python_type(sqltype: Any) -> Any:
    try:
        return sqltype.python_type
    except NotImplementedError:
        return None


def kind_of(sqltype: Any) -> str:
    if _python_type(sqltype) is bytes:
        return "binary"
    for classes, kind in KINDS:
        if isinstance(sqltype, classes):
            return kind
    if isinstance(sqltype, types.String) and (sqltype.length is None or sqltype.length > SHORT_TEXT):
        return "text"
    return "string"


def _type_text(sqltype: Any) -> str:
    if isinstance(sqltype, types.NullType):
        return ""
    try:
        return str(sqltype)
    except Exception:
        return type(sqltype).__name__


def _binary(value: Any) -> Optional[bytes]:
    return bytes(value) if isinstance(value, (bytes, bytearray, memoryview)) else None


def cell(value: Any) -> Any:
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value if abs(value) < SAFE_INTEGER else str(value)
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, (datetime, date, clock)):
        return value.isoformat()
    if isinstance(value, (Decimal, timedelta, uuid.UUID)):
        return str(value)
    data = _binary(value)
    if data is not None:
        return f"0x{data[:BINARY_PREVIEW].hex()}{'…' if len(data) > BINARY_PREVIEW else ''}"
    if isinstance(value, dict):
        return {str(key): cell(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [cell(item) for item in value]
    return str(value)


def _coerce(column: Any, value: Any) -> Any:
    if value is None:
        return None
    kind = kind_of(column.type)
    try:
        if kind == "boolean":
            return value if isinstance(value, bool) else str(value).strip().lower() in TRUTHY
        if kind == "integer":
            return int(value)
        if kind == "number":
            return Decimal(str(value)) if getattr(column.type, "asdecimal", False) else float(value)
        if kind == "json":
            return json.loads(value) if isinstance(value, str) else value
        if kind == "datetime" and isinstance(value, str):
            return datetime.fromisoformat(value)
        if kind == "date" and isinstance(value, str):
            return date.fromisoformat(value)
        if kind == "time" and isinstance(value, str):
            return clock.fromisoformat(value)
        if kind == "binary":
            raise ValueError(column.name)
    except (ValueError, TypeError, InvalidOperation, json.JSONDecodeError) as exc:
        raise databases.DatabaseError(INVALID, column.name) from exc
    return value


def _dialect(scope: databases.Scope) -> str:
    return database_engines.spec_of(databases.require(scope.connection))["sqlglot"]


def statements(sql: str, dialect: str) -> list[str]:
    try:
        tokens = sqlglot.tokenize(sql, read=dialect)
    except TokenError:
        return [sql.strip()] if sql.strip() else []
    parts, start = [], 0
    for token in tokens:
        if token.token_type == TokenType.SEMICOLON:
            parts.append(sql[start:token.start])
            start = token.end + 1
    parts.append(sql[start:])
    return [part.strip() for part in parts if part.strip()]


def _parsed(statement: str, dialect: str) -> Optional[exp.Expression]:
    try:
        return sqlglot.parse_one(statement, read=dialect)
    except (ParseError, TokenError):
        return None


def reads(statement: str, dialect: str) -> bool:
    tree = _parsed(statement, dialect)
    if tree is None:
        return False
    if isinstance(tree, exp.Command):
        name = tree.name.upper()
        if name == "EXPLAIN":
            rest = str(tree.expression.this if isinstance(tree.expression, exp.Literal) else tree.expression or "")
            while EXPLAIN_OPTIONS.match(rest):
                rest = EXPLAIN_OPTIONS.sub("", rest, count=1)
            return reads(rest, dialect)
        return name in READ_COMMANDS
    if isinstance(tree, exp.Pragma):
        return "=" not in statement
    return isinstance(tree, READ_TREES) and tree.find(*WRITE_NODES) is None


def _effect_of(tree: Optional[exp.Expression]) -> Optional[dict]:
    action = CHANGES.get(type(tree)) or DEFINITIONS.get(type(tree))
    if action is None:
        return None
    kind = "table" if type(tree) in CHANGES else str(tree.args.get("kind") or "").lower()
    if isinstance(tree.this, exp.Index):
        return {"action": action, "object": kind, "schema": None, "name": tree.this.name}
    target = tree.this if isinstance(tree.this, exp.Table) else tree.find(exp.Table)
    if target is None:
        return {"action": action, "object": kind, "schema": None, "name": ""}
    return {"action": action, "object": kind, "schema": target.db or None, "name": target.name}


def effects(connection_id: str, sql: str) -> list[Optional[dict]]:
    found = databases.find(connection_id)
    dialect = database_engines.spec_of(found)["sqlglot"] if found else ""
    return [_effect_of(_parsed(part, dialect)) for part in statements(sql, dialect)]


def _interrupt(connection: Connection, fired: threading.Event) -> None:
    fired.set()
    raw = connection.connection.dbapi_connection
    stop = getattr(raw, "cancel", None) or getattr(raw, "interrupt", None)
    if stop is not None:
        stop()


def _restore(connection: Connection, restoring: list[str]) -> None:
    try:
        for statement in restoring:
            connection.exec_driver_sql(statement)
    except SQLAlchemyError:
        connection.invalidate()


@contextmanager
def _session(engine: Engine, entry: dict, write: bool, seconds: int = QUERY_SECONDS, autocommit: bool = False) -> Iterator[Connection]:
    item = database_engines.spec_of(entry)
    try:
        opened = engine.connect()
        if autocommit:
            opened.execution_options(isolation_level="AUTOCOMMIT")
    except SQLAlchemyError as exc:
        raise databases.DatabaseError(databases.CONNECT_FAILED, databases.detail_of(exc)) from exc
    fired = threading.Event()
    with opened as connection:
        timer = threading.Timer(seconds, _interrupt, (connection, fired))
        try:
            if not write:
                for statement in item["read_only"]:
                    connection.exec_driver_sql(statement)
            if item["timeout"]:
                connection.exec_driver_sql(item["timeout"].format(milliseconds=seconds * MILLIS, seconds=seconds))
            timer.start()
            yield connection
            timer.cancel()
            if write:
                connection.commit()
            else:
                connection.rollback()
        except databases.DatabaseError as exc:
            connection.rollback()
            if fired.is_set():
                raise databases.DatabaseError(TIMEOUT, str(seconds), exc.statement) from exc
            raise
        except SQLAlchemyError as exc:
            connection.rollback()
            if fired.is_set():
                raise databases.DatabaseError(TIMEOUT, str(seconds)) from exc
            raise databases.DatabaseError(QUERY_FAILED, databases.detail_of(exc)) from exc
        finally:
            timer.cancel()
            if not write:
                _restore(connection, item["read_write"])


def _reading(scope: databases.Scope, seconds: int = QUERY_SECONDS):
    engine, entry = databases.engine_for(scope)
    return _session(engine, entry, False, seconds)


def _writing(scope: databases.Scope, autocommit: bool = False):
    engine, entry = databases.engine_for(scope)
    if entry["read_only"]:
        raise databases.DatabaseError(READ_ONLY)
    return _session(engine, entry, True, autocommit=autocommit)


def _databases(connection: Connection, item: dict) -> list[str]:
    return [str(name) for name in connection.execute(text(item["databases"])).scalars()]


def schemas(scope: databases.Scope) -> dict:
    entry = databases.require(scope.connection)
    item = database_engines.spec_of(entry)
    if not scope.database and databases.listable(entry):
        found = _probe(scope, lambda connection: _databases(connection, item))
        if found:
            return {"databases": found, "schemas": [], "default": None}
    hidden = set(item["hidden_schemas"])
    with _reading(scope) as connection:
        inspector = inspect(connection)
        names = [name for name in inspector.get_schema_names() if name not in hidden]
        return {"databases": None, "schemas": names, "default": inspector.default_schema_name}


def _probe(scope: databases.Scope, read: Callable[[Connection], Any], fallback: Any = None) -> Any:
    try:
        with _reading(scope) as connection:
            return read(connection)
    except NotImplementedError:
        return fallback
    except databases.DatabaseError as exc:
        if exc.reason != QUERY_FAILED:
            raise
        return fallback


def _inspected(scope: databases.Scope, read: Callable[[Any], Any], fallback: Any = None) -> Any:
    return _probe(scope, lambda connection: read(inspect(connection)), fallback)


def _materialized(scope: databases.Scope, schema: Optional[str]) -> list[str]:
    return _inspected(scope, lambda inspector: inspector.get_materialized_view_names(schema=schema), [])


def objects(scope: databases.Scope, schema: Optional[str]) -> dict:
    with _reading(scope) as connection:
        inspector = inspect(connection)
        tables = inspector.get_table_names(schema=schema)
        views = inspector.get_view_names(schema=schema)
    return {"tables": sorted(tables), "views": sorted({*views, *_materialized(scope, schema)})}


def _catalog_query(item: dict, key: str) -> str:
    return item[key].format(table=item["table_filter"])


def _columns(connection: Connection, item: dict, schema: Optional[str], name: str) -> list[dict]:
    if item["columns"]:
        found = connection.execute(text(_catalog_query(item, "columns")), {"name": name, "schema": schema}).mappings().all()
        if not found:
            raise databases.DatabaseError(databases.MISSING, name)
        return [{**row, "type": declared_type(row["declared"], item["sqlglot"])} for row in found]
    try:
        return inspect(connection).get_columns(name, schema=schema)
    except NoSuchTableError as exc:
        raise databases.DatabaseError(databases.MISSING, name) from exc


def _primary(connection: Connection, item: dict, schema: Optional[str], name: str) -> list[str]:
    if item["primary_key"]:
        return list(connection.execute(text(_catalog_query(item, "primary_key")), {"name": name, "schema": schema}).scalar() or [])
    return inspect(connection).get_pk_constraint(name, schema=schema).get("constrained_columns") or []


def _auto(column: dict, primary: list[str]) -> bool:
    if column.get("autoincrement") is True or column.get("identity") or "nextval(" in str(column.get("default") or ""):
        return True
    return primary == [column["name"]] and kind_of(column["type"]) == "integer"


def _column(column: dict, primary: list[str]) -> dict:
    return {
        "name": column["name"],
        "type": column.get("declared") or _type_text(column["type"]),
        "kind": kind_of(column["type"]),
        "nullable": column.get("nullable", True) is not False and column["name"] not in primary,
        "default": None if column.get("default") is None else str(column["default"]),
        "auto": _auto(column, primary),
        "primary_key": column["name"] in primary,
        "comment": column.get("comment"),
        "options": list(getattr(column["type"], "enums", None) or []),
    }


def _foreign(key: dict) -> dict:
    return {
        "columns": key.get("constrained_columns") or [],
        "schema": key.get("referred_schema"),
        "table": key.get("referred_table"),
        "referred": key.get("referred_columns") or [],
    }


def _index(index: dict) -> dict:
    return {"name": index.get("name"), "columns": [str(column) for column in index.get("column_names") or [] if column], "unique": bool(index.get("unique"))}


def table(scope: databases.Scope, schema: Optional[str], name: str) -> dict:
    entry = databases.require(scope.connection)
    item = database_engines.spec_of(entry)
    with _reading(scope) as connection:
        columns = _columns(connection, item, schema, name)
        views = inspect(connection).get_view_names(schema=schema)
    view = name in views or name in _materialized(scope, schema)
    primary = [] if view else _probe(scope, lambda connection: _primary(connection, item, schema, name), [])
    return {
        "schema": schema,
        "name": name,
        "kind": "view" if view else "table",
        "comment": (_inspected(scope, lambda inspector: inspector.get_table_comment(name, schema=schema), {}) or {}).get("text"),
        "definition": _inspected(scope, lambda inspector: inspector.get_view_definition(name, schema=schema)) if view else None,
        "editable": not view and bool(primary) and not entry["read_only"],
        "primary_key": primary,
        "columns": [_column(column, primary) for column in columns],
        "foreign_keys": [_foreign(key) for key in _inspected(scope, lambda inspector: inspector.get_foreign_keys(name, schema=schema), [])],
        "indexes": [_index(index) for index in _inspected(scope, lambda inspector: inspector.get_indexes(name, schema=schema), [])],
    }


def _reflect(scope: databases.Scope, connection: Connection, schema: Optional[str], name: str) -> Table:
    item = database_engines.spec_of(databases.require(scope.connection))
    primary = _primary(connection, item, schema, name)
    columns = [Column(column["name"], column["type"], primary_key=column["name"] in primary) for column in _columns(connection, item, schema, name)]
    return Table(name, MetaData(), *columns, schema=schema)


def _filtered(scope: databases.Scope, reflected: Table, where: str):
    query = select(reflected)
    if not where.strip():
        return query
    dialect = _dialect(scope)
    probe = f"SELECT * FROM t WHERE {where}"
    if len(statements(probe, dialect)) != 1 or not reads(probe, dialect):
        raise databases.DatabaseError(INVALID, where)
    return query.where(text(f"({where.replace(COLON, ESCAPED_COLON)}\n)"))


def _ordered(query: Any, reflected: Table, sort: Optional[str], descending: bool):
    if sort and sort in reflected.c:
        column = reflected.c[sort]
        return query.order_by(column.desc() if descending else column.asc())
    return query.order_by(*(list(reflected.primary_key.columns) or list(reflected.columns)[:1]))


def rows(scope: databases.Scope, schema: Optional[str], name: str, page: int, size: int, sort: Optional[str], descending: bool, where: str) -> dict:
    size = size if size in PAGE_SIZES else DEFAULT_PAGE
    page = max(page, 1)
    with _reading(scope) as connection:
        reflected = _reflect(scope, connection, schema, name)
        filtered = _filtered(scope, reflected, where)
        total = connection.scalar(select(func.count()).select_from(filtered.subquery()))
        result = connection.execute(_ordered(filtered, reflected, sort, descending).limit(size).offset((page - 1) * size))
        return {
            "columns": list(result.keys()),
            "rows": [[cell(value) for value in row] for row in result],
            "total": total or 0,
            "page": page,
            "size": size,
        }


def outside_transaction(statement: str) -> bool:
    return bool(OUTSIDE_TRANSACTION.match(statement))


def _skip(result: Any, count: int) -> None:
    while count > 0:
        taken = len(result.fetchmany(min(count, SKIP_CHUNK)))
        if not taken:
            return
        count -= taken


def _counted(result: Any) -> Optional[int]:
    return result.rowcount if result.rowcount is not None and result.rowcount >= 0 else None


def _statement_result(result: Any, limit: int, offset: int, changes: bool) -> dict:
    if not result.returns_rows:
        return {"kind": CHANGED if changes else DONE, "columns": None, "rows": None, "more": False, "affected": _counted(result)}
    _skip(result, offset)
    fetched = result.fetchmany(limit + 1)
    return {
        "kind": CHANGED if changes else ROWS,
        "columns": list(result.keys()),
        "rows": [[cell(value) for value in row] for row in fetched[:limit]],
        "more": len(fetched) > limit,
        "affected": _counted(result) if changes else None,
    }


def _returning(tree: Optional[exp.Expression], item: dict) -> Optional[str]:
    if type(tree) not in CHANGES or any(tree.args.get(key) for key in ("returning", "order", "limit")):
        return None
    return item["returning"]


def _with_returning(statement: str, mode: str, limit: int) -> str:
    changing = f"{statement}\nRETURNING *"
    if mode != RETURNING_CTE:
        return changing
    return f"WITH {CHANGED_ALIAS} AS (\n{changing}\n) SELECT *, count(*) OVER () AS {TOTAL_ALIAS} FROM {CHANGED_ALIAS} LIMIT {limit + 1}"


def _changed_result(result: Any, mode: str, limit: int) -> dict:
    columns = list(result.keys())
    kept: list[Any] = []
    total = 0
    if mode == RETURNING_CTE:
        fetched = result.fetchall()
        total = fetched[0][-1] if fetched else 0
        columns = columns[:-1]
        kept = [row[:-1] for row in fetched[:limit]]
    else:
        for row in result:
            total += 1
            if total <= limit:
                kept.append(row)
    return {
        "kind": CHANGED,
        "columns": columns,
        "rows": [[cell(value) for value in row] for row in kept],
        "more": total > limit,
        "affected": total,
    }


def _structure(scope: databases.Scope, found: dict) -> Optional[list[dict]]:
    try:
        info = table(scope, found["schema"], found["name"])
    except (databases.DatabaseError, SQLAlchemyError, NoSuchTableError):
        return None
    return [
        {key: column[key] for key in ("name", "type", "primary_key", "nullable", "auto", "default")}
        for column in info["columns"]
    ]


def _shaped(scope: databases.Scope, done: dict) -> dict:
    found = done["effect"]
    if not found or found["action"] not in SHAPING or found["object"] not in SHAPED:
        return done
    columns = _structure(scope, found)
    return {**done, "kind": STRUCTURE, "structure": columns} if columns else done


def query(scope: databases.Scope, sql: str, write: bool, limit: int = MAX_ROWS, offset: int = 0) -> dict:
    item = database_engines.spec_of(databases.require(scope.connection))
    dialect = item["sqlglot"]
    parts = statements(sql, dialect)
    if not parts:
        raise databases.DatabaseError(INVALID)
    reading = all(reads(part, dialect) for part in parts)
    if not reading and not write:
        raise databases.DatabaseError(WRITES)
    limit = max(1, min(limit, MAX_ROWS))
    offset = max(0, offset)
    outside = not reading and any(map(outside_transaction, parts))
    if outside:
        databases.release_others(scope)
    started = time.monotonic()
    results: list[dict] = []
    with (_reading(scope) if reading else _writing(scope, outside)) as connection:
        for index, part in enumerate(parts, 1):
            tree = None if reading else _parsed(part, dialect)
            mode = _returning(tree, item)
            try:
                result = connection.exec_driver_sql(_with_returning(part, mode, limit) if mode else part, execution_options=NO_PARAMETERS)
                done = _changed_result(result, mode, limit) if mode else _statement_result(result, limit, offset, type(tree) in CHANGES)
            except SQLAlchemyError as exc:
                raise databases.DatabaseError(QUERY_FAILED, databases.detail_of(exc), index) from exc
            results.append({**done, "effect": _effect_of(tree), "structure": None})
    elapsed = round((time.monotonic() - started) * 1000)
    results = [_shaped(scope, found) for found in results]
    shown = next((found for found in reversed(results) if found["columns"] is not None), None)
    counts = [found["affected"] for found in results if found["affected"] is not None]
    return {
        "results": results,
        "columns": shown["columns"] if shown else None,
        "rows": shown["rows"] if shown else None,
        "truncated": bool(shown and shown["more"]),
        "affected": sum(counts) if counts else None,
        "statements": len(parts),
        "wrote": not reading,
        "transaction": not outside,
        "elapsed": elapsed,
    }


def _values(reflected: Table, values: dict) -> dict:
    unknown = [key for key in values if key not in reflected.c]
    if unknown:
        raise databases.DatabaseError(INVALID, unknown[0])
    return {key: _coerce(reflected.c[key], value) for key, value in values.items()}


def _keyed(reflected: Table, key: dict):
    columns = list(reflected.primary_key.columns)
    if not columns or any(column.name not in key for column in columns):
        raise databases.DatabaseError(NOT_EDITABLE)
    return and_(*(column == _coerce(column, key[column.name]) for column in columns))


def _one(result: Any) -> None:
    if result.rowcount != 1:
        raise databases.DatabaseError(ROWS_CHANGED, str(result.rowcount))


def insert_row(scope: databases.Scope, schema: Optional[str], name: str, values: dict) -> None:
    with _writing(scope) as connection:
        reflected = _reflect(scope, connection, schema, name)
        connection.execute(insert(reflected).values(**_values(reflected, values)))


def update_row(scope: databases.Scope, schema: Optional[str], name: str, key: dict, values: dict) -> None:
    if not values:
        return
    with _writing(scope) as connection:
        reflected = _reflect(scope, connection, schema, name)
        _one(connection.execute(update(reflected).where(_keyed(reflected, key)).values(**_values(reflected, values))))


def delete_row(scope: databases.Scope, schema: Optional[str], name: str, key: dict) -> None:
    with _writing(scope) as connection:
        reflected = _reflect(scope, connection, schema, name)
        _one(connection.execute(delete(reflected).where(_keyed(reflected, key))))


def _file_safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._-")


def _export_file(entry: dict, base: str, extension: str, folder: Optional[Path] = None) -> Path:
    folder = folder or shared.project_dir("") / EXPORTS_FOLDER / _file_safe(entry["id"])
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return folder / f"{_file_safe(base) or _file_safe(entry['id'])}-{stamp}.{extension}"


def _relative(target: Path) -> str:
    return target.relative_to(shared.project_dir("")).as_posix()


def _csv_value(value: Any) -> Any:
    data = _binary(value)
    if data is not None:
        return f"0x{data.hex()}"
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(cell(value), ensure_ascii=False)
    if isinstance(value, (datetime, date, clock)):
        return value.isoformat()
    return value


def _write_csv(target: Path, columns: list[str], source: Any) -> None:
    with target.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        for row in source:
            writer.writerow([_csv_value(value) for value in row])


def _renderer(column: Any, engine: Engine, binary: str) -> Callable[[Any], str]:
    dialect = engine.dialect
    quoted = types.String().literal_processor(dialect)
    try:
        own = column.type.dialect_impl(dialect).literal_processor(dialect)
    except NotImplementedError:
        own = None

    def render(value: Any) -> str:
        data = _binary(value)
        if value is None:
            return "NULL"
        if data is not None:
            return binary.format(hex=data.hex())
        if isinstance(value, (dict, list)):
            return quoted(json.dumps(cell(value), ensure_ascii=False))
        if own is not None:
            try:
                return own(value)
            except (TypeError, ValueError, SQLAlchemyError):
                return quoted(str(value))
        return quoted(str(value))

    return render


def _write_inserts(target: Path, engine: Engine, entry: dict, reflected: Table, source: Any) -> None:
    binary = database_engines.spec_of(entry)["binary"]
    quote = engine.dialect.identifier_preparer.quote
    name = ".".join(quote(part) for part in (reflected.schema, reflected.name) if part)
    columns = ", ".join(quote(column.name) for column in reflected.columns)
    renderers = [_renderer(column, engine, binary) for column in reflected.columns]
    with target.open("w", encoding="utf-8", newline="\n") as handle:
        for row in source:
            values = ", ".join(render(value) for render, value in zip(renderers, row))
            handle.write(f"INSERT INTO {name} ({columns}) VALUES ({values});\n")


def export_table(
    scope: databases.Scope,
    schema: Optional[str],
    name: str,
    sort: Optional[str],
    descending: bool,
    where: str,
    format: str,
    folder: Optional[Path] = None,
) -> str:
    if format not in TABLE_FORMATS:
        raise databases.DatabaseError(INVALID, format)
    engine, entry = databases.engine_for(scope)
    target = _export_file(entry, name, format, folder)
    with _reading(scope, EXPORT_SECONDS) as connection:
        reflected = _reflect(scope, connection, schema, name)
        selected = _ordered(_filtered(scope, reflected, where), reflected, sort, descending)
        result = connection.execution_options(stream_results=True).execute(selected)
        if format == CSV:
            _write_csv(target, list(result.keys()), result)
        else:
            _write_inserts(target, engine, entry, reflected, result)
    return _relative(target)


def export_query(scope: databases.Scope, sql: str, folder: Optional[Path] = None) -> str:
    entry = databases.require(scope.connection)
    dialect = _dialect(scope)
    parts = statements(sql, dialect)
    if len(parts) != 1 or not reads(parts[0], dialect):
        raise databases.DatabaseError(INVALID)
    target = _export_file(entry, scope.database or entry["name"], CSV, folder)
    with _reading(scope, EXPORT_SECONDS) as connection:
        result = connection.execution_options(stream_results=True).exec_driver_sql(parts[0], execution_options=NO_PARAMETERS)
        if not result.returns_rows:
            raise databases.DatabaseError(INVALID)
        _write_csv(target, list(result.keys()), result)
    return _relative(target)
