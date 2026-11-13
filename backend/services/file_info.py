"""What a file says about itself: size and dates, and what its own format records, such as an
image's camera, the streams and tags of audio or video, or a PDF's document properties."""

import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

_PDF_MAGIC = b"%PDF-"
_TAGS = ("title", "artist", "album", "album_artist", "genre", "date", "track", "composer")
_PDF_PROPERTIES = ("title", "author", "subject", "creator", "producer")
_EXIF_DATE = "%Y:%m:%d %H:%M:%S"
_MINUTES_PER_DEGREE = 60
_SECONDS_PER_DEGREE = 3600


def describe(path: Path) -> dict:
    stat = path.stat()
    info: dict[str, Any] = {
        "size": stat.st_size,
        "modified": stat.st_mtime,
        "mime": mimetypes.guess_type(path.name)[0],
    }
    if _starts_with(path, _PDF_MAGIC):
        info["pdf"] = _pdf(path)
    else:
        info["image"] = _image(path)
        if info["image"] is None:
            info["media"] = _media(path)
    return _present(info)


def _starts_with(path: Path, magic: bytes) -> bool:
    with path.open("rb") as handle:
        return handle.read(len(magic)) == magic


def _present(values: dict) -> dict:
    return {key: value for key, value in values.items() if value not in (None, "", {}, [])}


def _text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    return str(value).strip("\x00 ") or None


def _number(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _image(path: Path) -> Optional[dict]:
    try:
        from PIL import Image
        with Image.open(path) as img:
            frames = getattr(img, "n_frames", 1)
            return _present({
                "format": img.format,
                "width": img.width,
                "height": img.height,
                "mode": img.mode,
                "frames": frames if frames > 1 else None,
                "dpi": _dpi(img.info.get("dpi")),
                **_exif(img.getexif()),
            })
    except Exception:
        return None


def _dpi(dpi: Any) -> Optional[int]:
    horizontal = _number(dpi[0]) if dpi else None
    return round(horizontal) if horizontal else None


def _exif(exif) -> dict:
    from PIL import ExifTags
    base = ExifTags.Base
    shot = exif.get_ifd(ExifTags.IFD.Exif)
    make = _text(exif.get(base.Make))
    model = _text(exif.get(base.Model))
    iso = shot.get(base.ISOSpeedRatings)
    return {
        "camera": model if make and model and model.startswith(make) else " ".join(filter(None, (make, model))),
        "lens": _text(shot.get(base.LensModel)),
        "taken": _taken(_text(shot.get(base.DateTimeOriginal)), _text(shot.get(base.OffsetTimeOriginal))),
        "exposure": _number(shot.get(base.ExposureTime)),
        "aperture": _number(shot.get(base.FNumber)),
        "iso": int(iso[0] if isinstance(iso, tuple) else iso) if iso else None,
        "focal_length": _number(shot.get(base.FocalLength)),
        "software": _text(exif.get(base.Software)),
        "location": _location(exif.get_ifd(ExifTags.IFD.GPSInfo)),
    }


def _taken(stamp: Optional[str], offset: Optional[str]) -> Optional[str]:
    if not stamp:
        return None
    try:
        taken = datetime.strptime(stamp, _EXIF_DATE).isoformat()
    except ValueError:
        return None
    return f"{taken}{offset}" if offset else taken


def _location(gps: dict) -> Optional[dict]:
    from PIL import ExifTags
    tag = ExifTags.GPS
    latitude = _degrees(gps.get(tag.GPSLatitude), gps.get(tag.GPSLatitudeRef), "S")
    longitude = _degrees(gps.get(tag.GPSLongitude), gps.get(tag.GPSLongitudeRef), "W")
    if latitude is None or longitude is None:
        return None
    return {"latitude": latitude, "longitude": longitude}


def _degrees(parts: Any, ref: Any, negative: str) -> Optional[float]:
    try:
        degrees, minutes, seconds = (float(part) for part in parts)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    value = degrees + minutes / _MINUTES_PER_DEGREE + seconds / _SECONDS_PER_DEGREE
    return -value if _text(ref) == negative else value


def _media(path: Path) -> Optional[dict]:
    try:
        import av
        with av.open(str(path)) as container:
            pictures = [s for s in container.streams if s.disposition & av.stream.Disposition.attached_pic]
            playable = [s for s in container.streams if s not in pictures]
            video = next((s for s in playable if s.type == "video"), None)
            audio = next((s for s in playable if s.type == "audio"), None)
            if audio is None and (video is None or not container.duration):
                return None
            tags = {key.lower(): value for key, value in {**(audio.metadata if audio else {}), **container.metadata}.items()}
            return _present({
                "container": _codec_name(container.format.long_name),
                "duration": container.duration / av.time_base if container.duration else None,
                "bitrate": container.bit_rate or None,
                "video": _video(video) if video else None,
                "audio": _audio(audio) if audio else None,
                "tags": _present({key: _text(tags.get(key)) for key in _TAGS}),
                "cover": bool(pictures),
            })
    except Exception:
        return None


def _codec_name(name: Optional[str]) -> Optional[str]:
    return name.split(" / ")[0] if name else None


def _video(stream) -> dict:
    context = stream.codec_context
    return _present({
        "codec": _codec_name(context.codec.long_name),
        "width": context.width,
        "height": context.height,
        "fps": _number(stream.average_rate),
        "bitrate": stream.bit_rate or None,
    })


def _audio(stream) -> dict:
    context = stream.codec_context
    return _present({
        "codec": _codec_name(context.codec.long_name),
        "sample_rate": context.sample_rate,
        "channels": context.layout.nb_channels if context.layout else None,
        "bitrate": stream.bit_rate or None,
    })


def _pdf(path: Path) -> Optional[dict]:
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        encrypted = reader.is_encrypted
        if encrypted and not reader.decrypt(""):
            return {"encrypted": True, "version": _pdf_version(reader)}
        meta = reader.metadata
        return _present({
            "pages": len(reader.pages),
            "version": _pdf_version(reader),
            "encrypted": encrypted,
            **({name: _text(getattr(meta, name, None)) for name in _PDF_PROPERTIES} if meta else {}),
            "created": _pdf_date(meta, "creation_date"),
            "modified": _pdf_date(meta, "modification_date"),
        })
    except Exception:
        return None


def _pdf_version(reader) -> Optional[str]:
    return reader.pdf_header.removeprefix("%PDF-") or None


def _pdf_date(meta, name: str) -> Optional[str]:
    try:
        stamp = getattr(meta, name, None) if meta else None
    except Exception:
        return None
    return stamp.isoformat() if stamp else None
