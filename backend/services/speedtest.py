"""Bandwidth measurement through the Ookla Speedtest CLI, when it is installed."""

from __future__ import annotations

import asyncio
import json
import shutil
import sys
from pathlib import Path
from typing import AsyncIterator, Optional

_WINDOWS = sys.platform == "win32"
_CANDIDATES = (
    Path.home() / "AppData/Local/Microsoft/WinGet/Links/speedtest.exe",
    Path(r"C:\Program Files\Speedtest\speedtest.exe"),
    Path("/usr/bin/speedtest"),
    Path("/usr/local/bin/speedtest"),
    Path("/opt/homebrew/bin/speedtest"),
)

_spawn = asyncio.create_subprocess_exec


def binary() -> Optional[str]:
    found = shutil.which("speedtest")
    if found:
        return found
    for candidate in _CANDIDATES:
        if candidate.exists():
            return str(candidate)
    return None


def available() -> bool:
    return binary() is not None


def _bandwidth_bps(value) -> Optional[float]:
    return float(value) * 8 if isinstance(value, (int, float)) else None


def _result(payload: dict) -> dict:
    download = payload.get("download") or {}
    upload = payload.get("upload") or {}
    ping = payload.get("ping") or {}
    server = payload.get("server") or {}
    return {
        "download": _bandwidth_bps(download.get("bandwidth")),
        "upload": _bandwidth_bps(upload.get("bandwidth")),
        "ping": ping.get("latency"),
        "jitter": ping.get("jitter"),
        "server": server.get("name"),
        "location": server.get("location"),
        "isp": payload.get("isp"),
        "url": (payload.get("result") or {}).get("url"),
    }


async def run(interface: Optional[str] = None) -> AsyncIterator[dict]:
    """Yield progress entries while the test runs, then a final result entry."""
    executable = binary()
    if not executable:
        yield {"type": "error", "message": "speedtest cli not installed"}
        return
    args = [executable, "--format=jsonl", "--progress=yes", "--accept-license", "--accept-gdpr"]
    if interface:
        args += ["--interface", interface]
    try:
        process = await _spawn(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    except OSError as exc:
        yield {"type": "error", "message": str(exc)}
        return
    if process.stdout is None:
        yield {"type": "error", "message": "no output"}
        return
    try:
        async for raw in process.stdout:
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = payload.get("type")
            if kind in ("download", "upload"):
                stage = payload.get(kind) or {}
                yield {
                    "type": "progress",
                    "stage": kind,
                    "progress": stage.get("progress"),
                    "bandwidth": _bandwidth_bps(stage.get("bandwidth")),
                }
            elif kind == "ping":
                ping = payload.get("ping") or {}
                yield {"type": "progress", "stage": "ping", "progress": ping.get("progress"), "ping": ping.get("latency")}
            elif kind == "result":
                yield {"type": "result", **_result(payload)}
            elif kind == "error":
                yield {"type": "error", "message": payload.get("message")}
    finally:
        if process.returncode is None:
            process.terminate()
        await process.wait()
