"""The cconnect command: serves the backend, exposes it, and looks after the install."""

import argparse
import atexit
import getpass
import io
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
from contextlib import suppress
from pathlib import Path
from urllib.parse import urlparse

import psutil
import qrcode

from core import data_migration, paths, release
from core.config import PORT, RESTART_EXIT_CODE
from services import repo, system_monitor

_ENV_PATH = paths.ENV_FILE
_TOKEN_VAR = "PUBLIC_ACCESS_TOKEN"
_SECURITY_KEY_VAR = "SECURITY_KEY"
_HOSTNAME_VAR = "PUBLIC_HOSTNAME"
_PROVIDERS = ("tailscale", "tailnet", "caddy")
_PRIVATE_PROVIDERS = ("tailnet",)
_STOP_TIMEOUT = 10
_POLL_SECONDS = 0.5
_MODULE = "core.cli"
_APP = "core.app:app"
_COMMANDS = ("run", "expose", "stop", "status", "update", "migrate", "key")


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
    os.environ["CCONNECT_AUTH_ACTIVE"] = "1"
    if os.environ.get(_TOKEN_VAR):
        return False

    token = secrets.token_urlsafe(32)
    _persist_in_env(_TOKEN_VAR, token)
    os.environ[_TOKEN_VAR] = token
    return True


def _ensure_security_key(rotate: bool = False) -> bool:
    """Make sure the key that unlocks the machine's own surface exists. True if just generated."""
    if os.environ.get(_SECURITY_KEY_VAR) and not rotate:
        return False
    key = secrets.token_urlsafe(32)
    _persist_in_env(_SECURITY_KEY_VAR, key)
    os.environ[_SECURITY_KEY_VAR] = key
    return True


def _print_rows(rows: list[tuple[str, str]]) -> None:
    width = max(len(label) for label, _ in rows)
    print("\n" + "\n".join(f"  {label.ljust(width)} : {value}" for label, value in rows) + "\n")


def _security_key_row(generated: bool) -> tuple[str, str]:
    return ("Security key", f"{os.environ[_SECURITY_KEY_VAR]}{' [Auto]' if generated else ''}")


def _print_security_key(generated: bool, qr: bool = False) -> None:
    _print_rows([_security_key_row(generated)])
    if qr:
        _print_qr(json.dumps({"security_key": os.environ[_SECURITY_KEY_VAR]}, separators=(",", ":")))


def _tailscale_status() -> dict:
    """What `tailscale status` reports, or {} when the CLI is missing or the daemon is down."""
    try:
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True, text=True, timeout=20, encoding="utf-8", errors="replace",
        )
    except (OSError, subprocess.SubprocessError):
        return {}
    if result.returncode != 0:
        return {}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}


def _require_tailscale() -> dict:
    if shutil.which("tailscale") is None:
        _abort("Tailscale is not installed. Get it from https://tailscale.com/download and try again.")
    status = _tailscale_status()
    state = status.get("BackendState") or ""
    if not state:
        _abort("Tailscale is installed but not running. Start the Tailscale app or service and try again.")
    if state in ("NeedsLogin", "NoState"):
        _abort("Tailscale is not signed in. Run 'tailscale up', then try again.")
    if state == "Stopped":
        subprocess.run(["tailscale", "up"], capture_output=True, text=True, timeout=60)
        status = _tailscale_status()
    return status


def _funnel_hint(output: str) -> str:
    if "funnel" in output.lower() and "https://login.tailscale.com/f/funnel" in output:
        return "Funnel is not enabled for this tailnet. Enable it from the link below and try again.\n"
    return ""


def _start_tailscale_funnel(port: int) -> str:
    """Start Tailscale Funnel in the background and return the public URL."""
    status = _require_tailscale()
    try:
        subprocess.run(["tailscale", "funnel", "reset"], capture_output=True, timeout=10)
        result = subprocess.run(
            ["tailscale", "funnel", "--bg", str(port)],
            capture_output=True, text=True, check=True, timeout=20, encoding="utf-8", errors="replace",
        )
    except subprocess.CalledProcessError as exc:
        output = (exc.stderr or "") + (exc.stdout or "")
        _abort(f"{_funnel_hint(output)}tailscale funnel failed:\n{output}")
    except subprocess.SubprocessError as exc:
        _abort(f"tailscale funnel did not answer: {exc}")

    output = (result.stdout or "") + (result.stderr or "")
    match = re.search(r"https://[^\s]+\.ts\.net/?", output)
    if match:
        return match.group(0).rstrip("/")
    host = ((status.get("Self") or {}).get("DNSName") or "").rstrip(".")
    if host:
        return f"https://{host}"
    _abort(f"could not work out the public URL from tailscale:\n{output}")


def _start_tailscale_serve(port: int) -> str:
    status = _require_tailscale()
    host = ((status.get("Self") or {}).get("DNSName") or "").rstrip(".")
    if not host:
        _abort("tailscale did not report a name for this machine.")
    try:
        subprocess.run(["tailscale", "serve", "reset"], capture_output=True, timeout=10)
        result = subprocess.run(
            ["tailscale", "serve", "--bg", str(port)],
            capture_output=True, text=True, check=True, timeout=20, encoding="utf-8", errors="replace",
        )
    except subprocess.CalledProcessError as exc:
        _abort(f"tailscale serve failed:\n{(exc.stderr or '') + (exc.stdout or '')}")
    except subprocess.SubprocessError as exc:
        _abort(f"tailscale serve did not answer: {exc}")
    output = (result.stdout or "") + (result.stderr or "")
    match = re.search(r"https://[^\s]+\.ts\.net/?", output)
    return match.group(0).rstrip("/") if match else f"https://{host}"


def _stop_tailscale_serve() -> None:
    try:
        subprocess.run(["tailscale", "serve", "reset"], capture_output=True, timeout=10)
    except Exception:
        pass


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
    """The first globally routable IPv4 among this machine's interfaces."""
    return next((ip for ip in _local_ipv4() if ipaddress.ip_address(ip).is_global), None)


def _dns_label(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")[:24]


def _default_public_host() -> str:
    """The sslip.io hostname built from the user name and the public address."""
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
    """Warns when the hostname points elsewhere or nothing answers on 443."""
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
    private = provider in _PRIVATE_PROVIDERS
    generated = False if private else _ensure_public_token()
    if provider == "tailscale":
        public_url = _start_tailscale_funnel(port)
        if not keep_running:
            atexit.register(_stop_tailscale_funnel)
    elif provider == "tailnet":
        public_url = _start_tailscale_serve(port)
        if not keep_running:
            atexit.register(_stop_tailscale_serve)
    elif provider == "caddy":
        public_url = _caddy_url(public_host, port)
    else:
        _abort(f"unknown --expose provider: {provider}")
        return
    os.environ["PUBLIC_URL"] = public_url
    token = "" if private else os.environ[_TOKEN_VAR]
    parsed = urlparse(public_url)
    pub_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    _print_rows([
        ("URL" if private else "Public URL", public_url),
        ("Provider", provider),
        ("Port", str(pub_port)),
        *([] if private else [("Token", f"{token}{' [Auto]' if generated else ''}")]),
        _security_key_row(key_generated),
    ])
    payload = {"url": public_url} if private else {"url": public_url, "token": token}
    _print_qr(json.dumps(payload, separators=(",", ":")))


def _running_pid() -> int | None:
    """PID of a live detached launcher, or None when the recorded one is gone."""
    try:
        pid = int(paths.DETACHED_PID_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None
    try:
        process = psutil.Process(pid)
        if _MODULE in " ".join(process.cmdline()):
            return pid
    except (psutil.Error, OSError):
        pass
    paths.DETACHED_PID_FILE.unlink(missing_ok=True)
    return None


def _detached_provider() -> str:
    """The provider the detached run exposed with."""
    with suppress(OSError):
        return paths.DETACHED_PROVIDER_FILE.read_text(encoding="utf-8").strip()
    return ""


def _spawn_detached(child_args: list[str]) -> int:
    handle = paths.DETACHED_LOG_FILE.open("ab")
    kwargs: dict = {
        "stdin": subprocess.DEVNULL,
        "stdout": handle,
        "stderr": handle,
        "cwd": str(paths.BACKEND_DIR),
        "env": dict(os.environ),
        "close_fds": True,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen([sys.executable, "-m", _MODULE, *child_args], **kwargs)
    paths.DETACHED_PID_FILE.write_text(str(process.pid), encoding="utf-8")
    return process.pid


def _reapable(target: psutil.Process) -> bool:
    with suppress(psutil.Error, OSError):
        return target.status() != psutil.STATUS_ZOMBIE
    return False


def _process_tree(pid: int) -> list[psutil.Process]:
    with suppress(psutil.Error, OSError):
        parent = psutil.Process(pid)
        return [target for target in parent.children(recursive=True) + [parent] if _reapable(target)]
    return []


def _terminate_tree(pid: int) -> None:
    targets = _process_tree(pid)
    for target in targets:
        with suppress(psutil.Error, OSError):
            target.terminate()
    with suppress(psutil.Error, OSError):
        _, alive = psutil.wait_procs(targets, timeout=_STOP_TIMEOUT)
        for target in alive:
            with suppress(psutil.Error, OSError):
                target.kill()


def _stop_detached() -> None:
    pid = _running_pid()
    if pid is None:
        print("No detached backend is running.")
    else:
        _terminate_tree(pid)
        if psutil.pid_exists(pid):
            _abort(f"could not stop pid {pid}.")
        print(f"Stopped detached backend (pid {pid}).")
    paths.DETACHED_PID_FILE.unlink(missing_ok=True)
    detached = _detached_provider()
    if detached == "tailscale":
        _stop_tailscale_funnel()
    elif detached == "tailnet":
        _stop_tailscale_serve()
    paths.DETACHED_PROVIDER_FILE.unlink(missing_ok=True)


def _invocation() -> str:
    return "cconnect" if paths.INSTALLED else f"{Path(sys.executable).name} run.py"


def _flag_parser() -> argparse.ArgumentParser:
    """The launcher's original flags, accepted alongside the subcommands."""
    parser = argparse.ArgumentParser(description="CConnect backend launcher.")
    parser.add_argument("--production", action="store_true",
                        help="No reload, multi-worker (Linux/macOS only).")
    parser.add_argument("--expose", choices=list(_PROVIDERS), default="",
                        help="Serve the backend through the given provider: tailnet keeps it "
                             "inside your tailnet, tailscale and caddy publish it.")
    parser.add_argument("--public-host", default="",
                        help="Hostname the reverse proxy serves (--expose caddy). Falls back to "
                             f"{_HOSTNAME_VAR}, then to <user>-<ip>.sslip.io.")
    parser.add_argument("--detach", action="store_true",
                        help="Run in the background and return; the server outlives the terminal.")
    parser.add_argument("--stop", action="store_true",
                        help="Stop a backend previously started with --detach.")
    parser.add_argument("--security-key", action="store_true",
                        help="Print the key that unlocks the terminal and ignored files, generating it the first time.")
    parser.add_argument("--rotate", action="store_true",
                        help="With --security-key, replace the existing key instead of printing it.")
    parser.set_defaults(command="", source="", force=False, json=False)
    return parser


def _command_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cconnect", description="CConnect backend.")
    parser.set_defaults(
        production=False, expose="", public_host="", detach=False,
        security_key=False, rotate=False, source="", force=False, json=False,
    )
    commands = parser.add_subparsers(dest="command")

    run = commands.add_parser("run", help="Serve on this machine and its network. The default.")
    run.add_argument("--production", action="store_true",
                     help="No reload, multi-worker (Linux/macOS only).")
    run.add_argument("--detach", action="store_true",
                     help="Run in the background; the server outlives the terminal.")

    expose = commands.add_parser("expose", help="Serve over the internet, token-gated.")
    expose.add_argument("provider", choices=list(_PROVIDERS))
    expose.add_argument("--public-host", default="",
                        help=f"Hostname the reverse proxy serves (caddy). Falls back to {_HOSTNAME_VAR}, "
                             "then to <user>-<ip>.sslip.io.")
    expose.add_argument("--detach", action="store_true",
                        help="Run in the background; the server outlives the terminal.")
    expose.add_argument("--production", action="store_true",
                        help="No reload, multi-worker (Linux/macOS only).")

    commands.add_parser("stop", help="Stop a backend started with --detach.")

    status = commands.add_parser("status", help="Version, where the data lives and what is running.")
    status.add_argument("--json", action="store_true", help="Print it as JSON, for other programs.")

    commands.add_parser("update", help="Upgrade this install to the latest release.")

    migrate = commands.add_parser("migrate", help="Copy a previous data folder into this one.")
    migrate.add_argument("source", nargs="?", default="",
                         help="The old data folder. Found on its own from inside a checkout.")
    migrate.add_argument("--force", action="store_true",
                         help="Overwrite what this data folder already holds.")

    key = commands.add_parser("key", help="Print the key that unlocks the terminal and ignored files.")
    key.add_argument("--rotate", action="store_true",
                     help="Replace the existing key instead of printing it.")
    return parser


def _parse(argv: list[str]) -> argparse.Namespace:
    legacy = bool(argv) and argv[0].startswith("-") and argv[0] not in ("-h", "--help")
    if legacy:
        args = _flag_parser().parse_args(argv)
        args.command = "key" if args.security_key else "stop" if args.stop else "run"
        return args
    args = _command_parser().parse_args(argv)
    args.expose = getattr(args, "provider", "") or args.expose
    args.command = args.command or "run"
    return args


def _runtime() -> dict[str, str]:
    """What the running server recorded, empty when the pid it wrote is gone."""
    try:
        recorded = dict(
            entry.split("=", 1)
            for entry in paths.RUNTIME_FILE.read_text(encoding="utf-8").split()
            if "=" in entry
        )
    except OSError:
        return {}
    pid = int(recorded.get("PID") or 0)
    return recorded if pid and psutil.pid_exists(pid) else {}


def _print_status(as_json: bool) -> None:
    live = _runtime()
    detached = _running_pid()
    if as_json:
        print(json.dumps({
            "version": release.VERSION,
            "data": str(paths.DATA_DIR),
            "env": str(paths.ENV_FILE),
            "port": int(live.get("PORT") or PORT),
            "pid": int(live.get("PID") or 0) or None,
            "running": bool(live),
            "detached": detached,
        }))
        return
    rows = [
        ("Version", release.VERSION),
        ("Data", str(paths.DATA_DIR)),
        ("Server", f"pid {live['PID']} on port {live.get('PORT', '?')}" if live else "not running"),
    ]
    if detached is not None:
        rows.append(("Detached", f"pid {detached}"))
    _print_rows(rows)


def _update() -> None:
    if not paths.INSTALLED:
        _abort("this is a git checkout, not an installed release: update it with git pull.")
    print(f"\n  {' '.join(repo.upgrade_command())}\n")
    result = repo.upgrade()
    if result["message"]:
        print(f"{result['message']}\n")
    if not result["ok"]:
        _abort(f"the upgrade failed. Stop the server and try again: {_invocation()} stop")
    if result["changed"] and _runtime():
        print("  The server that is running keeps the old version until it restarts.\n")


def _data_dir_in(place: Path) -> Path | None:
    for candidate in (place, place / "data", place / "backend" / "data"):
        if (candidate / "config").is_dir():
            return candidate.resolve()
    return None


def _migrate(source: str, force: bool) -> None:
    place = Path(source).expanduser() if source else Path.cwd()
    origin = _data_dir_in(place)
    if origin is None:
        _abort(f"no data folder at {place}, at {place / 'data'} or at {place / 'backend' / 'data'}")
        return
    if origin == paths.DATA_DIR:
        _abort(f"{origin} is already where the data lives.")
    if _running_pid() is not None or _runtime():
        _abort("stop the backend before copying its data.")
    if paths.DB_FILE.exists() and not force:
        _abort(f"{paths.DATA_DIR} already holds a database. Pass --force to replace what is there.")
    taken = data_migration.adopt(origin, force)
    _print_rows([
        ("From", str(origin)),
        ("Into", str(paths.DATA_DIR)),
        ("Copied", f"{len(taken)} files" if taken else "nothing new"),
    ])


def main():
    args = _parse(sys.argv[1:])

    try:
        moved = data_migration.migrate()
    except OSError as exc:
        _abort(f"could not move the old data files into {paths.DATA_DIR}: {exc}")
    if moved:
        print(f"Moved into {paths.DATA_DIR}: {', '.join(moved)}")

    if args.command == "key":
        _print_security_key(_ensure_security_key(args.rotate), qr=True)
        if args.rotate:
            print("  Every device has to enter it again, and a running backend needs a restart.\n")
        return

    if args.command == "status":
        _print_status(args.json)
        return

    if args.command == "update":
        _update()
        return

    if args.command == "migrate":
        _migrate(args.source, args.force)
        return

    if args.command == "stop":
        _stop_detached()
        return

    is_windows = sys.platform == "win32"

    if args.detach:
        running = _running_pid()
        if running is not None:
            _abort(f"a detached backend is already running (pid {running}). Use --stop first.")
        system_monitor.reset_log_file()
        key_generated = _ensure_security_key()
        if args.expose:
            _expose(args.expose, PORT, args.public_host, keep_running=True, key_generated=key_generated)
            paths.DETACHED_PROVIDER_FILE.write_text(args.expose, encoding="utf-8")
        else:
            _print_security_key(key_generated)
        child_args = ["--production"] if args.production else []
        pid = _spawn_detached(child_args)
        print(
            f"  Detached   : pid {pid}"
            f"\n  Log        : {paths.DETACHED_LOG_FILE}"
            f"\n  Stop with  : {_invocation()} stop\n"
        )
        return

    system_monitor.reset_log_file()
    key_generated = _ensure_security_key()
    if args.expose:
        _expose(args.expose, PORT, args.public_host, key_generated=key_generated)
    else:
        _print_security_key(key_generated)

    reload = not args.production and not is_windows
    workers = int(os.environ.get("WEB_CONCURRENCY", "2")) if (args.production and not is_windows) else 1

    cmd = [sys.executable, "-m", "uvicorn", _APP, "--host", "0.0.0.0", "--port", str(PORT)]
    if reload:
        cmd += ["--reload", "--reload-exclude", str(paths.DATA_DIR)]
    elif workers > 1:
        cmd += ["--workers", str(workers)]

    paths.RESTART_FLAG.unlink(missing_ok=True)
    paths.STOP_FLAG.unlink(missing_ok=True)
    while True:
        process = subprocess.Popen(cmd, cwd=paths.BACKEND_DIR)
        asked = False
        stopped = False
        try:
            while True:
                try:
                    process.wait(timeout=_POLL_SECONDS)
                    break
                except subprocess.TimeoutExpired:
                    asked = paths.RESTART_FLAG.exists()
                    stopped = paths.STOP_FLAG.exists()
                    if asked or stopped:
                        _terminate_tree(process.pid)
                        process.wait()
                        break
        except KeyboardInterrupt:
            _terminate_tree(process.pid)
            break
        if stopped or paths.STOP_FLAG.exists():
            paths.STOP_FLAG.unlink(missing_ok=True)
            break
        if asked or paths.RESTART_FLAG.exists():
            paths.RESTART_FLAG.unlink(missing_ok=True)
            continue
        if process.returncode != RESTART_EXIT_CODE:
            break


if __name__ == "__main__":
    main()
