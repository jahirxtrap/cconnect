"""The browser panel on the user's machine, for the clients that can show it."""

import base64
from typing import Optional

from claude_agent_sdk import tool

from services import browser, settings_store

CAPABILITY = "browser"
GROUP = "browser"
GROUP_SUMMARY = "Open pages in the browser panel the user is watching, and read what is on it."

SETTING = "browser_view"
DEFAULT_TEXT_LIMIT = 8000

OPEN = (
    "Open a URL in the browser panel the user is watching. Use it to put a page in front of"
    " them — documentation, a preview of what you just built, a dashboard — not to scrape it."
    " They can take over the page at any time, so it is also how you hand over a login or a"
    " captcha you cannot solve."
)

SHOT = (
    "A picture of what the browser panel shows right now. Use it when the layout matters:"
    " checking a design, confirming a page rendered, seeing why something looks wrong."
    " For reading text, browser_read costs far less."
)

READ = (
    "The visible text of the page in the browser panel. Prefer it over a screenshot whenever"
    " you need the content rather than the look."
)

OPEN_SCHEMA = {
    "type": "object",
    "properties": {
        "url": {"type": "string", "description": "Page to open. https:// is assumed when no scheme is given."},
        "new_tab": {"type": "boolean", "description": "Open beside the current page instead of replacing it."},
    },
    "required": ["url"],
}

READ_SCHEMA = {
    "type": "object",
    "properties": {
        "limit": {
            "type": "integer",
            "description": f"Characters to return. {DEFAULT_TEXT_LIMIT} by default.",
        }
    },
}


def _text(body: str) -> dict:
    return {"content": [{"type": "text", "text": body}]}


async def _blocked() -> Optional[dict]:
    if browser.executable() is None:
        return _text("There is no browser installed on the machine running CConnect.")
    if not browser.session.running and not await browser.ready_endpoint():
        return _text("The browser panel could not be started.")
    return None


def make_tools(context: dict) -> list:
    if CAPABILITY not in (context.get("capabilities") or ()):
        return []
    if not settings_store.get(SETTING):
        return []

    @tool("browser_open", OPEN, OPEN_SCHEMA)
    async def browser_open(args):
        blocked = await _blocked()
        if blocked:
            return blocked
        try:
            if args.get("new_tab"):
                await browser.session.open_tab()
            await browser.session.navigate(str(args["url"]))
            loaded = await browser.session.await_load()
        except (RuntimeError, OSError) as exc:
            return _text(f"The page could not be opened: {exc}")
        state = browser.session.status()
        where = f"{state['title']} ({state['url']})" if state["title"] else state["url"] or str(args["url"])
        if not loaded:
            return _text(f"{where} is open in the user's browser panel and still loading.")
        return _text(f"{where} is open in the user's browser panel.")

    @tool("browser_screenshot", SHOT, {})
    async def browser_screenshot(args):
        blocked = await _blocked()
        if blocked:
            return blocked
        frame = await browser.session.shot()
        if not frame:
            return _text("The browser panel has nothing to show yet.")
        return {
            "content": [
                {
                    "type": "image",
                    "data": base64.b64encode(frame).decode("ascii"),
                    "mimeType": "image/jpeg",
                }
            ]
        }

    @tool("browser_read", READ, READ_SCHEMA)
    async def browser_read(args):
        blocked = await _blocked()
        if blocked:
            return blocked
        try:
            body = await browser.session.text()
        except (RuntimeError, OSError) as exc:
            return _text(f"The page could not be read: {exc}")
        limit = args.get("limit")
        size = limit if isinstance(limit, int) and limit > 0 else DEFAULT_TEXT_LIMIT
        return _text(body[:size] or "The page has no visible text.")

    return [browser_open, browser_screenshot, browser_read]
