"""The plugin updates in flight: one CLI command at a time, each plugin's state pushed to every client."""

import asyncio

from services import claude_manage

QUEUED = "queued"
UPDATING = "updating"
FAILED = "failed"
UPDATE = claude_manage.UPDATE
_PENDING = (QUEUED, UPDATING)


class Updates:
    def __init__(self) -> None:
        self._states: dict[str, dict] = {}
        self._waiting: list[str] = []
        self._worker: asyncio.Task | None = None
        self.lock = asyncio.Lock()

    def snapshot(self) -> dict[str, dict]:
        return {plugin: dict(state) for plugin, state in self._states.items()}

    def _announce(self, finished: list[dict] | None = None) -> None:
        from services import chat_list

        chat_list.hub.publish([{"type": "plugin_updates", "updates": self.snapshot(), "finished": finished or []}])

    def enqueue(self, plugin: str) -> dict[str, dict]:
        if self._states.get(plugin, {}).get("status") not in _PENDING:
            self._states[plugin] = {"status": QUEUED, "message": ""}
            self._waiting.append(plugin)
            if self._worker is None or self._worker.done():
                self._worker = asyncio.create_task(self._drain())
            self._announce()
        return self.snapshot()

    def forget(self, plugin: str) -> None:
        if self._states.get(plugin, {}).get("status") == FAILED:
            del self._states[plugin]
            self._announce()

    async def _drain(self) -> None:
        while self._waiting:
            plugin = self._waiting.pop(0)
            self._states[plugin] = {"status": UPDATING, "message": ""}
            self._announce()
            async with self.lock:
                result = await asyncio.to_thread(claude_manage.plugin_action, UPDATE, plugin)
            result = await claude_manage.after_plugin_action(UPDATE, plugin, result)
            if result.get("ok"):
                del self._states[plugin]
                self._announce([{"plugin": plugin, "held": bool(result.get("held"))}])
            else:
                self._states[plugin] = {"status": FAILED, "message": result.get("message") or ""}
                self._announce()


updates = Updates()
