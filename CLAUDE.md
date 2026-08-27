# CConnect

Mobile, desktop and web interface for Claude Code. The apps drive Claude Code running
on the user's PC — chats in tabs, projects and sessions, file edits, permission prompts
and forms, rich blocks, plan proposals, subagents, attachments, a message queue and
rewind — over HTTP/WS, reachable on the tailnet or publicly through a Tailscale Funnel.
They also manage the Claude install itself (CLI, plugins, marketplaces, MCP servers,
skills, memories), a file manager over the shared folder, a PC monitor, an SSH client
and a markdown scratchpad.

**Monorepo with three modules that must stay in sync:**

- **`backend/`** — FastAPI (Python 3.11+) bridging the apps and Claude Code through the
  Agent SDK. THE source of truth for events, schemas and settings. See `backend/CLAUDE.md`.
- **`client/`** — Compose Multiplatform: one codebase → desktop, web (wasm) and Android.
  See `client/CLAUDE.md`.
- **`tauri/`** — Svelte + Tauri, a second app line covering the same platforms and the
  same contract, published from the same release.

## Architecture

```
[client | tauri] ──HTTP/WS──> [backend :8723] ──claude-agent-sdk──> [Claude Code CLI]
                                    │
                                    ├──> ~/.claude/projects   (sessions on disk)
                                    ├──> ~/.claude            (plugins, MCP, skills, memories)
                                    └──> backend/shared/      (file manager + uploads)
```

Two transport modes: **local** (both devices on the tailnet, plain HTTP, no auth) and
**public** (`python run.py --expose tailscale|caddy`, HTTPS + `Authorization: Bearer`).
Claude auth is the CLI's own OAuth subscription, never an API key.

## Version contract

`backend/pyproject.toml` declares `version`, `supported-app` and `supported-cli`; the
apps carry `SUPPORTED_SERVER`. `/api/health` and `/api/capabilities` expose all of them
and the apps render AppOutdated / ServerOutdated / CliOutdated notices.

A release is one commit named `v<x.y.z>` that replaces `CHANGELOG.md` and bumps nine
files: `backend/pyproject.toml` (`version`, `supported-app`, and `supported-cli` when the
CLI floor moves), `client/androidApp/build.gradle.kts` (`appVersionName` +
`appVersionCode`), `client/app/build.gradle.kts` (`appVersionName`,
`supportedServerRange`), `tauri/package.json`, `tauri/src-tauri/Cargo.toml` and its
`Cargo.lock` entry, `tauri/src-tauri/tauri.conf.json` (`version` **and**
`bundle.android.versionCode`) and `tauri/vite.config.ts` (`SUPPORTED_SERVER`). Tags are
lightweight and unprefixed (`1.6.1`). An Android build of tauri rewrites the Cargo files
from `tauri.conf.json` on its own.

`CHANGELOG.md` is replaced whole: no headers, versions or dates, one bullet per
user-visible change written as what the user sees, minor work collapsed into the closing
bullets, and the `> [!NOTE]` block with both web links at the end.

## Development

```bash
cd backend && python run.py                     # local (no reload on Windows: restart by hand)
cd client  && ./gradlew :app:compileKotlinDesktop :app:compileKotlinWasmJs :app:compileDebugKotlinAndroid
cd client  && ./gradlew :app:run                # desktop
cd tauri   && npm run check                     # svelte-check
cd tauri   && npm run dev
```

## Key rules

1. **client and tauri stay 1:1.** Every UI change lands in both, with the same wording,
   spacing and gestures. A divergence is a bug.
2. **Backend is the source of truth.** Mirror its event shapes and field names verbatim;
   a contract change updates both clients in the same commit.
3. **No comments** in any module. Self-explanatory names; a one-line descriptive docstring
   only when a constraint cannot be expressed in code. Rationale goes in the answer or the
   commit, never in the source. The exception is documentation as **data**: i18n files and
   database `COMMENT`s, where it is mandatory.
4. **English** for code, docstrings and docs; user-facing strings live in the i18n files.
5. **No secrets in the repo** — `.env`, `key.properties`, `keystore.jks` and
   `backend/prompts/USER.md` are gitignored.
6. **Read before acting** — check the existing conventions and helpers before adding new ones.
