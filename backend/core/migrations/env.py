from alembic import context

from core.db import engine


def _run(connection) -> None:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()


shared = context.config.attributes.get("connection")
if shared is None:
    with engine.connect() as connection:
        _run(connection)
else:
    _run(shared)
