"""adb's Wi-Fi debugging services on the local network, found by this process on every interface, which adb's own discovery misses."""

import asyncio
from typing import Callable

from zeroconf import InterfaceChoice, IPVersion, ServiceStateChange, Zeroconf
from zeroconf.asyncio import AsyncServiceBrowser, AsyncServiceInfo, AsyncZeroconf

PAIRING_SERVICE = "_adb-tls-pairing._tcp"
CONNECT_SERVICE = "_adb-tls-connect._tcp"
_LOCAL = ".local."
_TYPES = [f"{PAIRING_SERVICE}{_LOCAL}", f"{CONNECT_SERVICE}{_LOCAL}"]
_RESOLVE_TIMEOUT_MS = 3000


class Discovery:
    def __init__(self, changed: Callable[[list[dict]], None]):
        self._changed = changed
        self._zeroconf: AsyncZeroconf | None = None
        self._browser: AsyncServiceBrowser | None = None
        self._found: dict[str, dict] = {}

    def start(self) -> None:
        if self._zeroconf is not None:
            return
        self._zeroconf = AsyncZeroconf(interfaces=InterfaceChoice.All)
        self._browser = AsyncServiceBrowser(self._zeroconf.zeroconf, _TYPES, handlers=[self._on_change])

    async def close(self) -> None:
        if self._zeroconf is None:
            return
        zeroconf, self._zeroconf, self._browser = self._zeroconf, None, None
        await zeroconf.async_close()

    def _on_change(self, zeroconf: Zeroconf, service_type: str, name: str, state_change: ServiceStateChange) -> None:
        if state_change is ServiceStateChange.Removed:
            if self._found.pop(name, None) is not None:
                self._changed(list(self._found.values()))
        else:
            asyncio.create_task(self._resolve(zeroconf, service_type, name))

    async def _resolve(self, zeroconf: Zeroconf, service_type: str, name: str) -> None:
        info = AsyncServiceInfo(service_type, name)
        if not await info.async_request(zeroconf, _RESOLVE_TIMEOUT_MS) or not info.port:
            return
        addresses = info.parsed_addresses(IPVersion.V4Only)
        if not addresses:
            return
        self._found[name] = {
            "instance": name[: -len(f".{service_type}")],
            "service": service_type[: -len(_LOCAL)],
            "address": f"{addresses[0]}:{info.port}",
        }
        self._changed(list(self._found.values()))
