"""Stopping a process together with everything it started, on every platform."""

from contextlib import suppress

import psutil


def _reapable(target: psutil.Process) -> bool:
    with suppress(psutil.Error, OSError):
        return target.status() != psutil.STATUS_ZOMBIE
    return False


def members(pid: int) -> list[psutil.Process]:
    with suppress(psutil.Error, OSError):
        parent = psutil.Process(pid)
        return [target for target in parent.children(recursive=True) + [parent] if _reapable(target)]
    return []


def terminate(pid: int, timeout: float) -> None:
    targets = members(pid)
    for target in targets:
        with suppress(psutil.Error, OSError):
            target.terminate()
    with suppress(psutil.Error, OSError):
        _, alive = psutil.wait_procs(targets, timeout=timeout)
        for target in alive:
            with suppress(psutil.Error, OSError):
                target.kill()
