"""SQLite data layer (SQLAlchemy 2.0, sync). Settings are read-heavy and write-rare,
so the store caches them in memory and only hits the DB on writes and at startup —
keeping reads off the event loop without an async driver."""

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from loguru import logger
from sqlalchemy import Connection, String, column, create_engine, event, insert, select, table
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import TypeDecorator

from core import paths

engine = create_engine(f"sqlite:///{paths.DB_FILE}", echo=False)
Session = sessionmaker(bind=engine, expire_on_commit=False)

NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"

_applied = table("schema_migrations", column("revision"), column("checksum"))


@event.listens_for(engine, "connect")
def _apply_pragmas(connection, _record) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


class Base(DeclarativeBase):
    pass


class Timestamp(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value: Optional[datetime], dialect: Any) -> Optional[str]:
        if value is None:
            return None
        moment = value.astimezone(timezone.utc)
        return f"{moment:%Y-%m-%dT%H:%M:%S}.{moment.microsecond // 1000:03d}Z"

    def process_result_value(self, value: Optional[str], dialect: Any) -> Optional[datetime]:
        return None if value is None else datetime.fromisoformat(value)


def _config(connection: Connection) -> Config:
    config = Config()
    config.set_main_option("script_location", str(paths.MIGRATIONS_DIR))
    config.attributes["connection"] = connection
    return config


def _checksum(source: str) -> str:
    return hashlib.sha256(Path(source).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def _hold_to_source(connection: Connection, scripts: ScriptDirectory, current: Optional[str]) -> None:
    recorded = dict(connection.execute(select(_applied.c.revision, _applied.c.checksum)).all())
    for script in scripts.iterate_revisions(current, "base") if current else ():
        checksum = _checksum(script.path)
        if script.revision not in recorded:
            connection.execute(insert(_applied).values(revision=script.revision, checksum=checksum))
        elif recorded[script.revision] != checksum:
            logger.error(f"Migration {script.revision} changed after it was applied to {paths.DB_FILE.name}")


def init_db() -> None:
    """Bring the schema to the latest migration and hold every applied one to the source it ran from."""
    paths.DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with engine.begin() as connection:
        config = _config(connection)
        command.upgrade(config, "head")
        current = MigrationContext.configure(connection).get_current_revision()
        _hold_to_source(connection, ScriptDirectory.from_config(config), current)
    logger.info(f"Database {paths.DB_FILE.name} ready at migration {current}.")
