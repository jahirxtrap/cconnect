"""The official Agent Client Protocol catalog and the distribution of each agent this machine can run."""

import platform
import shutil
from typing import NamedTuple, Optional

import httpx

REGISTRY_URL = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json"
TIMEOUT = 30.0

BINARY = "binary"
PYTHON = "uvx"
NPM = "npx"

NEEDS_NODE = "node"
NEEDS_PLATFORM = "platform"

SYSTEMS = {"Darwin": "darwin", "Linux": "linux", "Windows": "windows"}
ARCHES = {"x86_64": "x86_64", "amd64": "x86_64", "arm64": "aarch64", "aarch64": "aarch64"}


class RegistryError(Exception):
    pass


class Runnable(NamedTuple):
    kind: Optional[str]
    spec: Optional[dict]
    needs: Optional[str]


def platform_key() -> Optional[str]:
    system = SYSTEMS.get(platform.system())
    arch = ARCHES.get(platform.machine().lower())
    return f"{system}-{arch}" if system and arch else None


def node_tools() -> Optional[tuple[str, str]]:
    node, npm = shutil.which("node"), shutil.which("npm")
    return (node, npm) if node and npm else None


def catalog() -> list[dict]:
    try:
        answer = httpx.get(REGISTRY_URL, timeout=TIMEOUT, follow_redirects=True)
        answer.raise_for_status()
        agents = answer.json().get("agents")
    except (httpx.HTTPError, ValueError, AttributeError) as exc:
        raise RegistryError(str(exc) or type(exc).__name__) from None
    if not isinstance(agents, list):
        return []
    return [item for item in agents if isinstance(item, dict) and item.get("id") and item.get("version")]


def entry(agent_id: str) -> Optional[dict]:
    return next((item for item in catalog() if item["id"] == agent_id), None)


def runnable(item: dict) -> Runnable:
    """The distribution this machine runs, or why none of them fits it."""
    distribution = item.get("distribution") or {}
    binary = (distribution.get(BINARY) or {}).get(platform_key() or "")
    if isinstance(binary, dict) and binary.get("archive") and binary.get("cmd"):
        return Runnable(BINARY, binary, None)
    python = distribution.get(PYTHON)
    if isinstance(python, dict) and python.get("package"):
        return Runnable(PYTHON, python, None)
    npm = distribution.get(NPM)
    if isinstance(npm, dict) and npm.get("package"):
        return Runnable(NPM, npm, None) if node_tools() else Runnable(None, None, NEEDS_NODE)
    return Runnable(None, None, NEEDS_PLATFORM)


def icon(item: dict) -> Optional[bytes]:
    url = item.get("icon")
    if not isinstance(url, str) or not url:
        return None
    try:
        answer = httpx.get(url, timeout=TIMEOUT, follow_redirects=True)
        answer.raise_for_status()
    except httpx.HTTPError:
        return None
    return answer.content
