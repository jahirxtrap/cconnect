"""The frame wire the browser and device panels share: a kind byte, then for video a float64 timestamp and the encoded chunk."""

import struct

JPEG_KIND = b"\x00"
KEY_KIND = 1
DELTA_KIND = 2

_VIDEO_HEADER = struct.Struct(">Bd")


def video_frame(key: bool, timestamp: float, data: bytes) -> bytes:
    return _VIDEO_HEADER.pack(KEY_KIND if key else DELTA_KIND, timestamp) + data


def is_key(chunk: bytes) -> bool:
    return chunk[:1] == bytes([KEY_KIND])
