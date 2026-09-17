"""The pieces of text the server hands the apps ready to show, so both sides read the same."""

SEPARATOR = " • "


def joined(*parts: str | None) -> str:
    return SEPARATOR.join(part for part in parts if part)
