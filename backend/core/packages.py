"""How this environment installs into itself: uv builds its tool venvs without pip."""

import shutil
import subprocess
import sys
from pathlib import Path


def uv_tool() -> str:
    parts = Path(sys.prefix).parts
    if "uv" not in parts or "tools" not in parts:
        return ""
    return shutil.which("uv") or ""


def install_command(package: str) -> list[str]:
    uv = uv_tool()
    if uv:
        return [uv, "pip", "install", "--python", sys.executable, "-U", package]
    return [sys.executable, "-m", "pip", "install", "-U", package]


def upgrade_command(distribution: str) -> list[str]:
    uv = uv_tool()
    if uv:
        return [uv, "tool", "upgrade", distribution]
    return [sys.executable, "-m", "pip", "install", "--upgrade", distribution]


def run(command: list[str], timeout: int) -> subprocess.CompletedProcess:
    return subprocess.run(
        command, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace"
    )
