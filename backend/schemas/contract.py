"""Writes the JSON Schema of the chat events the app's types are generated from; with --check, fails when the committed copy drifted."""

import json
import sys
from pathlib import Path

from pydantic.json_schema import GenerateJsonSchema

from schemas.chat_events import CHAT_EVENT

SCHEMA_FILE = Path(__file__).with_name("chat_events.json")


class _NamedModels(GenerateJsonSchema):
    def field_title_should_be_set(self, schema) -> bool:
        return False


def schema_text() -> str:
    return json.dumps({"title": "ChatEvent", **CHAT_EVENT.json_schema(schema_generator=_NamedModels)}, indent=2)


def main() -> int:
    expected = schema_text()
    if "--check" in sys.argv[1:]:
        current = SCHEMA_FILE.read_text(encoding="utf-8") if SCHEMA_FILE.is_file() else ""
        if current != expected:
            print(f"{SCHEMA_FILE.name} is out of date: run python -m schemas.contract", file=sys.stderr)
            return 1
        return 0
    SCHEMA_FILE.write_text(expected, encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
