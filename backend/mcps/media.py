"""What each client renders inline, and the wording the model reads about it."""

MEDIA = (
    {"capability": "media.gallery", "inline": "a gallery of images", "outside": "images"},
    {
        "capability": "media.video",
        "inline": "video inside a gallery",
        "outside": "video",
        "block": "video inside a gallery",
    },
    {
        "capability": "media.audio",
        "inline": "an audio playlist",
        "outside": "audio",
        "block": "`playlist` (audio items, each with `title` and `duration`)",
    },
    {
        "capability": "media.pdf",
        "inline": "a pdf",
        "outside": "a pdf",
        "block": "`pdf` (takes `url` and `title`)",
    },
    {
        "capability": "media.html",
        "inline": "an html page",
        "outside": "an html page",
        "block": "`html` (takes `url` and `title`)",
    },
)


def _listed(parts: list[str]) -> str:
    if len(parts) <= 1:
        return "".join(parts)
    return f"{', '.join(parts[:-1])} and {parts[-1]}"


def _picked(capabilities, key: str, supported: bool) -> list[str]:
    return [
        entry[key]
        for entry in MEDIA
        if key in entry and (entry["capability"] in capabilities) is supported
    ]


def preview_description(capabilities) -> str:
    have = _picked(capabilities, "inline", True)
    missing = _picked(capabilities, "outside", False)
    if not have:
        return "links to a cconnect media block; this client opens media outside the app."
    line = f"embeds a cconnect media block inside the form, shown small: {_listed(have)}."
    if missing:
        line += f" This client opens {_listed(missing)} outside the app instead."
    return line


def blocks_note(capabilities) -> str:
    have = _picked(capabilities, "block", True)
    return f" This client also renders {_listed(have)}." if have else ""
