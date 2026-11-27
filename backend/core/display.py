"""The pieces of text the server hands the apps ready to show."""

import os
from pathlib import Path

SEPARATOR = " • "
HOME = "~"


def joined(*parts: str | None) -> str:
    return SEPARATOR.join(part for part in parts if part)


def home_relative(path: Path) -> str:
    try:
        return os.path.join(HOME, path.relative_to(Path.home()))
    except ValueError:
        return str(path)
