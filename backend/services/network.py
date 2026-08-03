"""Host network state, Wi-Fi control and guarded switching with automatic rollback."""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Callable, Optional

import psutil

_WINDOWS = sys.platform == "win32"
_LINUX = sys.platform.startswith("linux")

SUPPORTED = _WINDOWS or _LINUX
WIRED_CONTROL = _LINUX

_STATE_FILE = Path(__file__).resolve().parent.parent / "network_state.json"
_PROBE_URLS = ("http://www.gstatic.com/generate_204", "http://detectportal.firefox.com/success.txt")
_SETTLE_TIMEOUT = 25.0
_WATCHDOG_INTERVAL = 5.0
_OFFLINE_GRACE = 45.0
_SSID_RE = re.compile(r"^\s*SSID\s+\d+\s*:\s*(.*)$")
_PERCENT_RE = re.compile(r"(\d{1,3})\s*%")

_sudo_password: Optional[str] = None
_jobs: dict[str, dict] = {}
_rates: dict[str, tuple[float, int, int]] = {}


def set_sudo_password(password: Optional[str]) -> None:
    global _sudo_password
    _sudo_password = password or None


def has_sudo_password() -> bool:
    return _sudo_password is not None


def _popen_kwargs() -> dict:
    if _WINDOWS:
        return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
    return {}


def _run(args: list[str], timeout: int = 25, privileged: bool = False) -> dict:
    stdin_data = None
    if privileged and _LINUX and _sudo_password:
        args = ["sudo", "-S", "-p", "", *args]
        stdin_data = _sudo_password + "\n"
    try:
        result = subprocess.run(
            args,
            input=stdin_data,
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout, **_popen_kwargs(),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return {"ok": False, "out": "", "message": str(exc)}
    out = (result.stdout or "").strip()
    err = (result.stderr or "").strip()
    return {"ok": result.returncode == 0, "out": out, "message": err or out}


def _powershell(script: str, timeout: int = 25) -> dict:
    return _run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script], timeout=timeout)


def _ps_json(script: str, timeout: int = 25):
    result = _powershell(f"{script} | ConvertTo-Json -Compress -Depth 4", timeout=timeout)
    if not result["ok"] or not result["out"]:
        return []
    try:
        data = json.loads(result["out"])
    except json.JSONDecodeError:
        return []
    if data is None:
        return []
    return data if isinstance(data, list) else [data]


def _nmcli(fields: str, args: list[str], privileged: bool = False) -> list[list[str]]:
    result = _run(["nmcli", "-t", "-f", fields, *args], privileged=privileged)
    if not result["ok"]:
        return []
    rows = []
    for line in result["out"].splitlines():
        if line.strip():
            rows.append([c.replace("\\:", ":") for c in re.split(r"(?<!\\):", line)])
    return rows


def _kind(media: str, name: str) -> str:
    text = f"{media} {name}".lower()
    if "802.11" in text or "wi-fi" in text or "wifi" in text or "wireless" in text:
        return "wifi"
    if "802.3" in text or "ethernet" in text:
        return "wired"
    return "other"


_PS_PROFILES = (
    "Get-NetConnectionProfile | Select-Object InterfaceAlias,Name,"
    "@{n='Connectivity';e={[string]$_.IPv4Connectivity}}"
)


def _interfaces_windows() -> list[dict]:
    adapters = _ps_json(
        "Get-NetAdapter | Select-Object Name,InterfaceDescription,LinkSpeed,"
        "@{n='Status';e={[string]$_.Status}},@{n='MediaType';e={[string]$_.MediaType}}"
    )
    profiles = {str(p.get("InterfaceAlias")): p for p in _ps_json(_PS_PROFILES)}
    items = []
    for adapter in adapters:
        name = str(adapter.get("Name") or "")
        profile = profiles.get(name) or {}
        connectivity = str(profile.get("Connectivity") or "")
        items.append({
            "name": name,
            "description": adapter.get("InterfaceDescription"),
            "kind": _kind(str(adapter.get("MediaType") or ""), str(adapter.get("InterfaceDescription") or "")),
            "up": str(adapter.get("Status") or "").lower() == "up",
            "link_speed": adapter.get("LinkSpeed"),
            "network": profile.get("Name"),
            "internet": connectivity.lower() == "internet",
        })
    return items


def _interfaces_linux() -> list[dict]:
    items = []
    for row in _nmcli("DEVICE,TYPE,STATE,CONNECTION", ["device", "status"]):
        if len(row) < 4:
            continue
        device, dev_type, state, connection = row[0], row[1], row[2], row[3]
        if dev_type in ("loopback", "bridge"):
            continue
        kind = "wifi" if dev_type == "wifi" else ("wired" if dev_type == "ethernet" else "other")
        items.append({
            "name": device,
            "description": dev_type,
            "kind": kind,
            "up": state == "connected",
            "link_speed": None,
            "network": connection or None,
            "internet": state == "connected",
        })
    return items


def interfaces() -> list[dict]:
    if not SUPPORTED:
        return []
    items = _interfaces_windows() if _WINDOWS else _interfaces_linux()
    stats = psutil.net_if_stats()
    for item in items:
        stat = stats.get(item["name"])
        if stat is not None and not item.get("link_speed"):
            item["link_speed"] = f"{stat.speed} Mbps" if stat.speed else None
    return items


def throughput() -> dict[str, dict]:
    counters = psutil.net_io_counters(pernic=True)
    now = time.monotonic()
    rates = {}
    for name, counter in counters.items():
        previous = _rates.get(name)
        _rates[name] = (now, counter.bytes_recv, counter.bytes_sent)
        if previous is None:
            continue
        elapsed = now - previous[0]
        if elapsed <= 0:
            continue
        rates[name] = {
            "rx": max(0.0, (counter.bytes_recv - previous[1]) / elapsed),
            "tx": max(0.0, (counter.bytes_sent - previous[2]) / elapsed),
        }
    return rates


def _probe_internet(timeout: float = 4.0) -> bool:
    import urllib.request
    for url in _PROBE_URLS:
        try:
            with urllib.request.urlopen(url, timeout=timeout) as response:
                if response.status < 400:
                    return True
        except Exception:
            continue
    return False


def connectivity() -> str:
    if _LINUX:
        result = _run(["nmcli", "networking", "connectivity", "check"], timeout=15)
        state = result["out"].strip().lower() if result["ok"] else "unknown"
        if state in ("full", "portal", "limited", "none"):
            if state == "full" and not _probe_internet():
                return "limited"
            return state
    if _WINDOWS:
        profiles = _ps_json(_PS_PROFILES)
        has_internet = any(str(p.get("Connectivity") or "").lower() == "internet" for p in profiles)
        if not has_internet:
            return "none" if not profiles else "limited"
    return "full" if _probe_internet() else "none"


def online() -> bool:
    return connectivity() == "full"


def wifi_scan() -> list[dict]:
    if _LINUX:
        known = {row[0] for row in _nmcli("NAME", ["connection", "show"]) if row}
        networks = []
        for row in _nmcli("IN-USE,SSID,SIGNAL,SECURITY", ["device", "wifi", "list", "--rescan", "auto"]):
            if len(row) < 4 or not row[1]:
                continue
            networks.append({
                "ssid": row[1],
                "signal": int(row[2]) if row[2].isdigit() else None,
                "security": row[3] or None,
                "active": row[0] == "*",
                "known": row[1] in known,
            })
        return networks
    if _WINDOWS:
        known = _windows_profiles()
        current = wifi_current()
        result = _run(["netsh", "wlan", "show", "networks", "mode=bssid"], timeout=30)
        networks: list[dict] = []
        pending: Optional[dict] = None
        for line in result["out"].splitlines():
            match = _SSID_RE.match(line)
            if match:
                if pending:
                    networks.append(pending)
                ssid = match.group(1).strip()
                pending = {"ssid": ssid, "signal": None, "security": None, "active": ssid == current, "known": ssid in known}
                continue
            if pending is None:
                continue
            percent = _PERCENT_RE.search(line)
            if percent and pending["signal"] is None:
                pending["signal"] = int(percent.group(1))
        if pending:
            networks.append(pending)
        return [n for n in networks if n["ssid"]]
    return []


def _windows_profiles() -> set[str]:
    result = _run(["netsh", "wlan", "show", "profiles"])
    names = set()
    for line in result["out"].splitlines():
        if ":" in line and not line.strip().endswith(":"):
            candidate = line.split(":", 1)[1].strip()
            if candidate and not candidate.startswith("<"):
                names.add(candidate)
    return names


def wifi_current() -> Optional[str]:
    if _LINUX:
        for row in _nmcli("ACTIVE,SSID", ["device", "wifi", "list"]):
            if len(row) >= 2 and row[0] == "yes":
                return row[1]
        return None
    if _WINDOWS:
        result = _run(["netsh", "wlan", "show", "interfaces"])
        for line in result["out"].splitlines():
            label, sep, value = line.partition(":")
            if sep and "SSID" in label.upper() and "BSSID" not in label.upper():
                ssid = value.strip()
                if ssid:
                    return ssid
    return None


def wifi_radio_state() -> Optional[bool]:
    if _LINUX:
        result = _run(["nmcli", "radio", "wifi"])
        return result["out"].strip().lower() == "enabled" if result["ok"] else None
    if _WINDOWS:
        adapters = _ps_json("Get-NetAdapter | Where-Object MediaType -eq 'Native 802.11' | Select-Object Status")
        if not adapters:
            return None
        return any(str(a.get("Status") or "").lower() == "up" for a in adapters)
    return None


def _windows_wifi_adapter() -> Optional[str]:
    for adapter in _ps_json(
        "Get-NetAdapter | Where-Object { $_.MediaType -eq 'Native 802.11' -and $_.Status -ne 'Not Present' }"
        " | Select-Object Name"
    ):
        name = adapter.get("Name")
        if name:
            return str(name)
    return None


def _windows_profile_xml(ssid: str, password: Optional[str]) -> str:
    from xml.sax.saxutils import escape
    name = escape(ssid)
    if password:
        security = (
            "<authEncryption><authentication>WPA2PSK</authentication>"
            "<encryption>AES</encryption><useOneX>false</useOneX></authEncryption>"
            "<sharedKey><keyType>passPhrase</keyType><protected>false</protected>"
            f"<keyMaterial>{escape(password)}</keyMaterial></sharedKey>"
        )
    else:
        security = (
            "<authEncryption><authentication>open</authentication>"
            "<encryption>none</encryption><useOneX>false</useOneX></authEncryption>"
        )
    return (
        '<?xml version="1.0"?>'
        '<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">'
        f"<name>{name}</name><SSIDConfig><SSID><name>{name}</name></SSID></SSIDConfig>"
        "<connectionType>ESS</connectionType><connectionMode>auto</connectionMode>"
        f"<MSM><security>{security}</security></MSM></WLANProfile>"
    )


def wifi_connect(ssid: str, password: Optional[str] = None) -> dict:
    if _LINUX:
        args = ["nmcli", "device", "wifi", "connect", ssid]
        if password:
            args += ["password", password]
        return _run(args, timeout=45, privileged=True)
    if _WINDOWS:
        if ssid not in _windows_profiles():
            if password is None:
                return {"ok": False, "message": "password required"}
            temp = Path(_STATE_FILE.parent) / f"wlan-{uuid.uuid4().hex}.xml"
            try:
                temp.write_text(_windows_profile_xml(ssid, password), encoding="utf-8")
                added = _run(["netsh", "wlan", "add", "profile", f"filename={temp}", "user=all"])
            finally:
                temp.unlink(missing_ok=True)
            if not added["ok"]:
                return added
        return _run(["netsh", "wlan", "connect", f"name={ssid}", f"ssid={ssid}"], timeout=45)
    return {"ok": False, "message": "unsupported"}


def wifi_set_radio(enabled: bool) -> dict:
    if _LINUX:
        return _run(["nmcli", "radio", "wifi", "on" if enabled else "off"], privileged=True)
    if _WINDOWS:
        adapter = _windows_wifi_adapter()
        if not adapter:
            return {"ok": False, "message": "no wifi adapter"}
        if enabled:
            state = last_good_state() or {}
            ssid = state.get("wifi_ssid")
            if ssid:
                return wifi_connect(ssid)
            return {"ok": True, "message": ""}
        return _run(["netsh", "wlan", "disconnect"], timeout=20)
    return {"ok": False, "message": "unsupported"}


def set_interface(name: str, enabled: bool) -> dict:
    if not WIRED_CONTROL:
        return {"ok": False, "message": "unsupported"}
    action = "connect" if enabled else "disconnect"
    return _run(["nmcli", "device", action, name], timeout=45, privileged=True)


def capture_state() -> dict:
    return {
        "wifi_ssid": wifi_current(),
        "wifi_radio": wifi_radio_state(),
        "interfaces": [{"name": i["name"], "kind": i["kind"], "up": i["up"]} for i in interfaces()],
        "saved_at": time.time(),
    }


def _restore_state(state: dict) -> None:
    if state.get("wifi_radio") and wifi_radio_state() is False:
        wifi_set_radio(True)
        time.sleep(3)
    for entry in state.get("interfaces", []):
        if entry["kind"] == "wired" and entry["up"] and WIRED_CONTROL:
            set_interface(entry["name"], True)
    ssid = state.get("wifi_ssid")
    if ssid and wifi_current() != ssid:
        wifi_connect(ssid)


def _persist_good(state: dict) -> None:
    try:
        _STATE_FILE.write_text(json.dumps(state), encoding="utf-8")
    except OSError:
        pass


def last_good_state() -> Optional[dict]:
    try:
        return json.loads(_STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


async def _wait_online(timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if await asyncio.to_thread(online):
            return True
        await asyncio.sleep(2)
    return False


def job(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)


def _guard_blocks(kind: str, name: Optional[str]) -> Optional[str]:
    items = interfaces()
    with_internet = [i for i in items if i["internet"] and i["up"]]
    if len(with_internet) > 1:
        return None
    if not with_internet:
        return None
    only = with_internet[0]
    if kind == "wifi" and only["kind"] == "wifi":
        return None
    if name and only["name"] == name:
        return "that interface is the only one with internet"
    return None


async def run_guarded(action: str, apply_fn: Callable[[], dict], *, kind: str = "wifi", target: Optional[str] = None) -> dict:
    job_id = uuid.uuid4().hex[:12]
    blocked = await asyncio.to_thread(_guard_blocks, kind, target)
    if blocked:
        return {"id": job_id, "status": "blocked", "message": blocked}
    before = await asyncio.to_thread(capture_state)
    _jobs[job_id] = {"id": job_id, "action": action, "status": "running", "started": time.time()}

    async def _task() -> None:
        try:
            result = await asyncio.to_thread(apply_fn)
            if not result.get("ok"):
                _jobs[job_id] |= {"status": "failed", "message": result.get("message")}
                return
            if await _wait_online(_SETTLE_TIMEOUT):
                _jobs[job_id] |= {"status": "ok"}
                _persist_good(await asyncio.to_thread(capture_state))
                return
            await asyncio.to_thread(_restore_state, before)
            recovered = await _wait_online(_SETTLE_TIMEOUT)
            _jobs[job_id] |= {"status": "rolled_back", "recovered": recovered}
        except Exception as exc:
            _jobs[job_id] |= {"status": "failed", "message": str(exc)}

    asyncio.get_running_loop().create_task(_task())
    return _jobs[job_id]


class NetworkWatchdog:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._offline_since: Optional[float] = None

    async def start(self) -> None:
        if self._task is not None or not SUPPORTED:
            return
        self._task = asyncio.get_running_loop().create_task(self._loop())

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(_WATCHDOG_INTERVAL)
                if any(j.get("status") == "running" for j in _jobs.values()):
                    continue
                if await asyncio.to_thread(online):
                    self._offline_since = None
                    continue
                now = time.monotonic()
                if self._offline_since is None:
                    self._offline_since = now
                    continue
                if now - self._offline_since < _OFFLINE_GRACE:
                    continue
                self._offline_since = None
                state = last_good_state()
                if state:
                    await asyncio.to_thread(_restore_state, state)
            except asyncio.CancelledError:
                raise
            except Exception:
                continue


watchdog = NetworkWatchdog()
