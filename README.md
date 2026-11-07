<p align="center">
  <img src=".github/assets/banner.png" alt="CConnect" width="760">
</p>

Mobile, desktop and web interface for **Claude Code**. Drive Claude Code running
on your PC — sessions, files, projects, file edits, interactive permission
prompts — from an Android app, a desktop app for Windows, Linux and macOS, or
any browser, locally over Tailscale or publicly over a Tailscale Funnel.

<p align="center">
  <a href="https://cconnect.dev">Website</a> ·
  <a href="https://app.cconnect.dev">Web app</a> ·
  <a href="https://github.com/jahirxtrap/cconnect/releases/latest">Download</a> ·
  <a href="https://github.com/jahirxtrap/cconnect/wiki">Wiki</a>
</p>

```
[Android / Desktop / Web client] ──HTTP/WS──> [Backend :8723 on the PC] ──Agent SDK──> [Claude Code]
```

---

## Install

```bash
curl -fsSL https://cconnect.dev/install.sh | sh     # macOS, Linux, WSL
```

```powershell
irm https://cconnect.dev/install.ps1 | iex          # Windows PowerShell
```

It installs [uv](https://docs.astral.sh/uv/) if it is missing and leaves the `cconnect` command on
your PATH. Its data lives in `~/.cconnect/data`; the conversations stay with the Claude CLI, in
`~/.claude`.

Run `cconnect`, open the app and add the server under **Settings → Environments** — on a phone, scan
the QR the server prints. The apps are on the
[latest release](https://github.com/jahirxtrap/cconnect/releases/latest) and the web app is at
[app.cconnect.dev](https://app.cconnect.dev). The installers aren't signed, so the first launch asks
once: **More info** on Windows, **Privacy & Security → Open anyway** on macOS.

<details>
<summary><b>Commands</b></summary>

| Command | What it does |
|---|---|
| `cconnect` | Serve on this machine and its network |
| `cconnect expose tailnet` | Serve over HTTPS to your tailnet only, no token |
| `cconnect expose tailscale` | Publish over the internet through a Tailscale Funnel |
| `cconnect expose caddy --public-host cc.example.com` | Publish behind a proxy you already run |
| `cconnect run --detach`, `cconnect stop` | Leave it serving after the terminal closes |
| `cconnect run --port 9000` | Serve on another port than 8723, also with `expose` |
| `cconnect restart` | Restart the backend that is running |
| `cconnect status` | Version, where the data lives, what is running |
| `cconnect logs`, `cconnect logs -f` | Print the server log, `-f` to keep following it |
| `cconnect doctor` | Check the Claude CLI, the SDK, Node.js, Tailscale and the port |
| `cconnect -v` | Print the version |
| `cconnect update` | Upgrade to the latest release |
| `cconnect migrate <folder>` | Copy a previous data folder into this one |
| `cconnect key` | Print the security key, `--rotate` to replace it |

</details>

## Reaching your PC

- **Local.** `cconnect` serves on port 8723 with no auth. The desktop app or a browser on the PC
  use `http://localhost:8723`; your other devices reach it over Tailscale at the PC's `100.x.x.x`
  address.
- **Tailnet.** `cconnect expose tailnet` serves HTTPS with a real certificate, only to the devices
  on your tailnet, still with no token.
- **Tailscale Funnel.** `cconnect expose tailscale` publishes it on the internet behind a token,
  printed with a QR for the phone to scan.
- **Your own proxy.** `cconnect expose caddy` does the same behind Caddy or any reverse proxy, a
  natural fit for a VPS.

`--detach` keeps it running after the terminal closes, and the desktop app can start and stop it
for you from **Settings → Local server**. The web app only reaches a server over HTTPS, so it pairs
with the tailnet mode or a public one.

---

## Features

### Chat

- **Tabs and panels.** Several chats at once, each with its own project and environment; chats and
  ACP agents open in either panel, and the tabs come back when you reopen the app.
- **Queue.** Send while Claude is still working: messages are held, run in order and survive a reload.
- **Questions as forms.** Claude asks with choices, fields and toggles, and answers with galleries,
  audio, PDFs and live previews.
- **Attachments.** Files and photos land on the PC before the prompt runs, and images reach Claude
  as real vision input.
- **Rewind and fork.** Take a conversation back to any point, with a preview of what changes on
  disk, or copy it into a new chat.
- **Listen and dictate.** Replies read aloud with the system's voices, and the microphone writes as
  you speak.
- **Persistent sessions.** A chat keeps its Claude process between turns, so replies start at once
  and background tasks keep running, each listed in the header with a button to stop it.
- **Your settings, from the app.** Model, effort, permission mode and how much of each turn you see,
  down to a simple mode, with a ring that tracks the context and your plan's limits.

### Files and code

- **Shared files.** A file manager over the server's shared folder: upload with progress, organize,
  and preview images, video, audio, PDF, Markdown, code, HTML and SQLite or DuckDB databases. What
  Claude writes there arrives as a link in the chat.
- **Project files.** Browse the chat's project with git colours and each change painted on its
  lines, then commit, pull and push from the same panel.
- **Databases.** Over fifty engines (SQLite, PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, DuckDB,
  Snowflake, BigQuery, ClickHouse, Databricks and the rest of SQLAlchemy's dialects) plus any
  SQLAlchemy URL, through an SSH tunnel when only another machine reaches them, with each driver
  installed from the app. A connection without a database lists every database on the server and
  loads one only when it is opened, and a database file in the shared folder or a project opens in
  its preview. Tables open in a paged grid with sorting and a WHERE filter, rows are edited in a
  form, a SQL console runs anything else, and all of it exports to CSV or SQL. Claude reads them,
  creates and manages connections, and changes data only with the security key.
- **Notes.** A Markdown editor with formatting, search and syntax highlighting.

### The PC

- **Monitor.** CPU, GPU, memory, disks and the server's logs, live. **Processes** shows what
  CConnect runs and stops any of it; **Network** checks the connection, switches Wi-Fi and runs a
  speed test.
- **Terminal and SSH.** Shells on the server, in tabs that outlive the app, and an SSH client for
  your other machines.
- **Browser.** Pages on this device or on the server, with an ad blocker. Claude can open, read and
  capture pages on the server to check its own work.

### Claude Code

- **The install, managed.** The CLI and its updates, plugins and marketplaces, MCP servers, skills,
  memories and a user prompt of your own.
- **Install from a link.** MCP servers, plugins, agents and packs from a web page, a message or a
  card Claude offers. See [Install links](https://github.com/jahirxtrap/cconnect/wiki/Install-links).
- **Accounts and providers.** Several Claude logins on one server, and providers such as Ollama or
  OmniRoute for other models.
- **ACP agents and delegation.** Copilot, Codex, Gemini and other agents in chats of their own, and
  Claude can hand a task to one of them or to another of your accounts.
- **Mods.** Panes, a band and status lines from Claude Code mods, drawn in CConnect's own style.
- **Plan usage.** Your session and weekly limits, with their reset times.

### Make it yours

- **Themes and packs.** Light and dark themes, terminal colours, fonts, accents and chat
  backgrounds, installed from `.ccpack` packs. See [how to make one](https://github.com/jahirxtrap/cconnect/wiki/Packs).
- **Settings.** Searchable, in ten languages, with copies you can keep in Google Drive, and an
  optional Discord status.

---

## Optional tools

Only the Claude Code CLI is required. Each of these adds something, and the server runs without it.

- **Tailscale** — the tailnet and Funnel modes.
- **Caddy**, or any reverse proxy — the `expose caddy` mode.
- **git** — cloning plugin marketplaces, and the changes and commits in Project files.
- **rar** (RARLAB) — compressing to `.rar` in the file manager. Opening and extracting `.rar`
  needs nothing: the server reads them with the 7-Zip it ships.
- **Node.js** — ACP agents shipped as npm packages.
- **ssh**, the OpenSSH client: the tunnel of a database connection that only another machine can
  reach.

The speed test in Monitor, video thumbnails and `.7z` archives come with the server.

## Configuration

Everything the backend reads comes from environment variables, taken from the process or from
`~/.cconnect/data/config/.env`. None of them is required for a plain local run.

<details>
<summary><b>Environment variables</b></summary>

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8723` | Port the backend binds to |
| `CCONNECT_DATA_DIR` | `~/.cconnect/data` | Everything the backend owns on disk and would carry to another machine — settings, accounts, your prompts, logs, the shared folder and the trash. Point it at another drive and the whole tree moves with it |
| `CCONNECT_CACHE_DIR` | `~/.cconnect/cache` | What it can rebuild on its own, beside the data folder rather than inside it, so a migration never drags it along |
| `CCONNECT_SHARED_DIR` | `<data>/shared` | The drop folder on its own. Point two backends at the same one and both serve the same files |
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Where Claude Code keeps its sessions |
| `DEFAULT_CWD` | your home folder | Directory a chat starts in when neither the app nor the connection picks one |
| `AI_WORKDIR` | `<data>/state/internal_task` | Throwaway cwd for the internal helper actions (titles, quick questions), kept out of your history |
| `DEFAULT_MODEL` | `opus` | Model used when the app doesn't override it |
| `DEFAULT_EFFORT` | `max` | Same, for the effort level |
| `DEFAULT_PERMISSION_MODE` | `default` | Same, for the permission mode |
| `PUBLIC_ACCESS_TOKEN` | — | Bearer token for `expose`; generated and saved on first use. Only honoured while an expose mode is active, so a leftover token never locks down a local run |
| `PUBLIC_HOSTNAME` | — | Hostname your proxy serves, for `expose caddy`. `--public-host` on the command line wins over it |
| `PUBLIC_URL` | — | Public address the backend reports in `/api/health`. Set by `cconnect` when it exposes the server, so you rarely write it yourself |
| `SECURITY_KEY` | — | Unlocks the terminal, the files git ignores, committing from the project panel, deleting a pack from the server, an ACP agent's environment variables, saving database connections, editing their rows or running SQL that writes, and Claude reading or editing the server's own `.env`. Generated and saved on first start, then printed on every start; `cconnect key --rotate` replaces it. It is the only gate |
| `BROWSER_EXECUTABLE` | autodetected | Chromium the browser pane drives. Falls back to Chrome, Chromium or Edge, whichever is installed |
| `BROWSER_DEBUG_PORT` | `9333` | Remote debugging port it is launched with |
| `BROWSER_HEADLESS` | `1` | Runs it without a window; set `0` to watch the real browser on the server |
| `BROWSER_QUALITY` | `70` | JPEG quality of the streamed frames. Lower it on a slow link — the pane stays sharp because the resolution does not change |
| `BROWSER_PROFILE_DIR` | `<cache>/browser` | Its own profile, so it never touches the one you browse with |

</details>

## License

MIT — see [LICENSE](LICENSE).
