# CLAUDE.md — backend

FastAPI bridge between the CConnect apps and Claude Code, running on the user's PC.
Drives the CLI through `claude-agent-sdk` using the **subscription** (the logged-in
CLI's OAuth): `core/sdk.ensure_subscription_auth()` drops `ANTHROPIC_API_KEY`, because
an exported key silently wins and bills API credits. The SDK is upgraded on startup while
the `sdk_auto_update` setting is on, which is why its import is deferred inside `claude_runtime`.

```
[app] ──WS  /api/chat/ws──> chat router ──> live_sessions ──> claude_runtime ──> SDK query()
      ──REST /api/sessions ─> sessions router ──> services/sessions (~/.claude/projects JSONL)
      ──REST /api/shared ───> shared router ──> backend/data/shared/
      ──REST /api/claude ───> claude router ──> claude_assets (read) + claude_manage (mutate)
```

## Layout

- `core/app.py` — the FastAPI app: router auto-discovery, gzip, catch-all 404. Served as
  `core.app:app`; it lives inside the package so an installed wheel carries it.
- `core/cli.py` — the `cconnect` command and the supervisor: launches uvicorn as a child
  and relaunches it on a restart request. Subcommands `run / expose / stop / restart /
  status / logs / doctor / update / key`, plus `-v` and `--port`, with the
  launcher's original flags still accepted. `run.py` at
  the backend root is the three-line entry a checkout (and the desktop app) calls.
  uvicorn always runs one worker: every registry lives in the process's memory, so a second
  one would split chats and sockets. The desktop app starts its local server with
  `CCONNECT_LIFELINE=1` and a pipe on stdin; when the pipe closes the supervisor stops the
  way `stop` does, so a server never outlives the app that launched it. uvicorn itself gets
  `stdin=DEVNULL`, or Windows deadlocks on the inherited pipe.
- `core/` — `paths` (**the** path table: every file the backend owns, plus `INSTALLED`,
  which decides where the data folder is), `release` (the version contract), `config`
  (env), `display` (separator and joining, shared with the app), `db` + `models` + `migrations/`
  (the SQLite store; see *Database*), `settings_defs` + `settings_store` (the settings it keeps),
  `cli_manager`, `sdk`, `process_job` (on Windows, the job
  object that takes the agents' processes down with the server), `responses` (**the**
  envelope: `{success, status, message, data}`), `ws` (**the** socket handshake:
  `accept_authorized`, `opening_message` for a socket that opens with a message, and
  `stream_watch` for a hub's snapshots).
- `core/packs/` — the built-in packs and `schema.json` / `builtin.json`, the pack format. The
  client build and the Tauri compile read them too, and so does `core/scripts/page_icon.js`
  (the page icon both browsers report), so all of them ship in the wheel.
- `middleware/` — `public_auth` (Bearer, no-op without a token), `security`, `error_handler`.
- `routers/` — thin: validate, call a service, return `api_response()`.
- `services/` — all the logic. `live_sessions` (turn decoupled from the socket), `claude_runtime`
  (SDK stream → normalized events), `persistent_sessions` (the CLI a chat keeps between
  turns), `mods` (the CLI's internal UI protocol), `control_requests` (the CLI's requests the SDK
  does not answer), `elicitation` (an MCP form as the chat's form and back), `sessions` (transcripts, checkpoints, images), `chat_list`,
  `categories`, `trash`, `rewind`, `questions`, `attachments`, `claude_assets` / `claude_manage`,
  `system_monitor` (also redacts tokens, keys and passwords from every log sink), `network`,
  `usage`, `accounts`, `shared`, `git_ops` (the commit panel, on top of the single runner in
  `services/git`, one lock per repository), `browser` (the server's Chromium, started only
  while a socket watches one of its tabs), `agents` / `agent_registry` (the ACP agents installed
  from the official catalog or added by hand), `agent_connections` / `agent_sessions` /
  `acp_peer` / `acp_events` (one process per agent and folder, a chat's session on it, and its
  updates turned into the chat's events), `agent_mcp` (the `cconnect` MCP an agent's chat gets:
  `share_files` and the guides of `system_append(..., AGENT_SCOPE)`, served at
  `/api/mcp/agent/<token>` over HTTP, or through `core/scripts/mcp_bridge.py` on stdio, and the
  same guides as `systemPrompt` only when the agent advertises it), `event_rows` (those events
  as history rows),
  `delegates` / `delegate_runner` / `delegate_runs` (handing a task to an agent or another
  account, with the model it asks for), `packs` / `pack_format` (the server's pack library and the
  validation the client's reader mirrors), `prompt_cache`, `tool_calls` / `tool_props`,
  `api_errors`, `directory_watch` (the base of the shared and pack watchers) and
  `project_watch` (Project files), which run `watchfiles` in a thread of their own, as
  `chat_list` does (on Linux starting it walks the whole tree, one inotify watch per folder,
  and a large project froze the server when that ran on the event loop), `pages` (an HTML page served with the folder around it, so its
  styles, scripts and images load), `processes` (what the server runs, matched to its chat,
  agent, terminal or browser, and stopped the way that screen stops it), `databases` (the
  connections in `database_connections`, whose passwords never reach the app, and one engine per
  connection), `database_engines` (**the** engine table: dialect, driver distributions installed on
  demand, read-only preludes, timeout, binary literal and hidden schemas), `database_tunnels`
  (SSH tunnels through the system's `ssh`), `database_data` (browsing, paging, SQL, row edits and
  exports to `shared/databases/<id>/`).
- `mcps/` — in-process MCP server exposed to Claude as `cconnect`.
- `core/prompts/` — `CCONNECT.md` (appended to every turn, `{{SHARED_DIR}}` / `{{SHARED_URL}}`
  substituted per request), `BLOCKS.md`, `BROWSER.md`, `INSTALL.md` (the install cards,
  appended when the app advertises `install`), `MODS.md` (only what this app adds
  for a mod Claude writes, appended while mods are on), `SUGGESTIONS.md` and `TOOLS.md` (the
  deferred tools with a `guide`, appended while the turn offers any). Versioned, so
  the user-owned `USER.md` and the per-project prompts live in `data/config/prompts/`
  instead (never deleted — emptied). `{{SHARED_URL}}` resolves to `config.SHARED_SCHEME`
  (`cconnect://shared`) and never to a host: the prompt is fixed when the CLI session is
  created, so an address baked into it is stale the moment the app changes environment.
  `/api/health` and `/api/capabilities` publish the scheme as `shared_scheme` and the app swaps
  it for the server it is talking to, which is the only side that knows. Health never waits on
  the CLI, so a chat's files still resolve when capabilities fail.

## Auth

`PUBLIC_ACCESS_TOKEN` is honoured only when `CCONNECT_AUTH_ACTIVE=1`, so a token left in
`.env` never locks down a plain local run. `PublicAuthMiddleware` gates every `/api/*`
except `/api/health` and the two routes an agent's own process calls on loopback with a token
of its connection instead: `/api/agents/browse` (the `BROWSER` helper,
`core/scripts/browse.py`, which still opens the page on the PC and hands the URL to the agent's
card) and `/api/mcp/agent/<token>`, plus the files of a registered page, `/api/pages/<id>/…`,
whose random id is the token: an iframe cannot send headers. Every WS handshake checks the same
header through `core/ws.accept_authorized`, which closes before accepting, so a socket without it
is refused at the HTTP layer (403).

`SECURITY_KEY` is the other gate and a different one: `core/access.key_matches()` compares
the `X-Security-Key` header and guards what belongs to the **machine** rather than to
Claude — the shells, the files git ignores, every git write, deleting a pack from the
server's library, an agent's environment variables, and the saved database connections: listing
them, reading what they hold, installing or removing a driver and anything that writes (a database
file follows the rule of the file it is). It also lifts the PreToolUse hook that
keeps Claude off the server's own `paths.ENV_FILE` and off the cconnect tools that reach the same
things (the terminal, removing a pack, linking a file, the database tools): the chat sends the key
with every `prompt` and the hook asks the live session on each call. A turn sent without it
loses the `terminal` and `databases` capabilities (`core/access.authorize`, run again on every
`prompt` with that prompt's key), so those tools are not even offered; the persistent CLI's `mark`
carries the capabilities, so unlocking mid-chat restarts it with them. It only gates while the Bearer gate is on (`gated()`), so a plain local
run is open. Each route checks it for itself; there is no middleware for it, and a read that
the panel needs before it can ask for anything (`repos`, `databases/engines`) is deliberately outside it.

`--expose tailnet` is the one exposure that skips both the token and `CCONNECT_AUTH_ACTIVE`:
`tailscale serve` answers only inside the tailnet, so it is the local mode with HTTPS on top.
`--expose caddy` only advertises an exposure someone else terminates, so `--stop` must not
close a Funnel it never opened (`.detached.provider`, which also tells a `serve` apart from a
`funnel` when shutting down). Its default hostname aborts when no globally routable IPv4
exists, or the QR would point nowhere.

## HTTP API

Everything returns `api_response()`. Route groups: `/api/health`, `/api/capabilities`,
`/api/settings`, `/api/cli`, `/api/sessions/*` (transcript slices, checkpoints + rewind,
rename/color/move/delete, fork through the SDK's `fork_session` up to a message or the
pending rewind point, trash, categories, transcript images), `/api/shared/*` (file
manager; listing is the `WS /api/shared/ws`; an upload streams to disk, so `PUT` is outside
`MAX_BODY_SIZE`), `/api/claude/*` (prompts, plugins and their reload, marketplaces, skills,
MCP, memories, usage in the app's `lang`, status; installing an MCP server from its
`.mcp.json` entry and a skill from a folder of a git repository, the two install links that
need the server), `/api/accounts/*`, `/api/system/*` (also the processes the server runs and
`processes/{pid}/stop`), `/api/pages` (registers an HTML page and serves the folder around
it), `/api/network/*`, `/api/git/*` (repositories under a project, identities,
the written message, commit, revert, pull, push), `/api/agents/*` (the Agent Client
Protocol agents: catalog, install, sign-in, forking, renaming and deleting sessions, and their
category and manual order, kept in `agent_session_placement` beside Claude's; reading or
changing their environment variables takes the security key), `/api/packs/*` (the server's pack library and its
previews; deleting from it takes the security key; `fetch` downloads a pack link, https only,
and hands it back without keeping it), `/api/databases/*` (connections, their drivers, schemas,
objects and tables, a page of rows, SQL, row edits and exports; see *Databases* below). Live streams: `WS /api/chat/ws`,
`WS /api/list/ws` (chat/project list), `WS /api/agents/ws` (an agent's chats: `watch`
names the agent and the folder, the server pushes `sessions` snapshots and `activity`
changes), `WS /api/system/ws`, `WS /api/shared/ws`,
`WS /api/packs/ws`, `WS /api/network/speedtest/ws`, `WS /api/browser/ws` (frames and state
of the server's Chromium; `watch` decides whether it runs, and an opening without it
watches, which is what an app older than 1.10.3 sends; `home` loads the blank page, so Back
returns to the page before it).

A route that answers with a file uses `FILE_HEADERS` (`core/responses.py`): without
`Cache-Control: no-cache`, the `last-modified` of a `FileResponse` lets a browser keep a copy
for a tenth of the file's age without asking, and a file rewritten under the same name shows
its old version.

Transcript slices are cursor-based (`before_index`), and while a live session still has
events to replay the tail is cut at its `turn_start_index` so the same turn never arrives
twice — once from disk and once from the replay.

## WebSocket protocol (`/api/chat/ws`)

Client → server: `start` (with `channel` + `last_seq` to re-attach, and the app's `locale`, which
the plan usage's names follow), `prompt`, `unqueue`,
`set_generation`, `set_permission_mode`, `interrupt`, `interaction_response`, `load_history`,
`ask`, `usage`, `stop_task`, `reload`, `close_resident`, for mods `mod_render`, `mod_act`,
`mod_answer`, `mod_client_module`, and for an ACP agent (a `start` that names one) `set_option`,
`agent_login`, `agent_logout`, `agent_retry` and `history`. An agent's chat gets `agent_state`
(status, options, commands, sign-in methods) and `history` (its rows, paged like a transcript)
outside the seq'd stream. Those rows come from the agent itself, replayed by `session/load`:
the server stores no agent messages, only the session ids of agents without `session/list`
(`agent_known_sessions`) and the titles the user gives sessions (`agent_session_titles`), which ACP
has no request for and which win over the agent's in the list and in `agent_state`. A new agent chat creates its session with the first message once the
agent's options are remembered (`agent_defaults`); delegation creates it at once
(`create_now`).

A socket re-attaching with a `channel` and `last_seq` only gets a replay when the replay can fill
it in. When the server no longer has that channel (it restarted, or released the chat) or the
outbox already trimmed events after `last_seq` (`LiveSession.covers`), `ready` says `stale` and
the app reopens the chat from its transcript, the way picking it from the list does. Otherwise
a device that came back after a restart, once another device had reopened the chat, was attached
to that one as `resumed`, got only the turn in progress and kept a view with a hole in it.

Re-attaching never changes the live chat's account: `ready` carries the one it runs on and
the app adopts it, and only `set_generation` changes it. A tab that had not loaded its
account yet used to send the default on reconnect and restart the CLI on it. Model, effort and
permission mode are the tab's own: a change answers only the socket that sent it.

Every event the server sends is typed in `schemas/chat_events.py`. `python -m schemas.contract`
writes `schemas/chat_events.json`, which the app's `npm run check` turns into its own types; the
release workflow runs it with `--check`, and `CCONNECT_CONTRACT_CHECK=1` validates each event as
it is sent.

Server → client, all seq'd per session except the control ones (`ready`, `permission_mode`,
`history_chunk`, `usage`, `ask_*`, `activity`) and the mods ones:

| event | notes |
|---|---|
| `assistant_text` / `thinking` / `todos` / `task` | streamed content and indicators |
| `anchor` | the transcript uuid of a top-level reply with text, which forking from that reply goes up to |
| `tool_use` / `tool_result` | `file_change` replaces them for Edit/Write/MultiEdit/NotebookEdit, with the diff already classified; `db_query` and `db_execute` add `query` (the connection, its name, the database, the SQL, `saved`) and, with the result, `statements` read back from it (`mcps/databases.statements_of`), each with its `kind` and `effect`, which the app draws as its query block. Like shared files, those two always arrive whole, whatever `show_tool_use` says (`mcps/databases.tool_mode`, and the socket filter lets an event with `query` or `statements` through) |
| `interaction_request` | permissions, and `kind: "component"` for forms (`ask_component` and `AskUserQuestion` share one renderer) |
| `compacting` / `compact` / `compact_summary` | `compacting` follows the CLI's `status` frame (`compacting_ended` when it clears); `compact` comes from the live `compact_boundary`, whose metadata is `compact_metadata` with `pre_tokens`/`post_tokens`, not the transcript's camelCase |
| `context` | context size; see below |
| `status` (`retrying`/`ok`) | `retrying` follows the CLI's `api_retry` with the attempt, the delay and the cause; a turn that fails arrives as an `api_error` whose `severity` tells a warning from an error |
| `rate_limit` / `cache` | the plan's session and weekly windows as the CLI reports them (ids `session` and `week`), and the prompt cache's expiry for the context ring |
| `task_running` / `agent_result` | a backgrounded agent or task started, and its end; the app shows the block as running in between, lists it under Running and stops it with `stop_task` |
| `reloaded` | what `/reload-plugins` or `/reload-skills` brought in |
| `commands` | the session's slash commands, sent again when `/reload-plugins` changes them |
| `activity` | per-chat state, rides the channel so a brand-new chat reports before it has an id |
| `queued` / `dequeued` | message queue |
| `attached` | replay finished — the client publishes the conversation in one step |
| `mods` | the whole mods surface (attached, panes, status lines, commands), sent on every attach and on each change |
| `mod_tree` / `mod_reply` | answer the socket that asked; every `mod_render` gets a `mod_tree`, with a null tree when no CLI is attached |
| `mod_toast` / `mod_invalidate` / `mod_focus` / `mod_scroll` / `mod_request` | live only, never replayed |
| `system`, `result`, `done`, `interrupted`, `error` | |

**Context size** travels only in `context` — `result` does not carry it, and the clients
*assign* the value, so a `null` clears the ring. The live number is
`input_tokens + cache_read + cache_creation` from each `AssistantMessage.usage` and from the
main conversation's `message_delta` stream event, emitted only when it changes: a model
provider can send `0` in `message_start`, which is what the `AssistantMessage` carries, and the
real counts only in `message_delta`. On a live `compact_boundary` it is
`compact_metadata.post_tokens`. A manual
`/compact` emits no live boundary, so the router derives it from `latest_compact()` after
the turn. Opening a session that isn't running still takes it from the transcript
(`sessions.last_context_tokens`), which reports the last usage in the file — so a session
compacted with no turn after it reads pre-compaction until the next message.

## Transcripts and compaction

`services/sessions.get_session_messages` normalizes the JSONL so resume == live (stripped
text, `tool_use` formatted the same way, TodoWrite/Task dropped, `AskUserQuestion` and
`ask_component` rebuilt as interaction blocks, rewind branches honoured).

The CLI's format is not a contract and it moves. What currently holds:

- `_active_entries` walks `parentUuid` (falling back to `logicalParentUuid`) back from the
  last entry to drop rewound branches, but only when some node has 2+ children.
- **Compaction markers survive that walk unconditionally** (`_is_compact_marker`). The CLI
  hangs the `isCompactSummary` entry off the boundary while the conversation continues from
  `compactMetadata.preservedSegment` — a uuid from *before* the compaction — so the pair
  looks like a dead sibling branch. Dropping it left a resumed chat with no compaction block
  and no summary.
- Reading starts at `_last_compact_offset(file)`: only the tail after the last boundary.
- `compactMetadata.postTokens` **is** present in the current CLI; `latest_compact` still
  falls back to the first post-boundary entry with usage.
- Non-conversation entries (`queue-operation`, `attachment`, `file-history-snapshot`,
  `custom-title`, `mode`, `last-prompt`…) are everywhere: filter by type, never by position.
- The SDK writes `"entrypoint":"sdk-py"`, which hides a session from `claude --resume`.
  Every turn rewrites it to `"cli"` padded with spaces to the same length, in place, only
  over the bytes that turn wrote, and in a worker thread. A transcript runs to hundreds of
  MB, and rewriting it whole on the event loop froze the server for ~10 s at the end of
  every turn (and could drop lines the CLI appended meanwhile).

## Message queue

A prompt sent mid-turn is queued and injected into the same turn instead of refused.
`run_prompt` runs the SDK in streaming-input mode and drains the session queue; each item
is rendered **from the transcript** (`_flush_users` greedily matches new user entries
against the leading chips), which is what makes resume and live agree when the CLI joins
several messages into one entry. The turn is held open until the queue drains and the
final `result` lands.

## Persistent sessions and mods

With `persistent_sessions` on, a chat keeps its CLI between turns. `persistent_sessions.pool`
holds one `PersistentSession` per channel, a `ClaudeSDKClient` owned by its own task and
keyed by cwd, the resolved account and scope. `session_limit` (10 by default) caps the
chats holding a process, persistent CLIs and ACP agents together, and `registry.trim`
releases the least recently used idle ones past it; the live session releases its own
`session_grace` seconds (300 by default) after the last socket detaches, once nothing runs in the background (`working` counts the
tasks the CLI reported). A turn whose options differ from the ones the CLI started with
(`mark`: model, effort, permission mode, mods, capabilities) closes it and starts a fresh one, and so does
another account, since the account is the CLI's config folder and credentials. Stopping or
restarting the server closes the persistent CLIs and the agents' processes first
(`live_sessions.close_processes`). When the CLI
starts a turn on its own, a mod sending a prompt or a background task finishing,
`own_turn` makes the live session adopt it so it streams like any other; an adopted turn
keeps the running CLI (`resident(keep=True)`) and never reshapes it, or it would kill the
process that started the turn.

Mods ride on the CLI's internal UI protocol (`services/mods.py`): `ui_attach` as the
`desktop` surface, `ui_render` per site, and the CLI's notifications, which fold into one
`Surface` per live session and reach the app as the `mods` snapshot. `mod_surfaces`, on by
default, gates all of it. What a mod writes to the transcript shows in any chat, while panes and the band
need the resident CLI. A chat without one keeps its last surface between turns and no CLI is left
to redraw it, so uninstalling or disabling a plugin drops what it left there (`forget_plugin`)
once the turn that still loads it ends. The protocol is not public and moves between CLI versions, so every
request goes through `mods.request`, which turns a failure into `None` instead of raising.

An MCP server's elicitation reaches the host as the CLI's `elicitation` control request, which the
SDK rejects as unknown, so every form used to come back cancelled. `control_requests` answers it,
and the mods' `ui_*` requests, on both kinds of chat: `serve` wraps a persistent CLI's query, and
`Answering` wraps the transport of a one-shot turn. `elicitation` turns the schema into the chat's
form and the answer back into `accept` / `decline` / `cancel`, the same mapping an ACP agent's
`elicitation/create` goes through.

## Database

Everything the server keeps as records lives in `data/config/cconnect.db` (SQLite in WAL), never in a
loose JSON file rewritten whole: settings, chat placement and categories, the trash, database
connections, agents and their chats' state, disabled MCP servers, pending rewinds, task lists and the
steps of each delegation. Files are only for what is not a record: prompts edited by hand, packs, the
CLI's account folders, caches, logs and the process files (`.runtime`, `.detached.*`).

- **The migrations are the schema.** `core/migrations/versions/` holds them, each with a working
  `downgrade()`; `init_db()` runs them to `head` on every start. A new one is scaffolded from
  `backend/` with `alembic revision -m "<what>"` and written by hand: nothing is generated from the
  models, and `create_all` is never called. `core/models.py` mirrors the result, and a change to
  one is a change to the other.
- **Applied migrations are held to their source.** `schema_migrations` keeps the SHA-256 of each
  one as it ran, and a start that finds the file changed logs it. While developing a migration is
  fixed in place (downgrade, edit, upgrade, then the whole set from scratch on a throwaway
  database); once released it is immutable and changes go forward in a new one.
- **Every table and column carries an English comment**, in the migration and in the model.
- **Timestamps are UTC instants** stored as ISO 8601 text (`Timestamp`, the same form `NOW`
  writes as a column default), so they sort as they read. The API still answers epoch seconds
  where it did.
- **Derived values come from the database.** Triggers, all of them listed here:
  `session_todos_touched` stamps `session_todos.updated_at` whenever `items` changes.

## Settings and visibility

Model, effort, permission mode, streaming, CLI source and per-block visibility live in the
`settings` table of `cconnect.db` and are **backend-owned**, so every client shares one config.
`show_thinking` / `show_tool_use` / `show_file_change` / `show_compact` take
`full | label | off` and are applied identically on the live stream and on resume. `label`
strips a tool's result, never an agent's subtasks: those still arrive, with their `parent`.

## MCP server (`mcps/`)

Tools auto-register. Each one is declared once, at module level, as a `Definition`
(`mcps/definition.py`: name, description, input schema, `eager`, `guide`) named after the tool in
capitals (`TERMINAL_OPEN`, `DB_QUERY`); `make_tools(context)` binds it to its handler by using it
as a decorator, runs fresh on every turn and returns `[]` to remove the module's tools from that
turn (the safest gate). A description or schema that depends on the turn is a `replace` of the
definition (the forms' previews, `delegate`'s destinations), and every text answer goes through
`reply`. A module whose tools reach what the security key guards declares `needs_key(name, args)`,
and the PreToolUse hook denies those calls when the message came without the key.
Bundled: `check_progress`, `compact`, `usage`, `history` (the chat's own messages, numbered,
before a compaction too, without the tool calls), `session_info`, `show_component`,
`ask_component`, `share_files`, `packs` (writes a pack into the server's library),
`delegate` (runs a task on a destination, or registers one), `reload` (persistent chats
only), `db_inspect` / `db_query` / `db_execute` / `db_manage` (only in turns with the `databases`
capability, which needs the key; `db_query` refuses anything that writes), and the
browser and terminal tools behind their settings.

What a turn gets is decided in layers. A family behind a setting is left out while it is off (the
browser), one that reaches the machine needs the key (the terminal and the database tools), and
what remains is **deferred behind tool search**: only the names reach the prompt, and Claude loads
a definition with `ToolSearch` the first time it needs it. A definition with `eager` is loaded up
front instead (`share_files` and the chat's own tools): `_load_up_front` marks it with `_meta`
`anthropic/alwaysLoad`, which Claude Code reads per tool and the SDK's listing does not set yet,
by wrapping the server's `tools/list` through mcp 2's handler API (hence `mcp>=2`). A definition
with `guide` stays deferred, and the opening paragraph of its description, which has to say what it
does and when to reach for it, goes in the system prompt through `TOOLS.md` (`tool_guides`, only
for the tools the turn offers and the user has not disabled). That is how the forms stay deferred:
without that line, an Opus turn asked to help pick a stack answered in prose, and with it, it loaded
`ask_component` and opened a form. Measured on 07/11 with everything on: the deferred families saved
~5,400 tokens of context per turn, and deferring the forms with their guide another ~4,800
(27,887 → 23,116, read from the CLI's own context breakdown).

`ask_component` and `show_component` share one element list (`mcps/components.py`). The
contract is flat: every value travels as a string, an `id` means the element carries a
value, control labels travel as keys for the client to translate, `show_if` hides an
element *and* leaves it out of `values`, and validation is client-side. `mcps/media.py` is
the single table of what the app renders inline.

**Adding an element** touches several files and there is no generator, so this is the checklist:

1. `TYPES` + `LEAF` in `mcps/components.py`, and its line in `DESCRIPTION` / `SHOW_DESCRIPTION`.
2. `ComponentElement` in `client/.../data/chatModels.ts` and `toElement` in `.../services/chatSocket.ts`.
3. The `{#if}` chain in `client/.../chat/blocks/ComponentBlock.svelte`.
4. **The summary** (`componentSummary` / the derived `summary`) — the one everybody forgets;
   skipping it is what printed `secret` values into the chat.
5. The validation (`componentMissing` / `missing`) if it can be required.
6. `en.json` if it brings text of its own, and the other catalogs with it (a key they lack
   falls back to English).

## Databases

The engines are data: `core/databases/engines.json` lists every one a connection can use (its
SQLAlchemy dialect, the pip packages of its driver, default port, read-only preludes, timeout,
binary literal, hidden schemas and the options its URL usually takes), with `defaults` and
`extends` so the PostgreSQL and MySQL families inherit their driver and rules.
`database_engines` only loads it. Three forms: `file` (a path), `server` (host, port, database,
user, password and `options`, the URL's query) and `url`, the `custom` engine: any SQLAlchemy URL
plus the pip packages its driver needs, which borrows the catalog's rules for its backend
(`spec_of`) and loses its password to the connection's own field when saved.

- **A driver install never moves the server's own packages.** `install_packages` pins every
  requirement of the `cconnect` distribution at its installed version, so a dialect that needs
  another SQLAlchemy resolves to an older release of itself or fails with the resolver's reason.
  Dialects whose every release pins an older SQLAlchemy are left out of the catalog; databases
  that speak PostgreSQL's or MySQL's protocol use those dialects instead.
- **The drivers dialog lists packages, not engines.** Engines with the same `packages` share one
  driver (`driver_of`): uninstalling it closes all of their engines and keeps only the
  distributions another installed driver still needs.
- **A connection that names no database lists the server's.** The catalog's `databases` query
  lists them and `home` is where such a connection lands (PostgreSQL's `postgres`). Every data
  call takes a `Scope`, the connection and one of those databases, and each scope gets an engine
  of its own; a listing that fails falls back to the schemas of the home database.
- **A database file opens without a connection.** `open_file` resolves a file of the shared
  folder or of a project (a project's ignored files only with the key), takes the engine from
  the file's header (`signature`; the `extensions` only decide for an empty file) and keeps the
  entry in memory under a `file:` id. File engines use `NullPool`, so the server holds no lock on
  the file between queries. The client reads the same `extensions` at build time.

Every SQL statement goes through `database_data`, and nothing there trusts the client:

- **Every statement answers on its own** (`results`), and the flat fields keep describing the
  last result set for the console. Each one says what it did (`kind`: `rows`, `changed`,
  `structure` or `done`, plus `effect`, the action and the object read from its SQL by sqlglot):
  an INSERT, UPDATE or DELETE brings back the rows it touched where the engine's `returning` allows
  it (`clause` appends `RETURNING *`; `cte`, the PostgreSQL family, wraps it as
  `WITH … SELECT … LIMIT`, so a change of millions of rows still ships only the first ones and its
  total from a window count), and a CREATE or ALTER of a table or view is followed by its
  reflected columns. A batch holding a statement no transaction admits (CREATE or
  DROP DATABASE, VACUUM, CREATE INDEX CONCURRENTLY…, `OUTSIDE_TRANSACTION`) runs in autocommit and
  cannot be undone; before it runs, the server closes its own pooled sessions on the connection's
  other databases (`release_others`), which DROP DATABASE would otherwise count as users.
- **Claude's tools answer in text, not JSON** (`mcps/databases.render`): a header per statement
  (`[1] 50 rows, more from offset 50`, `[2] 120 rows inserted into items, 50 shown`,
  `[3] created table items, 3 columns`, `[4] dropped table old`, `[5] done`), the columns and rows
  tab-separated with `\\`, `\t`, `\n` and `\r` escaped, NULL as `\N`, cells cut at 200 characters,
  50 rows by default with `limit` and `offset`. `statements_of` reads it back for the query block, so
  the two change together.
- **Reads and writes are told apart by sqlglot, failing closed.** The text is split on the
  tokenizer's semicolons, and a statement only reads when it parses as SELECT, a set operation,
  DESCRIBE, SHOW, EXPLAIN of a read or a PRAGMA without `=`. Anything else, or anything that does
  not parse, writes, and writing takes the key. A read runs in a transaction that is always rolled
  back, after the engine's read-only preludes (`PRAGMA query_only`, `SET TRANSACTION READ ONLY`).
- **The WHERE filter** is wrapped as `SELECT * FROM t WHERE …` and must be one reading statement;
  its colons are escaped so `text()` takes no bind parameters, and it closes on a newline so a
  trailing `--` cannot swallow the ORDER BY and LIMIT.
- **Every query has a deadline.** The engine's own statement timeout where it has one, and a
  timer that calls the DBAPI's `cancel` / `interrupt` otherwise; the error then says how long it ran.
- **Optional reflection runs in a session of its own** (`_probe`). A failed statement aborts the
  rest of the transaction in PostgreSQL and DuckDB, so a missing comment or foreign key lookup
  used to fail the whole table.
- **duckdb-engine cannot reflect under SQLAlchemy 2.1**: it reuses PostgreSQL's column and primary
  key queries, which now read `pg_collation` and `REGCLASS`. The engine table carries DuckDB's
  own `columns` and `primary_key` queries over `duckdb_columns()` / `duckdb_constraints()`, and
  declared types become SQLAlchemy types through sqlglot (`declared_type`). Tables are rebuilt from
  columns and primary key for every engine instead of autoloaded.
- **A driver counts as installed when its distributions are on disk**
  (`importlib.metadata`), not when the module can be found: an uninstalled module stays in
  `sys.modules` until the server restarts.
- Values leave as JSON-safe cells (`cell`): integers past 2^53, decimals, dates and UUIDs as text,
  binary as a short hex preview. Exports keep the full values: CSV with a BOM, and SQL inserts
  rendered by each column's own literal processor, binary through the engine's `binary`
  template.

## Configuration

Everything comes from environment variables; `core/config.py` declares them and auto-loads
`backend/.env` for local dev. The full table (defaults and meaning) is in the root
`README.md` — it is what the user configures, so keep it there and don't duplicate it.

## Conventions

1. **Routers stay thin**; logic lives in `services/`, new integrations get their own module.
2. **No comments.** A one-line descriptive docstring only when a constraint cannot be
   expressed in code; rationale goes in the answer or the commit.
3. **Imports at the top.** The only exception is the deferred `claude_agent_sdk` import.
4. **Subprocesses that print text use `encoding="utf-8", errors="replace"`** — Windows
   defaults to cp1252 and mojibakes CLI output.
5. `reload=True` only on Linux/macOS; on Windows it breaks the CLI subprocess, so the
   backend has to be restarted by hand after editing it.
