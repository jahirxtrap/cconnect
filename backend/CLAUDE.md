# CLAUDE.md — backend

FastAPI bridge between the CConnect apps and Claude Code, running on the user's PC.
Drives the CLI through `claude-agent-sdk` using the **subscription** (the logged-in
CLI's OAuth): `core/sdk.ensure_subscription_auth()` drops `ANTHROPIC_API_KEY`, because
an exported key silently wins and bills API credits. The SDK is upgraded on startup
(`AUTO_UPDATE_SDK=1`), which is why its import is deferred inside `claude_runtime`.

```
[app] ──WS  /api/chat/ws──> chat router ──> live_sessions ──> claude_runtime ──> SDK query()
      ──REST /api/sessions ─> sessions router ──> services/sessions (~/.claude/projects JSONL)
      ──REST /api/shared ───> shared router ──> backend/shared/
      ──REST /api/claude ───> claude router ──> claude_assets (read) + claude_manage (mutate)
```

## Layout

- `main.py` — app, router auto-discovery, gzip, catch-all 404.
- `run.py` — supervisor: launches uvicorn as a child and relaunches it on a restart
  request. `--expose {tailscale,caddy}` turns on the Bearer gate and prints URL + token + QR.
- `core/` — `config` (env + version contract), `settings_defs` + `db` + `settings_store`
  (SQLite KV), `cli_manager`, `sdk`, `responses` (**the** envelope: `{success, status, message, data}`).
- `middleware/` — `public_auth` (Bearer, no-op without a token), `security`, `error_handler`.
- `routers/` — thin: validate, call a service, return `api_response()`.
- `services/` — all the logic. `live_sessions` (turn decoupled from the socket), `claude_runtime`
  (SDK stream → normalized events), `sessions` (transcripts, checkpoints, images), `chat_list`,
  `categories`, `trash`, `rewind`, `questions`, `attachments`, `claude_assets` / `claude_manage`,
  `system_monitor`, `network`, `usage`, `accounts`, `shared`.
- `mcps/` — in-process MCP server exposed to Claude as `cconnect`.
- `prompts/` — `CCONNECT.md` (appended to every turn, `{{SHARED_DIR}}` / `{{BASE_URL}}`
  substituted per request) and `USER.md` (user-owned, gitignored, never deleted — emptied).

## Auth

`PUBLIC_ACCESS_TOKEN` is honoured only when `CCONNECT_AUTH_ACTIVE=1`, so a token left in
`.env` never locks down a plain local run. `PublicAuthMiddleware` gates every `/api/*`
except `/api/health`; the WS handshake checks the same header via `ws_bearer_ok`.

`--expose caddy` only advertises an exposure someone else terminates, so `--stop` must not
close a Funnel it never opened (`.detached.provider`). Its default hostname aborts when no
globally routable IPv4 exists, or the QR would point nowhere.

## HTTP API

Everything returns `api_response()`. Route groups: `/api/health`, `/api/capabilities`,
`/api/settings`, `/api/cli`, `/api/sessions/*` (transcript slices, checkpoints + rewind,
rename/color/move/delete, trash, categories, transcript images), `/api/shared/*` (file
manager; listing is the `WS /api/shared/ws`), `/api/claude/*` (prompt, plugins,
marketplaces, skills, MCP, memories, usage, status), `/api/accounts/*`, `/api/system/*`,
`/api/network/*`. Live streams: `WS /api/chat/ws`, `WS /api/list/ws` (chat/project list),
`WS /api/system/ws`, `WS /api/shared/ws`, `WS /api/network/speedtest/ws`.

Transcript slices are cursor-based (`before_index`), and while a live session still has
events to replay the tail is cut at its `turn_start_index` so the same turn never arrives
twice — once from disk and once from the replay.

## WebSocket protocol (`/api/chat/ws`)

Client → server: `start` (with `channel` + `last_seq` to re-attach), `prompt`,
`set_permission_mode`, `interrupt`, `interaction_response`, `load_history`, `ask`, `usage`.

Server → client, all seq'd per session except the control ones (`ready`, `permission_mode`,
`history_chunk`, `usage`, `ask_*`, `activity`):

| event | notes |
|---|---|
| `assistant_text` / `thinking` / `todos` / `task` | streamed content and indicators |
| `tool_use` / `tool_result` | `file_change` replaces them for Edit/Write/MultiEdit/NotebookEdit, with the diff already classified |
| `interaction_request` | permissions, and `kind: "component"` for forms (`ask_component` and `AskUserQuestion` share one renderer) |
| `compacting` / `compact` / `compact_summary` | `compacting` comes from a PreCompact hook pushed out-of-band, because the SDK stream is blocked while it compacts |
| `context` | context size; see below |
| `status` (`retrying`/`slow`/`ok`/`failed`) | transient API trouble, suppressed while compacting, while a tool is in flight and while awaiting the user |
| `activity` | per-chat state, rides the channel so a brand-new chat reports before it has an id |
| `queued` / `dequeued` | message queue |
| `attached` | replay finished — the client publishes the conversation in one step |
| `system`, `result`, `done`, `interrupted`, `error` | |

**Context size** travels only in `context` — `result` does not carry it, and the clients
*assign* the value, so a `null` clears the ring. The live number is
`input_tokens + cache_read + cache_creation` from each `AssistantMessage.usage`, emitted
only when it changes; on a `compact_boundary` it is `compactMetadata.postTokens`. A manual
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

## Message queue

A prompt sent mid-turn is queued and injected into the same turn instead of refused.
`run_prompt` runs the SDK in streaming-input mode and drains the session queue; each item
is rendered **from the transcript** (`_flush_users` greedily matches new user entries
against the leading chips), which is what makes resume and live agree when the CLI joins
several messages into one entry. The turn is held open until the queue drains and the
final `result` lands.

## Settings and visibility

Model, effort, permission mode, streaming, CLI source and per-block visibility live in the
SQLite KV store and are **backend-owned**, so every client shares one config.
`show_thinking` / `show_tool_use` / `show_file_change` / `show_compact` take
`full | label | off` and are applied identically on the live stream and on resume.

## MCP server (`mcps/`)

Tools auto-register: each module exposes `tools = [...]`, or `make_tools(context)` when the
tool needs the running turn (returning `[]` removes it from that turn — the safest gate).
Bundled: `check_progress`, `compact`, `usage`, `show_component`, `ask_component`.

`ask_component` and `show_component` share one element list (`mcps/components.py`). The
contract is flat: every value travels as a string, an `id` means the element carries a
value, control labels travel as keys for the client to translate, `show_if` hides an
element *and* leaves it out of `values`, and validation is client-side. `mcps/media.py` is
the single table of what the app renders inline.

**Adding an element** touches several files and there is no generator, so this is the checklist:

1. `TYPES` + `LEAF` in `mcps/components.py`, and its line in `DESCRIPTION` / `SHOW_DESCRIPTION`.
2. `ComponentElement` in `tauri/.../data/chatModels.ts` and `toElement` in `.../services/chatSocket.ts`.
3. The `{#if}` chain in `tauri/.../chat/blocks/ComponentBlock.svelte`.
4. **The summary** (`componentSummary` / the derived `summary`) — the one everybody forgets;
   skipping it is what printed `secret` values into the chat.
5. The validation (`componentMissing` / `missing`) if it can be required.
6. The two translation files if it brings text of its own.

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
