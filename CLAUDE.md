# CConnect

Mobile, desktop and web interface for Claude Code. The apps drive Claude Code running
on the user's PC — chats in tabs, projects and sessions, file edits, permission prompts
and forms, rich blocks, plan proposals, subagents, attachments, a message queue and
rewind — over HTTP/WS, reachable on the tailnet or publicly through a Tailscale Funnel.
They also manage the Claude install itself (CLI, plugins, marketplaces, MCP servers,
skills, memories), a file manager over the shared folder, an explorer of the project
that shows its git diff and commits it, a PC monitor, an SSH client and a notes
scratchpad.

**Monorepo with two modules that must stay in sync:**

- **`backend/`** — FastAPI (Python 3.11+) bridging the app and Claude Code through the
  Agent SDK. THE source of truth for events, schemas and settings. See `backend/CLAUDE.md`.
- **`client/`** — Svelte + Tauri: one codebase → desktop, web and Android.
  See `client/CLAUDE.md`.

## Architecture

```
[tauri] ──HTTP/WS──> [backend :8723] ──claude-agent-sdk──> [Claude Code CLI]
                                    │
                                    ├──> ~/.claude/projects   (sessions on disk)
                                    ├──> ~/.claude            (plugins, MCP, skills, memories)
                                    └──> the data folder      (settings, accounts, shared, trash)
```

The data folder is `backend/data` in a checkout and `~/.cconnect/data` once the package is
installed, with `CCONNECT_DATA_DIR` above both (`core/paths.INSTALLED` picks).

Three transport modes: **local** (both devices on the tailnet, plain HTTP, no auth),
**tailnet** (`cconnect expose tailnet`, HTTPS through `tailscale serve`, still no token
because it never leaves the tailnet) and **public** (`cconnect expose tailscale|caddy`,
HTTPS + `Authorization: Bearer`).
Claude auth is the CLI's own OAuth subscription, never an API key.

The backend ships two ways from one codebase: the `cconnect` command on PyPI, which the
release workflow publishes on every tag, and a git checkout, where `python run.py` is the
same entry point. Both take the same commands; see the README.

## Version contract

`backend/core/release.py` declares `VERSION`, `SUPPORTED_APP` and `SUPPORTED_CLI` — the
wheel reads its version from there too; the app carries `SUPPORTED_SERVER`. `/api/health`
and `/api/capabilities` expose all of them and the app renders AppOutdated /
ServerOutdated / CliOutdated notices.

A release is one commit named `v<x.y.z>` that replaces `CHANGELOG.md` and bumps five
files: `backend/core/release.py` (`VERSION`, and the two floors when they move),
`client/package.json`, `client/src-tauri/Cargo.toml` and its
`Cargo.lock` entry, `client/src-tauri/tauri.conf.json` (`version` **and**
`bundle.android.versionCode`) and `client/vite.config.ts` (`SUPPORTED_SERVER`). Tags are
lightweight and unprefixed (`1.6.1`). An Android build rewrites the Cargo files
from `tauri.conf.json` on its own.

`CHANGELOG.md` is replaced whole: no headers, versions or dates, one bullet per
user-visible change written as what the user sees, minor work collapsed into the closing
bullets, and the `> [!NOTE]` block with the web link at the end.

## Development

```bash
cd backend && python run.py                     # local (no reload on Windows: restart by hand)
cd client  && npm run check                     # svelte-check
cd client  && npm run dev
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
   `backend/data/` (settings, accounts and your own prompts) are gitignored.
5. **Read before acting** — check the existing conventions and helpers before adding new ones.
