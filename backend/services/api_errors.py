PASSING_ERRORS = frozenset({"rate_limit", "server_error"})


def api_error(text: str, error: str | None) -> dict:
    return {"type": "api_error", "text": text, "severity": "warning" if error in PASSING_ERRORS else "error"}
