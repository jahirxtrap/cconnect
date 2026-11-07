## Install

```bash
curl -fsSL https://cconnect.dev/install.sh | sh     # macOS, Linux, WSL
```

```powershell
irm https://cconnect.dev/install.ps1 | iex          # Windows PowerShell
```

It installs [uv](https://docs.astral.sh/uv/) if it is missing and leaves the
`cconnect` command on your PATH, in an environment of its own. Its data —
settings, accounts, the shared folder and the trash — lives in `~/.cconnect/data`;
the conversations stay with the Claude CLI, in `~/.claude`.

The apps for Windows, macOS, Linux and Android are on the
[latest release](https://github.com/jahirxtrap/cconnect/releases/latest). None of the
installers is signed, so the first launch needs one extra step:
macOS says the developer is unidentified and lets you through from **System
Settings → Privacy & Security → Open anyway**, and Windows hides the button
behind **More info** in the SmartScreen notice. Only the first time.

## Commands

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
| `cconnect key` | Print the security key, `--rotate` to replace it |

## Run the backend from the desktop app

The desktop app can start the backend for you. In Settings → Local server it
runs the installed `cconnect` command, found on its own or at a path you give.
Choose the mode — local, tailnet only, a Tailscale Funnel or Caddy — and with
**Start on launch** on it launches the server when the app opens, showing its
status and, in public mode, the URL and token to connect with. Once the server
is up it adds itself to Environments as Local server, with the token and the
security key when the mode needs them, unless an environment already points at
it; a token or key that changed is updated there instead. It only manages a
server it started; if one is already running, it steps aside.

## Connecting

Open Settings → Environments and add the server: on mobile, scan the QR
(top-right of the dialog) to autofill it from `--expose`'s output; on desktop,
paste the address and token by hand, or let the local server add itself. The
connection becomes active immediately and the chat reconnects.

Each environment can carry its own colour, which takes over the whole app while
it's the active one — a glance tells you whether you're driving your laptop or a
VPS. Leave it unset to keep the accent you picked in Settings, or set it to
dynamic so that environment follows the system colour.

Once you settle on one machine and one project, a **lock** pins them. Close the
padlock next to the active environment, or next to its working directory, and
every picker that would switch them goes quiet — the chat, Shared, Monitor and
the Claude screen show the current one as plain text instead of a menu. The
environments list itself stays open, so there's always a way back.

## Web app

The desktop UI also runs in the browser — the same code, nothing to install.
It's a plain static site, so it can be hosted anywhere and opened from any
browser.

Because the page is served over HTTPS, the browser only lets it reach a backend
over **HTTPS/WSS**, so it pairs with either mode that terminates TLS:
`cconnect expose tailnet` for a backend only your tailnet can reach, with no
token to paste, or `cconnect expose tailscale` for the public Funnel, with its
token. (For that reason the environment form on web offers only HTTPS; the
native apps keep plain HTTP for local backends.) Updating is just a reload. It
is hosted at https://app.cconnect.dev/.

It can also be installed, and then it opens in its own window without the
browser bar. **Install app** in Settings → About opens the browser's own
install dialog on Chrome and Edge; on the iPhone there is no such dialog, and no
way to open one, so it shows the two steps instead: the share button in Safari's
own bar, then *Add to Home Screen*. The entry disappears once it is installed.
