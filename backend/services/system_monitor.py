"""PC resource usage snapshots and a shared on-disk server log for the monitor screen.

Logs go to a JSONL file (one per server run) instead of process memory so that
multi-worker runs still expose every worker's output through any of them.
"""

import json
import logging
import platform
import re
import subprocess
import sys
import time
from functools import lru_cache
from pathlib import Path

import psutil
from loguru import logger

from core import paths

_READ_CAP = 64 * 1024
_capture_installed = False
_HIDDEN = "***"
_SECRET_PARAMS = (
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "key",
    "api_key",
    "apikey",
    "secret",
    "client_secret",
    "password",
    "code",
)
_SECRET_QUERY = re.compile(rf"([?&](?:{'|'.join(_SECRET_PARAMS)})=)[^&\s\"'#]+", re.IGNORECASE)
_SECRET_SCHEME = re.compile(r"\b(Bearer|Basic)\s+[\w.~+/=-]+", re.IGNORECASE)
_URL_LOGIN = re.compile(r"(\b[a-z][\w+.-]*://)[^/\s:@]+:[^/\s@]+@", re.IGNORECASE)


def _redacted(text: str) -> str:
    text = _SECRET_QUERY.sub(rf"\g<1>{_HIDDEN}", text)
    text = _SECRET_SCHEME.sub(rf"\g<1> {_HIDDEN}", text)
    return _URL_LOGIN.sub(rf"\g<1>{_HIDDEN}@", text)


def _redact(record) -> None:
    record["message"] = _redacted(record["message"])


def reset_log_file() -> None:
    paths.SERVER_LOG_FILE.write_text("", encoding="utf-8")


def _sink(message) -> None:
    record = message.record
    entry = {
        "ts": record["time"].timestamp(),
        "level": record["level"].name,
        "message": record["message"],
        "pid": record["process"].id,
    }
    try:
        with paths.SERVER_LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass


class _InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        if record.name == "uvicorn.access" and "/api/system" in message:
            return
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        logger.opt(depth=6, exception=record.exc_info).log(level, message)


def setup_log_capture() -> None:
    global _capture_installed
    if _capture_installed:
        return
    _capture_installed = True
    logger.remove()
    if sys.stderr:
        logger.add(sys.stderr, diagnose=False)
    logger.configure(patcher=_redact)
    logger.add(_sink, level="INFO", format="{message}")
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        std = logging.getLogger(name)
        std.handlers = [_InterceptHandler()]
        std.propagate = False
    psutil.cpu_percent(interval=None)


def logs(after: int = 0, limit: int = 200) -> dict:
    try:
        size = paths.SERVER_LOG_FILE.stat().st_size
    except OSError:
        return {"items": [], "offset": 0}
    start = max(0, size - _READ_CAP) if after == 0 else after
    if start >= size:
        return {"items": [], "offset": size}
    with paths.SERVER_LOG_FILE.open("rb") as fh:
        fh.seek(start)
        data = fh.read(size - start)
    end = start + len(data)
    if not data.endswith(b"\n"):
        cut = data.rfind(b"\n") + 1
        end = start + cut
        data = data[:cut]
    text = data.decode("utf-8", errors="replace")
    if after == 0 and start > 0:
        first_break = text.find("\n")
        text = text[first_break + 1:] if first_break >= 0 else ""
    items = []
    for line in text.splitlines():
        try:
            items.append(json.loads(line))
        except ValueError:
            continue
    if limit > 0:
        items = items[-limit:]
    return {"items": items, "offset": end}


_nvml = None
_last_gpu: dict | None = None


def _gpu() -> dict | None:
    global _nvml, _last_gpu
    if _nvml is False:
        return None
    if _nvml is None:
        try:
            import pynvml
            pynvml.nvmlInit()
            _nvml = pynvml
        except Exception:
            _nvml = False
            return None
    try:
        handle = _nvml.nvmlDeviceGetHandleByIndex(0)
        name = _nvml.nvmlDeviceGetName(handle)
        if isinstance(name, bytes):
            name = name.decode("utf-8", errors="replace")
        usage = _nvml.nvmlDeviceGetUtilizationRates(handle)
        memory = _nvml.nvmlDeviceGetMemoryInfo(handle)
        try:
            temp = _nvml.nvmlDeviceGetTemperature(handle, _nvml.NVML_TEMPERATURE_GPU)
        except Exception:
            temp = None
        _last_gpu = {
            "name": name,
            "percent": float(usage.gpu),
            "mem_used": int(memory.used),
            "mem_total": int(memory.total),
            "mem_percent": round(memory.used / memory.total * 100, 1) if memory.total else 0.0,
            "temp": temp,
        }
        return _last_gpu
    except Exception:
        if _last_gpu is not None:
            return {**_last_gpu, "percent": 0.0, "temp": None}
        return None


_WINDOWS_11_BUILD = 22000


@lru_cache(maxsize=1)
def _windows_edition() -> str:
    """Windows 11 reports itself as 10 everywhere except the build number."""
    try:
        return "11" if sys.getwindowsversion().build >= _WINDOWS_11_BUILD else "10"
    except (AttributeError, OSError):
        return ""


def _os_id() -> str:
    if sys.platform == "win32":
        edition = _windows_edition()
        return f"windows-{edition}" if edition else "windows"
    if sys.platform == "darwin":
        return "darwin"
    try:
        return platform.freedesktop_os_release().get("ID", "linux")
    except OSError:
        return "linux"


@lru_cache(maxsize=1)
def _os_name() -> str:
    if sys.platform == "win32":
        edition = _windows_edition()
        if edition:
            return f"Windows {edition}"
    return f"{platform.system()} {platform.release()}"


@lru_cache(maxsize=1)
def _cpu_name() -> str | None:
    try:
        if sys.platform == "win32":
            import winreg
            key_path = r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path) as key:
                return winreg.QueryValueEx(key, "ProcessorNameString")[0].strip() or None
        if sys.platform == "darwin":
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True, text=True, timeout=5,
            )
            return result.stdout.strip() or None
        for line in Path("/proc/cpuinfo").read_text(encoding="utf-8").splitlines():
            if line.lower().startswith("model name"):
                return line.split(":", 1)[1].strip() or None
    except Exception:
        pass
    return None


def _battery() -> dict | None:
    try:
        battery = psutil.sensors_battery()
    except Exception:
        return None
    if battery is None:
        return None
    left = battery.secsleft
    if left in (psutil.POWER_TIME_UNLIMITED, psutil.POWER_TIME_UNKNOWN) or left is None or left < 0:
        left = None
    return {
        "percent": round(battery.percent, 1),
        "plugged": bool(battery.power_plugged),
        "secsleft": left,
    }


def _disks() -> list[dict]:
    disks = []
    try:
        partitions = psutil.disk_partitions(all=False)
    except OSError:
        return disks
    for part in partitions:
        if not part.fstype or part.fstype == "squashfs" or "cdrom" in part.opts:
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except OSError:
            continue
        disks.append({
            "mount": part.mountpoint.rstrip("\\/") or part.mountpoint,
            "used": usage.used,
            "total": usage.total,
            "percent": usage.percent,
        })
    return disks


def _memory() -> dict:
    try:
        memory = psutil.virtual_memory()
    except OSError:
        return {"used": 0, "total": 0, "percent": 0.0}
    return {"used": memory.used, "total": memory.total, "percent": memory.percent}


def _cpu() -> dict:
    try:
        return {"percent": psutil.cpu_percent(interval=None), "cores": psutil.cpu_count() or 0}
    except OSError:
        return {"percent": 0.0, "cores": 0}


def _uptime() -> float:
    try:
        return time.time() - psutil.boot_time()
    except OSError:
        return 0.0


def snapshot() -> dict:
    return {
        "hostname": platform.node(),
        "os": _os_name(),
        "os_id": _os_id(),
        "arch": platform.machine(),
        "cpu_name": _cpu_name(),
        "uptime": _uptime(),
        "cpu": _cpu(),
        "memory": _memory(),
        "gpu": _gpu(),
        "battery": _battery(),
        "disks": _disks(),
        "network": _network(),
    }


def _network() -> dict:
    from services import network
    if not network.SUPPORTED:
        return {"supported": False}
    try:
        rates = network.throughput()
    except Exception:
        return {"supported": False}
    total_rx = sum(rate["rx"] for rate in rates.values())
    total_tx = sum(rate["tx"] for rate in rates.values())
    return {"supported": True, "rx": total_rx, "tx": total_tx, "rates": rates}
