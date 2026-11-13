"""Composes composer attachments into the prompt: every attachment gets an ``@``-mention
of its absolute host path; images additionally become embedded base64 blocks so the model
can see them."""

import base64
import io
from math import ceil
from pathlib import Path

from core.responses import Rendering
from services import shared as shared_service

_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
_VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogv", ".mov", ".mkv"}
_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".oga", ".opus", ".m4a", ".aac", ".flac"}
_MAX_DIMENSION = 1568
_STILL_AT = 0.1
RENDITION_LIMIT = 1024


def thumbnail_size(size: int | None) -> int | None:
    return min(size, RENDITION_LIMIT) if size else None


def is_image(name: str) -> bool:
    return Path(name).suffix.lower() in _IMAGE_EXTENSIONS


def is_video(name: str) -> bool:
    return Path(name).suffix.lower() in _VIDEO_EXTENSIONS


def is_audio(name: str) -> bool:
    return Path(name).suffix.lower() in _AUDIO_EXTENSIONS


def _side(img, cover: bool) -> int:
    return min(img.size) if cover else max(img.size)


def _encoded(img, limit: int, cover: bool) -> tuple[str, bytes]:
    side = _side(img, cover)
    target = (ceil(img.width * limit / side), ceil(img.height * limit / side)) if side > limit else None
    if target:
        img.draft(None, target)
    img.load()
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if target:
        img.thumbnail(target)
    buf = io.BytesIO()
    if has_alpha:
        img.save(buf, format="PNG")
        return "image/png", buf.getvalue()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    return "image/jpeg", buf.getvalue()


def shrunk(
    source: Path | bytes,
    limit: int,
    cover: bool = False,
    stills_only: bool = False,
    reduce_only: bool = False,
) -> tuple[str, bytes] | None:
    try:
        from PIL import Image
        with Image.open(io.BytesIO(source) if isinstance(source, bytes) else source) as img:
            if stills_only and getattr(img, "is_animated", False):
                return None
            if reduce_only and _side(img, cover) <= limit:
                return None
            encoded = _encoded(img, limit, cover)
        original = len(source) if isinstance(source, bytes) else source.stat().st_size
        return None if reduce_only and len(encoded[1]) >= original else encoded
    except Exception:
        return None


def video_still(path: Path, limit: int) -> tuple[str, bytes] | None:
    """A frame a tenth of the way into the video."""
    try:
        import av
        with av.open(str(path)) as container:
            stream = container.streams.video[0]
            target = (stream.start_time or 0) + int((stream.duration or 0) * _STILL_AT)
            if target:
                container.seek(target, stream=stream)
            still = None
            for frame in container.decode(stream):
                still = frame
                if frame.pts is None or frame.pts >= target:
                    break
            return _encoded(still.to_image(), limit, cover=True) if still else None
    except Exception:
        return None


def audio_cover(path: Path, limit: int) -> tuple[str, bytes] | None:
    """The picture an audio file carries, such as its album cover."""
    try:
        import av
        with av.open(str(path)) as container:
            picture = next((s for s in container.streams if s.disposition & av.stream.Disposition.attached_pic), None)
            packet = next(container.demux(picture), None) if picture is not None else None
            return shrunk(bytes(packet), limit, cover=True) if packet is not None and packet.size else None
    except Exception:
        return None


def rendering(path: Path, size: int | None, fit: int | None) -> Rendering | None:
    """What `?size=` (a square cover) or `?fit=` (the long side) makes of a file; None serves the file itself."""
    limit = thumbnail_size(size or fit)
    if not limit:
        return None
    cover = size is not None
    if is_image(path.name):
        variant = f"{limit}" if cover else f"fit{limit}"
        return variant, lambda: shrunk(path, limit, cover=cover, stills_only=True, reduce_only=True), True
    if cover and is_video(path.name):
        return f"still{limit}", lambda: video_still(path, limit), False
    if cover and is_audio(path.name):
        return f"cover{limit}", lambda: audio_cover(path, limit), False
    return None


def encode_image(path: Path) -> tuple[str, str] | None:
    encoded = shrunk(path, _MAX_DIMENSION)
    return (encoded[0], base64.b64encode(encoded[1]).decode("ascii")) if encoded else None


def compose_prompt(text: str, relpaths: list[str]) -> tuple[str, list[dict]]:
    images: list[dict] = []
    mentions: list[str] = []
    body = text
    for rel in relpaths:
        path = shared_service.resolve_file(rel)
        if path is None:
            continue
        if is_image(path.name):
            encoded = encode_image(path)
            if encoded:
                media, data = encoded
                images.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": media, "data": data},
                })
        mentions.append(f"@{path}")
    prompt = body
    if mentions:
        prompt = f"{prompt}\n{' '.join(mentions)}".strip()
    return prompt, images
