"""Ids written from the names people give things."""

import re
import unicodedata

_SEPARATORS = re.compile(r"[^a-z0-9]+")
_EDGES = re.compile(r"^-+|-+$")


def slug(name: str) -> str:
    plain = "".join(char for char in unicodedata.normalize("NFKD", name) if not unicodedata.combining(char))
    return _EDGES.sub("", _SEPARATORS.sub("-", plain.lower()))


def unique(base: str, taken: set[str]) -> str:
    candidate, number = base, 2
    while candidate in taken:
        candidate, number = f"{base}-{number}", number + 1
    return candidate
