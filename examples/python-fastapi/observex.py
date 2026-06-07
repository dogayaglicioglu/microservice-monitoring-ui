# Drop this file into your FastAPI service, call observex.register(app, cfg) once.
# It exposes /health, /metrics, and /logs — the three endpoints ObserveX needs.

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

SKIP = {"/health", "/metrics", "/logs"}
LogLevel = Literal["INFO", "WARN", "ERROR", "DEBUG"]


@dataclass
class Config:
    name: str
    version: str
    region: str


# -- shared state --

_cfg: Config | None = None
_start_time = time.time()
_total_reqs = 0
_error_reqs = 0
_latencies: deque[float] = deque(maxlen=100)
_current_rps = 0.0
_rps_counter = 0
_logs: deque[dict] = deque(maxlen=200)
_log_seq = 0
_lock = asyncio.Lock()


def register(app: FastAPI, config: Config) -> None:
    """
    Wire up ObserveX into your FastAPI app.

    Call once, before uvicorn.run():

        observex.register(app, observex.Config(
            name="payment-service",
            version="v2.1.0",
            region="eu-west-1",
        ))
    """
    global _cfg
    _cfg = config

    app.middleware("http")(_instrument)

    app.get("/health")(_handle_health)
    app.get("/metrics")(_handle_metrics)
    app.get("/logs")(_handle_logs)

    app.on_event("startup")(_start_rps_ticker)


def append_log(level: LogLevel, message: str, trace_id: str = "") -> None:
    """
    Push a log entry into the ring buffer so it appears in the ObserveX Log Explorer.
    Call this from your existing logger.

        observex.append_log("ERROR", "DB connection failed", trace_id=span_id)
    """
    global _log_seq
    _log_seq += 1
    entry = {
        "id": f"{_cfg.name}-{_log_seq}",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "service": _cfg.name,
        "level": level,
        "traceId": trace_id,
        "message": message,
    }
    _logs.appendleft(entry)


# -- internals --

async def _instrument(request: Request, call_next) -> Response:
    if request.url.path in SKIP:
        return await call_next(request)

    global _total_reqs, _error_reqs, _rps_counter
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000

    async with _lock:
        _total_reqs += 1
        _rps_counter += 1
        if response.status_code >= 400:
            _error_reqs += 1
        _latencies.append(ms)

    return response


async def _start_rps_ticker():
    asyncio.create_task(_rps_tick_loop())


async def _rps_tick_loop():
    global _current_rps, _rps_counter
    while True:
        await asyncio.sleep(1)
        async with _lock:
            _current_rps = float(_rps_counter)
            _rps_counter = 0


async def _handle_health():
    return {
        "service": _cfg.name,
        "status": "healthy",
        "version": _cfg.version,
        "region": _cfg.region,
        "uptime": _calc_uptime(),
    }


async def _handle_metrics():
    return {
        "rps": _current_rps,
        "latency": _avg_latency(),
        "errorRate": _error_rate(),
        "totalReqs": _total_reqs,
    }


async def _handle_logs():
    return list(_logs)


def _avg_latency() -> float:
    if not _latencies:
        return 0.0
    return sum(_latencies) / len(_latencies)


def _error_rate() -> float:
    if _total_reqs == 0:
        return 0.0
    return (_error_reqs / _total_reqs) * 100


def _calc_uptime() -> float:
    return max(0.0, 100.0 - _error_rate() * 0.1)
