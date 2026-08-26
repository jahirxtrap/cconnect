"""SQLite data layer (SQLAlchemy 2.0, sync). Settings are read-heavy and write-rare,
so the store caches them in memory and only hits the DB on writes and at startup —
keeping reads off the event loop without an async driver."""

from pathlib import Path

from loguru import logger
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_DB_PATH = Path(__file__).resolve().parent.parent / "cconnect.db"

engine = create_engine(f"sqlite:///{_DB_PATH}", echo=False)
Session = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _add_missing_columns() -> list[str]:
    """Bring existing tables up to what the models declare. SQLite can only append a column,
    which is all the models ever ask for — a field added to a table someone already has."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    added: list[str] = []
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in tables:
                continue
            existing = {column["name"] for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                # A NOT NULL column has no value to give the rows already there.
                if not column.nullable and column.server_default is None:
                    logger.warning(f"Cannot add {table.name}.{column.name}: it is NOT NULL without a default")
                    continue
                declaration = f"{column.name} {column.type.compile(engine.dialect)}"
                conn.exec_driver_sql(f"ALTER TABLE {table.name} ADD COLUMN {declaration}")
                added.append(f"{table.name}.{column.name}")
    return added


def init_db() -> None:
    """Create any missing table and append any missing column, so a database from an older
    run keeps working. Changing or dropping a column is still out of scope."""
    from core import models  # noqa: F401  (register models on Base before create_all)
    db_existed = _DB_PATH.exists()
    before = set(inspect(engine).get_table_names())
    Base.metadata.create_all(engine)
    after = set(inspect(engine).get_table_names())
    created = sorted(after - before)
    columns = _add_missing_columns()
    if not db_existed:
        logger.info(f"Created database {_DB_PATH.name} with tables: {', '.join(sorted(after))}")
    elif created:
        logger.info(f"Added new tables to {_DB_PATH.name}: {', '.join(created)}")
    else:
        logger.info(f"Database {_DB_PATH.name} ready ({len(after)} tables).")
    if columns:
        logger.info(f"Added new columns to {_DB_PATH.name}: {', '.join(columns)}")
