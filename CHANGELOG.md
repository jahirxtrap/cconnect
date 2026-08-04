- Expose the backend through a reverse proxy you already run with `--expose caddy`, same token and QR as the funnel but on a hostname you control
- Use your own domain or a free DuckDNS subdomain for it, or leave it empty and let the backend derive one from the machine's public IP
- Pick the new mode and its hostname from the desktop app's local server panel
- The local server panel no longer waits on Tailscale to notice a backend that is already running on the machine

> [!NOTE]
> The web version is available at https://cconnect.pages.dev/
