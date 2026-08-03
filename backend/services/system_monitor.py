"""PC resource usage snapshots and a shared on-disk server log for the monitor screen.

Logs go to a JSONL file (one per server run) instead of process memory so that
multi-worker runs still expose every worker's output through any of them.
"""

import json
import logging
import platform
import subprocess
import sys
import time
from functools import lru_cache
from pathlib import Path

import psutil
from loguru import logger

_LOG_FILE = Path(__file__).resolve().parent.parent / "logs" / "server.jsonl"
_READ_CAP = 64 * 1024
_capture_installed = False


def reset_log_file() -> None:
    _LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    _LOG_FILE.write_text("", encoding="utf-8")


def _sink(message) -> None:
    record = message.record
    entry = {
        "ts": record["time"].timestamp(),
        "level": record["level"].name,
        "message": record["message"],
        "pid": record["process"].id,
    }
    try:
        with _LOG_FILE.open("a", encoding="utf-8") as fh:
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
    _LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    logger.add(_sink, level="INFO", format="{message}")
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        std = logging.getLogger(name)
        std.handlers = [_InterceptHandler()]
        std.propagate = False
    psutil.cpu_percent(interval=None)


def logs(after: int = 0, limit: int = 200) -> dict:
    try:
        size = _LOG_FILE.stat().st_size
    except OSError:
        return {"items": [], "offset": 0}
    start = max(0, size - _READ_CAP) if after == 0 else after
    if start >= size:
        return {"items": [], "offset": size}
    with _LOG_FILE.open("rb") as fh:
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


@lru_cache(maxsize=1)
def _os_id() -> str:
    if sys.platform == "win32":
        return "windows"
    if sys.platform == "darwin":
        return "darwin"
    try:
        return platform.freedesktop_os_release().get("ID", "linux")
    except OSError:
        return "linux"


@lru_cache(maxsize=1)
def _os_name() -> str:
    if sys.platform == "win32":
        try:
            build = sys.getwindowsversion().build
            return f"Windows {'11' if build >= 22000 else '10'}"
        except Exception:
            pass
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


def snapshot() -> dict:
    memory = psutil.virtual_memory()
    disks = []
    for part in psutil.disk_partitions(all=False):
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
    return {
        "hostname": platform.node(),
        "os": _os_name(),
        "os_id": _os_id(),
        "arch": platform.machine(),
        "cpu_name": _cpu_name(),
        "uptime": time.time() - psutil.boot_time(),
        "cpu": {
            "percent": psutil.cpu_percent(interval=None),
            "cores": psutil.cpu_count() or 0,
        },
        "memory": {"used": memory.used, "total": memory.total, "percent": memory.percent},
        "gpu": _gpu(),
        "disks": disks,
        "network": _network(),
    }


def _network() -> dict:
    from services import network
    if not network.SUPPORTED:
        return {"supported": False}
    rates = network.throughput()
    total_rx = sum(rate["rx"] for rate in rates.values())
    total_tx = sum(rate["tx"] for rate in rates.values())
    return {"supported": True, "rx": total_rx, "tx": total_tx, "rates": rates}
