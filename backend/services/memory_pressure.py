"""The operating system's own low-memory signal, waited on in a sleeping thread, which lets idle chats go."""

from __future__ import annotations

import asyncio
import os
import select
import sys
import threading
from typing import Callable

from loguru import logger

_PSI_FILE = "/proc/pressure/memory"
_PSI_TRIGGER = b"some 500000 2000000\0"
_EVFILT_MEMORYSTATUS = -14
_NOTE_PRESSURE_WARN = 0x2
_NOTE_PRESSURE_CRITICAL = 0x4
_LOW_MEMORY = 0
_HIGH_MEMORY = 1
_INFINITE = 0xFFFFFFFF


def _windows(signal: Callable[[], None]) -> None:
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateMemoryResourceNotification.restype = wintypes.HANDLE
    kernel32.CreateMemoryResourceNotification.argtypes = [ctypes.c_int]
    kernel32.WaitForSingleObject.restype = wintypes.DWORD
    kernel32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    low = kernel32.CreateMemoryResourceNotification(_LOW_MEMORY)
    high = kernel32.CreateMemoryResourceNotification(_HIGH_MEMORY)
    if not low or not high:
        return
    while True:
        kernel32.WaitForSingleObject(low, _INFINITE)
        signal()
        kernel32.WaitForSingleObject(high, _INFINITE)


def _linux(signal: Callable[[], None]) -> None:
    fd = os.open(_PSI_FILE, os.O_RDWR | os.O_NONBLOCK)
    try:
        os.write(fd, _PSI_TRIGGER)
        poller = select.poll()
        poller.register(fd, select.POLLPRI)
        while True:
            for _, event in poller.poll():
                if event & select.POLLERR:
                    return
                if event & select.POLLPRI:
                    signal()
    finally:
        os.close(fd)


def _macos(signal: Callable[[], None]) -> None:
    queue = select.kqueue()
    try:
        queue.control([select.kevent(
            0,
            filter=_EVFILT_MEMORYSTATUS,
            flags=select.KQ_EV_ADD,
            fflags=_NOTE_PRESSURE_WARN | _NOTE_PRESSURE_CRITICAL,
        )], 0)
        while True:
            if queue.control(None, 1):
                signal()
    finally:
        queue.close()


def _waiter() -> Callable[[Callable[[], None]], None] | None:
    if sys.platform == "win32":
        return _windows
    if sys.platform == "darwin":
        return _macos
    return _linux if os.path.exists(_PSI_FILE) else None


def watch(relieve: Callable[[], object]) -> None:
    """Run ``relieve`` on the loop each time the system says memory is running out."""
    wait = _waiter()
    if wait is None:
        return
    loop = asyncio.get_running_loop()

    def signal() -> None:
        loop.call_soon_threadsafe(lambda: asyncio.ensure_future(relieve()))

    def run() -> None:
        try:
            wait(signal)
        except Exception as exc:
            logger.debug(f"memory pressure signal unavailable: {type(exc).__name__}: {exc}")

    threading.Thread(target=run, name="memory-pressure", daemon=True).start()
