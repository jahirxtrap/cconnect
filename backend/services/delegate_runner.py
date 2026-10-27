import asyncio
import os
import shlex
import shutil
import subprocess
from collections import deque
from pathlib import Path
from typing import Any, Awaitable, Callable, NamedTuple, Optional

from core import cli_manager
from services import accounts, agent_sessions, agents, delegates, sessions, settings_store
from services.acp_events import TOOL_NAMES
from services.claude_runtime import (
    _blocks_to_events,
    _build_can_use_tool,
    _cli_env,
    _flatten_result_content,
)
from services.delegates import TASK_TOKEN

Report = Callable[[dict], Awaitable[None]]
Ask = Callable[[dict], Awaitable[dict]]

OUTPUT_LIMIT = 30000
LOG_LINES = 200
READ_TOOLS = ["Read", "Grep", "Glob", "WebSearch", "WebFetch"]
BATCH_SUFFIXES = (".cmd", ".bat")
DEFAULT_MODE = "default"
BYPASS_MODE = "bypassPermissions"
EDIT_MODES = ("acceptEdits", "auto")
ASKING_MODES = (DEFAULT_MODE, *EDIT_MODES)
READ_KINDS = frozenset({"read", "search", "fetch", "think"})
EDIT_KINDS = READ_KINDS | {"edit", "move", "delete"}
CHECKED_ARGS = (("args", DEFAULT_MODE), ("edit_args", EDIT_MODES[0]), ("bypass_args", BYPASS_MODE))
REPORTED = ("assistant_text", "thinking", "tool_use", "tool_result", "file_change")
ALLOWING = ("allow_once", "allow_always")
REFUSING = ("reject_once", "reject_always")
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
    tools: bool = True


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
    found = shutil.which(destination["program"])
    if not found:
        raise DelegateError(f"{destination['program']} is not installed on this machine")
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
        env={**os.environ, **destination["user_env"]},
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


class _Delegation:
    """An agent working one task for a chat: what it answers, and the steps the chat's permission mode keeps from it."""

    def __init__(self, name: str, turn: Turn):
        self.name = name
        self.turn = turn
        self.allowed = _allowed_kinds(turn.mode)
        self.answer: list[str] = []
        self.refused: list[str] = []

    async def report(self, event: dict) -> None:
        if event.get("type") == "assistant_text":
            self.answer.append(event.get("text") or "")
        if event.get("type") in REPORTED:
            await self.turn.report(event)

    @staticmethod
    def _choice(payload: dict, kinds: tuple) -> dict:
        option = next((item for item in payload.get("options") or [] if item.get("kind") in kinds), None)
        return {"option_id": option["id"]} if option else {"chat": True}

    async def ask(self, payload: dict) -> dict:
        if payload.get("kind") != "permission":
            return await self.turn.ask(payload) if self.turn.ask else {"chat": True}
        if self.allowed is None or payload.get("tool_kind") in self.allowed:
            return self._choice(payload, ALLOWING)
        title = (payload.get("input") or "").split("\n", 1)[0] or payload.get("tool_name") or ""
        if self.turn.mode not in ASKING_MODES or self.turn.ask is None:
            self.refused.append(f"{title} (not allowed in this chat's permission mode)")
            return self._choice(payload, REFUSING)
        answer = await self.turn.ask({**payload, "tool_name": _named(self.name, payload.get("tool_name") or "")})
        refusing = {option["id"] for option in payload.get("options") or [] if option.get("kind") in REFUSING}
        if answer.get("chat") or answer.get("option_id") in refusing:
            self.refused.append(f"{title} (the user declined)")
        return answer

    def reply(self) -> str:
        answer = "".join(self.answer).strip()
        if not self.refused:
            return answer
        note = f"These steps were not allowed: {'; '.join(self.refused)}"
        return f"{answer}\n\n{note}" if answer else note


async def _acp(destination: dict, task: str, turn: Turn) -> str:
    delegation = _Delegation(destination["name"], turn)
    session = agent_sessions.AgentSession(destination["id"], turn.cwd, sessions.project_key_for(turn.cwd))
    session.bind(delegation.report, delegation.ask)
    try:
        await session.open()
        if session.status != agent_sessions.READY:
            raise DelegateError(session.detail or session.reason or session.status)
        closing = await session.prompt(task, [])
    finally:
        await session.release()
    failed = next((event for event in closing if event.get("type") == "error"), None)
    if failed is not None:
        raise DelegateError(failed.get("message") or "the agent stopped with an error")
    return delegation.reply()[-OUTPUT_LIMIT:]


async def _account(destination: dict, task: str, turn: Turn) -> str:
    return await (_claude if turn.tools else _model)(destination, task, turn)


RUNNERS: dict[str, Callable[[dict, str, Turn], Awaitable[str]]] = {
    delegates.ACCOUNT: _account,
    agents.COMMAND: _command,
    agents.ACP: _acp,
}


async def run(destination: dict, task: str, turn: Turn) -> str:
    return await RUNNERS[destination["kind"]](destination, task, turn)


async def _ignore(_event: dict) -> None:
    return None


async def check(destination: dict, cwd: str, vis: dict) -> None:
    for key, mode in CHECKED_ARGS:
        if key != "args" and not destination.get(key):
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
