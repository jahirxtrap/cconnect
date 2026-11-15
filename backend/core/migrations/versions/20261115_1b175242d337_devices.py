"""devices

Revision ID: 1b175242d337
Revises: 4c1f0a9e2b7d
Create Date: 2026-11-15 03:19:11.126143
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '1b175242d337'
down_revision: Union[str, Sequence[str], None] = '4c1f0a9e2b7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text("(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", sa.String(), primary_key=True, comment="Slug of the name the device was first saved with, used in the app's routes"),
        sa.Column("serial", sa.String(), nullable=False, unique=True, comment="Hardware serial the device reports (ro.serialno), the same over USB and Wi-Fi"),
        sa.Column("name", sa.String(), nullable=False, comment="Name the panel shows: the device's marketing name until the user renames it"),
        sa.Column("model", sa.String(), nullable=False, comment="Model the device reports (ro.product.model)"),
        sa.Column("address", sa.String(), nullable=True, comment="host:port it was last reached at over Wi-Fi, to connect it again where mDNS does not reach; NULL for a device only seen over USB"),
        sa.Column("created_at", sa.String(), nullable=False, server_default=NOW, comment="When it was first seen authorized, in UTC"),
        sa.Column("seen_at", sa.String(), nullable=False, server_default=NOW, comment="When it was last connected, in UTC; the panel lists saved devices newest first"),
        comment="Android devices the Devices panel has seen authorized, so one paired over Wi-Fi keeps its name and can be connected again",
    )


def downgrade() -> None:
    op.drop_table("devices")
