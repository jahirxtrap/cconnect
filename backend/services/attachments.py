"""Composes composer attachments into the prompt: every attachment gets an ``@``-mention
of its absolute host path; images additionally become embedded base64 blocks so the model
can see them."""

import base64
import io
from pathlib import Path

from services import shared as shared_service

_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
_MAX_DIMENSION = 1568


def is_image(name: str) -> bool:
    return Path(name).suffix.lower() in _IMAGE_EXTENSIONS


def encode_image(path: Path) -> tuple[str, str] | None:
    try:
        from PIL import Image
        with Image.open(path) as img:
            img.load()
            has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
            if max(img.size) > _MAX_DIMENSION:
                img.thumbnail((_MAX_DIMENSION, _MAX_DIMENSION))
            buf = io.BytesIO()
            if has_alpha:
                img.save(buf, format="PNG")
                media = "image/png"
            else:
                img.convert("RGB").save(buf, format="JPEG", quality=85)
                media = "image/jpeg"
            return media, base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return None


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
