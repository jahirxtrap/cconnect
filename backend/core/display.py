"""The pieces of text the server hands the apps ready to show."""

SEPARATOR = " • "


def joined(*parts: str | None) -> str:
    return SEPARATOR.join(part for part in parts if part)
