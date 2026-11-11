# CLAUDE.md — backend

FastAPI bridge between the CConnect apps and Claude Code, on the user's PC. It drives the CLI
through `claude-agent-sdk` on the **subscription**: `core/sdk.ensure_subscription_auth()` drops
`ANTHROPIC_API_KEY`, which would otherwise win and bill API credits. The SDK import is deferred
inside `claude_runtime` because the SDK upgrades itself on startup (`sdk_auto_update`).

```
[app] ──WS  /api/chat/ws──> chat router ──> live_sessions ──> claude_runtime ──> SDK query()
      ──REST /api/sessions ─> sessions router ──> services/sessions (~/.claude/projects JSONL)
      ──REST /api/shared ───> shared router ──> backend/data/shared/
      ──REST /api/claude ───> claude router ──> claude_assets (read) + claude_manage (mutate)
```

## Layout

- `core/app.py` — the app (`core.app:app`): router auto-discovery, gzip, catch-all 404.
- `core/cli.py` — the `cconnect` command and the supervisor that runs uvicorn as a child.
  `run.py` is the checkout's entry. Always **one worker**: every registry lives in memory. With
  `CCONNECT_LIFELINE=1` the server stops when its stdin pipe closes, so it never outlives the
  desktop app; uvicorn gets `stdin=DEVNULL`, or Windows deadlocks on the inherited pipe.
- `core/` — `paths` (**the** path table; `INSTALLED` picks the data folder), `release`,
  `config`, `db` / `models` / `migrations/`, `settings_defs` / `settings_store`, `responses`
  (**the** envelope `{success, status, message, data}`), `ws` (**the** handshake:
  `accept_authorized`, `opening_message`, `stream_watch`), `process_job` (Windows job object
  that takes child processes down with the server).
- `core/packs/` — built-in packs and the pack format (`schema.json`, `builtin.json`); the client
  build and Tauri read them too, as they do `core/scripts/page_icon.js`.
- `core/prompts/` — the system prompt pieces (`CCONNECT.md`, `BLOCKS.md`, `BROWSER.md`,
  `INSTALL.md`, `MODS.md`, `SUGGESTIONS.md`, `TOOLS.md`). User-owned prompts (`USER.md`, per
  project) live in `data/config/prompts/` and are emptied, never deleted. `{{SHARED_URL}}`
  becomes `cconnect://shared`, never a host: the prompt is fixed when the CLI session starts,
  and the app swaps the scheme for the server it talks to (`shared_scheme` in health).
- `middleware/` — `public_auth`, `security`, `error_handler`.
- `routers/` — thin: validate, call a service, return `api_response()`.
- `services/` — all the logic, one module per integration. Watchers (`chat_list`,
  `directory_watch`, `project_watch`) run `watchfiles` in their own thread, never on the event
  loop. `project_watch` never recurses (on Linux that is an inotify watch per folder): it watches
  the folders the clients send as open, the ones git tracks and each `.git`.
- `services/accounts` / `cli_login` — an account is only its credentials: the CLI runs on the
  primary config with `CLAUDE_SECURESTORAGE_CONFIG_DIR` set to the account folder. Sign-in and the
  models, plan and fast mode CConnect offers use `identity_env` (the account folder as the whole
  config). Sign-in goes through the CLI's control requests (`claude_authenticate`,
  `mcp_authenticate`), never a pseudo-terminal. `wait_mcp` watches `.credentials.json` because the
  CLI reports no event when an MCP login finishes. `login_expiry` caches per `.credentials.json`.
- `mcps/` — the in-process MCP server Claude sees as `cconnect`.

## Auth

- `PUBLIC_ACCESS_TOKEN` applies only with `CCONNECT_AUTH_ACTIVE=1`. `PublicAuthMiddleware` gates
  every `/api/*` except `/api/health` and the loopback routes that carry their own token
  (`/api/agents/browse`, `/api/mcp/agent/<token>`, `/api/mcp/lazy/<token>`, `/api/pages/<id>/…`,
  since an iframe cannot send headers). WS handshakes check it in `accept_authorized` before
  accepting.
- `SECURITY_KEY` (`X-Security-Key`, `core/access.key_matches()`) guards what belongs to the
  machine: shells, git-ignored files, git writes, deleting a server pack, an agent's environment,
  saved database connections and their drivers. Each route checks it itself, and it only gates
  while the Bearer gate is on (`gated()`). Reads the panels need before asking (`repos`,
  `databases/engines`) stay outside it.
- A turn sent without the key loses the `terminal` and `databases` capabilities
  (`core/access.authorize`, per `prompt`), and the PreToolUse hook keeps Claude off
  `paths.ENV_FILE` and the key-gated tools. The capabilities are part of the persistent CLI's
  `mark`, so unlocking mid-chat restarts it.
- `--expose tailnet` skips the token. `--expose caddy` only advertises, so `--stop` never closes
  a Funnel it did not open (`.detached.provider`).

## HTTP API

Everything returns `api_response()`; routers are auto-discovered from `routers/`. A route that
answers with a file uses `FILE_HEADERS` (`Cache-Control: no-cache`), or a rewritten file shows
its old copy. Transcript slices are cursor-based (`before_index`), and while a live session has
events to replay the tail is cut at `turn_start_index` so a turn never arrives twice. Uploads
stream to disk, so `PUT` is outside `MAX_BODY_SIZE`.

## Chat socket (`/api/chat/ws`)

- Every event is typed in `schemas/chat_events.py`. `python -m schemas.contract` writes
  `schemas/chat_events.json`, which the app's `npm run check` turns into types; the release runs
  it with `--check`, and `CCONNECT_CONTRACT_CHECK=1` validates each event as it is sent.
- Events are seq'd per session except the control ones (`ready`, `permission_mode`,
  `history_chunk`, `usage`, `session_info`, `ask_*`, `activity`) and the mods ones.
  `mod_toast` / `mod_invalidate` / `mod_focus` / `mod_scroll` / `mod_request` are never replayed,
  and every `mod_render` gets a `mod_tree`, null when no CLI is attached.
- Re-attaching with `channel` + `last_seq` replays only when the outbox covers it
  (`LiveSession.covers`); otherwise `ready` says `stale` and the app reopens from the transcript.
  Re-attaching never changes the chat's account (`ready` carries it, only `set_generation`
  changes it). Model, effort and permission mode answer only the socket that set them.
- `file_change` replaces `tool_use` / `tool_result` for Edit, Write, MultiEdit and NotebookEdit.
  `db_query` / `db_execute` carry `query` and `statements` (`mcps/databases.statements_of`) and,
  like shared files, always arrive whole whatever `show_tool_use` says.
- The live `compact_boundary` uses `compact_metadata` with `pre_tokens` / `post_tokens`, not the
  transcript's camelCase, and `compact` carries `earlier` for `load_history(until=…)`.
- The plan windows (`rate_limit`) come only on a CLI's first turn, so `usage.live_windows` keeps
  the last ones per account and sends them to every socket that attaches.
- An ACP agent's chat (a `start` that names one) gets `agent_state` and `history` outside the
  seq'd stream. Its rows come from the agent (`session/load`); the server stores only session ids
  of agents without `session/list` and the titles the user gives.
- **Context size** travels only in `context`, and clients assign it, so `null` clears the ring.
  It is `input_tokens + cache_read + cache_creation` from each `AssistantMessage.usage` and from
  the main conversation's `message_delta` (a provider can send `0` in `message_start`), and
  `post_tokens` on a live boundary. A manual `/compact` has no live boundary, so the router reads
  `latest_compact()` after the turn; a closed session reads `sessions.last_context_tokens`.

## Transcripts and compaction

`services/sessions.get_session_messages` normalizes the JSONL so resume equals live. The CLI's
format is not a contract; what currently holds:

- `_active_entries` walks `parentUuid` (then `logicalParentUuid`) back from the last entry to
  drop rewound branches, only when some node has two or more children.
- Compaction markers survive that walk (`_is_compact_marker`): the summary hangs off the boundary
  while the conversation continues from `compactMetadata.preservedSegment`, so it looks like a
  dead branch.
- Reading starts at `_last_compact_offset(file)`. `session_segment(..., until=<boundary>)` reads
  the stretch before a boundary, only when the user asks for earlier messages, and
  `list_checkpoints(..., until=…)` answers `{points, earlier}`. The CLI rewinds nothing before
  the last boundary, so those points only fork.
- Filter non-conversation entries (`queue-operation`, `attachment`, `file-history-snapshot`,
  `custom-title`, `mode`, `last-prompt`…) by type, never by position.
- The SDK writes `"entrypoint":"sdk-py"`, which hides a session from `claude --resume`. Each turn
  rewrites it to a space-padded `"cli"` in place, only over the bytes it wrote, in a worker thread.

## Message queue

A prompt sent mid-turn is injected into the same turn: `run_prompt` runs the SDK in
streaming-input mode and drains the queue, rendering each item **from the transcript**
(`_flush_users`), so resume and live agree when the CLI joins messages. A task notification is
written twice, so `LiveSession.shown_notices` keeps what the tail already sent and
`_flush_users` skips it; a byte offset is not enough.

## Persistent sessions and mods

- With `persistent_sessions` on, `persistent_sessions.pool` keeps one `ClaudeSDKClient` per
  channel, keyed by cwd, account and scope. `session_limit` caps chats holding a process (CLIs
  and ACP agents together) and `registry.trim` releases the least recently used idle ones.
- The grace (`session_grace`) is one timer, started when the last socket leaves or, if work is
  running, when it ends (`_schedule_cooldown`); nothing polls it.
- A turn whose `mark` differs (model, effort, permission mode, mods, capabilities) or whose
  account differs restarts the CLI. A turn the CLI starts on its own is adopted (`own_turn`)
  with `resident(keep=True)` and never reshapes the process.
- `memory_reserve` is read only before starting a process and on the system's low-memory signal
  (`services/memory_pressure.py`), never polled. Below it, `registry.relieve` stops idle MCP
  servers, then releases idle chats, oldest first. A one-shot CLI always gets the no-background
  environment (`_background_guard(kept=False)`).
- Mods use the CLI's internal UI protocol (`services/mods.py`), which moves between versions:
  every request goes through `mods.request`, which returns `None` on failure. `forget_plugin`
  drops a disabled plugin's surface once its turn ends.
- `control_requests` answers what the SDK rejects as unknown: MCP `elicitation` (turned into the
  chat's form by `elicitation`) and the mods' `ui_*`. `serve` wraps a persistent CLI's query and
  `Answering` a one-shot's transport.
- Stopping the server closes the CLIs and agents first (`live_sessions.close_processes`).

## Local MCP servers on demand (`services/mcp_lazy.py`)

Each stdio MCP server of user, local or plugin scope reaches a chat's CLI as
`{"type": "http", "url": ".../api/mcp/lazy/<token>"}` under its own name. Project servers, the
disabled ones and any config with an unresolved `${…}` stay with the CLI.

- `initialize` and every list come from `mcp_catalogs` (keyed by command, arguments and
  environment), so the CLI starts with no server process. A server with no catalog starts as
  before while one is read in the background.
- The real process starts on the first call (`_Link`) with the environment the CLI would give
  it. Every start rereads the lists and sends `list_changed` when they changed.
- The first start per backend run goes through the launcher (`uvx`, `npx`); later ones run the
  process it spawned directly (`CCONNECT_MCP_SPAWN` marker), falling back to the launcher.
- The proxy speaks the handshake era: it answers a newer `mcp-protocol-version` with the 400 an
  older server gives.
- mcp 2.3: one stateful `StreamableHTTPSessionManager` per server and CLI, `json_response=False`
  (JSON drops progress, logs and forms) and `session_idle_timeout=None`. `_Proxy` overrides
  `get_capabilities`. `stdio_client` needs the whole environment passed.
- A persistent CLI's servers close with it, a one-shot's at the end of the turn, and
  `release_idle` stops unused ones when memory runs short.

## Database (`data/config/cconnect.db`)

Every record the server keeps lives in SQLite (WAL), never in a loose JSON file. Files are only
for prompts, packs, account folders, caches, logs and process files.

- **The migrations are the schema** (`core/migrations/versions/`), each with a working
  `downgrade()`, run to `head` on every start. Scaffold with `alembic revision -m "<what>"` and
  write it by hand; `create_all` is never called and `core/models.py` mirrors the result.
- `schema_migrations` stores each migration's SHA-256. A released migration is immutable.
- Every table and column carries an English comment, in the migration and in the model.
- Timestamps are UTC ISO 8601 text (`Timestamp`); the API answers epoch seconds where it did.
- Triggers (all of them): `session_todos_touched` stamps `session_todos.updated_at`.

## Settings and visibility

Model, effort, permission mode, streaming, CLI source and block visibility are backend-owned, in
the `settings` table. `show_thinking` / `show_tool_use` / `show_file_change` / `show_compact` take
`full | label | off`, applied the same live and on resume; `label` never strips an agent's
subtasks. Simple mode never hides file changes, shared files, query blocks, forms or the
`task_*` / `agent_result` events Running needs.

## MCP server (`mcps/`)

- Each tool is a module-level `Definition` (`mcps/definition.py`) named in capitals
  (`DB_QUERY`). `make_tools(context)` runs every turn and binds it to its handler; returning
  `[]` removes the module's tools from that turn. A turn-dependent description is a `replace`,
  and every text answer goes through `reply`. A module whose tools reach key-gated things
  declares `needs_key(name, args)`.
- Families behind a setting are left out while it is off, key-gated ones need the key, and the
  rest are **deferred behind tool search**. `eager` loads a tool up front (`_meta`
  `anthropic/alwaysLoad`, through mcp 2's handler API). `guide` puts the first paragraph of the
  description in the system prompt (`TOOLS.md`), which is what makes Claude reach for it.
- `ask_component` and `show_component` share `mcps/components.py`: every value is a string, an
  `id` means the element carries a value, labels travel as keys, `show_if` also drops the value,
  validation is client-side. `mcps/media.py` is the one table of what renders inline.
- **Adding an element** (no generator): `TYPES` + `LEAF` and its line in `DESCRIPTION` /
  `SHOW_DESCRIPTION`; `ComponentElement` in `client/.../data/chatModels.ts` and `toElement` in
  `.../services/chatSocket.ts`; the `{#if}` chain in `ComponentBlock.svelte`; the summary
  (`componentSummary` / `summary`), which must keep `secret` values out of the chat; the
  validation (`componentMissing` / `missing`); `en.json` and the other catalogs.

## Databases

`core/databases/engines.json` is the engine catalog (dialect, driver packages, port, read-only
preludes, timeout, binary literal, hidden schemas, URL options, `quote`, `auto_increment`,
`identity_sync`, `identity_insert_on/off`), with `defaults` and `extends` for the families.
Connections are `file`, `server` or `url` (`custom`, which borrows its backend's rules through
`spec_of`). Every data call takes a `Scope` (connection and database), one engine per scope.

- A driver install pins every requirement of `cconnect` at its installed version, so it never
  moves the server's packages. Engines with the same `packages` share one driver (`driver_of`).
  A driver counts as installed when its distributions are on disk (`importlib.metadata`).
- A database file opens without a connection (`open_file`): the engine comes from the file's
  header (`signature`), the entry lives in memory under a `file:` id, and `NullPool` holds no lock.
- Nothing in `database_data` trusts the client. Reads and writes are told apart by sqlglot,
  failing closed: only SELECT, set operations, DESCRIBE, SHOW, EXPLAIN of a read and a PRAGMA
  without `=` read; anything else writes and takes the key. A read runs in a transaction that is
  rolled back, after the engine's read-only preludes.
- Each statement answers on its own (`results`, with `kind` and `effect`). Writes return the rows
  touched where `returning` allows (`clause` or `cte`). A CREATE or ALTER is reflected on its own
  connection right after it runs; an ALTER also carries `changes`. A statement no transaction
  admits (`OUTSIDE_TRANSACTION`) runs in autocommit after `release_others`.
- The WHERE filter must be one reading statement, with colons escaped and closed on a newline.
- Every query has a deadline: the engine's statement timeout, or a timer that calls the DBAPI's
  `cancel` / `interrupt`.
- Optional reflection runs in its own session (`_probe`): a failed statement aborts the rest of
  the transaction in PostgreSQL and DuckDB.
- Tables are rebuilt from columns and primary key, never autoloaded: duckdb-engine cannot reflect
  under SQLAlchemy 2.1, so the catalog carries DuckDB's own `columns` / `primary_key` queries and
  `declared_type` maps types through sqlglot.
- Claude's tools answer in text (`mcps/databases.render`), read back by `statements_of`, so the
  two change together.
- Cells leave JSON-safe (`cell`); exports keep full values: CSV with a BOM, SQL through each
  column's literal processor.
- A SQL export is a dump built from the catalog, never `pg_dump` (`export_dump`, for a table, a
  schema or the database): tables in foreign key order, indexes, streamed inserts, then views.
  Function defaults go in parentheses (SQLite). Sequence-fed columns use `auto_increment`,
  `identity_sync` moves the sequence, `identity_insert_on/off` wrap SQL Server's inserts.

## Configuration

Environment variables, declared in `core/config.py`, which loads `backend/.env` in a checkout.
The table lives in the root `README.md` only.

## Conventions

1. **Routers stay thin**; logic lives in `services/`, new integrations get their own module.
2. **No comments.** A one-line descriptive docstring only when a constraint cannot be expressed
   in code.
3. **Imports at the top**, except the deferred `claude_agent_sdk`.
4. **Subprocesses that print text use `encoding="utf-8", errors="replace"`** (Windows is cp1252).
5. **Auto-reload only in a checkout on Linux/macOS**, never in the installed package (every
   `pip install` would restart it), excluding the data folder and `sys.prefix`. On Windows it
   breaks the CLI subprocess, so restart by hand.
