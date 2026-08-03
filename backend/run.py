"""Uvicorn server launcher. Use --production for no-reload multi-worker mode."""

import argparse
import atexit
import io
import json
import os
import re
import secrets
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
_DETACHED_LOG = _BASE_DIR / "logs" / "detached.log"
_TOKEN_VAR = "PUBLIC_ACCESS_TOKEN"


def _abort(msg: str) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    sys.exit(1)


def _persist_token_in_env(token: str) -> str:
    if not _ENV_PATH.exists():
        _ENV_PATH.write_text(f"{_TOKEN_VAR}={token}\n", encoding="utf-8")
        return "created .env"

    lines = _ENV_PATH.read_text(encoding="utf-8").splitlines()
    pattern = re.compile(rf"^\s*{re.escape(_TOKEN_VAR)}\s*=\s*(.*)$")
    for i, line in enumerate(lines):
        match = pattern.match(line)
        if match:
            lines[i] = f"{_TOKEN_VAR}={token}"
            _ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return "filled empty entry in .env"

    if lines and lines[-1] != "":
        lines.append("")
    lines.append(f"{_TOKEN_VAR}={token}")
    _ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return "appended entry to .env"


def _ensure_public_token() -> bool:
    """Make sure a Bearer token exists for public exposure. Returns True if just generated."""
    # Env var (not module mutation) so uvicorn's reload subprocess inherits the state.
    os.environ["CCONNECT_AUTH_ACTIVE"] = "1"
    if os.environ.get(_TOKEN_VAR):
        return False

    token = secrets.token_urlsafe(32)
    _persist_token_in_env(token)
    os.environ[_TOKEN_VAR] = token
    return True


def _start_tailscale_funnel(port: int) -> str:
    """Start Tailscale Funnel in the background and return the public URL."""
    try:
        subprocess.run(["tailscale", "up"], capture_output=True, text=True, timeout=60)
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
            ["tailscale", "funnel", "--https=443", "off"],
            capture_output=True, timeout=10,
        )
    except Exception:
        pass


def _print_qr(payload: str) -> None:
    qr = qrcode.QRCode(border=1)
    qr.add_data(payload)
    qr.make(fit=True)
    buf = io.StringIO()
    qr.print_ascii(out=buf, invert=True)
    sys.stdout.buffer.write(buf.getvalue().encode("utf-8"))
    sys.stdout.buffer.flush()


def _expose(provider: str, port: int, keep_running: bool = False) -> None:
    generated = _ensure_public_token()
    if provider == "tailscale":
        public_url = _start_tailscale_funnel(port)
        if not keep_running:
            atexit.register(_stop_tailscale_funnel)
    else:
        _abort(f"unknown --expose provider: {provider}")
        return  # unreachable, satisfies static checkers
    token = os.environ[_TOKEN_VAR]
    token_tag = " [Auto]" if generated else ""
    parsed = urlparse(public_url)
    pub_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    print(
        f"\n  Public URL : {public_url}"
        f"\n  Provider   : {provider}"
        f"\n  Port       : {pub_port}"
        f"\n  Token      : {token}{token_tag}\n"
    )
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
    _stop_tailscale_funnel()


def main():
    parser = argparse.ArgumentParser(description="CConnect backend launcher.")
    parser.add_argument("--production", action="store_true",
                        help="No reload, multi-worker (Linux/macOS only).")
    parser.add_argument("--expose", choices=["tailscale"], default=None,
                        help="Expose the backend to the public internet via the given provider.")
    parser.add_argument("--detach", action="store_true",
                        help="Run in the background and return; the server outlives the terminal.")
    parser.add_argument("--stop", action="store_true",
                        help="Stop a backend previously started with --detach.")
    args = parser.parse_args()

    is_windows = sys.platform == "win32"

    if args.stop:
        _stop_detached()
        return

    if args.detach:
        running = _running_pid()
        if running is not None:
            _abort(f"a detached backend is already running (pid {running}). Use --stop first.")
        system_monitor.reset_log_file()
        if args.expose:
            _expose(args.expose, PORT, keep_running=True)
        child_args = ["--production"] if args.production else []
        pid = _spawn_detached(child_args)
        print(
            f"  Detached   : pid {pid}"
            f"\n  Log        : {_DETACHED_LOG}"
            f"\n  Stop with  : {Path(sys.executable).name} run.py --stop\n"
        )
        return

    system_monitor.reset_log_file()
    if args.expose:
        _expose(args.expose, PORT)

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
        try:
            code = subprocess.run(cmd, cwd=Path(__file__).resolve().parent).returncode
        except KeyboardInterrupt:
            break
        if RESTART_FLAG.exists():
            RESTART_FLAG.unlink(missing_ok=True)
            continue
        if code != RESTART_EXIT_CODE:
            break


if __name__ == "__main__":
    main()
