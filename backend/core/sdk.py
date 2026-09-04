"""Claude Agent SDK lifecycle: subscription auth and auto-update on startup."""

import asyncio
import importlib.metadata
import os
import subprocess
import sys

from loguru import logger

SDK_PACKAGE = "claude-agent-sdk"
SDK_MODULE = "claude_agent_sdk"
SETTING = "sdk_auto_update"


def ensure_subscription_auth():
    """Drop ANTHROPIC_API_KEY so the SDK falls back to the Claude Code CLI OAuth
    (the user's subscription). An exported key silently wins and bills API credits."""
    if os.environ.pop("ANTHROPIC_API_KEY", None):
        logger.info("Removed ANTHROPIC_API_KEY from the process env; using subscription auth.")


def installed_version() -> str | None:
    try:
        return importlib.metadata.version(SDK_PACKAGE)
    except importlib.metadata.PackageNotFoundError:
        return None


async def update_sdk() -> dict:
    """Upgrade the SDK with a fixed argument list (no shell), in a worker thread so it does
    not depend on the event loop type: Windows SelectorEventLoop cannot spawn subprocesses."""
    logger.info(f"Updating {SDK_PACKAGE}...")
    result = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "pip", "install", "-U", SDK_PACKAGE],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.warning(f"SDK update failed:\n{result.stdout}{result.stderr}")
    return {**sdk_status(), "ok": result.returncode == 0, "message": (result.stderr or result.stdout).strip()}


async def ensure_sdk_installed():
    """Install or upgrade the SDK. Falls back to whatever is already present if the
    pip call fails; only raises when the SDK is missing entirely."""
    from services import settings_store

    if settings_store.get(SETTING):
        await update_sdk()

    version = installed_version()
    if version is None:
        raise RuntimeError(
            f"{SDK_PACKAGE} is not installed and could not be installed automatically. "
            f"Run: {sys.executable} -m pip install {SDK_PACKAGE}"
        )
    logger.info(f"{SDK_PACKAGE} ready (v{version}).")


def sdk_status() -> dict:
    return {"package": SDK_PACKAGE, "version": installed_version()}
