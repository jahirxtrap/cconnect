"""Bandwidth measured against Cloudflare's speed test endpoints, and against M-Lab's ndt7 servers when Cloudflare cannot be reached, with nothing to install."""

from __future__ import annotations

import asyncio
import json
import re
import statistics
import time
from typing import AsyncIterator, Awaitable, Callable, Optional

import httpx
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import WebSocketException

from core.release import VERSION

ENDPOINT = "https://speed.cloudflare.com"
_HEADERS = {"Referer": f"{ENDPOINT}/"}
_TIMEOUT = httpx.Timeout(20.0, connect=10.0)
_LATENCY_SAMPLES = 12
_STREAMS = 6
_PHASE_SECONDS = 10.0
_WARMUP_SECONDS = 2.0
_TICK_SECONDS = 0.25
_DOWNLOAD_BYTES = 100_000_000
_UPLOAD_BYTES = 25_000_000
_CHUNK_BYTES = 256 * 1024
_UPLOAD_CHUNK = bytes(_CHUNK_BYTES)
_BITS_PER_BYTE = 8
_MILLIS = 1000
_MICROS = 1_000_000
_SERVER_TIME = re.compile(r"cfSpeed\w*;dur=([\d.]+)")

_MLAB_LOCATE = "https://locate.measurementlab.net/v2/nearest/ndt/ndt7"
_MLAB_CLIENT = {"client_name": "cconnect", "client_version": VERSION}
_NDT7 = "net.measurementlab.ndt.v7"
_NDT7_DOWNLOAD = "wss:///ndt/v7/download"
_NDT7_UPLOAD = "wss:///ndt/v7/upload"
_NDT7_OPEN_SECONDS = 10.0
_NDT7_FIRST_MESSAGE = 1 << 13
_NDT7_LARGEST_MESSAGE = 1 << 20
_NDT7_SCALE = 16

Transfer = Callable[[httpx.AsyncClient, list[int], float], Awaitable[None]]
_FAILURES = (httpx.HTTPError, WebSocketException, OSError, asyncio.TimeoutError, ValueError, KeyError, IndexError)


async def _meta(client: httpx.AsyncClient) -> dict:
    try:
        response = await client.get(f"{ENDPOINT}/meta")
        return response.json() if response.is_success else {}
    except (httpx.HTTPError, ValueError):
        return {}


async def _round_trip(client: httpx.AsyncClient) -> float:
    """The request's time minus what the server reports spending on it, which leaves the network's round trip."""
    started = time.perf_counter()
    response = await client.get(f"{ENDPOINT}/__down", params={"bytes": 0})
    response.raise_for_status()
    elapsed = (time.perf_counter() - started) * _MILLIS
    spent = sum(float(value) for value in _SERVER_TIME.findall(response.headers.get("server-timing", "")))
    return max(0.0, elapsed - spent)


async def _download(client: httpx.AsyncClient, moved: list[int], deadline: float) -> None:
    loop = asyncio.get_running_loop()
    while loop.time() < deadline:
        async with client.stream("GET", f"{ENDPOINT}/__down", params={"bytes": _DOWNLOAD_BYTES}) as response:
            response.raise_for_status()
            async for chunk in response.aiter_raw(_CHUNK_BYTES):
                moved[0] += len(chunk)
                if loop.time() >= deadline:
                    return


async def _upload(client: httpx.AsyncClient, moved: list[int], deadline: float) -> None:
    loop = asyncio.get_running_loop()

    async def body():
        sent = 0
        while sent < _UPLOAD_BYTES and loop.time() < deadline:
            yield _UPLOAD_CHUNK
            sent += _CHUNK_BYTES
            moved[0] += _CHUNK_BYTES

    while loop.time() < deadline:
        response = await client.post(f"{ENDPOINT}/__up", content=body(), headers={"Content-Type": "application/octet-stream"})
        response.raise_for_status()


async def _throughput(client: httpx.AsyncClient, stage: str, transfer: Transfer, measured: dict) -> AsyncIterator[dict]:
    """Several streams at once for a fixed time, counted from the end of the warm-up."""
    loop = asyncio.get_running_loop()
    moved = [0]
    started = loop.time()
    tasks = [asyncio.create_task(transfer(client, moved, started + _PHASE_SECONDS)) for _ in range(_STREAMS)]
    base: Optional[tuple[float, int]] = None
    try:
        while True:
            done, _ = await asyncio.wait(tasks, timeout=_TICK_SECONDS)
            for task in done:
                task.result()
            now = loop.time()
            if base is None and now - started >= _WARMUP_SECONDS:
                base = (now, moved[0])
            rate = (moved[0] - base[1]) * _BITS_PER_BYTE / (now - base[0]) if base and now > base[0] else None
            measured[stage] = rate
            if len(done) == len(tasks):
                return
            yield {"type": "progress", "stage": stage, "progress": min(1.0, (now - started) / _PHASE_SECONDS)}
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def _cloudflare() -> AsyncIterator[dict]:
    measured: dict = {}
    limits = httpx.Limits(max_connections=_STREAMS + 1, max_keepalive_connections=_STREAMS + 1)
    async with httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT, limits=limits) as client:
        meta = await _meta(client)
        await _round_trip(client)
        samples: list[float] = []
        for index in range(_LATENCY_SAMPLES):
            samples.append(await _round_trip(client))
            yield {"type": "progress", "stage": "ping", "progress": (index + 1) / _LATENCY_SAMPLES}
        async for event in _throughput(client, "download", _download, measured):
            yield event
        async for event in _throughput(client, "upload", _upload, measured):
            yield event
    colo = meta.get("colo") or {}
    yield {
        "type": "result",
        "download": measured.get("download"),
        "upload": measured.get("upload"),
        "ping": statistics.median(samples),
        "jitter": statistics.fmean(abs(a - b) for a, b in zip(samples, samples[1:])),
        "server": f"Cloudflare {colo['city']}" if colo.get("city") else "Cloudflare",
        "isp": meta.get("asOrganization"),
    }


def _ndt7(url: str):
    return connect(url, subprotocols=[_NDT7], compression=None, max_size=None, open_timeout=_NDT7_OPEN_SECONDS)


async def _ndt7_download(url: str, measured: dict) -> AsyncIterator[dict]:
    """The server sends for about ten seconds, with its own TCP figures between the data."""
    loop = asyncio.get_running_loop()
    received = 0
    async with _ndt7(url) as socket:
        started = shown = loop.time()
        async for message in socket:
            received += len(message)
            if isinstance(message, str):
                tcp = json.loads(message).get("TCPInfo") or {}
                if tcp.get("MinRTT"):
                    measured["ping"] = tcp["MinRTT"] / _MILLIS
                if tcp.get("RTTVar"):
                    measured["jitter"] = tcp["RTTVar"] / _MILLIS
            now = loop.time()
            if now > started:
                measured["download"] = received * _BITS_PER_BYTE / (now - started)
            if now - shown >= _TICK_SECONDS:
                shown = now
                yield {"type": "progress", "stage": "download", "progress": min(1.0, (now - started) / _PHASE_SECONDS)}


async def _ndt7_reports(socket: ClientConnection, measured: dict) -> None:
    async for message in socket:
        if not isinstance(message, str):
            continue
        app = json.loads(message).get("AppInfo") or {}
        if app.get("ElapsedTime") and app.get("NumBytes"):
            measured["upload"] = app["NumBytes"] * _BITS_PER_BYTE * _MICROS / app["ElapsedTime"]


async def _ndt7_upload(url: str, measured: dict) -> AsyncIterator[dict]:
    """The client sends for ten seconds, growing its messages as the spec asks, and takes the rate the server says it received."""
    loop = asyncio.get_running_loop()
    async with _ndt7(url) as socket:
        reports = asyncio.create_task(_ndt7_reports(socket, measured))
        started = shown = loop.time()
        size, sent = _NDT7_FIRST_MESSAGE, 0
        payload = bytes(size)
        try:
            while (now := loop.time()) - started < _PHASE_SECONDS:
                await socket.send(payload)
                sent += size
                if size < _NDT7_LARGEST_MESSAGE and size <= sent / _NDT7_SCALE:
                    size *= 2
                    payload = bytes(size)
                if now - shown >= _TICK_SECONDS:
                    shown = now
                    yield {"type": "progress", "stage": "upload", "progress": min(1.0, (now - started) / _PHASE_SECONDS)}
            measured.setdefault("upload", sent * _BITS_PER_BYTE / (loop.time() - started))
        finally:
            reports.cancel()
            await asyncio.gather(reports, return_exceptions=True)


async def _mlab() -> AsyncIterator[dict]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(_MLAB_LOCATE, params=_MLAB_CLIENT)
        response.raise_for_status()
        target = response.json()["results"][0]
    urls = target["urls"]
    city = (target.get("location") or {}).get("city")
    measured: dict = {}
    async for event in _ndt7_download(urls[_NDT7_DOWNLOAD], measured):
        yield event
    async for event in _ndt7_upload(urls[_NDT7_UPLOAD], measured):
        yield event
    yield {
        "type": "result",
        "download": measured.get("download"),
        "upload": measured.get("upload"),
        "ping": measured.get("ping"),
        "jitter": measured.get("jitter"),
        "server": f"M-Lab {city}" if city else "M-Lab",
        "isp": None,
    }


async def run() -> AsyncIterator[dict]:
    """Yield progress entries while the test runs, then a final result entry; a failed Cloudflare run starts over on M-Lab."""
    try:
        async for event in _cloudflare():
            yield event
        return
    except _FAILURES:
        pass
    try:
        async for event in _mlab():
            yield event
    except _FAILURES as exc:
        yield {"type": "error", "message": str(exc) or type(exc).__name__}
