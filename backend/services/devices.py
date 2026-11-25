"""The Android devices adb sees from this machine, pushed to the panel as adb reports them, with the ones it remembers and the emulators of the SDK."""

import asyncio
import os
import re
import secrets
import string
import subprocess
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

import psutil
from loguru import logger

from core import process_tree
from core.db import Session
from core.models import Device
from core.packages import NO_WINDOW
from core.slugs import slug, unique
from services import adb, device_tools, discovery

MISSING = "missing"
INVALID = "invalid"
PAIR_FAILED = "pair"
CONNECT_FAILED = "connect"
EMULATOR_FAILED = "emulator"
SCREENSHOT_FAILED = "screenshot"
SCREENSHOT_COMMAND = "screencap -p"
PNG_SIGNATURE = b"\x89PNG"

READY = "device"
UNAUTHORIZED = "unauthorized"
BOOTING = "booting"
CONNECTING = "connecting"
OFFLINE = "offline"
USB = "usb"
WIFI = "wifi"
EMULATOR = "emulator"

WAITING = "waiting"
PAIRING = "pairing"
PAIRED = "paired"
FAILED = "failed"

FALLBACK_ID = "device"
TRACK_DEVICES = "host:track-devices-l"
PAIRING_SERVICE = discovery.PAIRING_SERVICE
CONNECT_SERVICE = discovery.CONNECT_SERVICE
_CONNECT_SUFFIX = f".{CONNECT_SERVICE}"
_INSTANCE_PREFIX = "adb-"
_AVD_NAME_COMMAND = "avd name"
_EMULATOR_PREFIX = "emulator-"
_EMULATOR_PROGRAMS = ("emulator", "qemu-system")
_AVD_FLAG = "-avd"
_NO_SNAPSHOT_FLAG = "-no-snapshot"
_STOP_TIMEOUT = 10.0
_PAIR_PREFIX = "cconnect-"
_PAIR_NAME_BYTES = 4
_PASSWORD_LENGTH = 12
_PASSWORD_ALPHABET = string.ascii_letters + string.digits
_PAIRED_REPLY = "Successfully paired"
_CONNECTED_REPLIES = ("connected to", "already connected to")
_RECONNECT_SECONDS = 2
_ADDRESS = re.compile(r"^\S+:\d{1,5}$")
_API_LEVEL = re.compile(r"android-(\d+)")
_WINDOWS = os.name == "nt"

SERIAL = "ro.serialno"
MODEL = "ro.product.model"
MARKET_NAME = "ro.product.marketname"
RELEASE = "ro.build.version.release"
SDK = "ro.build.version.sdk"
AVD_NAME = "ro.boot.qemu.avd_name"
LEGACY_AVD_NAME = "ro.kernel.qemu.avd_name"
BOOTED = "sys.boot_completed"
PROPERTIES = (SERIAL, MODEL, MARKET_NAME, RELEASE, SDK, AVD_NAME, LEGACY_AVD_NAME, BOOTED)
_BOOT_WAIT = f'while [ "$(getprop {BOOTED})" != 1 ]; do sleep 1; done'
_BOOT_TIMEOUT = 600

_AVD_HOME = "ANDROID_AVD_HOME"
_USER_HOME = "ANDROID_USER_HOME"
_DISPLAY_NAME = "avd.ini.displayname"
_DEVICE_NAME = "hw.device.name"
_TARGET = "target"


class DeviceError(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _epoch(moment: Optional[datetime]) -> Optional[float]:
    return moment.replace(tzinfo=moment.tzinfo or timezone.utc).timestamp() if moment else None


def _saved_entry(row: Device) -> dict:
    return {"id": row.id, "serial": row.serial, "name": row.name, "model": row.model, "address": row.address, "seen_at": _epoch(row.seen_at)}


def saved() -> list[dict]:
    with Session() as session:
        rows = session.query(Device).order_by(Device.seen_at.desc()).all()
    return [_saved_entry(row) for row in rows]


def _required(row: Optional[Device], device_id: str) -> Device:
    if row is None:
        raise DeviceError(MISSING, device_id)
    return row


def remember(serial: str, name: str, model: str, address: Optional[str]) -> dict:
    with Session() as session:
        row = session.query(Device).filter(Device.serial == serial).one_or_none()
        if row is None:
            taken = {ident for (ident,) in session.query(Device.id)}
            row = Device(id=unique(slug(name) or FALLBACK_ID, taken), serial=serial, name=name, model=model, address=address)
            session.add(row)
        else:
            row.model = model
            row.address = address or row.address
            row.seen_at = datetime.now(timezone.utc)
        session.commit()
        return _saved_entry(row)


def rename(device_id: str, name: str) -> dict:
    if not _text(name):
        raise DeviceError(INVALID)
    with Session() as session:
        row = _required(session.get(Device, device_id), device_id)
        row.name = _text(name)
        session.commit()
        return _saved_entry(row)


def forget(device_id: str) -> None:
    with Session() as session:
        session.delete(_required(session.get(Device, device_id), device_id))
        session.commit()


def find_saved(device_id: str) -> dict:
    with Session() as session:
        return _saved_entry(_required(session.get(Device, device_id), device_id))


def kind_of(serial: str) -> str:
    if serial.startswith(_EMULATOR_PREFIX):
        return EMULATOR
    if serial.endswith(_CONNECT_SUFFIX) or ":" in serial:
        return WIFI
    return USB


def _rows(payload: str) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    for line in payload.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        rows[parts[0]] = {"serial": parts[0], "state": parts[1], "kind": kind_of(parts[0])}
    return rows


def _hardware_of(instance: str) -> str:
    end = instance.rfind("-")
    return instance[len(_INSTANCE_PREFIX):end] if instance.startswith(_INSTANCE_PREFIX) and end > len(_INSTANCE_PREFIX) else ""


def _host_of(address: str) -> str:
    return address.rpartition(":")[0]


def _label(words: str) -> str:
    return " ".join(word[:1].upper() + word[1:] for word in words.replace("_", " ").split())


def _ini(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    with suppress(OSError):
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            key, separator, value = line.partition("=")
            if separator:
                values[key.strip()] = value.strip()
    return values


def avd_home() -> Path:
    if os.environ.get(_AVD_HOME):
        return Path(os.environ[_AVD_HOME])
    return Path(os.environ.get(_USER_HOME) or Path.home() / ".android") / "avd"


def avds() -> list[dict]:
    found = []
    home = avd_home()
    for ini in sorted(home.glob("*.ini")) if home.is_dir() else []:
        name = ini.stem
        header = _ini(ini)
        config = _ini(home / f"{name}.avd" / "config.ini")
        level = _API_LEVEL.search(header.get(_TARGET, ""))
        found.append({
            "name": name,
            "label": config.get(_DISPLAY_NAME) or name,
            "device": _label(config.get(_DEVICE_NAME, "")),
            "api": int(level.group(1)) if level else None,
        })
    return found


def start_emulator(name: str) -> None:
    executable = device_tools.emulator_path()
    if executable is None:
        raise DeviceError(EMULATOR_FAILED, "the SDK has no emulator")
    if name not in {item["name"] for item in avds()}:
        raise DeviceError(MISSING, name)
    try:
        subprocess.Popen(
            [executable, _AVD_FLAG, name, _NO_SNAPSHOT_FLAG],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            cwd=Path.home(), creationflags=NO_WINDOW, start_new_session=not _WINDOWS,
        )
    except OSError as exc:
        raise DeviceError(EMULATOR_FAILED, str(exc)) from exc
    hub.note_launch(name)


def emulator_processes() -> list[tuple[psutil.Process, str]]:
    found = []
    for process in psutil.process_iter(["name", "cmdline"]):
        name = (process.info["name"] or "").lower()
        args = process.info["cmdline"] or []
        if not name.startswith(_EMULATOR_PROGRAMS) or _AVD_FLAG not in args:
            continue
        position = args.index(_AVD_FLAG) + 1
        found.append((process, args[position] if position < len(args) else ""))
    return found


def kill_emulator_process(avd: Optional[str]) -> bool:
    running = emulator_processes()
    targets = [process for process, name in running if name == avd] if avd else [process for process, _name in running]
    if not targets or (not avd and len({name for _process, name in running}) > 1):
        return False
    for process in targets:
        process_tree.terminate(process.pid, _STOP_TIMEOUT)
    return True


def _address(value: str) -> str:
    address = _text(value)
    if not _ADDRESS.match(address):
        raise DeviceError(INVALID, address)
    return address


async def pair(address: str, code: str) -> str:
    try:
        answer = await adb.pair(_address(address), _text(code))
    except adb.AdbError as exc:
        raise DeviceError(PAIR_FAILED, exc.detail) from exc
    if not answer.startswith(_PAIRED_REPLY):
        raise DeviceError(PAIR_FAILED, answer.strip())
    hub.note_paired(_address(address))
    return answer.strip()


async def connect(address: str) -> str:
    target = _address(address)
    try:
        if hub.holds_stale(target):
            await adb.disconnect(target)
        answer = await adb.connect(target)
    except adb.AdbError as exc:
        raise DeviceError(CONNECT_FAILED, exc.detail) from exc
    if not answer.startswith(_CONNECTED_REPLIES):
        raise DeviceError(CONNECT_FAILED, answer.strip())
    return answer.strip()


async def disconnect(serial: str) -> None:
    found = hub.device(serial)
    try:
        if found["kind"] != EMULATOR:
            await adb.disconnect(serial)
        elif found["state"] == READY:
            await adb.kill_emulator(serial)
        elif not await asyncio.to_thread(kill_emulator_process, found["avd"]):
            raise DeviceError(EMULATOR_FAILED, serial)
    except adb.AdbError as exc:
        raise DeviceError(CONNECT_FAILED, exc.detail) from exc


async def stop_emulator(name: str) -> None:
    running = next((item["serial"] for item in hub.snapshot()["emulators"] if item["name"] == name and item["serial"]), None)
    if running:
        await disconnect(running)
    elif not await asyncio.to_thread(kill_emulator_process, name):
        raise DeviceError(MISSING, name)


async def screenshot(serial: str) -> bytes:
    hub.ready_device(serial)
    image = await adb.exec_out(serial, SCREENSHOT_COMMAND)
    if not image.startswith(PNG_SIGNATURE):
        raise DeviceError(SCREENSHOT_FAILED, image.decode("utf-8", "replace").strip())
    return image


class DevicesHub:
    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()
        self._rows: dict[str, dict] = {}
        self._dropped: set[str] = set()
        self._info: dict[str, dict[str, str]] = {}
        self._describing: dict[str, asyncio.Task] = {}
        self._naming: dict[str, asyncio.Task] = {}
        self._avds: dict[str, str] = {}
        self._named: set[str] = set()
        self._launched: list[str] = []
        self._services: list[dict] = []
        self._discovery = discovery.Discovery(self._services_changed)
        self._tried: set[str] = set()
        self._paired_hosts: set[str] = set()
        self._trackers: list[asyncio.Task] = []
        self._listed = asyncio.Event()
        self._failure: Optional[str] = None
        self._installing = False
        self._pairing: Optional[dict] = None
        self._saved: list[dict] = []
        self._loaded = False

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(queue)
        self.start()
        queue.put_nowait(self.snapshot())
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def start(self) -> None:
        if not self._loaded:
            self._saved = saved()
            self._loaded = True
        if any(not task.done() for task in self._trackers) or device_tools.adb_path() is None:
            return
        self._failure = None
        self._trackers = [asyncio.create_task(self._track(TRACK_DEVICES, self._devices_changed))]
        self._discovery.start()

    async def ready(self) -> None:
        self.start()
        if self._trackers:
            await self._listed.wait()

    def close(self) -> None:
        for task in [*self._trackers, *self._describing.values(), *self._naming.values()]:
            task.cancel()
        self._trackers = []
        self._describing = {}
        self._naming = {}
        asyncio.create_task(self._discovery.close())

    def note_paired(self, address: str) -> None:
        self._paired_hosts.add(_host_of(address))
        self._auto_connect()

    def address_for(self, entry: dict) -> Optional[str]:
        return next(
            (item["address"] for item in self._services if item["service"] == CONNECT_SERVICE and _hardware_of(item["instance"]) == entry["serial"]),
            entry["address"],
        )

    def reload_saved(self) -> None:
        self._saved = saved()
        self._publish()

    async def install_tools(self) -> None:
        if self._installing:
            return
        self._installing = True
        self._publish()
        try:
            await asyncio.to_thread(device_tools.install)
        finally:
            self._installing = False
            self._publish()
        self.start()

    def start_pairing(self) -> dict:
        name = f"{_PAIR_PREFIX}{secrets.token_hex(_PAIR_NAME_BYTES)}"
        password = "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(_PASSWORD_LENGTH))
        self._pairing = {"name": name, "password": password, "status": WAITING, "detail": "", "address": ""}
        self._publish()
        return {"name": name, "password": password, "text": f"WIFI:T:ADB;S:{name};P:{password};;"}

    def stop_pairing(self) -> None:
        self._pairing = None
        self._publish()

    def has_emulators(self) -> bool:
        return any(row["kind"] == EMULATOR for row in self._rows.values())

    def note_launch(self, avd: str) -> None:
        self._launched.append(avd)

    def device(self, serial: str) -> dict:
        found = self._rows.get(serial)
        if found is None:
            raise DeviceError(MISSING, serial)
        return self._device(found, self._labels(self._emulators()))

    def holds_stale(self, serial: str) -> bool:
        return serial in self._rows and self._rows[serial]["state"] != READY

    def ready_device(self, serial: str) -> dict:
        found = self.device(serial)
        if found["state"] != READY:
            raise DeviceError(found["state"], serial)
        return found

    def _devices_changed(self, payload: str) -> None:
        rows = _rows(payload)
        for serial in [serial for serial in self._info if serial not in rows or rows[serial]["state"] != READY]:
            self._info.pop(serial, None)
        for serial in [serial for serial in self._describing if serial not in rows or rows[serial]["state"] != READY]:
            self._describing.pop(serial).cancel()
        for serial, row in rows.items():
            if row["kind"] == EMULATOR and serial not in self._rows and serial not in self._avds and self._launched:
                self._avds[serial] = self._launched.pop(0)
            if row["state"] == READY and serial not in self._info and serial not in self._describing:
                self._describing[serial] = asyncio.create_task(self._describe(serial))
            elif row["kind"] == EMULATOR and row["state"] != READY and serial not in self._named and serial not in self._naming:
                self._naming[serial] = asyncio.create_task(self._name_emulator(serial))
        for serial in [serial for serial in self._avds if serial not in rows]:
            del self._avds[serial]
            self._named.discard(serial)
        for serial in [serial for serial in self._naming if serial not in rows]:
            self._naming.pop(serial).cancel()
        self._dropped = {
            serial
            for serial, row in rows.items()
            if row["kind"] == WIFI and row["state"] != READY and (serial in self._dropped or self._rows.get(serial, {}).get("state") == READY)
        }
        self._rows = rows
        self._listed.set()
        self._auto_connect()

    def _emulators(self) -> list[dict]:
        return avds() if device_tools.emulator_path() else []

    def _labels(self, emulators: list[dict]) -> dict[str, str]:
        return {item["name"]: item["label"] for item in emulators}

    def _connected(self) -> set[str]:
        return {self._info[serial][SERIAL] for serial in self._rows if serial in self._info and self._info[serial].get(SERIAL)}

    def _avd_of(self, serial: str) -> str:
        info = self._info.get(serial, {})
        return info.get(AVD_NAME) or info.get(LEGACY_AVD_NAME) or self._avds.get(serial, "")

    def snapshot(self) -> dict:
        running = {self._avd_of(serial): serial for serial in self._rows if kind_of(serial) == EMULATOR}
        emulators = self._emulators()
        labels = self._labels(emulators)
        devices = [self._device(row, labels) for row in self._rows.values() if row["serial"] not in self._dropped]
        listed = {device["saved"] for device in devices if device["saved"]}
        return {
            "type": "state",
            "tools": {**device_tools.status(), "installing": self._installing},
            "failure": self._failure,
            "scanning": not self._listed.is_set(),
            "devices": devices,
            "saved": [{**entry, "address": self.address_for(entry), "connected": entry["id"] in listed} for entry in self._saved],
            "emulators": [{**item, "serial": running.get(item["name"])} for item in emulators],
            "pairing": {key: value for key, value in self._pairing.items() if key != "password"} if self._pairing else None,
        }

    def _saved_for(self, hardware: str) -> Optional[dict]:
        return next((entry for entry in self._saved if entry["serial"] == hardware), None) if hardware else None

    def _kept(self, row: dict, info: dict) -> Optional[dict]:
        """The saved entry of a listed device: by hardware serial, or by Wi-Fi host until adb describes it."""
        kept = self._saved_for(info.get(SERIAL, ""))
        address = self._address_of(row["serial"]) if kept is None and row["kind"] == WIFI else None
        if not address:
            return kept
        return next((entry for entry in self._saved if entry["address"] and _host_of(entry["address"]) == _host_of(address)), None)

    def _address_of(self, serial: str) -> Optional[str]:
        if ":" in serial and not serial.endswith(_CONNECT_SUFFIX):
            return serial
        instance = serial[: -len(_CONNECT_SUFFIX)] if serial.endswith(_CONNECT_SUFFIX) else None
        return next((item["address"] for item in self._services if item["service"] == CONNECT_SERVICE and item["instance"] == instance), None)

    def _device(self, row: dict, labels: Optional[dict[str, str]] = None) -> dict:
        info = self._info.get(row["serial"], {})
        kept = self._kept(row, info)
        sdk = info.get(SDK, "")
        avd = self._avd_of(row["serial"])
        if row["state"] != READY:
            state = BOOTING if row["kind"] == EMULATOR and row["state"] == OFFLINE else row["state"]
        elif not info:
            state = CONNECTING
        else:
            state = READY if info.get(BOOTED) == "1" else BOOTING
        return {
            **row,
            "state": state,
            "name": (kept or {}).get("name") or (labels or {}).get(avd) or info.get(MARKET_NAME) or info.get(MODEL) or row["serial"],
            "model": info.get(MODEL, ""),
            "android": info.get(RELEASE, ""),
            "sdk": int(sdk) if sdk.isdigit() else None,
            "saved": (kept or {}).get("id"),
            "avd": avd or None,
            "address": self._address_of(row["serial"]) if row["kind"] == WIFI else None,
        }

    def _publish(self) -> None:
        snapshot = self.snapshot()
        for queue in list(self._subscribers):
            while not queue.empty():
                queue.get_nowait()
            queue.put_nowait(snapshot)

    async def _track(self, service: str, apply: Callable[[str], None]) -> None:
        while True:
            try:
                async for payload in adb.track(service):
                    apply(payload)
                    self._publish()
            except adb.AdbError as exc:
                self._failure = exc.detail or exc.reason
                self._listed.set()
                self._publish()
                return
            except (asyncio.IncompleteReadError, OSError) as exc:
                logger.debug(f"{service} ended: {exc}")
            await asyncio.sleep(_RECONNECT_SECONDS)

    def _services_changed(self, found: list[dict]) -> None:
        self._services = found
        self._tried &= {item["address"] for item in found}
        pairing = self._pairing
        if pairing and pairing["status"] == WAITING:
            offered = next((item for item in found if item["service"] == PAIRING_SERVICE and item["instance"] == pairing["name"]), None)
            if offered:
                asyncio.create_task(self._pair_offered(pairing, offered["address"]))
        self._auto_connect()
        self._publish()

    def _auto_connect(self) -> None:
        connected = self._connected()
        for item in self._services:
            if item["service"] != CONNECT_SERVICE or item["address"] in self._tried:
                continue
            hardware = _hardware_of(item["instance"])
            known = bool(hardware) and self._saved_for(hardware) is not None and hardware not in connected
            if known or _host_of(item["address"]) in self._paired_hosts:
                self._tried.add(item["address"])
                asyncio.create_task(self._reconnect(item["address"]))

    async def _reconnect(self, address: str) -> None:
        try:
            await connect(address)
        except DeviceError as exc:
            logger.debug(f"{address} could not be connected: {exc}")
            return
        self._paired_hosts.discard(_host_of(address))

    async def _name_emulator(self, serial: str) -> None:
        try:
            port = int(serial[len(_EMULATOR_PREFIX):])
            while serial in self._rows and self._rows[serial]["state"] != READY:
                try:
                    name = await adb.console(port, _AVD_NAME_COMMAND)
                except (adb.AdbError, asyncio.IncompleteReadError, OSError):
                    await asyncio.sleep(_RECONNECT_SECONDS)
                    continue
                if name:
                    self._avds[serial] = name
                    self._named.add(serial)
                    self._publish()
                return
        except ValueError:
            return
        finally:
            self._naming.pop(serial, None)

    async def _pair_offered(self, pairing: dict, address: str) -> None:
        self._pairing = {**pairing, "status": PAIRING, "address": address}
        self._publish()
        try:
            await pair(address, pairing["password"])
        except DeviceError as exc:
            outcome = {"status": FAILED, "detail": exc.detail or exc.reason}
        else:
            outcome = {"status": PAIRED, "detail": ""}
            self.note_paired(address)
        if self._pairing and self._pairing["name"] == pairing["name"]:
            self._pairing = {**self._pairing, **outcome}
            self._publish()

    async def _describe(self, serial: str) -> None:
        try:
            info = await adb.properties(serial, PROPERTIES)
        except (adb.AdbError, asyncio.IncompleteReadError, OSError) as exc:
            logger.debug(f"{serial} could not be described: {exc}")
            return
        finally:
            self._describing.pop(serial, None)
        if serial not in self._rows or self._rows[serial]["state"] != READY:
            return
        self._info[serial] = info
        if info.get(BOOTED) != "1":
            self._describing[serial] = asyncio.create_task(self._await_boot(serial))
        elif kind_of(serial) != EMULATOR and info.get(SERIAL):
            name = info.get(MARKET_NAME) or info.get(MODEL) or serial
            await asyncio.to_thread(remember, info[SERIAL], name, info.get(MODEL, ""), self._address_of(serial))
            self._saved = await asyncio.to_thread(saved)
        self._publish()

    async def _await_boot(self, serial: str) -> None:
        try:
            await adb.shell(serial, _BOOT_WAIT, _BOOT_TIMEOUT)
        except (adb.AdbError, asyncio.IncompleteReadError, OSError) as exc:
            logger.debug(f"{serial} boot wait ended: {exc}")
            self._describing.pop(serial, None)
            return
        self._info.pop(serial, None)
        if serial in self._rows and self._rows[serial]["state"] == READY:
            self._describing[serial] = asyncio.create_task(self._describe(serial))
        else:
            self._describing.pop(serial, None)


hub = DevicesHub()
