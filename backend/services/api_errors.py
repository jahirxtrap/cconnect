PASSING_ERRORS = frozenset({"rate_limit", "server_error", "max_output_tokens"})
RESUMES = {"max_output_tokens": "continue", "server_error": "retry", "overloaded": "retry"}


def api_error(text: str, error: str | None) -> dict:
    return {
        "type": "api_error",
        "text": text,
        "severity": "warning" if error in PASSING_ERRORS else "error",
        "resume": RESUMES.get(error or ""),
    }
