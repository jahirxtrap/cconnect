"""server state

Revision ID: e27b5df5f03a
Revises: 7d5d3c3df2d8
Create Date: 2026-11-07 18:23:07.720314
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e27b5df5f03a'
down_revision: Union[str, Sequence[str], None] = '7d5d3c3df2d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text("(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")

TABLES = (
    "delegate_runs",
    "agent_defaults",
    "agent_session_titles",
    "agent_known_sessions",
    "session_todos",
    "pending_rewinds",
    "disabled_mcp_servers",
    "agents",
    "database_connections",
)


def upgrade() -> None:
    op.create_table(
        "database_connections",
        sa.Column("id", sa.String(), primary_key=True, comment="Slug of the name the connection was created with, used in the app's routes"),
        sa.Column("name", sa.String(), nullable=False, comment="Name the panel shows"),
        sa.Column("engine", sa.String(), nullable=False, comment="Engine id from core/databases/engines.json, or custom for a SQLAlchemy URL"),
        sa.Column("host", sa.String(), nullable=False, comment="Server a server engine connects to; empty for files and URLs"),
        sa.Column("port", sa.Integer(), nullable=True, comment="Its port; NULL takes the engine's default"),
        sa.Column("database_name", sa.String(), nullable=False, comment="Database a server engine opens; empty lists every database the server holds"),
        sa.Column("username", sa.String(), nullable=False, comment="User a server engine signs in as"),
        sa.Column("password", sa.String(), nullable=False, comment="Its password, also the one taken out of a typed URL; the app only learns whether there is one"),
        sa.Column("path", sa.String(), nullable=False, comment="Database file on the server, for file engines"),
        sa.Column("url", sa.String(), nullable=False, comment="SQLAlchemy URL of a custom connection, kept without its password"),
        sa.Column("packages", sa.JSON(), nullable=False, comment="pip packages the driver of a custom connection needs"),
        sa.Column("options", sa.JSON(), nullable=False, comment="Query parameters of a server engine's URL, such as Snowflake's warehouse"),
        sa.Column("read_only", sa.Boolean(), nullable=False, comment="Every query runs in a transaction that is rolled back and rows cannot be edited"),
        sa.Column("ssh_host", sa.String(), nullable=True, comment="Machine the SSH tunnel goes through; NULL connects directly"),
        sa.Column("ssh_port", sa.Integer(), nullable=True, comment="Its SSH port; NULL takes 22"),
        sa.Column("ssh_user", sa.String(), nullable=True, comment="User the tunnel signs in as"),
        sa.Column("ssh_key", sa.String(), nullable=True, comment="Private key file on the server; empty leaves it to the ssh agent"),
        sa.Column("created_at", sa.String(), nullable=False, server_default=NOW, comment="When it was added, in UTC; the panel lists connections in this order"),
        comment="Connections of the Databases panel; their passwords never leave the server",
    )
    op.create_table(
        "agents",
        sa.Column("id", sa.String(), primary_key=True, comment="Catalog id, or the slug of the name for an agent added by hand"),
        sa.Column("name", sa.String(), nullable=False, comment="Name the app shows"),
        sa.Column("source", sa.String(), nullable=False, comment="registry for the official catalog, custom for one added by hand"),
        sa.Column("protocol", sa.String(), nullable=False, comment="acp for an Agent Client Protocol server, command for a CLI that takes one task"),
        sa.Column("description", sa.String(), nullable=False, comment="The catalog's description; empty for an agent added by hand"),
        sa.Column("purpose", sa.String(), nullable=False, comment="What the user says it is good at, which Claude reads when delegating"),
        sa.Column("version", sa.String(), nullable=True, comment="Catalog version installed; NULL for an agent added by hand"),
        sa.Column("kind", sa.String(), nullable=True, comment="How the catalog ships it: binary, python or npm; NULL for an agent added by hand"),
        sa.Column("program", sa.String(), nullable=False, comment="Executable it runs, by name on the PATH or by full path"),
        sa.Column("args", sa.JSON(), nullable=False, comment="Arguments while it may only read"),
        sa.Column("edit_args", sa.JSON(), nullable=False, comment="Arguments while it may also edit files; empty reuses args"),
        sa.Column("bypass_args", sa.JSON(), nullable=False, comment="Arguments while it may act without asking; empty reuses args"),
        sa.Column("model_args", sa.JSON(), nullable=False, comment="Arguments that pick a model, with {model} where it goes"),
        sa.Column("env", sa.JSON(), nullable=False, comment="Environment the catalog sets"),
        sa.Column("user_env", sa.JSON(), nullable=False, comment="Environment the user adds; reading or changing it takes the security key"),
        sa.Column("enabled", sa.Boolean(), nullable=False, comment="Shown in ACP agents and offered to Claude as a destination"),
        sa.Column("created_at", sa.String(), nullable=False, server_default=NOW, comment="When it was added, in UTC; agents are listed in this order"),
        comment="Agents the server talks to, installed from the ACP catalog or added by hand",
    )
    op.create_table(
        "disabled_mcp_servers",
        sa.Column("name", sa.String(), primary_key=True, comment="Server name as the CLI knows it"),
        sa.Column("config", sa.JSON(), nullable=False, comment="Its entry from ~/.claude.json, written back when it is enabled"),
        comment="MCP servers the user turned off, taken out of the CLI's config until turned on again",
    )
    op.create_table(
        "pending_rewinds",
        sa.Column("session_id", sa.String(), primary_key=True, comment="Transcript id of the chat"),
        sa.Column("anchor_uuid", sa.String(), nullable=False, comment="Transcript entry the next turn resumes at"),
        comment="Conversations rewound in the app that the CLI branches on their next turn",
    )
    op.create_table(
        "session_todos",
        sa.Column("session_id", sa.String(), primary_key=True, comment="Transcript id of the chat"),
        sa.Column("items", sa.JSON(), nullable=False, comment="The TodoWrite items as the CLI last sent them"),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=NOW, comment="When the list last changed, in UTC; only the most recent lists are kept"),
        comment="Last task list of each chat, which the transcript does not keep",
    )
    op.execute(
        "CREATE TRIGGER session_todos_touched AFTER UPDATE OF items ON session_todos "
        "BEGIN UPDATE session_todos SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
        "WHERE session_id = NEW.session_id; END"
    )
    op.create_table(
        "agent_known_sessions",
        sa.Column("agent", sa.String(), primary_key=True, comment="ACP agent the session runs on"),
        sa.Column("session_id", sa.String(), primary_key=True, comment="Session id the agent gave the chat"),
        sa.Column("cwd", sa.String(), nullable=False, comment="Folder the session works in; the list only shows the folder's own"),
        sa.Column("added_at", sa.String(), nullable=False, server_default=NOW, comment="When the server last created or forked it, in UTC; the newest come first"),
        comment="Sessions of agents that cannot list their own, so their chats can be reopened",
    )
    op.create_table(
        "agent_session_titles",
        sa.Column("agent", sa.String(), primary_key=True, comment="ACP agent the session runs on"),
        sa.Column("session_id", sa.String(), primary_key=True, comment="Session id the agent gave the chat"),
        sa.Column("title", sa.String(), nullable=False, comment="Title that wins over the agent's own in the list and in the chat"),
        comment="Titles the user gave agent chats, which ACP has no request to set",
    )
    op.create_table(
        "agent_defaults",
        sa.Column("agent", sa.String(), primary_key=True, comment="ACP agent id"),
        sa.Column("options", sa.JSON(), nullable=True, comment="Its configuration options with the values last chosen"),
        sa.Column("commands", sa.JSON(), nullable=True, comment="Its slash commands"),
        comment="What an agent offered last time, so a new chat shows it before the agent answers",
    )
    op.create_table(
        "delegate_runs",
        sa.Column("session_id", sa.String(), primary_key=True, comment="Transcript id of the chat that delegated"),
        sa.Column("tool_use_id", sa.String(), primary_key=True, comment="The delegate tool call the steps belong to"),
        sa.Column("rows", sa.JSON(), nullable=False, comment="The destination's steps as history rows"),
        sa.Column("saved_at", sa.String(), nullable=False, server_default=NOW, comment="When the run ended and its steps were saved, in UTC"),
        comment="Steps of each finished delegation, shown under its tool call in the chat",
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER session_todos_touched")
    for name in TABLES:
        op.drop_table(name)
