# CLAUDE.md — CConnect Backend

Bridge between the CConnect clients (the Android app and the Compose
desktop/web app) and Claude Code, running locally on the user's PC. FastAPI +
Python 3.11+. One backend serves all clients identically.

It drives Claude Code through the official **Claude Agent SDK**
(`claude-agent-sdk`), using the user's **subscription** (the logged-in CLI
OAuth), never an API key. The app reaches it either over the local tailnet
(plain HTTP, no auth) or over a Tailscale Funnel (HTTPS, Bearer-token gated).
Beyond the chat bridge it manages the local Claude Code install (CLI, plugins,
marketplaces, MCP servers, skills, memories) and a shared-folder file manager.

---

## Architecture

```
[CConnect client] ──WS  /api/chat/ws────> chat router ──> services/live_sessions.LiveSession ──> services/claude_runtime.run_prompt ──> SDK query()
             ──REST /api/sessions/* ─> sessions router ──> services/sessions (reads ~/.claude/projects JSONL; rewind via services/rewind)
             ──REST /api/shared/* ──> shared router ──> services/shared (list/upload/download/move/copy/rename under backend/shared/)
             ──REST /api/claude/* ──> claude router ──> services/claude_assets (reads ~/.claude) + services/claude_manage (mutations via `claude` CLI subprocess)
```

- **Subscription auth.** `core/sdk.ensure_subscription_auth()` drops
  `ANTHROPIC_API_KEY` so the SDK uses the CLI's OAuth. An exported key silently
  wins and bills API credits.
- **SDK auto-update.** `core/sdk.ensure_sdk_installed()` runs
  `pip install -U claude-agent-sdk` on startup (toggle with `AUTO_UPDATE_SDK=0`).
- **Connection-independent turns.** Each chat runs in a `LiveSession`
  (`services/live_sessions.py`) whose worker task is decoupled from the socket:
  a dropped connection does **not** cancel the turn. The socket is a detachable
  transport — a reconnecting client re-attaches by `channel` (handed out in
  `ready`), gets the current `running` state, and any still-pending permission
  prompt is re-emitted so it can be answered over the new connection. One turn
  at a time per session — a prompt sent mid-turn is queued and injected (see
  **Message queue**); multi-turn resumes the session id from each `result`.
  (In-memory only — turns survive socket drops, not a backend restart.)

## Project Structure

```
backend/
├── main.py                  # FastAPI app; lifespan ensures auth + SDK; router auto-discovery; catch-all 404; GZipMiddleware(minimum_size=512)
├── run.py                   # Supervisor launcher: runs uvicorn as a child and relaunches it on restart requests; --expose {tailscale,caddy} resolves the public URL + token + QR. The desktop client's local-server panel can spawn this too (see client/CLAUDE.md)
├── pyproject.toml           # version + [tool.cconnect] supported-app / supported-cli (the version contract)
├── Dockerfile
├── .env.example
├── prompts/
│   ├── CCONNECT.md          # System conventions appended to every turn ({{SHARED_DIR}}/{{BASE_URL}} placeholders)
│   └── USER.md              # User's own prompt (gitignored, edited from the app; never deleted — emptied instead)
├── core/
│   ├── config.py            # PORT (8723), CLAUDE_PROJECTS_DIR, SHARED_DIR, AUTO_UPDATE_SDK, PUBLIC_ACCESS_TOKEN, COMMANDS, MODELS (CLI aliases — fable/opus/sonnet/haiku, with [1m] variants), defaults; reads pyproject for SERVER_VERSION / SUPPORTED_APP / SUPPORTED_CLI
│   ├── settings_defs.py     # KV settings registry — default, type, allowed values per key
│   ├── db.py / models.py    # SQLite-backed store for the runtime settings
│   ├── cli_manager.py       # Resolve/select the Claude CLI (system, bundled, custom) + update it; active_version() is cached per resolved path, invalidated on update/set_source
│   ├── sdk.py               # Subscription auth + SDK install/upgrade + status
│   ├── responses.py         # api_response() + paginated_response() — THE response envelope
│   └── rate_limit.py        # slowapi limiter (configured, not globally enforced)
├── middleware/
│   ├── public_auth.py       # Bearer-token gate; no-op when PUBLIC_ACCESS_TOKEN is None
│   ├── security.py          # Security headers + 25MB request size limit
│   └── error_handler.py     # Routes every error through api_response()
├── routers/
│   ├── health.py            # GET /api/health (+ SDK status + version contract) — only path open with --expose
│   ├── capabilities.py      # GET /api/capabilities — models, effort levels, permission modes, colors, commands + version contract
│   ├── settings.py          # GET/POST /api/settings, POST /api/settings/reset — backend-owned config
│   ├── cli.py               # GET/POST /api/cli, POST /api/cli/update — Claude CLI manager
│   ├── sessions.py          # Projects, sessions, transcript slices, rename/color/delete, checkpoints + rewind, transcript images
│   ├── shared.py            # File manager API over backend/shared/
│   ├── claude.py            # Claude install manager: prompt, plugins, marketplaces, catalog, skills, MCP, memories
│   ├── system.py            # PC resource snapshot + server logs (monitor screen)
│   ├── network.py           # Host network status, Wi-Fi control, speed test (monitor screen)
│   ├── accounts.py          # Claude accounts: list/create/rename/delete, MCP sync, remote OAuth login
│   └── chat.py              # WS /api/chat/ws
├── schemas/
│   ├── network.py           # Network router request models
│   ├── accounts.py          # Accounts router request models
│   └── chat.py              # Inbound WebSocket message models
├── mcps/                    # In-process MCP server (auto-registered tools) — see below
└── services/
    ├── live_sessions.py     # In-memory LiveSession + SessionRegistry — turns decoupled from the WS connection; reattach by channel, idle reaper, seq'd outbox replay; message queue (enqueue/drain, carry-over)
    ├── claude_runtime.py    # SDK query() -> normalized event stream; system-prompt append; side-question + usage helpers; title generation; streaming-input drain injects queued messages (`dequeued`); PreCompact hook emits `compacting`; idle watchdog + stderr callback + result/exception classification emit `status` (`slow`/retry, suppressed during compact/tool/await) vs clean `error` (usage limits/auth)
    ├── sessions.py          # Read transcripts from ~/.claude/projects (path-traversal safe); checkpoints; image extraction
    ├── questions.py         # AskUserQuestion <-> component blocks: questions_to_blocks() for the form, answers_from_values() for the CLI's answer, values_from_answers() to rebuild it on resume
    ├── rewind.py            # Rewind preview/execute via SDK control requests; pending rewind id in rewind_pending.json
    ├── attachments.py       # compose_prompt(): native image blocks + @-mentions for chat attachments
    ├── claude_assets.py     # Read-only views of ~/.claude: plugins, marketplaces + catalogs, skills, MCP servers, memories, USER.md
    ├── claude_manage.py     # Mutations via `claude` CLI subprocess: plugin/marketplace actions, MCP add/remove
    ├── settings_store.py    # Read/write the KV settings; visibility_mode() per block type
    ├── system_monitor.py    # psutil/NVML snapshots + shared on-disk server log (see System monitor)
    ├── usage.py             # Plan token usage from the selected account's OAuth creds: structured usage_data(account) for the app, usage_markdown(account) for the chat's /usage; reads the `limits` array (session / weekly_all / per-model)
    ├── accounts.py          # THE source of account paths: each account is its own CLAUDE_CONFIG_DIR under accounts/, with projects+plugins+skills linked back to the primary one. env_for() is the only integration point; is_logged_in() asks `claude auth status --json`
    ├── account_login.py     # Remote OAuth: drives `claude auth login --claudeai` in a PTY, scrapes the authorization URL, feeds back the pasted code
    ├── network.py           # Interfaces, Wi-Fi scan/connect/radio, real connectivity check, guarded mutations with rollback + offline watchdog
    ├── speedtest.py         # Ookla CLI wrapper (jsonl progress); reports unavailable when not installed
    └── shared.py            # List / upload (dedup) / download / mkdir / rename / move / copy / delete under backend/shared/
```

## Auth model

| Command | `CCONNECT_AUTH_ACTIVE` env | `PUBLIC_ACCESS_TOKEN` | Result |
|---|---|---|---|
| `python run.py` | unset | `None` | Open backend (no auth) |
| `python run.py --expose tailscale` | `1` | from env / `.env` | Bearer required on every `/api/*` except `/api/health` |
| `python run.py --expose caddy` | `1` | from env / `.env` | Same gate; the URL points at the reverse proxy instead of a Funnel |

`core/config.PUBLIC_ACCESS_TOKEN` is gated by `CCONNECT_AUTH_ACTIVE` so that a
token sitting in `.env` from a previous expose run doesn't accidentally lock
down a plain local run. The env var propagates to uvicorn's reload subprocess
on every platform, so the gate is consistent across reload and no-reload.

`PublicAuthMiddleware` enforces the gate; `_ws_bearer_ok()` in `routers/chat.py`
validates the same header on the WebSocket handshake before `accept()`.

## `--expose <provider>`

Steps 1, 2 and 4 are shared by every provider; only step 3 differs.

1. `os.environ["CCONNECT_AUTH_ACTIVE"] = "1"` is set in `run.py` before
   `uvicorn.run()` so the worker import of `core.config` sees it.
2. If `PUBLIC_ACCESS_TOKEN` is unset, a fresh `secrets.token_urlsafe(32)` is
   persisted in `.env` and set in `os.environ`.
3. The provider resolves the public URL (below).
4. The public URL, port, token, and a QR (`{"url":"...","token":"..."}` JSON) are
   printed to the terminal. The mobile app scans this QR to autoconfigure.

Providers fall into two shapes, and `_expose` covers both: one where `run.py`
**creates** the exposure and has to tear it down, and one where the exposure
already exists and `run.py` only advertises it.

### `tailscale`

`tailscale funnel --bg <port>` is started and the URL parsed from its output;
`atexit` calls `tailscale funnel --https=443 off` to clean up. Requires
Tailscale signed in and Funnel allowed for this node in the tailnet ACL.

### `caddy`

For a reverse proxy already terminating TLS in front of the backend — Caddy,
nginx, anything. There is no process to start or stop: the proxy is a service of
its own, so this provider only builds `https://<host>` and turns the Bearer gate
on. The hostname comes from `--public-host`, else `PUBLIC_HOSTNAME` in `.env`,
else `<user>-<dashed public IPv4>.sslip.io` — sslip.io decodes the address from
the name itself, so that default needs no DNS setup.

The default **aborts** when no globally routable IPv4 exists on any interface
(`_public_ipv4` skips loopback, RFC1918 and CGNAT, so Tailscale's `100.x` never
qualifies): behind NAT the name would resolve to an unreachable address and the
QR would fail only once scanned. `_warn_if_unserved` covers the rest of that
class of silent failure, warning when the hostname does not resolve to one of
this machine's addresses or when nothing is listening on `:443`.

Because the proxy outlives the process, `--stop` must not blindly close a Funnel
that was never opened: `--detach` records the provider in `.detached.provider`
and `_stop_detached` reads it back.

## Version contract

`pyproject.toml` declares the three-way compatibility:

```toml
[project]
version = "x.y.z"            # server version
[tool.cconnect]
supported-app = ">=x.y.z"    # minimum mobile app version
supported-cli = ">=x.y.z"    # minimum Claude CLI version
```

`core/config` parses these at import; `/api/health` and `/api/capabilities`
expose `version`, `supported_app`, `cli_version` (from
`cli_manager.active_version()`, cached) and `supported_cli`. The app renders
outdated notices from them. Raise `supported-cli` only after checking the
official CHANGELOG for the feature you depend on.

## HTTP API

Every REST endpoint returns `core.responses.api_response()` —
`{success, status, message, data}`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Liveness + SDK status + version contract. **Open** even with --expose. |
| GET | `/api/capabilities` | Permission modes, effort levels, models, colors, slash commands, defaults + version contract |
| GET / POST | `/api/settings` | Read / update backend-owned config (model, effort, permissions, streaming, CLI, visibility) |
| POST | `/api/settings/reset` | Restore settings to defaults |
| GET / POST | `/api/cli` | Read / set the active Claude CLI (system, bundled, or custom path) |
| POST | `/api/cli/update` | Update the bundled/system CLI (invalidates the version cache) |
| GET | `/api/sessions/{id}/messages?project=<key>&limit=200&before_index=N` | Cursor-based transcript slice. Without `before_index` returns the most recent `limit` items. Each item carries its `index`; clients pass the smallest index they have to pull the slice before it. Response: `{items, total, start_index, has_more}`. While a live session still has events to replay, the tail is cut at its `turn_start_index` (`registry.committed_cut`) so the same turn never arrives twice — once from disk and once from the replay. |
| GET | `/api/sessions/{id}/checkpoints` | Rewind points (one per user prompt on the active branch) |
| POST | `/api/sessions/{id}/rewind/preview` | Dry-run: `{can_rewind, files_changed, insertions, deletions}` |
| POST | `/api/sessions/{id}/rewind` | Execute rewind; `mode ∈ both \| conversation` |
| GET | `/api/sessions/{id}/images/{message_uuid}/{index}` | Binary image extracted from a transcript message (pasted/attached images in history) |
| POST | `/api/sessions/{id}/rename` | Set a custom title |
| POST | `/api/sessions/{id}/auto-rename` | Ask the SDK (haiku) to generate a title |
| POST | `/api/sessions/{id}/color` | Set the session color |
| POST | `/api/sessions/{id}/move` | Move the session to the project that owns `cwd` (`{project, cwd}`): rewrites only the `cwd` of each transcript entry, moves the sibling `<sessionId>/` directory, and resyncs `chat_list`. 409 while a turn is running, 400 when the target already holds that session id |
| DELETE | `/api/sessions/{id}?project=<key>` | Delete a session |
| WS | `/api/shared/ws` | Live folder listing for the file explorer (`services/shared_watch.py`): client sends `{type:"watch", path}`; server replies `{type:"snapshot", path, entries}` on connect and re-pushes it as that folder changes (watchdog watcher on `backend/shared/`, polling fallback). Replaces the removed `GET /api/shared`. Bearer via `ws_bearer_ok`. |
| GET | `/api/shared/{path:path}` | Download a file |
| PUT | `/api/shared/{path:path}` | Upload (streamed body). Name collisions dedupe with ` (n)`; returns the final saved relpath |
| POST | `/api/shared/folder` | Create a folder |
| POST | `/api/shared/rename` | Rename an entry (extension preserved by the app) |
| POST | `/api/shared/move` / `/api/shared/copy` | Move/copy entries to a destination folder |
| POST | `/api/shared/paths` | Resolve relpaths to absolute PC paths (for "copy path") |
| DELETE | `/api/shared/{path:path}` | Delete an entry |
| GET / PUT | `/api/claude/prompt` | Read / save `prompts/USER.md` (never deleted — emptied) |
| GET | `/api/claude/plugins` | Installed plugins (+description from catalog) + marketplaces |
| POST | `/api/claude/plugins/action` | `{action, plugin}` — install/uninstall/enable/disable/update |
| POST | `/api/claude/marketplaces/action` | `{action, target}` — add/remove/update |
| GET | `/api/claude/marketplaces/{name}/catalog` | Full catalog with `installed` flags |
| GET | `/api/claude/skills` | Skills across installed plugins (id, plugin, plugin_name, description) |
| GET | `/api/claude/skills/file?skill=&plugin=` | The SKILL.md (text/markdown) |
| GET / POST / DELETE | `/api/claude/mcp` | List / add (stdio, http, sse) / remove MCP servers |
| GET | `/api/claude/memories?project=` | Memories: global + per-project (description from frontmatter) |
| GET | `/api/claude/memories/file?scope=&name=&project=` | A memory file (text/markdown) |
| DELETE | `/api/claude/memories` | Delete a memory (also prunes its MEMORY.md index line) |
| GET | `/api/claude/usage?account=<id>` | Plan usage for an account (defaults to the configured one) |
| GET / POST | `/api/accounts` | List accounts (+ the default) / create one (links shared dirs, copies MCP servers) |
| PUT / DELETE | `/api/accounts/{id}` | Rename / delete an account (links are detached, the shared history is never touched) |
| POST | `/api/accounts/{id}/mcp-sync` | Copy the primary account's MCP servers into this one |
| POST | `/api/accounts/{id}/login` | Start the OAuth flow; returns the authorization URL |
| POST | `/api/accounts/{id}/login/code` | Submit the code pasted by the user |
| DELETE | `/api/accounts/{id}/login` | Cancel a login in progress |
| GET | `/api/network` | Supported flag, connectivity, Wi-Fi radio/SSID, interfaces |
| GET | `/api/network/wifi` | Networks in range (ssid, signal, security, active, known) |
| POST | `/api/network/wifi/connect` | Join a network — guarded, returns a job |
| POST | `/api/network/wifi/radio` | Turn the Wi-Fi radio on/off — guarded |
| POST | `/api/network/interface` | Bring an interface up/down (Linux) — guarded |
| POST | `/api/network/auth` | Cache the sudo password for privileged network actions (Linux) |
| GET | `/api/network/job/{id}` | Outcome of a guarded action (`ok`, `rolled_back`, `failed`, `blocked`) |
| WS | `/api/network/speedtest/ws` | Speed test progress + result |
| GET | `/api/claude/usage` | Structured plan usage: `plan` ("Max (20x)", from the CLI credentials' subscriptionType + rateLimitTier) + `windows` (id/percent/resets_at per limit window) |
| GET | `/api/claude/status` | Claude service status from status.claude.com (Statuspage `summary.json`): `indicator` + `components` + active `incidents`; cached 60s |
| GET | `/api/system` | Resource snapshot: hostname, os, os_id, arch, cpu_name, uptime, cpu (percent/cores), memory, gpu (NVML; null without NVIDIA), disks |
| GET | `/api/system/logs?after=&limit=` | Server log entries past byte offset `after` (0 = tail window); returns `{items, offset}` |
| POST | `/api/system/restart` | Replies, then exits with the restart code + flag file; run.py's supervisor relaunches the server |
| WS | `/api/system/ws` | Live monitor stream (what the app uses): pushes `{type:"system",...}` every 2s and `{type:"logs",items}` as entries land (server-side 0.5s file tail). Bearer checked on handshake via `middleware.public_auth.ws_bearer_ok` (shared with chat). |
| WS | `/api/list/ws` | Live chat/project list (`services/chat_list.py`): sends `{type:"snapshot", projects, sessions}` on connect, then per-item deltas (`session_changed`/`session_removed`/`project_changed`/`project_removed`) as the projects dir changes — including external CLI edits. A `watchdog` watcher (polling fallback) debounces, re-scans (reusing cached metadata for unchanged files) and diffs against an in-memory snapshot, so the app loads the list once and stays fresh without re-fetching. Bearer checked via `ws_bearer_ok`. |

## WebSocket protocol (`/api/chat/ws`)

Client → server (JSON):

- `{"type":"start","cwd":"...","permission_mode":"...","resume":"...","fork":false,"model":"...","effort":"...","partial":false,"base_url":"...","channel":"...","last_seq":N}` — `channel` is optional: when it matches a still-live session the server re-attaches to it (keeping the running turn) instead of starting fresh. `last_seq` (default 0) is the highest event `seq` the client has rendered; on re-attach the server replays buffered events with a greater `seq`. Side-chat re-attach uses the parallel `side_channel` / `side_resume` / `side_last_seq` fields.
- `{"type":"prompt","text":"...","attachments":["uploads/a.png", ...]}` — `attachments` are relpaths under `shared/` previously uploaded via `PUT /api/shared/...`; the server composes them into the prompt (see Attachments below). A prompt sent while a turn is running is **enqueued** rather than rejected and injected when reached (see **Message queue**).
- `{"type":"set_permission_mode","mode":"..."}`
- `{"type":"interrupt"}` — optional `"lane":"side"` interrupts the quick chat instead of the main turn.
- `{"type":"interaction_response","id":"...","option_id":"...","free_text":"...","values":{...},"chat":false}` — `option_id`/`free_text` answer a permission, `values` answers a component (id → string / bool / array), `chat` dismisses it.
- `{"type":"load_history","session_id":"...","project":"...","before_index":N,"limit":100}` — pull the slice immediately before `before_index`. Used after the initial HTTP fetch when the user scrolls towards the top.
- `{"type":"ask","text":"...","resume":"..."}` — quick-chat side question. Runs as a concurrent, isolated subquery (own workspace + model) and never touches the main turn.
- `{"type":"usage"}` — request the ephemeral plan-usage report (`services/usage`); not part of any session.

Server → client (JSON):

Every streamed turn event below carries a monotonic **`seq`** (per session). The
client tracks the highest `seq` it has rendered and sends it as `last_seq` on
re-attach; the server replays only events past it (buffered in-memory, last
`OUTBOX_MAX` events — a very long gap falls back to `load_history` on disk).
Control/ephemeral messages (`ready`, `permission_mode`, `history_chunk`,
`usage`, `ask_*`) are not part of the seq'd stream.

- **`activity`** (`state ∈ working | slow | compacting | waiting | failed | idle`)
  — what this chat is doing, pushed by `LiveSession` on every transition and
  derived in `_track` from the events it emits (`compacting`/`compact`,
  `status`). It rides the **channel**, not the session id, so a brand-new chat
  reports state before its session exists on disk; the same value also goes to
  `chat_list` for the sidebar (dropped there while there is no id, re-published
  as soon as `session_started`/`result` provides one). Out of the seq'd stream:
  it is state, not transcript, and `ready` carries the current value.
  `failed` outlives the turn — it says the last one ended on a transient API
  failure — and is cleared by the next `start`.
- `ready` (session_id, project, **`channel`** — the live-session handle the
  client stores and sends back in `start` to re-attach; **`running`** — whether a
  turn is in progress, so a reconnecting client knows to show the spinner vs the
  input; **`activity`** — the state above). Sent before the replay. On re-attach, any still-pending
  `interaction_request` is re-emitted so it can be answered over the new socket,
  and current task state is re-emitted so indicators restore.
- `assistant_text`, `thinking`, `todos`, `task`
- `tool_use` (id, name, input as `"key: value"` per line; carries `result` when tool visibility is `full`)
- `tool_result` (tool_use_id, content, is_error)
- `ask_text` / `ask_done` — quick-chat answer stream and its end marker.
- `usage` (markdown) — ephemeral plan-usage report; rendered live and never persisted.
- `compacting` — turns on the client's "Compactando" progress bar. Emitted by a
  **PreCompact hook** (carries `trigger: manual|auto`) registered in
  `run_prompt`, so the bar shows during **auto**-compaction too, not only manual
  `/compact`. It's pushed **out-of-band** through the LiveSession's `emit`
  callback (the runner factory now receives `(ask_user, emit)`) because the SDK
  message stream is blocked while it compacts, so a normal `yield` couldn't
  surface it in time.
- `compact` / `compact_summary` — compaction block and its summary, filled in
  live; `compact` (the boundary) also turns the progress bar back off.
- `status` (`kind ∈ retrying | slow | ok | failed`) — transient progress
  indicator for the client's status bar. While the CLI is retrying the API,
  `run_prompt`'s `stderr` callback emits `retrying` (out-of-band via `emit`),
  cleared with `ok` on the next real message; a final transient failure yields
  `failed`. An **idle watchdog** additionally emits `slow` when no SDK message
  has arrived for >15s, surfacing a genuinely slow generation as "taking longer
  than usual" — but it is **suppressed** while the turn is legitimately quiet:
  during compaction (`compacting`), while any tool is in flight (a `pending` set
  of `tool_use` ids, drained on each `tool_result`), and while awaiting the user
  (a permission / `AskUserQuestion` prompt). **Error classification**
  (`_looks_transient`): a failing `ResultMessage` (`is_error` + `api_error_status`
  5xx, or "no response from API" / connection text) or a `ProcessError` →
  `status`; usage-limit (429 / rate-limit), auth, billing, etc. → a normal
  `error` with a clean message (no Python wrapper). The client shows `status`
  as an orange/red bar and `error` as a block with a warning icon.
- `command` (markdown) — output of local slash commands.
- `permission_mode` — ack of `set_permission_mode`.
- **`file_change`** (id, path, diff_lines) — emitted instead of `tool_use` for
  Edit/Write/MultiEdit/NotebookEdit. `diff_lines` is a list of
  `{kind, text}` entries with `kind ∈ header | hunk | add | del | ctx`, already
  classified backend-side so mobile only renders. The matching `tool_result`
  is suppressed.
- `interaction_request` (id, kind, options, free_text, title, tool_name, input,
  tool_use_id; `kind: "component"` carries `blocks` plus `submit` / `submit_key`
  / `title_key` / `dismiss`) — per-tool permission prompts and anything answered
  with a form. The form's `dismiss` (label + icon) is drawn as a wide button
  under the send one; without it the block shows a close icon instead.
  `AskUserQuestion` is translated into component blocks by
  `services/questions.py` (one `page` per question, its `select`, the free-text
  field and its `notes`), so the client keeps a single renderer. Control labels
  travel as keys (`title_key`, `label_key`, `placeholder_key`) for the client to
  translate, never as ready-made text. Paired by id with the client's
  `interaction_response` (`option_id` / `values` / `chat`).
- `attached` — sent once the replay (and the task/todos re-emit) is done, so the
  client knows the reattach is complete and can show the conversation in one go
  instead of watching it rebuild event by event.
- `system`, `result` (carries `session_id`), `done`, `interrupted`, `error`.
- `queued` (id, text) / `dequeued` (id) — message-queue lifecycle: `queued`
  acknowledges a prompt accepted into the queue while a turn was running;
  `dequeued` fires when it is injected into the running turn, so the client
  renders its bubble in place. See **Message queue**.
- `history_chunk` (session_id, start_index, items, has_more) — push response to `load_history`. Each `item` matches the resume transcript shape and carries its `index`. When `has_more=false` the client stops requesting.

`permission_mode` ∈
`default | acceptEdits | plan | dontAsk | bypassPermissions | auto`.

## Chat attachments (`services/attachments.py`)

`compose_prompt(text, relpaths)` turns uploaded shared files into Claude Code's
**native** attachment shapes:

- Every file gets an `@`-mention with its **absolute** path appended to the
  prompt text, so the CLI treats it like a file referenced in the terminal.
- Images (png/jpg/gif/webp/bmp) additionally become real vision input: Pillow
  thumbnails to max 1568px, re-encodes (JPEG q85, PNG when alpha), base64, and
  a `[Image #N]` marker is appended to the text — matching what the CLI
  produces for pasted images. `claude_runtime.run_prompt(images=...)` sends
  `content: [{type:"text"...}, {type:"image",source:{type:"base64",...}}]`
  through the SDK's stream-input mode.

History parity: pasted/attached images in old transcripts are served by
`GET /api/sessions/{id}/images/...` so resumed chats render them too.

## Message queue (`live_sessions` + `claude_runtime`)

A prompt sent while a turn is running is **queued** instead of refused, then fed
into the same turn — matching the CLI's own behaviour.

- **Enqueue.** `LiveSession.enqueue(id, text, attachments)` appends to the
  session queue and echoes `queued` (id, text) to every attached socket. The
  `id` is the client-generated queue id.
- **Drain into the turn.** `run_prompt` runs the SDK in **streaming-input** mode:
  after the first user message it keeps yielding queued items from the session's
  `drain` async iterator, each as another `user` message (with composed
  attachments). It records, in send order, the text it actually sent for the
  initial (`prompt`) and each drained item into `chips` (`{id, sent, drained}`).
- **Render from the transcript (source of truth).** When the CLI consumes a
  message it writes a normal `user` entry to the transcript — the same entries
  `get_session_messages` renders on resume, **joined exactly as the CLI joined
  them** (it batches consecutive messages, even the initial, into one entry split
  by `\n`). `run_prompt._flush_users` tail-reads them (`sessions.tail_user_messages`,
  same 128 KB tail-read as `last_context_tokens`) at every message boundary
  (`content_block_start`, `AssistantMessage`, `result`) and, for each **new**
  entry, **greedily** matches it against the longest run of leading `chips` whose
  `sent` texts joined by `\n` reproduce it — so a joined entry maps to ALL the chips
  it covers, disambiguating a join from a multi-line message without guessing.
  Emits `dequeued` (`ids` = covered chip ids, `text` = the entry verbatim,
  `consumed` = how many were drained). The initial is **not** special-cased — it's
  the first `chip` and renders from the transcript like the rest, so a joined
  initial shows joined (== resume). `seen_users` is seeded with the pre-turn
  history (via `resume`) so only this turn renders.
- **Consume / close.** Each `drain` increments `_unconsumed`; each `dequeued`
  decrements it by `consumed`. The turn is held open (the `_keep_stream_open`
  PreToolUse hook) until the queue is drained, `_unconsumed` hits 0, and the final
  `result` lands. `chips` is consumed front-to-back (≥1 per entry) and each chip is
  taken exactly once, so `sum(consumed) == #drained` → `_unconsumed` always reaches
  0 (no working-infinite, even if a greedy match falls back). A turn that ends with
  items still queued carries them over to the next `start`.
- **Resume position.** `get_session_messages` renders each `user` entry as one
  bubble at its tree position. A client resuming **mid-turn** drops the in-progress
  turn (messages at `sourceIndex >= committed_count`, sent in `ready`) and lets the
  live replay re-add it, so neither side duplicates the turn.
- **Client.** `ChatViewModel` renders each `dequeued` as one user bubble from the
  event's `text` and removes every chip in `ids`. `commit_user` only marks the seed
  consumed (no render). Chip ids are per-instance unique (`q<tag>-N`) so a fresh
  ViewModel never collides with a reattached `LiveSession`'s ids. See `client/CLAUDE.md`.

## Rewind (`services/rewind.py`)

- `checkpoints` lists one rewind point per user prompt on the active branch.
- Preview and execute go through SDK control requests (`rewind_files` with
  `dry_run` for preview). `mode="both"` restores files and conversation;
  `"conversation"` only branches the transcript.
- The pending rewind id persists in `rewind_pending.json`; the next
  `run_prompt` resumes the session **at** that message (branching), then clears
  it.

## Claude install manager

Two services with a strict split:

- **`claude_assets.py` — reads.** Parses `~/.claude` directly:
  `plugins/installed_plugins.json` (v2: scope/installPath/version),
  `plugins/known_marketplaces.json` → each marketplace's
  `.claude-plugin/marketplace.json` catalog (descriptions come from here),
  `settings.json → enabledPlugins`, `~/.claude.json → mcpServers`, skills from
  `<installPath>/skills/*/SKILL.md` (frontmatter name/description), memories
  from `~/.claude/CLAUDE.md` (global), `<repo>/CLAUDE.md` and
  `~/.claude/projects/<key>/memory/*.md`. Memory file access is
  whitelist-validated (scope + project-key regex + filename pattern) — never
  raw paths from the client.
- **`claude_manage.py` — mutations.** Shells out to the `claude` CLI
  (`subprocess` with `encoding="utf-8", errors="replace"` — required on
  Windows to avoid cp1252 mojibake). Plugin actions resolve the install
  **scope** and project path from `installed_plugins.json` and pass
  `-s <scope>` + the project cwd (the CLI defaults to user scope and fails on
  project-scoped plugins otherwise). MCP add supports stdio (`-- cmd args`),
  http and sse (`--transport`), at user scope; there is no enable/disable or
  restart for user-scope MCP servers.

## System monitor (`services/system_monitor.py`)

- **Snapshots** via psutil (CPU percent uses `interval=None` — average since
  the previous poll, never blocks) + NVML (`nvidia-ml-py`) for the GPU. NVML
  init failure marks the GPU absent permanently; **read** failures are
  transient (laptop dGPUs power-gate while idle) and fall back to the last
  known identity at 0% so the panel never flickers away. Linux: `squashfs`
  pseudo-disks (snaps) are filtered out.
- **Server logs are a shared JSONL file** (`backend/logs/server.jsonl`,
  gitignored), not process memory — with `--production` multi-workers every
  process appends to the same file, so any worker can serve the full log.
  `run.py` truncates it once per run (master process). A loguru sink writes
  the entries; an `_InterceptHandler` routes stdlib/uvicorn logging through
  loguru, skipping the monitor's own `/api/system` access lines so polling
  doesn't flood the log.
- **Cursor = byte offset.** The endpoint reads from `after` to EOF (capped to
  a 64KB tail window on first call), drops a trailing partial line and returns
  the offset after the last complete one — safe against concurrent writers.
- **Static identity** is computed once (`lru_cache`): `os_id`
  (windows/darwin/`freedesktop_os_release` ID — maps to the app's OS brand
  icons), `arch`, and `cpu_name` (Windows registry / `/proc/cpuinfo` /
  `sysctl`, best-effort).

## Server restart

`run.py` is a **supervisor**: it launches uvicorn as a child process and
relaunches it when the child exits with `RESTART_EXIT_CODE` **or** the
`RESTART_FLAG` file exists (both declared in `core/config`). The flag is polled
**while the child runs**, not only after it exits: under `--reload` the child is
uvicorn's reloader and the worker's exit code never reaches the supervisor, so
waiting for it left Linux/macOS with a dead server. On the flag the whole
process tree is terminated (`_terminate_tree`, psutil) and relaunched, which is
the same path on every platform. Ctrl+C still
tears everything down and the Funnel cleanup stays in the supervisor, which
never dies. `POST /api/system/restart` replies, touches the flag and
`os._exit`s — the app's sockets drop and reconnect on their own. Works the
same on Windows and Linux.

## Settings & visibility

Model, effort, permission mode, streaming, CLI source and per-block visibility
live in a SQLite KV store (`core/settings_defs` declares them; `services/settings_store`
reads/writes). They're **backend-owned** so every client shares one config —
mobile renders the effective values, it doesn't keep its own. `show_thinking`,
`show_tool_use`, `show_file_change` and `show_compact` each take `full | label | off`
and are applied the same way on the live stream (`claude_runtime`) and on resume
(`sessions.get_session_messages`), so a block looks identical either way.

## Custom MCP server (`mcps/`)

`backend/mcps/` is an in-process MCP server exposed to Claude under the name
`cconnect`. Tools auto-register from sibling modules so adding one is a
single-file drop:

- Each `.py` in `backend/mcps/` exposes a module-level `tools = [<fn>, ...]`.
- `mcps/__init__.build_cconnect_server(context)` walks the package and hands the
  collected list to `claude_agent_sdk.create_sdk_mcp_server`.
- `services/claude_runtime.run_prompt` wires it into the SDK via
  `ClaudeAgentOptions(mcp_servers={"cconnect": build_cconnect_server(...)})`.
  It runs per turn, so the server is rebuilt for every prompt.
- Tools surface to Claude as `mcp__cconnect__<tool_name>`.

### Tools that need the running turn

A module can expose `make_tools(context)` instead of `tools`. It is called on
every turn with what that turn passed in, so the handler can be a closure over
turn-scoped things (`request_compact`, `ask_user`, the client's `capabilities`).
Returning `[]` removes the tool from that turn entirely — which is also the
safest gate: a tool the model can't see is a tool it can't call. `mcps/session.py`
(what the user can ask about the running session: `compact`, `usage`) uses both
halves — `compact` only exists when the turn can honour it, and it is absent from
the compaction turn it triggers, so it can't chain.

### Adding a tool

1. Drop `backend/mcps/<your_module>.py`.
2. Decorate the handler with `@tool("name", "description", {"arg": type})`
   from `claude_agent_sdk`. Return
   `{"content": [{"type": "text", "text": "..."}]}` from the handler.
3. Expose `tools = [your_handler]` at module level, or `make_tools(context)`
   when the tool needs the running turn.
4. Restart the backend — it's picked up automatically.
5. Recommended: add a section to `prompts/CCONNECT.md` telling Claude when to
   call it. Without that guidance the SDK often won't reach for it.

### Prompt files (`prompts/`)

`_system_append()` builds the per-turn system-prompt suffix from two files,
read fresh on every turn:

- **`CCONNECT.md`** — the system conventions (file-sharing links, markdown
  images, attachments, progress-check tool). Two placeholders are substituted
  at request time: `{{SHARED_DIR}}` → absolute path of `backend/shared/`, and
  `{{BASE_URL}}` → the request's effective base URL (the phone sends its
  current `base_url` in the WS `start` payload, so substituted shared links
  always work for whichever device issued the prompt).
- **`USER.md`** — the user's own standing instructions, edited from the app
  via `/api/claude/prompt`. Gitignored. The file is **never deleted** — saving
  empty content writes an empty file. It's appended wrapped in a
  user-attribution frame ("the user wrote these instructions themselves...")
  so the model follows it as the user's voice, not as more system conventions.

### Bundled tools

| Tool | Purpose |
|---|---|
| `check_progress` | Summarizes the latest session of another project into Done / Pending / Files touched / Next step. Runs an isolated SDK subquery in `AI_WORKDIR` with `haiku`. |
| `compact` | Asks for compaction; it starts when the turn ends. Absent from the turn it triggers, so it can't chain. |
| `usage` | Plan usage for the turn's account: returns the per-window percentages to the model and pushes the `usage` event so the chat draws the bars. |
| `show_component` | Draws a read-only block in the chat (bars, text, media) through the turn's `emit` and returns at once — nothing to answer, so it never marks the chat as awaiting the user. Same elements as the form, minus the ones that carry a value. |
| `ask_component` | Shows a form in the chat and waits for it. Elements: `text`, `select`, `input`, `toggle`, `notes`, `buttons`, `preview`, `page`; plus `dismiss` for a way out of the form, which replaces the close icon. Gated on the client's `components` capability, and `preview` only mentions rich media when the client also has `media.rich`. |

## Session transcript transformation

`services/sessions.get_session_messages` reads the JSONL transcript and
normalizes blocks so resume == live:

- `text`, `thinking`, `summary` — `.strip()`-ed (the SDK leaves a leading space
  in the first block chunk; live streaming strips the same way inside
  `claude_runtime.run_prompt` using a per-block-index flag).
- User messages carry attachment/image references so the app can rebuild chips
  and fetch images via the transcript-images endpoint.
- `tool_use` — emitted with `text = _format_tool_input(input)` (same `"key: value"`
  format as live). Special handling:
  - `Edit/Write/MultiEdit/NotebookEdit` → `file_change` with `diff_lines`.
    The matching `tool_result` is dropped.
  - `TodoWrite` and any `Task*` tool → dropped entirely (live shows them as
    transient state, no equivalent in history).
  - `AskUserQuestion` → one `interaction` message of kind `component`, built with
    the same `services/questions.py` used live, so resume looks identical. The
    chosen answer comes from parsing the matching tool_result content (Claude
    Code stores it as `"Q"="A", "Q2"="A2"`) back into `values`.
  - `mcp__cconnect__ask_component` → an `interaction` message carrying the tool's
    own `blocks` and the answered `values`.
- `tool_result` — emitted with `_flatten_result_content(...)` (same as live).
- Rewind forks are honored: only the active branch (via parent links) is
  emitted.

## File-edit diff construction (`_build_file_diff`)

`difflib.unified_diff` produces the raw lines and `_classify_diff_lines` maps
each to `{kind, text}` (kinds: `header`, `hunk`, `add`, `del`, `ctx`). The
`+`/`-`/` ` prefix is stripped from `text` because `kind` already encodes it.

| Tool | Input | Lines fed to classifier |
|---|---|---|
| `Edit` | `old_string`, `new_string` | unified_diff(old, new) |
| `MultiEdit` | `edits[]` | concatenated unified_diffs |
| `Write` | `content` | unified_diff("", content) — every line as `add` |
| `NotebookEdit` | `new_source` | unified_diff("", new_source) |

## Configuration

All config lives in environment variables. `core/config.py` auto-loads
`backend/.env` for local dev.

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8723` | Uvicorn bind port |
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Where Claude Code stores sessions |
| `DEFAULT_PERMISSION_MODE` | `default` | Fallback when `start` omits it |
| `DEFAULT_EFFORT` | `max` | Fallback when `start` omits it |
| `DEFAULT_MODEL` | `opus` | Fallback when `start` omits it |
| `AUTO_UPDATE_SDK` | `1` | `pip install -U claude-agent-sdk` on startup |
| `PUBLIC_ACCESS_TOKEN` | — | Bearer token, honored only when `CCONNECT_AUTH_ACTIVE=1` |
| `PUBLIC_HOSTNAME` | — | Hostname the proxy serves, for `--expose caddy`; `--public-host` wins over it |

## Reload

`reload=True` is enabled on Linux/macOS only. On Windows uvicorn's reload
worker breaks the asyncio subprocess that Claude CLI spawns
(`CLIConnectionError`), so reload stays off there.

## Conventions

1. **Routers stay thin** — validate input, call a service, return `api_response()`.
2. **Business logic lives in `services/`.** New integrations get their own module.
3. **Imports at the top of the file.** The only exception is the deferred
   `claude_agent_sdk` import inside `services/claude_runtime.py` (the package is
   installed/upgraded at startup, so it may be absent at module-load time).
4. **No secrets in the repo.** Secrets come from env vars / a gitignored `.env`.
5. **Subprocesses that print text use `encoding="utf-8", errors="replace"`** —
   Windows defaults to cp1252 and mojibakes CLI output otherwise.
