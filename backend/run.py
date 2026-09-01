"""Uvicorn server launcher. Use --production for no-reload multi-worker mode."""

import argparse
import atexit
import getpass
import io
import ipaddress
import json
import os
import re
import secrets
import socket
import subprocess
import sys
from contextlib import suppress
from pathlib import Path
from urllib.parse import urlparse

import psutil
import qrcode

from core.config import PORT, RESTART_EXIT_CODE, RESTART_FLAG
from services import system_monitor

_BASE_DIR = Path(__file__).resolve().parent
_ENV_PATH = _BASE_DIR / ".env"
_PID_PATH = _BASE_DIR / ".detached.pid"
_PROVIDER_PATH = _BASE_DIR / ".detached.provider"
_DETACHED_LOG = _BASE_DIR / "logs" / "detached.log"
_TOKEN_VAR = "PUBLIC_ACCESS_TOKEN"
_TERMINAL_KEY_VAR = "TERMINAL_ACCESS_KEY"
_HOSTNAME_VAR = "PUBLIC_HOSTNAME"
_PROVIDERS = ("tailscale", "caddy")


def _abort(msg: str) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    sys.exit(1)


def _persist_in_env(var: str, value: str) -> None:
    if not _ENV_PATH.exists():
        _ENV_PATH.write_text(f"{var}={value}\n", encoding="utf-8")
        return

    lines = _ENV_PATH.read_text(encoding="utf-8").splitlines()
    pattern = re.compile(rf"^\s*{re.escape(var)}\s*=\s*(.*)$")
    for i, line in enumerate(lines):
        if pattern.match(line):
            lines[i] = f"{var}={value}"
            _ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return

    if lines and lines[-1] != "":
        lines.append("")
    lines.append(f"{var}={value}")
    _ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _ensure_public_token() -> bool:
    """Make sure a Bearer token exists for public exposure. Returns True if just generated."""
    # Env var (not module mutation) so uvicorn's reload subprocess inherits the state.
    os.environ["CCONNECT_AUTH_ACTIVE"] = "1"
    if os.environ.get(_TOKEN_VAR):
        return False

    token = secrets.token_urlsafe(32)
    _persist_in_env(_TOKEN_VAR, token)
    os.environ[_TOKEN_VAR] = token
    return True


def _ensure_terminal_key(rotate: bool = False) -> bool:
    """Make sure the key that unlocks the terminal exists. Returns True if just generated."""
    if os.environ.get(_TERMINAL_KEY_VAR) and not rotate:
        return False
    key = secrets.token_urlsafe(32)
    _persist_in_env(_TERMINAL_KEY_VAR, key)
    os.environ[_TERMINAL_KEY_VAR] = key
    return True


def _print_rows(rows: list[tuple[str, str]]) -> None:
    width = max(len(label) for label, _ in rows)
    print("\n" + "\n".join(f"  {label.ljust(width)} : {value}" for label, value in rows) + "\n")


def _terminal_key_row(generated: bool) -> tuple[str, str]:
    return ("Terminal key", f"{os.environ[_TERMINAL_KEY_VAR]}{' [Auto]' if generated else ''}")


def _print_terminal_key(generated: bool, qr: bool = False) -> None:
    _print_rows([_terminal_key_row(generated)])
    if qr:
        _print_qr(json.dumps({"terminal_key": os.environ[_TERMINAL_KEY_VAR]}, separators=(",", ":")))


def _start_tailscale_funnel(port: int) -> str:
    """Start Tailscale Funnel in the background and return the public URL."""
    try:
        subprocess.run(["tailscale", "up"], capture_output=True, text=True, timeout=60)
        # Clear serve/funnel state left by a previous run: a stale config silently
        # downgrades the funnel to tailnet-only (tailscale/tailscale#19803).
        subprocess.run(["tailscale", "funnel", "reset"], capture_output=True, timeout=10)
        result = subprocess.run(
            ["tailscale", "funnel", "--bg", str(port)],
            capture_output=True, text=True, check=True, timeout=20,
        )
    except FileNotFoundError:
        _abort("tailscale CLI not found in PATH. Install Tailscale and try again.")
    except subprocess.CalledProcessError as exc:
        _abort(f"tailscale funnel failed:\n{exc.stderr or exc.stdout}")

    output = (result.stdout or "") + (result.stderr or "")
    match = re.search(r"https://[^\s]+\.ts\.net/?", output)
    if not match:
        _abort(f"could not parse public URL from tailscale output:\n{output}")
    return match.group(0).rstrip("/")


def _stop_tailscale_funnel() -> None:
    """Best-effort shutdown of the background funnel on exit."""
    try:
        subprocess.run(
            ["tailscale", "funnel", "reset"],
            capture_output=True, timeout=10,
        )
    except Exception:
        pass


def _local_ipv4() -> list[str]:
    found = []
    for entries in psutil.net_if_addrs().values():
        for entry in entries:
            if entry.family != socket.AF_INET:
                continue
            with suppress(ValueError):
                found.append(str(ipaddress.ip_address(entry.address)))
    return found


def _public_ipv4() -> str | None:
    """First globally routable IPv4, read from the interfaces so it works offline."""
    return next((ip for ip in _local_ipv4() if ipaddress.ip_address(ip).is_global), None)


def _dns_label(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")[:24]


def _default_public_host() -> str:
    """Zero-setup hostname: sslip.io decodes the address out of the name itself."""
    address = _public_ipv4()
    if not address:
        _abort(
            "--expose caddy could not derive a hostname: this machine has no globally routable "
            "IPv4, so the sslip.io default would resolve to an address nobody can reach.\n"
            f"Pass --public-host <name> or set {_HOSTNAME_VAR} in .env."
        )
    user = _dns_label(getpass.getuser())
    if not user:
        _abort("--expose caddy could not build a DNS label from the user name. Pass --public-host.")
    return f"{user}-{address.replace('.', '-')}.sslip.io"


def _warn_if_unserved(host: str, port: int) -> None:
    """The proxy is configured outside this repo, so a bad hostname fails only once scanned."""
    try:
        resolved = {info[4][0] for info in socket.getaddrinfo(host, None, socket.AF_INET)}
    except OSError:
        print(f"  ! {host} does not resolve yet — the QR will fail until its DNS record exists")
        return
    if not resolved & set(_local_ipv4()):
        print(f"  ! {host} resolves to {', '.join(sorted(resolved))}, none of them this machine")
    with socket.socket() as probe:
        probe.settimeout(1.5)
        if probe.connect_ex(("127.0.0.1", 443)) != 0:
            print(f"  ! nothing is listening on :443 — start the proxy that forwards to :{port}")


def _caddy_url(public_host: str, port: int) -> str:
    host = (public_host or os.environ.get(_HOSTNAME_VAR, "")).strip().rstrip("/")
    if "://" in host:
        host = urlparse(host).netloc
    host = host or _default_public_host()
    _warn_if_unserved(host, port)
    return f"https://{host}"


def _print_qr(payload: str) -> None:
    sys.stdout.flush()
    qr = qrcode.QRCode(border=1)
    qr.add_data(payload)
    qr.make(fit=True)
    buf = io.StringIO()
    qr.print_ascii(out=buf, invert=True)
    sys.stdout.buffer.write(buf.getvalue().encode("utf-8"))
    sys.stdout.buffer.flush()


def _expose(
    provider: str,
    port: int,
    public_host: str = "",
    keep_running: bool = False,
    key_generated: bool = False,
) -> None:
    generated = _ensure_public_token()
    if provider == "tailscale":
        public_url = _start_tailscale_funnel(port)
        if not keep_running:
            atexit.register(_stop_tailscale_funnel)
    elif provider == "caddy":
        public_url = _caddy_url(public_host, port)
    else:
        _abort(f"unknown --expose provider: {provider}")
        return  # unreachable, satisfies static checkers
    token = os.environ[_TOKEN_VAR]
    parsed = urlparse(public_url)
    pub_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    _print_rows([
        ("Public URL", public_url),
        ("Provider", provider),
        ("Port", str(pub_port)),
        ("Token", f"{token}{' [Auto]' if generated else ''}"),
        _terminal_key_row(key_generated),
    ])
    _print_qr(json.dumps({"url": public_url, "token": token}, separators=(",", ":")))


def _running_pid() -> int | None:
    """PID of a live detached launcher, or None when the recorded one is gone."""
    try:
        pid = int(_PID_PATH.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None
    try:
        process = psutil.Process(pid)
        if Path(__file__).name in " ".join(process.cmdline()):
            return pid
    except (psutil.Error, OSError):
        pass
    _PID_PATH.unlink(missing_ok=True)
    return None


def _detached_provider() -> str:
    """Which provider the detached run exposed with, so --stop only tears down what it started."""
    with suppress(OSError):
        return _PROVIDER_PATH.read_text(encoding="utf-8").strip()
    return ""


def _spawn_detached(child_args: list[str]) -> int:
    _DETACHED_LOG.parent.mkdir(parents=True, exist_ok=True)
    handle = _DETACHED_LOG.open("ab")
    kwargs: dict = {
        "stdin": subprocess.DEVNULL,
        "stdout": handle,
        "stderr": handle,
        "cwd": str(_BASE_DIR),
        "env": dict(os.environ),
        "close_fds": True,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), *child_args], **kwargs)
    _PID_PATH.write_text(str(process.pid), encoding="utf-8")
    return process.pid


def _terminate_tree(pid: int) -> None:
    with suppress(psutil.Error):
        parent = psutil.Process(pid)
        targets = parent.children(recursive=True) + [parent]
        for target in targets:
            with suppress(psutil.Error):
                target.terminate()
        _, alive = psutil.wait_procs(targets, timeout=10)
        for target in alive:
            with suppress(psutil.Error):
                target.kill()


def _stop_detached() -> None:
    pid = _running_pid()
    if pid is None:
        print("No detached backend is running.")
    else:
        try:
            parent = psutil.Process(pid)
            targets = parent.children(recursive=True) + [parent]
            for target in targets:
                with suppress(psutil.Error):
                    target.terminate()
            _, alive = psutil.wait_procs(targets, timeout=10)
            for target in alive:
                with suppress(psutil.Error):
                    target.kill()
            print(f"Stopped detached backend (pid {pid}).")
        except (psutil.Error, OSError) as exc:
            _abort(f"could not stop pid {pid}: {exc}")
    _PID_PATH.unlink(missing_ok=True)
    if _detached_provider() == "tailscale":
        _stop_tailscale_funnel()
    _PROVIDER_PATH.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="CConnect backend launcher.")
    parser.add_argument("--production", action="store_true",
                        help="No reload, multi-worker (Linux/macOS only).")
    parser.add_argument("--expose", choices=list(_PROVIDERS), default=None,
                        help="Expose the backend to the public internet via the given provider.")
    parser.add_argument("--public-host", default="",
                        help="Hostname the reverse proxy serves (--expose caddy). Falls back to "
                             f"{_HOSTNAME_VAR}, then to <user>-<ip>.sslip.io.")
    parser.add_argument("--detach", action="store_true",
                        help="Run in the background and return; the server outlives the terminal.")
    parser.add_argument("--stop", action="store_true",
                        help="Stop a backend previously started with --detach.")
    parser.add_argument("--terminal-key", action="store_true",
                        help="Print the key that unlocks the terminal, generating it the first time.")
    parser.add_argument("--rotate", action="store_true",
                        help="With --terminal-key, replace the existing key instead of printing it.")
    args = parser.parse_args()

    is_windows = sys.platform == "win32"

    if args.terminal_key:
        _print_terminal_key(_ensure_terminal_key(args.rotate), qr=True)
        if args.rotate:
            print("  Every device has to enter it again, and a running backend needs a restart.\n")
        return

    if args.stop:
        _stop_detached()
        return

    if args.detach:
        running = _running_pid()
        if running is not None:
            _abort(f"a detached backend is already running (pid {running}). Use --stop first.")
        system_monitor.reset_log_file()
        key_generated = _ensure_terminal_key()
        if args.expose:
            _expose(args.expose, PORT, args.public_host, keep_running=True, key_generated=key_generated)
            _PROVIDER_PATH.write_text(args.expose, encoding="utf-8")
        else:
            _print_terminal_key(key_generated)
        child_args = ["--production"] if args.production else []
        pid = _spawn_detached(child_args)
        print(
            f"  Detached   : pid {pid}"
            f"\n  Log        : {_DETACHED_LOG}"
            f"\n  Stop with  : {Path(sys.executable).name} run.py --stop\n"
        )
        return

    system_monitor.reset_log_file()
    key_generated = _ensure_terminal_key()
    if args.expose:
        _expose(args.expose, PORT, args.public_host, key_generated=key_generated)
    else:
        _print_terminal_key(key_generated)

    # Disabled on Windows: uvicorn's reload worker breaks the Claude CLI's asyncio subprocess.
    reload = not args.production and not is_windows
    workers = int(os.environ.get("WEB_CONCURRENCY", "2")) if (args.production and not is_windows) else 1

    cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(PORT)]
    if reload:
        cmd.append("--reload")
    elif workers > 1:
        cmd += ["--workers", str(workers)]

    RESTART_FLAG.unlink(missing_ok=True)
    while True:
        process = subprocess.Popen(cmd, cwd=Path(__file__).resolve().parent)
        asked = False
        try:
            while True:
                try:
                    process.wait(timeout=0.5)
                    break
                except subprocess.TimeoutExpired:
                    if RESTART_FLAG.exists():
                        asked = True
                        _terminate_tree(process.pid)
                        process.wait()
                        break
        except KeyboardInterrupt:
            _terminate_tree(process.pid)
            break
        if asked or RESTART_FLAG.exists():
            RESTART_FLAG.unlink(missing_ok=True)
            continue
        if process.returncode != RESTART_EXIT_CODE:
            break


if __name__ == "__main__":
    main()
