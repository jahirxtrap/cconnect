"""What each client renders inline, and the wording the model reads about it."""

MEDIA = (
    {
        "capability": "media.gallery",
        "inline": "a gallery of images",
        "outside": "images",
        "block": "`gallery` — several images shown together, each with `url` and `alt`",
    },
    {
        "capability": "media.video",
        "inline": "video inside a gallery",
        "outside": "video",
        "block": "video items inside a `gallery`, with an optional `poster`",
        "single": "video",
    },
    {
        "capability": "media.audio",
        "inline": "an audio playlist",
        "outside": "audio",
        "block": "`playlist` — audio items, each with `title` and `duration`",
    },
    {
        "capability": "media.markdown_audio",
        "single": "audio file",
    },
    {
        "capability": "media.pdf",
        "inline": "a pdf",
        "outside": "a pdf",
        "block": "`pdf` — takes `url` and `title`",
    },
    {
        "capability": "media.html",
        "inline": "an html page",
        "outside": "an html page",
        "block": "`html` — takes `url` and `title`; the page loads the files of its folder and its "
        "subfolders by relative path, a reference by the name it shows",
    },
    {
        "capability": "media.drawing",
        "block": "a drawing — the one block written inline: its body is the `<svg>` element itself, not "
        "JSON, with no file. Only when a picture explains better than text: a checklist with ticks, a "
        "diagram, figures or a table by hand. It is a quick draft and the reader is waiting: start "
        "drawing at once, with no layout worked out or checked beforehand; rough positions, plain "
        "lines and lines that cross are fine, and the canvas grows to hold whatever spills past the "
        "`viewBox`. Make the `viewBox` square (1:1): the chat shows it in a square frame as wide as the "
        "reply, and it opens full screen. Its size, style and shapes are yours. Name it with a "
        "`<title>` as its first child: the name heads the preview and the saved image. It shows exactly "
        "as drawn, so give it its own background; text without a `font-family` takes the app's font. "
        "`<defs>`, `<use>` and `<marker>` work; no `<style>`, scripts, links, images or outside URLs",
    },
)


def _listed(parts: list[str], conjunction: str = "and") -> str:
    if len(parts) <= 1:
        return "".join(parts)
    return f"{', '.join(parts[:-1])} {conjunction} {parts[-1]}"


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


def single_media(capabilities) -> str:
    return _listed(["image", *_picked(capabilities, "single", True)], "or")


def block_types(capabilities) -> str:
    lines = [f"- {entry}" for entry in _picked(capabilities, "block", True)]
    missing = _picked(capabilities, "outside", False)
    if lines and missing:
        lines.append(f"\nThis client opens {_listed(missing)} outside the app, so link those instead.")
    return "\n".join(lines)
