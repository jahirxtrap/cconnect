import asyncio
import json
import os
import shlex
import shutil
import subprocess
from collections import deque
from pathlib import Path
from typing import Any, Awaitable, Callable, NamedTuple, Optional

from core import cli_manager
from services import accounts, settings_store
from services.claude_runtime import (
    _blocks_to_events,
    _build_can_use_tool,
    _cli_env,
    _display_tool_name,
    _flatten_result_content,
    _format_tool_input,
)
from services.delegates import TASK_TOKEN

Report = Callable[[dict], Awaitable[None]]
Ask = Callable[[dict], Awaitable[dict]]

OUTPUT_LIMIT = 30000
LOG_LINES = 200
READ_TOOLS = ["Read", "Grep", "Glob", "WebSearch", "WebFetch"]
BATCH_SUFFIXES = (".cmd", ".bat")
ACP_VERSION = 1
DEFAULT_MODE = "default"
BYPASS_MODE = "bypassPermissions"
EDIT_MODES = ("acceptEdits", "auto")
ASKING_MODES = (DEFAULT_MODE, *EDIT_MODES)
READ_KINDS = frozenset({"read", "search", "fetch", "think"})
EDIT_KINDS = READ_KINDS | {"edit", "move", "delete"}
CHECKED_ARGS = (("args", DEFAULT_MODE), ("edit_args", EDIT_MODES[0]), ("bypass_args", BYPASS_MODE))
TOOL_NAMES = {
    "read": "Read",
    "edit": "Edit",
    "delete": "Delete",
    "move": "Move",
    "search": "Search",
    "execute": "Execute",
    "think": "Think",
    "fetch": "Fetch",
}
ACP_NOT_FOUND = -32601
CHECK_TASK = "Reply with only the word: ok"
CHECK_SECONDS = 120.0
MODEL_PROMPT = (
    "Another AI agent is handing you one request. Answer it directly and completely. "
    "You have no tools, so work only from what the request contains."
)


class DelegateError(Exception):
    pass


class Turn(NamedTuple):
    cwd: str
    vis: dict
    report: Report
    mode: str = DEFAULT_MODE
    ask: Optional[Ask] = None


def _named(name: str, tool: str) -> str:
    return f"{name}: {tool}"


def _asking_as(name: str, ask: Ask) -> Ask:
    async def asked(payload: dict) -> dict:
        tool = payload.get("tool_name")
        named = payload.get("kind") == "permission" and tool != "ExitPlanMode"
        return await ask({**payload, "tool_name": _named(name, tool)} if named else payload)

    return asked


def _allowed_kinds(mode: str) -> Optional[frozenset]:
    if mode == BYPASS_MODE:
        return None
    return EDIT_KINDS if mode in EDIT_MODES else READ_KINDS


def _args_for(destination: dict, mode: str) -> list[str]:
    if mode == BYPASS_MODE and destination["bypass_args"]:
        return destination["bypass_args"]
    if mode in (BYPASS_MODE, *EDIT_MODES) and destination["edit_args"]:
        return destination["edit_args"]
    return destination["args"]


def _tool_result(tool_use_id: str, content: str, vis: dict) -> dict:
    return {"type": "tool_result", "tool_use_id": tool_use_id, "content": content if vis["tool_use"] == "full" else None}


async def _stream(options: Any, task: str, vis: dict, report: Report) -> str:
    from claude_agent_sdk import AssistantMessage, ResultMessage, UserMessage, query

    final = ""
    async for message in query(prompt=task, options=options):
        if isinstance(message, AssistantMessage):
            for event in _blocks_to_events(message.content, vis):
                await report(event)
        elif isinstance(message, UserMessage):
            for block in getattr(message, "content", None) or []:
                if type(block).__name__ == "ToolResultBlock":
                    await report(_tool_result(block.tool_use_id, _flatten_result_content(block.content), vis))
        elif isinstance(message, ResultMessage):
            if message.is_error:
                raise DelegateError(message.result or "the destination stopped with an error")
            final = message.result or ""
    return final


def _model_of(account: str) -> str:
    return accounts.model_for(account, settings_store.get("model"))


async def _model(destination: dict, task: str, turn: Turn) -> str:
    from claude_agent_sdk import ClaudeAgentOptions

    account = accounts.resolve(destination["account"])
    options = ClaudeAgentOptions(
        cwd=turn.cwd,
        model=_model_of(account),
        cli_path=cli_manager.resolve_cli_path(),
        env=_cli_env(account),
        system_prompt=MODEL_PROMPT,
        setting_sources=[],
        tools=[],
    )
    return await _stream(options, task, turn.vis, turn.report)


async def _claude(destination: dict, task: str, turn: Turn) -> str:
    from claude_agent_sdk import ClaudeAgentOptions

    account = accounts.resolve(destination["account"])
    options = ClaudeAgentOptions(
        cwd=turn.cwd,
        model=_model_of(account),
        cli_path=cli_manager.resolve_cli_path(),
        env=_cli_env(account),
        system_prompt={"type": "preset", "preset": "claude_code"},
        setting_sources=["project"],
        permission_mode=turn.mode,
        allowed_tools=READ_TOOLS,
        can_use_tool=_build_can_use_tool(_asking_as(destination["name"], turn.ask)) if turn.ask else None,
    )
    return await _stream(options, task, turn.vis, turn.report)


def _executable(destination: dict) -> str:
    command = destination["command"] or ""
    found = shutil.which(command)
    if not found:
        raise DelegateError(f"{command or destination['name']} is not installed on this machine")
    return found


async def _stop(process: asyncio.subprocess.Process) -> None:
    if process.returncode is None:
        process.kill()
    await process.wait()


def _command_line(parts: list[str]) -> str:
    return subprocess.list2cmdline(parts) if os.name == "nt" else shlex.join(parts)


async def _lines(stream: asyncio.StreamReader):
    while line := await stream.readline():
        yield line.decode("utf-8", errors="replace").rstrip("\r\n")


async def _command(destination: dict, task: str, turn: Turn) -> str:
    executable = _executable(destination)
    args = _args_for(destination, turn.mode)
    inline = any(TASK_TOKEN in arg for arg in args)
    if inline and Path(executable).suffix.lower() in BATCH_SUFFIXES:
        raise DelegateError(f"{Path(executable).name} is a batch file: send the task on stdin instead of {TASK_TOKEN}")
    argv = [arg.replace(TASK_TOKEN, task) for arg in args]
    report = turn.report
    process = await asyncio.create_subprocess_exec(
        executable,
        *argv,
        cwd=turn.cwd,
        stdin=asyncio.subprocess.DEVNULL if inline else asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    if not inline and process.stdin is not None:
        process.stdin.write(task.encode("utf-8"))
        await process.stdin.drain()
        process.stdin.close()
    log_id = f"{destination['id']}-log"
    log: deque[str] = deque(maxlen=LOG_LINES)
    output: list[str] = []
    await report({"type": "tool_use", "id": log_id, "name": TOOL_NAMES["execute"], "input": _command_line([Path(executable).name, *argv])})

    async def read_output():
        async for line in _lines(process.stdout):
            output.append(line)
            await report({"type": "assistant_text", "text": f"{line}\n"})

    async def read_log():
        async for line in _lines(process.stderr):
            log.append(line)
            await report(_tool_result(log_id, "\n".join(log), turn.vis))

    try:
        await asyncio.gather(read_output(), read_log())
        code = await process.wait()
    finally:
        await _stop(process)
    text = "\n".join(output).strip()
    if not text:
        silence = f"it exited with code {code} and printed nothing" if code else "it printed no answer"
        raise DelegateError("\n".join(log).strip()[-OUTPUT_LIMIT:] or silence)
    return text[-OUTPUT_LIMIT:]


class _AcpPeer:
    def __init__(self, process: asyncio.subprocess.Process, name: str, turn: Turn):
        self.process = process
        self.name = name
        self.turn = turn
        self.allowed = _allowed_kinds(turn.mode)
        self.vis = turn.vis
        self.report = turn.report
        self.pending: dict[int, asyncio.Future] = {}
        self.kinds: dict[str, str] = {}
        self.titles: dict[str, str] = {}
        self.inputs: dict[str, Any] = {}
        self.refused: list[str] = []
        self.answer: list[str] = []
        self.thinking_shown = False
        self.next_id = 0

    async def write(self, message: dict) -> None:
        self.process.stdin.write((json.dumps(message) + "\n").encode("utf-8"))
        await self.process.stdin.drain()

    async def call(self, method: str, params: dict) -> Any:
        self.next_id += 1
        future = asyncio.get_running_loop().create_future()
        self.pending[self.next_id] = future
        await self.write({"jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params})
        return await future

    async def listen(self) -> None:
        async for line in _lines(self.process.stdout):
            try:
                message = json.loads(line)
            except ValueError:
                continue
            if "method" not in message:
                future = self.pending.pop(message.get("id"), None)
                if future is not None and not future.done():
                    error = message.get("error")
                    if error:
                        future.set_exception(DelegateError(str(error.get("message") or error)))
                    else:
                        future.set_result(message.get("result"))
            elif "id" in message:
                await self.write({"jsonrpc": "2.0", "id": message["id"], **await self.respond(message)})
            elif message["method"] == "session/update":
                await self.update((message.get("params") or {}).get("update") or {})
        for future in self.pending.values():
            if not future.done():
                future.set_exception(DelegateError("the agent closed before answering"))

    async def respond(self, message: dict) -> dict:
        if message["method"] != "session/request_permission":
            return {"error": {"code": ACP_NOT_FOUND, "message": f"{message['method']} is not supported"}}
        params = message.get("params") or {}
        call = params.get("toolCall") or {}
        ident = call.get("toolCallId") or ""
        kind = call.get("kind") or self.kinds.get(ident) or "other"
        title = call.get("title") or self.titles.get(ident) or kind
        allowed = self.allowed is None or kind in self.allowed or await self.asked(kind, title, call.get("rawInput") or self.inputs.get(ident))
        wanted = ("allow_once", "allow_always") if allowed else ("reject_once", "reject_always")
        option = next((item for item in params.get("options") or [] if item.get("kind") in wanted), None)
        if option is None:
            return {"result": {"outcome": {"outcome": "cancelled"}}}
        return {"result": {"outcome": {"outcome": "selected", "optionId": option.get("optionId")}}}

    async def asked(self, kind: str, title: str, raw: Any) -> bool:
        if self.turn.mode not in ASKING_MODES or self.turn.ask is None:
            self.refused.append(f"{title} (not allowed in this chat's permission mode)")
            return False
        lines = [title, _format_tool_input(raw) if raw else ""]
        answer = await self.turn.ask({
            "kind": "permission",
            "tool_name": _named(self.name, _display_tool_name(TOOL_NAMES.get(kind, ""))),
            "input": "\n".join(line for line in lines if line),
            "options": [{"id": "allow"}, {"id": "deny"}],
            "free_text": "off",
        })
        if answer.get("option_id") == "allow":
            return True
        self.refused.append(f"{title} (the user declined)")
        return False

    async def update(self, update: dict) -> None:
        kind = update.get("sessionUpdate")
        content = update.get("content") if isinstance(update.get("content"), dict) else {}
        if kind == "agent_message_chunk" and content.get("type") == "text":
            self.answer.append(content.get("text") or "")
            await self.report({"type": "assistant_text", "text": content.get("text") or ""})
        elif kind == "agent_thought_chunk" and content.get("type") == "text":
            await self.thought(content.get("text") or "")
        elif kind == "tool_call":
            ident = update.get("toolCallId") or ""
            tool_kind = update.get("kind") or "other"
            title = update.get("title") or ""
            raw = update.get("rawInput")
            self.kinds[ident] = tool_kind
            self.titles[ident] = title
            self.inputs[ident] = raw
            if self.vis["tool_use"] != "off":
                lines = [title, _format_tool_input(raw) if raw else ""]
                await self.report({
                    "type": "tool_use",
                    "id": ident,
                    "name": _display_tool_name(TOOL_NAMES.get(tool_kind, "")),
                    "input": "\n".join(line for line in lines if line),
                })
        elif kind == "tool_call_update" and update.get("status") in ("completed", "failed"):
            await self.report(_tool_result(update.get("toolCallId") or "", _acp_output(update), self.vis))

    def reply(self) -> str:
        answer = "".join(self.answer).strip()
        if not self.refused:
            return answer
        note = f"These steps were not allowed: {'; '.join(self.refused)}"
        return f"{answer}\n\n{note}" if answer else note

    async def thought(self, text: str) -> None:
        mode = self.vis["thinking"]
        if mode == "full":
            await self.report({"type": "thinking", "text": text})
        elif mode == "label" and not self.thinking_shown:
            self.thinking_shown = True
            await self.report({"type": "thinking", "label": True})


def _acp_output(update: dict) -> str:
    texts = [
        ((item.get("content") or {}).get("text") or "")
        for item in update.get("content") or []
        if isinstance(item, dict) and item.get("type") == "content"
    ]
    joined = "\n".join(text for text in texts if text)
    raw = update.get("rawOutput")
    return joined or (_flatten_result_content(raw) if isinstance(raw, (str, list)) else json.dumps(raw) if raw else "")


async def _acp(destination: dict, task: str, turn: Turn) -> str:
    process = await asyncio.create_subprocess_exec(
        _executable(destination),
        *destination["args"],
        cwd=turn.cwd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    peer = _AcpPeer(process, destination["name"], turn)
    listener = asyncio.create_task(peer.listen())
    try:
        await peer.call("initialize", {
            "protocolVersion": ACP_VERSION,
            "clientCapabilities": {"fs": {"readTextFile": False, "writeTextFile": False}, "terminal": False},
        })
        session = await peer.call("session/new", {"cwd": turn.cwd, "mcpServers": []})
        await peer.call("session/prompt", {"sessionId": (session or {}).get("sessionId"), "prompt": [{"type": "text", "text": task}]})
    finally:
        listener.cancel()
        await _stop(process)
    return peer.reply()[-OUTPUT_LIMIT:]


RUNNERS: dict[str, Callable[[dict, str, Turn], Awaitable[str]]] = {
    "model": _model,
    "claude": _claude,
    "command": _command,
    "acp": _acp,
}


async def run(destination: dict, task: str, turn: Turn) -> str:
    return await RUNNERS[destination["kind"]](destination, task, turn)


async def _ignore(_event: dict) -> None:
    return None


async def check(destination: dict, cwd: str, vis: dict) -> None:
    for key, mode in CHECKED_ARGS:
        if key != "args" and not destination[key]:
            continue
        lead = "" if key == "args" else f"with {key}, "
        try:
            answer = await asyncio.wait_for(run(destination, CHECK_TASK, Turn(cwd, vis, _ignore, mode)), CHECK_SECONDS)
        except asyncio.TimeoutError:
            raise DelegateError(f"{lead}it gave no answer within {int(CHECK_SECONDS)} seconds") from None
        except (OSError, DelegateError) as exc:
            raise DelegateError(f"{lead}{exc}") from None
        if not answer.strip():
            raise DelegateError(f"{lead}it ran but gave no answer")
