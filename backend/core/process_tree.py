"""Stopping a process together with everything it started, on every platform."""

import ctypes
import os
import sys
from contextlib import suppress
from typing import Iterable

import psutil

_TIMEOUT = 10
_PR_SET_CHILD_SUBREAPER = 36


def _reapable(target: psutil.Process) -> bool:
    with suppress(psutil.Error, OSError):
        return target.status() != psutil.STATUS_ZOMBIE
    return False


def members(pid: int) -> list[psutil.Process]:
    with suppress(psutil.Error, OSError):
        parent = psutil.Process(pid)
        return [target for target in parent.children(recursive=True) + [parent] if _reapable(target)]
    return []


def _stop(targets: list[psutil.Process], timeout: float) -> None:
    for target in targets:
        with suppress(psutil.Error, OSError):
            target.terminate()
    with suppress(psutil.Error, OSError):
        _, alive = psutil.wait_procs(targets, timeout=timeout)
        for target in alive:
            with suppress(psutil.Error, OSError):
                target.kill()


def terminate(pid: int, timeout: float) -> None:
    _stop(members(pid), timeout)


def terminate_descendants(spared: Iterable[int] = (), timeout: float = _TIMEOUT) -> None:
    """Stops every process below this one, except ``spared`` and what they started."""
    kept = {target.pid for pid in spared for target in members(pid)}
    with suppress(psutil.Error, OSError):
        _stop([target for target in psutil.Process().children(recursive=True) if target.pid not in kept and _reapable(target)], timeout)


def adopt_orphans() -> None:
    """Makes Linux hand this process the orphans of its descendants."""
    if sys.platform.startswith("linux"):
        with suppress(OSError, AttributeError):
            ctypes.CDLL(None).prctl(_PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0)


def reap_adopted(running: int) -> None:
    """Collects the adopted orphans that already exited, all but ``running``."""
    with suppress(psutil.Error, OSError):
        for child in psutil.Process().children():
            if child.pid != running and not _reapable(child):
                with suppress(ChildProcessError, OSError):
                    os.waitpid(child.pid, os.WNOHANG)
