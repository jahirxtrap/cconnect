# CConnect

## Project Overview

Mobile, desktop and web interface for Claude Code. The apps drive Claude Code
running on the user's PC — sessions, files, projects, file edits, interactive
permission prompts and forms, rich blocks in the replies, plan proposals,
subagent runs, chat attachments, a message queue, rewind, several chats at
once in tabs —
over HTTP/WS, reachable either locally via Tailscale or publicly via Tailscale
Funnel. They also remote-manage
the Claude Code installation itself (CLI version/updates, plugins, marketplaces,
MCP servers, skills, memories, user prompt), ship a full file manager over the
backend's shared folder, and a live PC monitor (CPU/GPU/memory/disks + server
logs).

The desktop and Android apps also bundle a standalone SSH client (saved hosts,
embedded terminal, OS auto-detection); the desktop app can additionally launch
and supervise the backend process itself (the local-server panel in Settings),
and a built-in Markdown scratchpad keeps notes that persist between sessions.
See `client/CLAUDE.md`.

**Monorepo** — backend and client are the active project and MUST stay in sync.
Changes to API contracts, event shapes, or schemas have to be reflected in both.

- **Backend**: FastAPI (Python 3.11+ + Pydantic 2 + Uvicorn) — bridge between the
  apps and Claude Code via the Agent SDK. Runs on the user's PC. Serves all
  clients identically.
- **Client**: Compose Multiplatform (Kotlin) — one codebase building a native
  **desktop** app (Windows/Linux/macOS), a **web** app (WebAssembly, hosted on
  Cloudflare Pages) and a native **Android** app, all over the same WebSocket/REST
  contract.
- **Tauri**: a second app line (Svelte + Tauri) covering the same platforms and
  the same contract, published alongside the client from the same release. Assets
  and its web build are named `cconnect-tauri`.

See `backend/CLAUDE.md` and `client/CLAUDE.md` for module-specific rules.

## Architecture

```
[Android / desktop / web client] ──HTTP/WS──> [Backend :8723] ──claude-agent-sdk──> [Claude Code CLI]
                                │
                                ├──> ~/.claude/projects (sessions on disk)
                                ├──> ~/.claude (plugins, marketplaces, MCP, skills, memories — read + `claude` CLI subprocess for mutations)
                                └──> backend/shared/ (file manager + chat attachment uploads)
```

- Backend port `8723`, runs on the user's PC.
- Two transport modes:
  - **Local**: both devices on the same tailnet; phone hits `http://<tailnet-host>:8723`.
  - **Public**: `python run.py --expose <provider>` publishes it over HTTPS with a
    Bearer token. `tailscale` brings up a Funnel on 443 (`https://<funnel>.ts.net`);
    `caddy` points at a reverse proxy that already fronts the backend.
- Claude auth: the SDK uses the **Claude Code CLI's OAuth subscription** (no API
  key). `core/sdk.ensure_subscription_auth()` drops `ANTHROPIC_API_KEY` so the
  CLI's session wins.

## Version contract

Three-way compatibility, declared in `backend/pyproject.toml`:

- `[project] version` — the server version.
- `[tool.cconnect] supported-app` — minimum client app version the server accepts.
- `[tool.cconnect] supported-cli` — minimum Claude CLI version the backend's
  features are validated against.

`GET /api/health` and `GET /api/capabilities` expose `version`,
`supported_app`, `cli_version`, `supported_cli`. The app compares them against
its own `versionName` / `BuildConfig.SUPPORTED_SERVER` and surfaces
AppOutdated / ServerOutdated / CliOutdated notices. **Bump these together**
when a change requires a newer counterpart.

## Auth model

- Plain `python run.py` → no auth. Open backend on the tailnet.
- `python run.py --expose <tailscale|caddy>` → sets `CCONNECT_AUTH_ACTIVE=1` and a
  `PUBLIC_ACCESS_TOKEN` (auto-generated if absent, persisted in `.env`).
  `core/config` honors the token only when the flag is set, so a leftover
  token in `.env` never accidentally locks down a plain local run.
  `PublicAuthMiddleware` enforces `Authorization: Bearer <token>` for every
  `/api/*` except `/api/health`. The WS handshake checks the same header.

## Development Commands

### Backend
```bash
cd backend && python run.py                    # Local HTTP (no auth)
cd backend && python run.py --expose tailscale # Public HTTPS via Funnel
cd backend && python run.py --expose caddy --public-host cc.example.com  # Public HTTPS via a reverse proxy
cd backend && python run.py --production       # Multi-worker (Linux/macOS)
```

### Client (desktop + web + Android)
```bash
cd client && ./gradlew :app:run                                 # Run desktop
cd client && ./gradlew :app:wasmJsBrowserDevelopmentRun         # Run web
cd client && ./gradlew :app:compileKotlinDesktop :app:compileDebugKotlinAndroid :app:compileKotlinWasmJs  # Compile-check all
cd client && ./gradlew :app:packageDistributionForCurrentOS     # Desktop installers
cd client && ./gradlew :app:wasmJsBrowserDistribution           # Web static bundle (→ Cloudflare Pages)
cd client && ./gradlew :androidApp:assembleRelease              # Android APK (signed if client/key.properties exists)
```
`.github/workflows/android.yml` builds the client's Android APK on push/PR and
uploads it as an artifact (signed when the `KEYSTORE_*` repo secrets are set).

## Key Rules

1. **Monorepo consistency** — backend and client must agree on event types, field
   names, and the QR payload shape (`{url, token}` JSON). The client is the single
   app: desktop, web and Android all build from `commonMain`.
2. **Version contract** — when a feature needs a newer app/server/CLI, update
   `version` / `supported-app` / `supported-cli` in `backend/pyproject.toml`
   and the app's `versionName` / `SUPPORTED_SERVER` accordingly.
3. **No secrets in the repo** — `.env`, `key.properties`, `keystore.jks` are
   all gitignored. `backend/prompts/USER.md` is user-owned and gitignored too.
4. **English only** — code, docstrings and docs in English.
5. **No comments** — in every module (backend, client, tauri). Self-explanatory
   names; a one-line descriptive docstring only when a constraint cannot be
   expressed in code. Rationale belongs in the chat or the commit, never in the
   source. The exceptions are documentation as **data**: i18n label files and the
   `COMMENT` on database tables/columns, where it is mandatory.
6. **Read before acting** — verify before editing; check existing
   conventions/helpers before creating new ones.
