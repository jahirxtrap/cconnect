import asyncio
from typing import Any, Literal, Optional

from fastapi import APIRouter, Header
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core.access import key_matches
from core.responses import api_response
from services import database_data, database_engines, databases

router = APIRouter(tags=["Databases"])


class Tunnel(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: Optional[int] = None
    user: str = Field("", max_length=255)
    key: str = Field("", max_length=4096)


class ConnectionFields(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    engine: Optional[str] = None
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = None
    database: Optional[str] = Field(None, max_length=255)
    user: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None, max_length=4096)
    path: Optional[str] = Field(None, max_length=4096)
    url: Optional[str] = Field(None, max_length=4096)
    packages: Optional[list[str]] = None
    options: Optional[dict[str, str]] = None
    read_only: Optional[bool] = None
    ssh: Optional[Tunnel] = None


class TestRequest(ConnectionFields):
    id: Optional[str] = None


class Scoped(BaseModel):
    database: Optional[str] = Field(None, max_length=255)


class TableRef(Scoped):
    schema_name: Optional[str] = Field(None, alias="schema")
    name: str = Field(min_length=1)


class Browse(TableRef):
    page: int = 1
    size: int = database_data.DEFAULT_PAGE
    sort: Optional[str] = None
    descending: bool = False
    where: str = ""


class Packages(BaseModel):
    packages: list[str] = Field(min_length=1)


class DatabaseFile(BaseModel):
    project: Optional[str] = None
    path: str = Field(min_length=1, max_length=4096)


class Statement(Scoped):
    sql: str = Field(min_length=1)


class NewRow(TableRef):
    values: dict[str, Any]


class RowChange(TableRef):
    key: dict[str, Any]
    values: dict[str, Any]


class RowKey(TableRef):
    key: dict[str, Any]


class TableExport(Browse):
    format: Literal[database_data.CSV, database_data.SQL] = database_data.CSV


def _failed(exc: Exception) -> Response:
    if isinstance(exc, databases.DatabaseError) and exc.reason == database_data.WRITES:
        return api_response(status=403)
    data = {"reason": exc.reason, "detail": exc.detail, "statement": getattr(exc, "statement", None)}
    if isinstance(exc, databases.DatabaseError) and exc.reason == databases.MISSING:
        return api_response(status=404, data=data)
    return api_response(status=422, data=data)


FAILURES = (databases.DatabaseError, database_engines.EngineError)


async def _answer(work, *args) -> Response:
    try:
        return api_response(data=await asyncio.to_thread(work, *args))
    except FAILURES as exc:
        return _failed(exc)


async def _keyed(key: str, work, *args) -> Response:
    if not key_matches(key):
        return api_response(status=403)
    return await _answer(work, *args)


async def _reading(connection_id: str, key: str, work, *args) -> Response:
    if not databases.is_file(connection_id) and not key_matches(key):
        return api_response(status=403)
    return await _answer(work, *args)


def _fields(body: ConnectionFields) -> dict:
    return body.model_dump(exclude_unset=True)


def _drivers() -> dict:
    return {"engines": database_engines.listed()}


@router.get("/databases/engines")
def database_catalog():
    return api_response(data={
        **_drivers(),
        "page_sizes": list(database_data.PAGE_SIZES),
        "page_size": database_data.DEFAULT_PAGE,
        "max_rows": database_data.MAX_ROWS,
    })


@router.get("/databases")
async def list_databases(x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: {"connections": [databases.listed(entry) for entry in databases.load()]})


@router.post("/databases")
async def add_database(body: ConnectionFields, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: databases.listed(databases.create(_fields(body))))


@router.patch("/databases/{connection_id}")
async def change_database(connection_id: str, body: ConnectionFields, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: databases.listed(databases.update(connection_id, _fields(body))))


@router.delete("/databases/{connection_id}")
async def remove_database(connection_id: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, databases.remove, connection_id)


@router.post("/databases/test")
async def test_database(body: TestRequest, x_security_key: str = Header("")):
    return await _keyed(x_security_key, databases.test, _fields(body), body.id)


@router.post("/databases/engines/{engine}/install")
async def install_engine(engine: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: database_engines.install(engine) or _drivers())


@router.post("/databases/packages")
async def install_packages(body: Packages, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: database_engines.install_packages(body.packages) or _drivers())


@router.delete("/databases/engines/{engine}")
async def uninstall_engine(engine: str, x_security_key: str = Header("")):
    return await _keyed(x_security_key, lambda: databases.uninstall_driver(engine) or _drivers())


@router.post("/databases/files")
async def open_database_file(body: DatabaseFile, x_security_key: str = Header("")):
    return await _answer(lambda: databases.listed(databases.open_file(body.project, body.path, key_matches(x_security_key))))


@router.get("/databases/{connection_id}/schemas")
async def database_schemas(connection_id: str, database: Optional[str] = None, x_security_key: str = Header("")):
    return await _reading(connection_id, x_security_key, database_data.schemas, databases.Scope(connection_id, database))


@router.get("/databases/{connection_id}/objects")
async def database_objects(connection_id: str, schema: Optional[str] = None, database: Optional[str] = None, x_security_key: str = Header("")):
    return await _reading(connection_id, x_security_key, database_data.objects, databases.Scope(connection_id, database), schema)


@router.get("/databases/{connection_id}/table")
async def database_table(connection_id: str, name: str, schema: Optional[str] = None, database: Optional[str] = None, x_security_key: str = Header("")):
    return await _reading(connection_id, x_security_key, database_data.table, databases.Scope(connection_id, database), schema, name)


@router.post("/databases/{connection_id}/browse")
async def browse_table(connection_id: str, body: Browse, x_security_key: str = Header("")):
    return await _reading(
        connection_id, x_security_key,
        database_data.rows, databases.Scope(connection_id, body.database), body.schema_name, body.name, body.page, body.size, body.sort, body.descending, body.where,
    )


@router.post("/databases/{connection_id}/query")
async def run_query(connection_id: str, body: Statement, x_security_key: str = Header("")):
    return await _reading(connection_id, x_security_key, database_data.query, databases.Scope(connection_id, body.database), body.sql, key_matches(x_security_key))


@router.post("/databases/{connection_id}/rows")
async def insert_row(connection_id: str, body: NewRow, x_security_key: str = Header("")):
    return await _keyed(x_security_key, database_data.insert_row, databases.Scope(connection_id, body.database), body.schema_name, body.name, body.values)


@router.patch("/databases/{connection_id}/rows")
async def update_row(connection_id: str, body: RowChange, x_security_key: str = Header("")):
    return await _keyed(x_security_key, database_data.update_row, databases.Scope(connection_id, body.database), body.schema_name, body.name, body.key, body.values)


@router.post("/databases/{connection_id}/rows/delete")
async def delete_row(connection_id: str, body: RowKey, x_security_key: str = Header("")):
    return await _keyed(x_security_key, database_data.delete_row, databases.Scope(connection_id, body.database), body.schema_name, body.name, body.key)


@router.post("/databases/{connection_id}/export")
async def export_table(connection_id: str, body: TableExport, x_security_key: str = Header("")):
    return await _reading(
        connection_id, x_security_key,
        lambda: {"path": database_data.export_table(
            databases.Scope(connection_id, body.database), body.schema_name, body.name, body.sort, body.descending, body.where, body.format,
        )},
    )


@router.post("/databases/{connection_id}/export/query")
async def export_query(connection_id: str, body: Statement, x_security_key: str = Header("")):
    return await _reading(connection_id, x_security_key, lambda: {"path": database_data.export_query(databases.Scope(connection_id, body.database), body.sql)})
