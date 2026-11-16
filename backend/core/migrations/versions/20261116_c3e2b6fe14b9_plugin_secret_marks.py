"""plugin secret marks

Revision ID: c3e2b6fe14b9
Revises: 1b175242d337
Create Date: 2026-11-16 11:40:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c3e2b6fe14b9'
down_revision: Union[str, Sequence[str], None] = '1b175242d337'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text("(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")


def upgrade() -> None:
    op.create_table(
        "plugin_secret_marks",
        sa.Column("storage", sa.String(), primary_key=True, comment="Secure storage folder the CLI of an account keeps its secrets in (CLAUDE_SECURESTORAGE_CONFIG_DIR); empty for the primary account"),
        sa.Column("plugin", sa.String(), primary_key=True, comment="Plugin id, name@marketplace, as the CLI keys its secret options"),
        sa.Column("fingerprint", sa.String(), nullable=False, comment="SHA-256 of the plugin's secret option values in that storage when they last matched every account, never the values themselves; a storage that differs from it changed since"),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=NOW, comment="When the fingerprint was last recorded, in UTC"),
        comment="What each account held of every plugin's secret options when CConnect last made them the same in all accounts, to tell which account changed one since",
    )


def downgrade() -> None:
    op.drop_table("plugin_secret_marks")
