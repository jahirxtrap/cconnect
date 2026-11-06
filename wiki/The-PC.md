## Watch the PC

The **Monitor** screen shows what the machine is doing while Claude works:
CPU, GPU and memory as live graphs (VRAM and temperature included when
there's an NVIDIA card), storage per disk, the server's own logs streaming
in over a dedicated WebSocket, and a device card — OS with its brand icon,
hostname, uptime, CPU/GPU models. If the machine runs on a battery — a laptop,
or a phone hosting the backend — its charge shows there too, with the time left
when the system reports it. Switch between resources, processes, network and
logs, change servers right from the top bar, and **restart the backend
remotely** — one confirmation, the server relaunches itself and the app
reconnects on its own.

### Processes

A **Processes** tab lists what CConnect runs on the machine — the server, each
chat with everything it launched (its Claude process, MCP servers, Bash commands
and quick chat, each with its own memory), the ACP agents, the terminals and the
browser — with their CPU and memory, under a bar of how much of the machine is
CConnect's. With a project locked, it lists that project's. Chats, agents,
terminals and the browser stop from there after a confirmation; a terminal also
asks for the security key.

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

## Browser

The browser panel opens pages in two places, and a button at the start of its
tabs switches between them:

- **This device**: the desktop app and Android browse with the system's own
  engine (WebView2, WebKit or the Android WebView), in a profile of their own
  apart from the app's, so scrolling, video and signing in work as in any
  browser. On the phone, going back steps back through the page first.
- **Server**: a Chrome or Edge already installed on the machine hosting the
  backend, streamed to the panel, so it reaches that machine's `localhost` and
  a page that needs your session there stays logged in. It starts only once you
  open one of its tabs, and it is the only side the web app has.

Both carry tabs with the site's icon, back and forward, a reload and a home
button. Home is a start page of CConnect's with a search box and your
favorites, which you add from ⋮ or from the **+** on that page with the name and
address you choose, and edit or delete from the tile itself.

⋮ beside the address holds the rest: **Viewport** loads the page as a phone or a
tablet (shrunk to fit the panel), or on Android as the mobile or the desktop
site; **Zoom** is remembered per site, with Ctrl + / − / 0 on the desktop; and
from there you pick an element (a chip carrying the page it came from, left out
on touch screens), attach a screenshot of the page to the chat, open it outside
CConnect, copy its link or add it to your favorites. On Android the page takes
your touches where you put them, and pulling down from its top reloads it.

This device's browser has an ad blocker built in and on by default (EasyList,
EasyPrivacy and uBlock Origin's filters, with Annoyances and Cookie notices to
add) that leaves local and tailnet addresses alone; the shield inside the
address bar turns it off for a site, and its tooltip counts what it blocked.
**Clear site data** and **Clear browsing data** under ⋮ ask before deleting
anything. **Browser** in the Client settings picks the lists, sets a proxy (the
system's, none, or one of your own with the addresses that skip it) and clears
the browsing data the same way.

Claude reaches the server side through three tools (open a page, read what is
on it, take a screenshot) so it can check its own work on a site instead of
guessing; the tools appear only while the panel is enabled in Settings → Tools,
and you can take the mouse and the keyboard back at any moment. The panel is
the only way in: there is no browser screen to open on its own.

## Terminal

A terminal opens beside the chat and in its folder, in a panel you can drag as
wide as you need:
shells on the machine running the backend, each in its own tab, and the SSH hosts
you saved. They run on the server rather than in the app, so closing it — or
opening the same backend from your phone — finds them where you left them.

Getting in takes the key the server prints on every start (`SECURITY_KEY`,
replaced with `cconnect key --rotate`). It is the only gate, so
treat it as a password to the machine. The same key decides whether Claude may
open a shell and run a command in it, which you can also turn off from
Settings → Tools, whether the project explorer shows the files git ignores
and lets you commit them, and whether **Packs** can delete a pack from the
server.

## SSH client

The app also bundles a lightweight SSH client. Open Settings → SSH
hosts to save a target — its address, the SSH port (`22` unless the server
listens somewhere else), and the credentials you log in with — then open it
to an embedded terminal. On Linux that's your shell user + password;
on Windows hosts running OpenSSH it's your account password. Password auth
must be enabled on the target. A keepalive keeps the session connected, with
a Wi-Fi lock on mobile when the screen turns off, and Ctrl+V pastes the
clipboard into the terminal.

### Local

Your device and the target on the same network — use the target's LAN IP or
hostname. No extra setup.

### Remote (via Tailscale)

Install Tailscale on both your device and the target machine, sign into the
same account, and use the target's tailnet IP (`100.x.x.x`) shown in the
Tailscale app. The port stays the same (`22`); no port forwarding, no VPN
setup.
