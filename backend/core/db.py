"""SQLite data layer (SQLAlchemy 2.0, sync). Settings are read-heavy and write-rare,
so the store caches them in memory and only hits the DB on writes and at startup —
keeping reads off the event loop without an async driver."""

from loguru import logger
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from core import paths

engine = create_engine(f"sqlite:///{paths.DB_FILE}", echo=False)
Session = sessionmaker(bind=engine, expire_on_commit=False)


@event.listens_for(engine, "connect")
def _apply_pragmas(connection, _record) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


class Base(DeclarativeBase):
    pass


def _add_missing_columns() -> list[str]:
    """Append the columns the models declare and the table is missing."""
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
                if not column.nullable and column.server_default is None:
                    logger.warning(f"Cannot add {table.name}.{column.name}: it is NOT NULL without a default")
                    continue
                declaration = f"{column.name} {column.type.compile(engine.dialect)}"
                conn.exec_driver_sql(f"ALTER TABLE {table.name} ADD COLUMN {declaration}")
                added.append(f"{table.name}.{column.name}")
    return added


def init_db() -> None:
    """Create the missing tables and append the missing columns."""
    from core import models  # noqa: F401
    db_existed = paths.DB_FILE.exists()
    before = set(inspect(engine).get_table_names())
    Base.metadata.create_all(engine)
    after = set(inspect(engine).get_table_names())
    created = sorted(after - before)
    columns = _add_missing_columns()
    if not db_existed:
        logger.info(f"Created database {paths.DB_FILE.name} with tables: {', '.join(sorted(after))}")
    elif created:
        logger.info(f"Added new tables to {paths.DB_FILE.name}: {', '.join(created)}")
    else:
        logger.info(f"Database {paths.DB_FILE.name} ready ({len(after)} tables).")
    if columns:
        logger.info(f"Added new columns to {paths.DB_FILE.name}: {', '.join(columns)}")
