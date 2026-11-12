The backend runs local or public, and public has two providers.

## Local HTTP (no auth)

```bash
cconnect
```

- Backend listens on `:8723`, no auth.
- **From the same machine** — the desktop app, or a browser on the PC — use
  `http://localhost:8723`. Nothing else to install.
- **From another device**, both it and the PC need **Tailscale**, signed into the
  same account: connect to the PC's tailnet IP (`100.x.x.x`) shown in the
  Tailscale app, e.g. `http://100.x.x.x:8723`. No funnel needed. Tailscale is how
  your phone reaches the PC here, not something the backend itself requires.

## Tailnet HTTPS (no token, never leaves your tailnet)

```bash
cconnect expose tailnet
```

Runs `tailscale serve --bg 8723`, so the machine answers at
`https://<machine>.<tailnet>.ts.net` with a real certificate — reachable only from
devices signed into your tailnet, never from the internet. No token: the tailnet is
the gate, the same as the local mode. It is what you want when the browser refuses a
plain `http://100.x.x.x` because the page itself came over HTTPS. `Ctrl+C` (or
`cconnect stop`) runs `tailscale serve reset` and the address stops answering.

**Requirement:** Tailscale installed and signed in. HTTPS certificates must be on for
the tailnet, which is the same switch Funnel needs.

## Public HTTPS (token-gated, exposes the PC over the internet)

```bash
cconnect expose tailscale
```

What this does:

1. Runs `tailscale up` and `tailscale funnel --bg 8723` to publish the backend
   at `https://<hostname>.<tailnet>.ts.net` (port 443).
2. If `PUBLIC_ACCESS_TOKEN` is unset, generates one and persists it in
   `~/.cconnect/data/config/.env` (reused on subsequent runs).
3. Prints the public URL, the token, and a **scannable QR** encoding
   `{"url":"...","token":"..."}` for the mobile app.
4. Gates every `/api/*` route — except `/api/health` — behind
   `Authorization: Bearer <token>`. The WebSocket handshake checks the same.
5. On `Ctrl+C` (or process exit) runs `tailscale funnel --https=443 off` to
   close the funnel.

**Requirement (PC only):** Tailscale installed, signed in, and **Funnel
enabled for this node** in the tailnet ACL. Your device needs only an internet
connection — no Tailscale required.

## Public HTTPS behind your own proxy

```bash
cconnect expose caddy --public-host cc.example.com
```

Same result as the funnel — public URL, token, QR — but the HTTPS comes from a
reverse proxy you already run instead of Tailscale. Natural fit for a VPS, which
has a public IP and doesn't need a tunnel to be reachable, and for serving more
than one backend from the same machine: each hostname routes to its own port and
keeps its own token. With Caddy that's the whole config:

```
cc.example.com { reverse_proxy 127.0.0.1:8723 }
```

The certificate is Let's Encrypt's, so any name that resolves to the machine
works — your own domain, a free `duckdns.org` subdomain, or nothing at all:
**omit `--public-host` and the backend derives `<user>-<public-ip>.sslip.io`**,
a name sslip.io resolves straight back to that address with no registration. Set
`PUBLIC_HOSTNAME` in `~/.cconnect/data/config/.env` to avoid repeating the flag.

Nothing is started or stopped here: the proxy is a service of its own, so this
mode only publishes where it answers and turns the token on. That means the
hostname has to be one your proxy actually serves — CConnect warns before
printing the QR when the name doesn't resolve to this machine or when nothing is
listening on 443. On a machine behind NAT the sslip.io default can't work, so it
refuses to guess and asks for a hostname instead.

## Detached (leave it running over SSH)

```bash
cconnect expose tailscale --detach
cconnect stop
```

Meant for a VPS you reach over SSH: `--detach` prints the URL, token and QR as
usual, then hands the terminal back and keeps the server running in its own
process — closing the session (or the terminal) no longer takes it down. Output
goes to `~/.cconnect/data/logs/detached.log`, the funnel stays up, and `cconnect stop`
shuts both down. It survives the terminal, not a reboot.

If a server is already running in another terminal, `--detach` moves it to the
background: it stops that one and starts the detached server in its place, so
the apps reconnect on their own and only a turn in progress is cut. It reports
`Detached` once the new server answers, and the error if it does not. Starting a
second server in the foreground while one is running is refused instead.
