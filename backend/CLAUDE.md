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
  and relaunches it on a restart request. Subcommands `run / expose / stop / status /
  update / migrate / key`, with the launcher's original flags still accepted. `run.py` at
  the backend root is the three-line entry a checkout (and the desktop app) calls.
- `core/` — `paths` (**the** path table: every file the backend owns, plus `INSTALLED`,
  which decides where the data folder is), `release` (the version contract), `config`
  (env), `display` (separator and joining, shared with the app), `settings_defs` + `db` +
  `settings_store` (SQLite KV), `cli_manager`, `sdk`, `responses` (**the** envelope:
  `{success, status, message, data}`).
- `core/packs/` — the built-in packs and `schema.json` / `builtin.json`, the pack format. The
  client build and the Tauri compile read them too, and so does `core/scripts/page_icon.js`
  (the page icon both browsers report), so all of them ship in the wheel.
- `middleware/` — `public_auth` (Bearer, no-op without a token), `security`, `error_handler`.
- `routers/` — thin: validate, call a service, return `api_response()`.
- `services/` — all the logic. `live_sessions` (turn decoupled from the socket), `claude_runtime`
  (SDK stream → normalized events), `persistent_sessions` (the CLI a chat keeps between
  turns), `mods` (the CLI's internal UI protocol), `sessions` (transcripts, checkpoints, images), `chat_list`,
  `categories`, `trash`, `rewind`, `questions`, `attachments`, `claude_assets` / `claude_manage`,
  `system_monitor` (also redacts tokens, keys and passwords from every log sink), `network`,
  `usage`, `accounts`, `shared`, `git_ops` (the commit panel, on top of the single runner in
  `services/git`, one lock per repository), `browser` (the server's Chromium, started only
  while a socket watches one of its tabs), `delegates` / `delegate_runner` / `delegate_runs`
  (handing a task to another AI), `packs` / `pack_format` (the server's pack library and the
  validation the client's reader mirrors), `prompt_cache`, `tool_calls` / `tool_props`,
  `api_errors`, `directory_watch` (the base of the shared and pack watchers).
- `mcps/` — in-process MCP server exposed to Claude as `cconnect`.
- `core/prompts/` — `CCONNECT.md` (appended to every turn, `{{SHARED_DIR}}` / `{{SHARED_URL}}`
  substituted per request), `BLOCKS.md`, `BROWSER.md`, `MODS.md` (only what this app adds
  for a mod Claude writes, appended while mods are on) and `SUGGESTIONS.md`. Versioned, so
  the user-owned `USER.md` and the per-project prompts live in `data/config/prompts/`
  instead (never deleted — emptied). `{{SHARED_URL}}` resolves to `config.SHARED_SCHEME`
  (`cconnect://shared`) and never to a host: the prompt is fixed when the CLI session is
  created, so an address baked into it is stale the moment the app changes environment.
  `/api/capabilities` publishes the scheme as `shared_scheme` and the app swaps it for the
  server it is talking to, which is the only side that knows.

## Auth

`PUBLIC_ACCESS_TOKEN` is honoured only when `CCONNECT_AUTH_ACTIVE=1`, so a token left in
`.env` never locks down a plain local run. `PublicAuthMiddleware` gates every `/api/*`
except `/api/health`; the WS handshake checks the same header via `ws_bearer_ok`.

`SECURITY_KEY` is the other gate and a different one: `core/access.key_matches()` compares
the `X-Security-Key` header and guards what belongs to the **machine** rather than to
Claude — the shells, the files git ignores and every git write. It only gates while the
Bearer gate is on (`gated()`), so a plain local run is open. Each route checks it for
itself; there is no middleware for it, and a read that the panel needs before it can ask
for anything (`repos`) is deliberately outside it.

`--expose tailnet` is the one exposure that skips both the token and `CCONNECT_AUTH_ACTIVE`:
`tailscale serve` answers only inside the tailnet, so it is the local mode with HTTPS on top.
`--expose caddy` only advertises an exposure someone else terminates, so `--stop` must not
close a Funnel it never opened (`.detached.provider`, which also tells a `serve` apart from a
`funnel` when shutting down). Its default hostname aborts when no globally routable IPv4
exists, or the QR would point nowhere.

## HTTP API

Everything returns `api_response()`. Route groups: `/api/health`, `/api/capabilities`,
`/api/settings`, `/api/cli`, `/api/sessions/*` (transcript slices, checkpoints + rewind,
rename/color/move/delete, trash, categories, transcript images), `/api/shared/*` (file
manager; listing is the `WS /api/shared/ws`), `/api/claude/*` (prompts, plugins and their
reload, marketplaces, skills, MCP, memories, usage, status), `/api/accounts/*`,
`/api/system/*`, `/api/network/*`, `/api/git/*` (repositories under a project, identities,
the written message, commit, revert, pull, push), `/api/delegates` (the destinations;
writing them takes the security key), `/api/packs/*` (the server's pack library and its
previews). Live streams: `WS /api/chat/ws`, `WS /api/list/ws` (chat/project list),
`WS /api/system/ws`, `WS /api/shared/ws`, `WS /api/packs/ws`, `WS /api/network/speedtest/ws`,
`WS /api/browser/ws` (frames and state of the server's Chromium; `watch` decides whether it
runs, and an opening without it watches, which is what an app older than 1.10.3 sends).

A route that answers with a file uses `FILE_HEADERS` (`core/responses.py`): without
`Cache-Control: no-cache`, the `last-modified` of a `FileResponse` lets a browser keep a copy
for a tenth of the file's age without asking, and a file rewritten under the same name shows
its old version.

Transcript slices are cursor-based (`before_index`), and while a live session still has
events to replay the tail is cut at its `turn_start_index` so the same turn never arrives
twice — once from disk and once from the replay.

## WebSocket protocol (`/api/chat/ws`)

Client → server: `start` (with `channel` + `last_seq` to re-attach), `prompt`, `unqueue`,
`set_generation`, `set_permission_mode`, `interrupt`, `interaction_response`, `load_history`,
`ask`, `usage`, `stop_task`, `reload`, `close_resident`, and for mods `mod_render`, `mod_act`,
`mod_answer`, `mod_client_module`.

Re-attaching never changes the live chat's account: `ready` carries the one it runs on and
the app adopts it, and only `set_generation` changes it. A tab that had not loaded its
account yet used to send the default on reconnect and restart the CLI on it.

Server → client, all seq'd per session except the control ones (`ready`, `permission_mode`,
`history_chunk`, `usage`, `ask_*`, `activity`) and the mods ones:

| event | notes |
|---|---|
| `assistant_text` / `thinking` / `todos` / `task` | streamed content and indicators |
| `tool_use` / `tool_result` | `file_change` replaces them for Edit/Write/MultiEdit/NotebookEdit, with the diff already classified |
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
`input_tokens + cache_read + cache_creation` from each `AssistantMessage.usage`, emitted
only when it changes; on a live `compact_boundary` it is `compact_metadata.post_tokens`. A manual
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
keyed by cwd, the resolved account and scope; `persistent_limit` trims the oldest idle
ones, and the live session releases its own `persistent_grace` seconds (300 by default)
after the last socket detaches, once nothing runs in the background (`working` counts the
tasks the CLI reported). A turn whose options differ from the ones the CLI started with
(`mark`: model, effort, permission mode, mods) closes it and starts a fresh one, and so does
another account, since the account is the CLI's config folder and credentials. When the CLI
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

## Settings and visibility

Model, effort, permission mode, streaming, CLI source and per-block visibility live in the
SQLite KV store and are **backend-owned**, so every client shares one config.
`show_thinking` / `show_tool_use` / `show_file_change` / `show_compact` take
`full | label | off` and are applied identically on the live stream and on resume. `label`
strips a tool's result, never an agent's subtasks: those still arrive, with their `parent`.

## MCP server (`mcps/`)

Tools auto-register: each module exposes `tools = [...]`, or `make_tools(context)` when the
tool needs the running turn (returning `[]` removes it from that turn — the safest gate).
Bundled: `check_progress`, `compact`, `usage`, `history` (the chat's own messages, numbered,
before a compaction too, without the tool calls), `session_info`, `show_component`,
`ask_component`, `share_files`, `packs` (writes a pack into the server's library),
`delegate` (runs a task on a destination, or registers one), `reload` (persistent chats
only), and the browser and terminal tools behind their settings.

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
