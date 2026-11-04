## Optional tools

Installing the command covers everything the backend imports; the Claude Code
CLI is the only hard requirement on top. A handful of features reach for a
program that isn't a Python package, so they're worth installing if you want the
full set — none of them is needed to start the server, and each one degrades on
its own.

- **Tailscale** — the `expose tailscale` mode and its QR pairing. Without it
  you're limited to local access, unless you front the backend yourself.
- **Caddy** (or nginx, or any reverse proxy) — the `expose caddy` mode. Unlike
  the rest of this list it isn't a binary you install and forget: it's a service
  you configure and leave running, and CConnect never starts or stops it.
- **git** — the Claude screen clones plugin marketplaces with it. The backend
  never calls it directly; the CLI does, which is why it's easy to miss.
- **unrar** and **rar** — reading and writing `.rar` in the file manager, one
  binary each. On Windows, WinRAR provides both and the backend finds them under
  `Program Files` without touching `PATH`; on Debian and Ubuntu they're the
  `unrar` and `rar` packages (`unrar-free` is a limited reimplementation and
  chokes on recent archives); on macOS, Homebrew's `rar` formula covers both.
  Every other format the file manager offers works out of the box.
- **Ookla speedtest** — the speed test in Monitor → Network, which otherwise
  reports the CLI as unavailable.
- **Node.js** — the ACP agents the catalog ships as npm packages. Python ones
  install with **uv** when it is on the `PATH`, which also fetches the Python
  version they ask for, and with pip otherwise; binaries need neither.

## Configuration

Everything the backend reads comes from environment variables, taken from the
process or from `~/.cconnect/data/config/.env`. None of them is required for a
plain local run.

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
| `SECURITY_KEY` | — | Unlocks the terminal, the files git ignores, committing from the project panel, deleting a pack from the server, an ACP agent's environment variables and Claude reading or editing the server's own `.env`. Generated and saved on first start, then printed on every start; `cconnect key --rotate` replaces it. It is the only gate |
| `BROWSER_EXECUTABLE` | autodetected | Chromium the browser pane drives. Falls back to Chrome, Chromium or Edge, whichever is installed |
| `BROWSER_DEBUG_PORT` | `9333` | Remote debugging port it is launched with |
| `BROWSER_HEADLESS` | `1` | Runs it without a window; set `0` to watch the real browser on the server |
| `BROWSER_QUALITY` | `70` | JPEG quality of the streamed frames. Lower it on a slow link — the pane stays sharp because the resolution does not change |
| `BROWSER_PROFILE_DIR` | `<cache>/browser` | Its own profile, so it never touches the one you browse with |
