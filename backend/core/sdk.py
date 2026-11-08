"""Claude Agent SDK lifecycle: subscription auth and auto-update on startup."""

import asyncio
import importlib.metadata
import os
import subprocess

from loguru import logger

from core import packages

SDK_PACKAGE = "claude-agent-sdk"
SDK_MODULE = "claude_agent_sdk"
SETTING = "sdk_auto_update"
_INHERITED_AUTH = ("ANTHROPIC_API_KEY", "CLAUDE_SECURESTORAGE_CONFIG_DIR")


def ensure_subscription_auth():
    """Drop the credentials the server inherits, so every CLI bills the account CConnect gives it."""
    for name in _INHERITED_AUTH:
        if os.environ.pop(name, None):
            logger.info(f"Removed {name} from the process env; each CLI gets its account's own.")


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
        packages.install_command(SDK_PACKAGE),
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
            f"Run: {' '.join(packages.install_command(SDK_PACKAGE))}"
        )
    logger.info(f"{SDK_PACKAGE} ready (v{version}).")


def sdk_status() -> dict:
    return {"package": SDK_PACKAGE, "version": installed_version()}
