# CConnect

Mobile, desktop and web interface for Claude Code. The apps drive Claude Code running
on the user's PC — chats in tabs, projects and sessions, file edits, permission prompts
and forms, rich blocks, plan proposals, subagents, attachments, a message queue and
rewind — over HTTP/WS, reachable on the tailnet or publicly through a Tailscale Funnel.
They also manage the Claude install itself (CLI, plugins, marketplaces, MCP servers,
skills, memories), a file manager over the shared folder, a PC monitor, an SSH client
and a markdown scratchpad.

**Monorepo with two modules that must stay in sync:**

- **`backend/`** — FastAPI (Python 3.11+) bridging the app and Claude Code through the
  Agent SDK. THE source of truth for events, schemas and settings. See `backend/CLAUDE.md`.
- **`tauri/`** — Svelte + Tauri: one codebase → desktop, web and Android.
  See `tauri/CLAUDE.md`.

## Architecture

```
[tauri] ──HTTP/WS──> [backend :8723] ──claude-agent-sdk──> [Claude Code CLI]
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
app carries `SUPPORTED_SERVER`. `/api/health` and `/api/capabilities` expose all of them
and the app renders AppOutdated / ServerOutdated / CliOutdated notices.

A release is one commit named `v<x.y.z>` that replaces `CHANGELOG.md` and bumps five
files: `backend/pyproject.toml` (`version`, `supported-app`, and `supported-cli` when the
CLI floor moves), `tauri/package.json`, `tauri/src-tauri/Cargo.toml` and its
`Cargo.lock` entry, `tauri/src-tauri/tauri.conf.json` (`version` **and**
`bundle.android.versionCode`) and `tauri/vite.config.ts` (`SUPPORTED_SERVER`). Tags are
lightweight and unprefixed (`1.6.1`). An Android build of tauri rewrites the Cargo files
from `tauri.conf.json` on its own.

`CHANGELOG.md` is replaced whole: no headers, versions or dates, one bullet per
user-visible change written as what the user sees, minor work collapsed into the closing
bullets, and the `> [!NOTE]` block with the web link at the end.

## Development

```bash
cd backend && python run.py                     # local (no reload on Windows: restart by hand)
cd tauri   && npm run check                     # svelte-check
cd tauri   && npm run dev
```

## Key rules

1. **Backend is the source of truth.** Mirror its event shapes and field names verbatim;
   a contract change updates the app in the same commit.
2. **No comments** in any module. Self-explanatory names; a one-line descriptive docstring
   only when a constraint cannot be expressed in code. Rationale goes in the answer or the
   commit, never in the source. The exception is documentation as **data**: i18n files and
   database `COMMENT`s, where it is mandatory.
3. **English** for code, docstrings and docs; user-facing strings live in the i18n files.
4. **No secrets in the repo** — `.env`, `key.properties`, `keystore.jks` and
   `backend/prompts/USER.md` are gitignored.
5. **Read before acting** — check the existing conventions and helpers before adding new ones.
