from dataclasses import dataclass, field
from typing import Awaitable, Callable

from claude_agent_sdk import SdkMcpTool, tool


@dataclass(frozen=True)
class Definition:
    name: str
    description: str
    schema: dict = field(default_factory=dict)
    eager: bool = False
    guide: bool = False

    def __call__(self, handler: Callable[[dict], Awaitable[dict]]) -> SdkMcpTool:
        return tool(self.name, self.description, self.schema)(handler)


def reply(text: str, error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": text}], **({"is_error": True} if error else {})}
