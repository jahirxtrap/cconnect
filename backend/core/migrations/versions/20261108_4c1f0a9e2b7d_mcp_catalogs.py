"""mcp catalogs

Revision ID: 4c1f0a9e2b7d
Revises: ba9d242701ac
Create Date: 2026-11-08 08:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '4c1f0a9e2b7d'
down_revision: Union[str, Sequence[str], None] = 'ba9d242701ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text("(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")


def upgrade() -> None:
    op.create_table(
        "mcp_catalogs",
        sa.Column("key", sa.String(), primary_key=True, comment="Hash of the server's command, arguments and environment; changing any of them makes a new entry"),
        sa.Column("name", sa.String(), nullable=False, comment="Server name as the CLI knows it; one entry per name, the newest"),
        sa.Column("catalog", sa.JSON(), nullable=False, comment="What it answered the last time it ran: its initialize result, tools, prompts, resources and resource templates"),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=NOW, comment="When it was last read from the running server, in UTC"),
        comment="What each local MCP server offers, so a chat lists its tools without starting it until one is used",
    )


def downgrade() -> None:
    op.drop_table("mcp_catalogs")
