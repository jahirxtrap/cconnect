"""trash timestamps

Revision ID: ba9d242701ac
Revises: e27b5df5f03a
Create Date: 2026-11-07 18:23:08.293236
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'ba9d242701ac'
down_revision: Union[str, Sequence[str], None] = 'e27b5df5f03a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "trashed_sessions"
STAGED = "deleted_at_staged"
UTC_COMMENT = "When it was thrown away, in UTC; the trash itself never expires"
EPOCH_COMMENT = "Epoch seconds it was thrown away; the trash itself never expires"


def _replace(column: sa.Column, fill: str, comment: str) -> None:
    with op.batch_alter_table(TABLE) as batch:
        batch.add_column(column)
    op.execute(f"UPDATE {TABLE} SET {STAGED} = {fill}")
    with op.batch_alter_table(TABLE) as batch:
        batch.drop_column("deleted_at")
        batch.alter_column(STAGED, new_column_name="deleted_at", existing_type=column.type, nullable=False, comment=comment)


def upgrade() -> None:
    _replace(
        sa.Column(STAGED, sa.String(), nullable=True, comment=UTC_COMMENT),
        "strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at, 'unixepoch')",
        UTC_COMMENT,
    )


def downgrade() -> None:
    _replace(
        sa.Column(STAGED, sa.Float(), nullable=True, comment=EPOCH_COMMENT),
        "strftime('%s', deleted_at) + (strftime('%f', deleted_at) - strftime('%S', deleted_at))",
        EPOCH_COMMENT,
    )
