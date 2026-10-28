import ctypes
import sys
from ctypes import wintypes
from functools import cache
from typing import Optional

_KILL_ON_JOB_CLOSE = 0x2000
_EXTENDED_LIMIT_INFORMATION = 9
_PROCESS_TERMINATE = 0x0001
_PROCESS_SET_QUOTA = 0x0100


class _BasicLimits(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64),
        ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class _IoCounters(ctypes.Structure):
    _fields_ = [
        (name, ctypes.c_uint64)
        for name in (
            "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
            "ReadTransferCount", "WriteTransferCount", "OtherTransferCount",
        )
    ]


class _ExtendedLimits(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", _BasicLimits),
        ("IoInfo", _IoCounters),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


_job: Optional[int] = None


@cache
def _kernel32():
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel32.SetInformationJobObject.restype = wintypes.BOOL
    kernel32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    return kernel32


def _ensure_job(kernel32) -> Optional[int]:
    global _job
    if _job is None:
        job = kernel32.CreateJobObjectW(None, None)
        limits = _ExtendedLimits()
        limits.BasicLimitInformation.LimitFlags = _KILL_ON_JOB_CLOSE
        if job and kernel32.SetInformationJobObject(
            job, _EXTENDED_LIMIT_INFORMATION, ctypes.byref(limits), ctypes.sizeof(limits)
        ):
            _job = job
    return _job


def tie(pid: int) -> None:
    if sys.platform != "win32":
        return
    kernel32 = _kernel32()
    job = _ensure_job(kernel32)
    if job is None:
        return
    process = kernel32.OpenProcess(_PROCESS_TERMINATE | _PROCESS_SET_QUOTA, False, pid)
    if process:
        kernel32.AssignProcessToJobObject(job, process)
        kernel32.CloseHandle(process)
