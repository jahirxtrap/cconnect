# CConnect

Mobile, desktop and web interface for **Claude Code**. Drive Claude Code running
on your PC — sessions, files, projects, file edits, interactive permission
prompts — from an Android app, a desktop app for Windows, Linux and macOS, or
any browser, locally over Tailscale or publicly over a Tailscale Funnel.

```
[Android / Desktop / Web client] ──HTTP/WS──> [Backend :8723 on the PC] ──Agent SDK──> [Claude Code]
```

## Structure

```
cconnect/
├── backend/   # FastAPI bridge (Python) — see backend/CLAUDE.md
└── client/    # Desktop, web and Android app (Compose Multiplatform) — Windows, Linux, macOS, the browser and Android — see client/CLAUDE.md
```

The desktop and web apps are one Compose Multiplatform codebase: the desktop
build is a native installer per OS, and the web build is the same UI compiled to
WebAssembly and hosted as a static site (see [Web app](#web-app)).

## Run modes

The backend runs in two modes. Both use the same `python run.py` entry.

### Local HTTP (no auth)

```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate
pip install -e .
python run.py
```

- Backend listens on `:8723`, no auth.
- **From the same machine** — the desktop app, or a browser on the PC — use
  `http://localhost:8723`. Nothing else to install.
- **From another device**, both it and the PC need **Tailscale**, signed into the
  same account: connect to the PC's tailnet IP (`100.x.x.x`) shown in the
  Tailscale app, e.g. `http://100.x.x.x:8723`. No funnel needed. Tailscale is how
  your phone reaches the PC here, not something the backend itself requires.

### Public HTTPS (token-gated, exposes the PC over the internet)

```bash
python run.py --expose tailscale
```

What this does:

1. Runs `tailscale up` and `tailscale funnel --bg 8723` to publish the backend
   at `https://<hostname>.<tailnet>.ts.net` (port 443).
2. If `PUBLIC_ACCESS_TOKEN` is unset, generates one and persists it in
   `backend/.env` (reused on subsequent runs).
3. Prints the public URL, the token, and a **scannable QR** encoding
   `{"url":"...","token":"..."}` for the mobile app.
4. Gates every `/api/*` route — except `/api/health` — behind
   `Authorization: Bearer <token>`. The WebSocket handshake checks the same.
5. On `Ctrl+C` (or process exit) runs `tailscale funnel --https=443 off` to
   close the funnel.

**Requirement (PC only):** Tailscale installed, signed in, and **Funnel
enabled for this node** in the tailnet ACL. Your device needs only an internet
connection — no Tailscale required.

### Detached (leave it running over SSH)

```bash
python run.py --detach --expose tailscale
python run.py --stop
```

Meant for a VPS you reach over SSH: `--detach` prints the URL, token and QR as
usual, then hands the terminal back and keeps the server running in its own
process — closing the session (or the terminal) no longer takes it down. Output
goes to `backend/logs/detached.log`, the funnel stays up, and `--stop` shuts
both down. It survives the terminal, not a reboot.

## Run the backend from the desktop app

The desktop app can start the backend for you instead of running `python run.py`
yourself. In Settings → Local server, point it at the backend folder, choose how
to run Python (auto-detect a virtualenv there, the system Python, or a path you
pick) and the mode — Local or a Tailscale Funnel — and it launches the server on
startup, showing its status and, in public mode, the URL and token to connect
with. It only manages a server it started; if one is already running, it steps
aside.

## Connecting

Open Settings → Connections and add the server: on mobile, scan the QR
(top-right of the dialog) to autofill it from `--expose`'s output; on desktop,
paste the address and token by hand. The connection becomes active immediately
and the chat reconnects.

## Web app

The desktop UI also runs in the browser — the same Compose code compiled to
**WebAssembly**, nothing to install. It's a plain static site (HTML + WASM +
assets), so it can be hosted anywhere and opened from any browser.

Because the page is served over HTTPS, the browser only lets it reach a backend
over **HTTPS/WSS** — so the web app pairs with the public mode: run
`python run.py --expose tailscale` and add the server with its
`https://<hostname>.<tailnet>.ts.net` URL and token. (For that reason the
environment form on web offers only HTTPS; the native apps keep plain HTTP for
local backends.) Updating is just a reload.

## In the chat

Claude Code's own slash commands show up in the composer, plus a `/usage` view
of your plan's token limits. A **quick chat** button opens a side panel for a
throwaway question — handy to ask something while a long task keeps running,
without derailing it.

**Queue** keeps your messages flowing: send another while Claude is still
working and it's held, then picked up in order and placed in the conversation
as each one runs — and anything still waiting comes back if you reload or
resume the chat.

**Attachments** travel with your message: tap the clip, pick any files or
photos on your device, and they land on the PC before the prompt runs. Images
reach Claude as real vision input — it sees them, not a path — and other files
arrive as mentions it can open directly.

**Rewind** takes a conversation back to an earlier point. Pick the moment,
preview exactly what would change on disk (`+added −removed • files`), and
choose whether to roll back the conversation alone or code and conversation
together.

Model, effort, permission mode, how much of each turn you see, and which Claude
CLI the backend drives are all set from the app and shared across every client
that connects.

## Tabs

Keep several chats open at once, each in its own tab with its own session,
project and environment — start a long task in one, switch to another, and come
back to find it where you left it. Desktop and web get a tab bar; on mobile a
switcher does the same. Open any chat or session in a new tab, reorder them, and
on desktop reach for the keyboard (Ctrl+T to open, Ctrl+W to close, Ctrl+Tab to
cycle). The tabs you had open come back when you reopen the app, each loading
only once you switch to it.

## Files

The shared folder grew into a full file manager. Browse `backend/shared/` from
the app: upload files (with per-file progress you can cancel), create folders,
rename, sort by name/date/type/size, and long-press (or right-click on desktop)
to multi-select — then move, copy, share, delete, save to Downloads, or copy a
file's PC path. Open a file to preview it in place — images with zoom, SVG,
Markdown, and source code, and HTML in a web view on mobile or your browser on
desktop — and delete it right from the preview if it's no longer needed.

It works in both directions: drop a file into `backend/shared/` on the PC — or
just ask Claude to write one there — and you get a tap-to-download link in the
chat, served over the same authenticated connection.

## Notes

A built-in Markdown editor doubles as a scratchpad: jot things down with a live
preview, then save, export, or share the note as a file. What you type stays
between sessions.

## Manage Claude Code itself

The **Claude** screen is a remote manager for the Claude Code install on the
PC:

- See the active CLI version, switch where it comes from, update it, and read
  the official changelog without leaving the app.
- Browse any **marketplace** catalog and install **plugins** from the app;
  enable, disable, update, or uninstall the ones you have.
- Add or remove **MCP servers** and marketplaces.
- Read the **skills** your plugins provide, and view or delete Claude's
  **memories**, globally or per project.
- Keep your own standing instructions in a **user prompt** editable from the
  app — it rides along every conversation, on top of the system conventions in
  `backend/prompts/CCONNECT.md`.
- See your **plan usage** at a glance — your subscription tier (Pro, Max 5x,
  Max 20x) and a bar per limit window: current session, all models, and the
  per-model weekly caps, each with its reset time.
- Keep several **Claude accounts** on one backend and switch between them.

### Multiple accounts

One backend can hold more than one Claude login. Add an account from the Claude
screen and sign in without leaving the app: it hands you a link — copy it, open
it on whatever device you like, approve the account there and paste the code
back. Nothing is typed on the server, and each account keeps its own
credentials, refreshed by the CLI as usual.

What they share is everything you'd want in common — the same conversation
history, plugins and skills — so switching accounts only changes who pays for
the turn, not what you see. MCP servers are copied over when the account is
created, and can be re-synced later.

Pick the account per chat from the composer bar, or set the server-wide default
from the Claude screen's header (the usage shown there follows it) or in
Settings. Accounts you haven't signed into yet are listed too, so you can
finish later.

## Watch the PC

The **Monitor** screen shows what the machine is doing while Claude works:
CPU, GPU and memory as live graphs (VRAM and temperature included when
there's an NVIDIA card), storage per disk, the server's own logs streaming
in over a dedicated WebSocket, and a device card — OS with its brand icon,
hostname, uptime, CPU/GPU models. Switch between resources, network and logs,
change servers right from the top bar, and **restart the backend remotely** —
one confirmation, the server relaunches itself and the app reconnects on its
own.

### Network

A **Network** tab manages the PC's connection from wherever you are: whether it
really has internet (a captive portal counts as no), live upload/download, every
interface with the one carrying traffic marked, the Wi-Fi networks in range with
their signal, and an on-demand **speed test** through the Ookla CLI when it's
installed.

You can also act on it — join another Wi-Fi network, turn the radio off, and on
Linux bring a wired interface up or down. Since a wrong move over a remote link
would strand you, every change is guarded: an action that would leave the
machine with no way out is refused outright, and anything else is applied, then
verified — if the new network has no internet, the previous one is restored on
its own. A watchdog does the same if the machine ends up offline for any other
reason. The tab only appears on backends that support it (Windows and Linux).

## Built-in features

On top of plain Claude Code, the backend ships a few helpers wired into the
agent so they're available out of the box from the phone:

- **Cross-project progress check.** Ask things like _"how's the README I left
  running in <other-project> going?"_ and Claude summarizes that other
  session's latest activity into Done / Pending / Files touched / Next step,
  without you having to open it.
- **Editable system prompt.** `backend/prompts/CCONNECT.md` is auto-appended to
  every chat — that's where the file-sharing and progress-check conventions
  live. Your personal additions go in `USER.md`, edited straight from the
  Claude screen.

## Staying current

The app and the backend declare which versions of each other — and of the
Claude CLI — they support. When something falls behind, a notice in the chat
takes you straight to the right place: the app's own update (with its
changelog), the server requirement, or the CLI update button. Release notes
for both CConnect and Claude Code are readable in the app.

## SSH client

The app also bundles a lightweight SSH client. Open Settings → SSH
hosts to save a target — its address, the SSH port (`22` unless the server
listens somewhere else), and the credentials you log in with — then open it
to an embedded terminal. On Linux that's your shell user + password;
on Windows hosts running OpenSSH it's your account password. Password auth
must be enabled on the target. A keepalive keeps the session connected, with
a Wi-Fi lock on mobile when the screen turns off.

### Local

Your device and the target on the same network — use the target's LAN IP or
hostname. No extra setup.

### Remote (via Tailscale)

Install Tailscale on both your device and the target machine, sign into the
same account, and use the target's tailnet IP (`100.x.x.x`) shown in the
Tailscale app. The port stays the same (`22`); no port forwarding, no VPN
setup.

## License

MIT — see [LICENSE](LICENSE).
