"""A real Chromium driven over CDP and streamed as frames.

Targets are discovered, not owned: a page opened by another CDP client attached to the
same browser shows up in the pane as one more tab.
"""

import asyncio
import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from loguru import logger
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from core.config import (
    BROWSER_DEBUG_PORT,
    BROWSER_EXECUTABLE,
    BROWSER_HEADLESS,
    BROWSER_PROFILE_DIR,
    BROWSER_QUALITY,
)

_LAUNCH_TIMEOUT = 20.0
_ENDPOINT_POLL = 0.15
_CLOSE_TIMEOUT = 5.0
_LOAD_TIMEOUT = 20.0
_MAX_PENDING_FRAMES = 2
_DEFAULT_WIDTH = 1024
_DEFAULT_HEIGHT = 768
_MIN_WIDTH = 320
_MIN_HEIGHT = 240
_MAX_SCALE = 3.0
_HOME = "about:blank"
_PAGE_EVENTS = ("Page.frameNavigated", "Page.navigatedWithinDocument", "Page.loadEventFired")

_PHONE_AGENT = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko)"
    " Chrome/125.0.0.0 Mobile Safari/537.36"
)
_TABLET_AGENT = (
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)"
    " Version/17.0 Mobile/15E148 Safari/604.1"
)
_DESCRIBE = """function() {
  const parts = [];
  let node = this;
  while (node && node.nodeType === 1 && parts.length < 6) {
    if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break; }
    let part = node.tagName.toLowerCase();
    part += [...node.classList].slice(0, 2).map((name) => '.' + CSS.escape(name)).join('');
    const parent = node.parentElement;
    if (parent) {
      const same = [...parent.children].filter((item) => item.tagName === node.tagName);
      if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  const box = this.getBoundingClientRect();
  return JSON.stringify({
    selector: parts.join(' > '),
    text: (this.innerText || '').trim().slice(0, 200),
    html: this.outerHTML.slice(0, 800),
    width: Math.round(box.width),
    height: Math.round(box.height)
  });
}"""

_CURSOR_BINDING = "cconnectCursor"

_CURSOR_SCRIPT = """(() => {
  if (window.__cconnectCursor) return;
  window.__cconnectCursor = true;
  let last = '';
  const report = (event) => {
    const node = event.target instanceof Element ? event.target : document.body;
    if (!node) return;
    let shape = getComputedStyle(node).cursor || 'auto';
    if (shape === 'auto') {
      const typing = node.isContentEditable || /^(input|textarea)$/i.test(node.tagName);
      const words = Array.prototype.some.call(
        node.childNodes || [],
        (child) => child.nodeType === 3 && child.textContent.trim()
      );
      shape = typing || words ? 'text' : 'default';
    }
    if (shape === last) return;
    last = shape;
    if (window.cconnectCursor) window.cconnectCursor(shape);
  };
  addEventListener('mousemove', report, true);
  addEventListener('mouseover', report, true);
})();"""

_HIGHLIGHT = {
    "showInfo": True,
    "contentColor": {"r": 111, "g": 168, "b": 220, "a": 0.45},
    "paddingColor": {"r": 147, "g": 196, "b": 125, "a": 0.35},
    "marginColor": {"r": 246, "g": 178, "b": 107, "a": 0.35},
}

_DEVICES: dict[str, dict[str, Any]] = {
    "mobile": {"width": 390, "height": 844, "scale": 3, "touch": True, "agent": _PHONE_AGENT},
    "tablet": {"width": 820, "height": 1180, "scale": 2, "touch": True, "agent": _TABLET_AGENT},
}

_WINDOWS_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
)
_MACOS_CANDIDATES = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
)
_LINUX_CANDIDATES = ("google-chrome", "chromium", "chromium-browser", "microsoft-edge")


def executable() -> Optional[str]:
    if BROWSER_EXECUTABLE and Path(BROWSER_EXECUTABLE).is_file():
        return BROWSER_EXECUTABLE
    if os.name == "nt":
        return next((path for path in _WINDOWS_CANDIDATES if Path(path).is_file()), None)
    if sys.platform == "darwin":
        return next((path for path in _MACOS_CANDIDATES if Path(path).is_file()), None)
    return next((found for name in _LINUX_CANDIDATES if (found := shutil.which(name))), None)


def endpoint() -> str:
    return _endpoint(BROWSER_DEBUG_PORT) or ""


def http_endpoint() -> str:
    return f"http://127.0.0.1:{BROWSER_DEBUG_PORT}"


async def ready_endpoint() -> str:
    if not session.running:
        try:
            await session.ensure(_DEFAULT_WIDTH, _DEFAULT_HEIGHT, 1.0)
        except (RuntimeError, OSError) as exc:
            logger.info(f"browser: not available for playwright ({exc})")
            return ""
    return endpoint()


def _kill_tree(pid: int):
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW,
            check=False,
        )
        return
    subprocess.run(["pkill", "-TERM", "-P", str(pid)], check=False)


def _endpoint(port: int) -> Optional[str]:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1) as response:
            return json.loads(response.read()).get("webSocketDebuggerUrl")
    except (urllib.error.URLError, OSError, ValueError):
        return None


@dataclass
class _Tab:
    id: str
    target: str
    session: str
    url: str = ""
    title: str = ""


class _Cdp:
    def __init__(self, socket):
        self._socket = socket
        self._last_id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self.events: asyncio.Queue = asyncio.Queue()
        self.closed = False

    def _envelope(self, method: str, params: Optional[dict], session: str) -> dict:
        self._last_id += 1
        message: dict[str, Any] = {"id": self._last_id, "method": method, "params": params or {}}
        if session:
            message["sessionId"] = session
        return message

    async def call(self, method: str, params: Optional[dict] = None, session: str = "") -> dict:
        if self.closed:
            raise RuntimeError("cdp closed")
        message = self._envelope(method, params, session)
        future = asyncio.get_running_loop().create_future()
        self._pending[message["id"]] = future
        await self._socket.send(json.dumps(message))
        return await future

    async def post(self, method: str, params: Optional[dict] = None, session: str = ""):
        if self.closed:
            raise RuntimeError("cdp closed")
        await self._socket.send(json.dumps(self._envelope(method, params, session)))

    async def pump(self):
        async for raw in self._socket:
            message = json.loads(raw)
            identifier = message.get("id")
            if identifier is None:
                self.events.put_nowait(message)
                continue
            future = self._pending.pop(identifier, None)
            if future is None or future.done():
                continue
            error = message.get("error")
            if error:
                future.set_exception(RuntimeError(error.get("message") or "cdp error"))
            else:
                future.set_result(message.get("result") or {})

    async def close(self):
        await self._socket.close()

    def fail_pending(self, exc: BaseException):
        self.closed = True
        for future in self._pending.values():
            if not future.done():
                future.set_exception(exc)
        self._pending.clear()


class BrowserSession:
    def __init__(self):
        self._process: Optional[subprocess.Popen] = None
        self._cdp: Optional[_Cdp] = None
        self._tasks: list[asyncio.Task] = []
        self._tabs: dict[str, _Tab] = {}
        self._known: set[str] = set()
        self._active = ""
        self._counter = 0
        self._subscribers: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()
        self._registry = asyncio.Lock()
        self._width = _DEFAULT_WIDTH
        self._height = _DEFAULT_HEIGHT
        self._scale = 1.0
        self._device = ""
        self._picking = False
        self._settling: Optional[asyncio.Task] = None
        self._loaded = asyncio.Event()
        self._back = False
        self._forward = False

    @property
    def running(self) -> bool:
        return self._cdp is not None and not self._cdp.closed

    @property
    def _page(self) -> str:
        tab = self._tabs.get(self._active)
        return tab.session if tab else ""

    def status(self) -> dict:
        tab = self._tabs.get(self._active)
        device = _DEVICES.get(self._device)
        return {
            "device": self._device,
            "picking": self._picking,
            "deviceWidth": device["width"] if device else 0,
            "deviceHeight": device["height"] if device else 0,
            "running": self.running,
            "available": executable() is not None,
            "headless": BROWSER_HEADLESS,
            "viewers": len(self._subscribers),
            "width": self._width,
            "height": self._height,
            "pageWidth": device["width"] if device else int(self._width * self._scale),
            "pageHeight": device["height"] if device else int(self._height * self._scale),
            "url": tab.url if tab else "",
            "title": tab.title if tab else "",
            "canGoBack": self._back,
            "canGoForward": self._forward,
            "activeTab": self._active,
            "tabs": [
                {"id": item.id, "url": item.url, "title": item.title} for item in self._tabs.values()
            ],
        }

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self._subscribers.discard(queue)

    async def ensure(self, width: int, height: int, scale: float):
        async with self._lock:
            fresh = False
            if not self.running:
                await self._teardown()
                await self._launch()
                await self._discover()
                fresh = True
            elif not self._tabs:
                await self._discover()
                fresh = True
            await self._apply_viewport(width, height, scale, force=fresh)
            await self._kick()

    async def stop(self):
        async with self._lock:
            await self._teardown()

    async def navigate(self, url: str):
        target = url.strip()
        if not target:
            return
        if "://" not in target:
            target = f"https://{target}"
        self._loaded.clear()
        await self._cdp.call("Page.navigate", {"url": target}, self._page)

    async def await_load(self, timeout: float = _LOAD_TIMEOUT) -> bool:
        try:
            await asyncio.wait_for(self._loaded.wait(), timeout)
        except asyncio.TimeoutError:
            return False
        await self._refresh()
        return True

    async def reload(self):
        await self._cdp.call("Page.reload", {}, self._page)

    async def go(self, delta: int):
        history = await self._cdp.call("Page.getNavigationHistory", {}, self._page)
        entries = history.get("entries") or []
        index = int(history.get("currentIndex") or 0) + delta
        if 0 <= index < len(entries):
            await self._cdp.call(
                "Page.navigateToHistoryEntry", {"entryId": entries[index]["id"]}, self._page
            )

    async def open_tab(self, url: str = "") -> str:
        created = await self._cdp.call("Target.createTarget", {"url": url or _HOME})
        target_id = created["targetId"]
        await self._register(target_id, url)
        tab = next((item for item in self._tabs.values() if item.target == target_id), None)
        if tab is None:
            return ""
        await self.switch_tab(tab.id)
        return tab.id

    async def reorder(self, ids: list[str]):
        ordered = {item: self._tabs[item] for item in ids if item in self._tabs}
        for tab_id, tab in self._tabs.items():
            ordered.setdefault(tab_id, tab)
        self._tabs = ordered
        self._publish(("state", self.status()))

    async def close_tab(self, tab_id: str):
        tab = self._tabs.get(tab_id)
        if tab is not None:
            await self._cdp.call("Target.closeTarget", {"targetId": tab.target})

    async def switch_tab(self, tab_id: str):
        if tab_id not in self._tabs or tab_id == self._active:
            return
        async with self._lock:
            await self._stop_stream()
            self._active = tab_id
            await self._cdp.call("Target.activateTarget", {"targetId": self._tabs[tab_id].target})
            await self._start_stream()
        await self._refresh()

    async def resize(self, width: int, height: int, scale: float):
        async with self._lock:
            if self.running:
                await self._apply_viewport(width, height, scale)

    async def mouse(self, payload: dict):
        params = {
            "type": payload.get("event") or "mouseMoved",
            "x": float(payload.get("x") or 0),
            "y": float(payload.get("y") or 0),
            "button": payload.get("button") or "none",
            "buttons": int(payload.get("buttons") or 0),
            "clickCount": int(payload.get("clickCount") or 0),
            "modifiers": int(payload.get("modifiers") or 0),
        }
        if params["type"] == "mouseWheel":
            params["deltaX"] = float(payload.get("deltaX") or 0)
            params["deltaY"] = float(payload.get("deltaY") or 0)
        await self._cdp.call("Input.dispatchMouseEvent", params, self._page)

    async def key(self, payload: dict):
        params = {
            "type": payload.get("event") or "keyDown",
            "key": payload.get("key") or "",
            "code": payload.get("code") or "",
            "modifiers": int(payload.get("modifiers") or 0),
            "windowsVirtualKeyCode": int(payload.get("keyCode") or 0),
            "nativeVirtualKeyCode": int(payload.get("keyCode") or 0),
        }
        text = payload.get("text")
        if text:
            params["text"] = text
            params["unmodifiedText"] = text
        await self._cdp.call("Input.dispatchKeyEvent", params, self._page)

    async def clip(self, cut: bool):
        page = self._page
        if not page:
            return
        picked = await self._cdp.call(
            "Runtime.evaluate",
            {"expression": "String(document.getSelection() || '')", "returnByValue": True},
            page,
        )
        text = (picked.get("result") or {}).get("value") or ""
        if cut and text:
            await self._cdp.call(
                "Runtime.evaluate", {"expression": "document.execCommand('cut')"}, page
            )
        self._publish(("clipboard", {"text": text}))

    async def insert(self, text: str):
        if text:
            await self._cdp.call("Input.insertText", {"text": text}, self._page)

    async def _launch(self):
        binary = executable()
        if binary is None:
            raise RuntimeError("no_browser")
        profile = Path(BROWSER_PROFILE_DIR)
        profile.mkdir(parents=True, exist_ok=True)
        arguments = [
            binary,
            f"--remote-debugging-port={BROWSER_DEBUG_PORT}",
            f"--user-data-dir={profile}",
            "--remote-allow-origins=*",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            _HOME,
        ]
        if BROWSER_HEADLESS:
            arguments.insert(1, "--headless=new")
        creation = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        self._process = subprocess.Popen(
            arguments,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation,
        )

        target = None
        deadline = asyncio.get_running_loop().time() + _LAUNCH_TIMEOUT
        while target is None and asyncio.get_running_loop().time() < deadline:
            target = await asyncio.to_thread(_endpoint, BROWSER_DEBUG_PORT)
            if target is None:
                await asyncio.sleep(_ENDPOINT_POLL)
        if target is None:
            await self._teardown()
            raise RuntimeError("no_endpoint")

        socket = await connect(target, max_size=None, ping_interval=None)
        self._cdp = _Cdp(socket)
        self._tasks = [
            asyncio.create_task(self._pump()),
            asyncio.create_task(self._consume()),
        ]
        logger.info(f"browser: attached to {binary}")

    async def _discover(self):
        self._known = {tab.target for tab in self._tabs.values()}
        await self._cdp.call("Target.setDiscoverTargets", {"discover": True})
        found = await self._cdp.call("Target.getTargets")
        for info in found.get("targetInfos") or []:
            if info.get("type") == "page":
                await self._register(info["targetId"], info.get("url") or "", info.get("title") or "")
        if not self._tabs:
            created = await self._cdp.call("Target.createTarget", {"url": _HOME})
            await self._register(created["targetId"])
        if not self._active and self._tabs:
            self._active = next(iter(self._tabs))

    async def _register(self, target_id: str, url: str = "", title: str = "") -> Optional[_Tab]:
        async with self._registry:
            return await self._attach(target_id, url, title)

    async def _attach(self, target_id: str, url: str, title: str) -> Optional[_Tab]:
        if target_id in self._known:
            return None
        self._known.add(target_id)
        try:
            attached = await self._cdp.call(
                "Target.attachToTarget", {"targetId": target_id, "flatten": True}
            )
        except RuntimeError:
            self._known.discard(target_id)
            return None
        self._counter += 1
        tab = _Tab(
            id=f"t{self._counter}", target=target_id, session=attached["sessionId"], url=url, title=title
        )
        self._tabs[tab.id] = tab
        await self._cdp.call("Page.enable", {}, tab.session)
        await self._cdp.call("Runtime.enable", {}, tab.session)
        await self._cdp.call("Runtime.addBinding", {"name": _CURSOR_BINDING}, tab.session)
        await self._cdp.call(
            "Page.addScriptToEvaluateOnNewDocument", {"source": _CURSOR_SCRIPT}, tab.session
        )
        await self._cdp.call(
            "Runtime.evaluate", {"expression": _CURSOR_SCRIPT}, tab.session
        )
        return tab

    async def _drop(self, target_id: str):
        self._known.discard(target_id)
        gone = next((item for item in self._tabs.values() if item.target == target_id), None)
        if gone is None:
            return
        self._tabs.pop(gone.id, None)
        if self._active != gone.id:
            self._publish(("state", self.status()))
            return
        self._active = next(iter(self._tabs), "")
        if not self._active:
            self._publish(("state", self.status()))
            await self.open_tab()
            return
        await self._start_stream()
        await self._refresh()

    def _metrics(self) -> tuple[int, int, dict]:
        device = _DEVICES.get(self._device)
        if device is None:
            width = int(self._width * self._scale)
            height = int(self._height * self._scale)
            return width, height, {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False}
        width = int(device["width"] * device["scale"])
        height = int(device["height"] * device["scale"])
        return width, height, {
            "width": device["width"],
            "height": device["height"],
            "deviceScaleFactor": device["scale"],
            "mobile": True,
        }

    async def set_picking(self, enabled: bool):
        page = self._page
        if not page:
            return
        self._picking = enabled
        await self._cdp.call("DOM.enable", {}, page)
        await self._cdp.call("Overlay.enable", {}, page)
        await self._cdp.call(
            "Overlay.setInspectMode",
            {"mode": "searchForNode" if enabled else "none", "highlightConfig": _HIGHLIGHT},
            page,
        )
        self._publish(("state", self.status()))

    async def _picked(self, backend_node_id: int, session: str):
        self._picking = False
        await self._cdp.call(
            "Overlay.setInspectMode", {"mode": "none", "highlightConfig": _HIGHLIGHT}, session
        )
        resolved = await self._cdp.call("DOM.resolveNode", {"backendNodeId": backend_node_id}, session)
        handle = (resolved.get("object") or {}).get("objectId")
        if handle:
            described = await self._cdp.call(
                "Runtime.callFunctionOn",
                {"objectId": handle, "functionDeclaration": _DESCRIBE, "returnByValue": True},
                session,
            )
            body = (described.get("result") or {}).get("value")
            if body:
                self._publish(("picked", json.loads(body)))
        self._publish(("state", self.status()))

    async def set_device(self, name: str):
        if name == self._device or (name and name not in _DEVICES):
            return
        async with self._lock:
            self._device = name if name in _DEVICES else ""
            await self._stop_stream()
            await self._apply_agent()
            await self._start_stream()
        self._publish(("state", self.status()))

    async def _apply_agent(self):
        page = self._page
        if not page:
            return
        device = _DEVICES.get(self._device)
        touch = bool(device and device["touch"])
        await self._cdp.call(
            "Emulation.setTouchEmulationEnabled",
            {"enabled": touch, "maxTouchPoints": 5 if touch else 1},
            page,
        )
        await self._cdp.call(
            "Emulation.setEmitTouchEventsForMouse",
            {"enabled": touch, "configuration": "mobile" if touch else "desktop"},
            page,
        )
        await self._cdp.call(
            "Emulation.setUserAgentOverride",
            {"userAgent": device["agent"] if device else ""},
            page,
        )

    async def _start_stream(self):
        page = self._page
        if not page:
            return
        raster_width, raster_height, metrics = self._metrics()
        await self._cdp.call("Emulation.setDeviceMetricsOverride", metrics, page)
        await self._cdp.call(
            "Page.startScreencast",
            {
                "format": "jpeg",
                "quality": BROWSER_QUALITY,
                "maxWidth": raster_width,
                "maxHeight": raster_height,
                "everyNthFrame": 1,
            },
            page,
        )
        await self._kick()

    async def shot(self) -> bytes:
        page = self._page
        if not page:
            return b""
        try:
            taken = await self._cdp.call(
                "Page.captureScreenshot", {"format": "jpeg", "quality": BROWSER_QUALITY}, page
            )
        except (RuntimeError, ConnectionClosed, OSError):
            return b""
        return base64.b64decode(taken.get("data") or "")

    async def text(self) -> str:
        page = self._page
        if not page:
            return ""
        read = await self._cdp.call(
            "Runtime.evaluate",
            {"expression": "String(document.body ? document.body.innerText : '')", "returnByValue": True},
            page,
        )
        return (read.get("result") or {}).get("value") or ""

    async def _kick(self):
        frame = await self.shot()
        if frame:
            self._publish(("frame", frame))

    async def _stop_stream(self):
        page = self._page
        if page:
            try:
                await self._cdp.call("Page.stopScreencast", {}, page)
            except RuntimeError:
                pass

    async def _apply_viewport(self, width: int, height: int, scale: float, force: bool = False):
        width = max(_MIN_WIDTH, int(width or _DEFAULT_WIDTH))
        height = max(_MIN_HEIGHT, int(height or _DEFAULT_HEIGHT))
        scale = min(_MAX_SCALE, max(1.0, float(scale or 1.0)))
        if not force and (width, height, scale) == (self._width, self._height, self._scale):
            return
        self._width, self._height, self._scale = width, height, scale
        await self._stop_stream()
        await self._start_stream()
        self._publish(("state", self.status()))

    async def _pump(self):
        cdp = self._cdp
        try:
            await cdp.pump()
        except (ConnectionClosed, OSError):
            pass
        finally:
            cdp.fail_pending(ConnectionClosed(None, None))
            self._publish(("state", {**self.status(), "running": False}))

    async def _consume(self):
        while True:
            message = await self._cdp.events.get()
            method = message.get("method")
            params = message.get("params") or {}
            session = message.get("sessionId") or ""
            try:
                await self._handle(method, params, session)
            except (ConnectionClosed, OSError) as exc:
                logger.info(f"browser: stream closed ({exc})")
                return
            except (RuntimeError, KeyError) as exc:
                logger.info(f"browser: {method} failed ({exc})")

    async def _handle(self, method: str, params: dict, session: str):
        if method == "Page.screencastFrame":
            if session != self._page:
                return
            await self._cdp.post(
                "Page.screencastFrameAck", {"sessionId": params.get("sessionId")}, session
            )
            self._publish(("frame", base64.b64decode(params.get("data") or "")))
            return
        if method == "Runtime.bindingCalled":
            if params.get("name") == _CURSOR_BINDING and session == self._page:
                self._publish(("cursor", {"shape": params.get("payload") or "auto"}))
            return
        if method == "Overlay.inspectNodeRequested" and session == self._page:
            await self._picked(int(params.get("backendNodeId") or 0), session)
            return
        if method == "Target.targetCreated":
            info = params.get("targetInfo") or {}
            if info.get("type") == "page":
                tab = await self._register(info["targetId"], info.get("url") or "", info.get("title") or "")
                if tab is not None and self._idle():
                    await self.switch_tab(tab.id)
                self._publish(("state", self.status()))
            return
        if method == "Target.targetDestroyed":
            await self._drop(params.get("targetId") or "")
            return
        if method == "Target.targetInfoChanged":
            info = params.get("targetInfo") or {}
            tab = next((item for item in self._tabs.values() if item.target == info.get("targetId")), None)
            if tab is not None:
                tab.url = info.get("url") or tab.url
                tab.title = info.get("title") or ""
                self._publish(("state", self.status()))
            return
        if method in _PAGE_EVENTS and session == self._page:
            if method == "Page.loadEventFired":
                self._loaded.set()
            self._schedule(self._settle(method == "Page.loadEventFired"))

    def _idle(self) -> bool:
        tab = self._tabs.get(self._active)
        return tab is None or not tab.url or tab.url.startswith("about:")

    def _schedule(self, work):
        if self._settling is not None and not self._settling.done():
            work.close()
            return
        self._settling = asyncio.create_task(work)

    async def _settle(self, loaded: bool):
        try:
            await self._refresh()
            if loaded:
                await self._kick()
        except (RuntimeError, ConnectionClosed, OSError, KeyError):
            return

    async def _refresh(self):
        page = self._page
        if not page:
            return
        history = await self._cdp.call("Page.getNavigationHistory", {}, page)
        entries = history.get("entries") or []
        index = int(history.get("currentIndex") or 0)
        current = entries[index] if 0 <= index < len(entries) else {}
        tab = self._tabs.get(self._active)
        if tab is not None:
            tab.url = current.get("url") or ""
            tab.title = current.get("title") or ""
        self._back = index > 0
        self._forward = index < len(entries) - 1
        self._publish(("state", self.status()))

    def _publish(self, item: tuple[str, Any]):
        for queue in list(self._subscribers):
            if item[0] == "frame":
                kept = []
                while not queue.empty():
                    pending = queue.get_nowait()
                    if pending[0] != "frame":
                        kept.append(pending)
                for entry in kept:
                    queue.put_nowait(entry)
            queue.put_nowait(item)

    async def _teardown(self):
        cdp, process, tasks = self._cdp, self._process, self._tasks
        self._cdp, self._process, self._tasks = None, None, []
        self._tabs = {}
        self._known = set()
        self._active = ""
        self._back = self._forward = False

        if cdp is not None:
            try:
                await asyncio.wait_for(cdp.call("Browser.close"), _CLOSE_TIMEOUT)
            except (ConnectionClosed, OSError, RuntimeError, asyncio.TimeoutError):
                pass
        for task in tasks:
            task.cancel()
        if cdp is not None:
            try:
                await cdp.close()
            except (ConnectionClosed, OSError, RuntimeError):
                pass
        if process is not None and process.poll() is None:
            try:
                await asyncio.wait_for(asyncio.to_thread(process.wait), _CLOSE_TIMEOUT)
            except asyncio.TimeoutError:
                _kill_tree(process.pid)


session = BrowserSession()
