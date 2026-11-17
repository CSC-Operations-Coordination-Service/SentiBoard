"""Sentinel orbits (TLE) from Celestrak, kept in memory.

CELESTRAK_TLE_URL         where to fetch, default: every object named SENTINEL, TLE format
ORBIT_CACHE_SECONDS       how long a fetched copy is served before refetching, default 6 h
                          (Celestrak refreshes about every 2 h and asks clients not to poll faster)
ORBIT_MAX_STALE_SECONDS   how long the last good copy is still served when a refetch fails,
                          default 3 days (TLEs stay usable for a few days)

The legacy app fetched the same data (`/api/acquisitions/satellite/orbits`, from NORAD via
Celestrak). This is the backend's only outbound call to the internet.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import urllib.request
from collections.abc import Callable

from domain.orbit import Orbit, parse_tle
from domain.ports import OrbitsUnavailable

log = logging.getLogger("uvicorn.error")

DEFAULT_URL = "https://celestrak.org/NORAD/elements/gp.php?NAME=SENTINEL&FORMAT=TLE"
TIMEOUT_SECONDS = 10


def http_get(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "sentiboard-backend"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310
        return response.read().decode("ascii", errors="replace")


class CelestrakOrbitSource:
    """Implements OrbitSource (domain/ports.py). Thread-safe: routes run in a threadpool."""

    def __init__(
        self,
        url: str = DEFAULT_URL,
        cache_seconds: float = 6 * 3600,
        max_stale_seconds: float = 3 * 86400,
        fetch: Callable[[str], str] = http_get,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._url = url
        self._cache_seconds = cache_seconds
        self._max_stale_seconds = max_stale_seconds
        self._fetch = fetch
        self._clock = clock
        self._lock = threading.Lock()
        self._orbits: list[Orbit] | None = None
        self._fetched_at = 0.0

    def orbits(self) -> list[Orbit]:
        with self._lock:
            age = self._clock() - self._fetched_at
            if self._orbits is not None and age < self._cache_seconds:
                return self._orbits
            try:
                orbits = parse_tle(self._fetch(self._url))
                if not orbits:
                    raise ValueError("no valid TLE in the response")
            except Exception as exc:  # network, HTTP status, or an unusable body
                if self._orbits is not None and age < self._max_stale_seconds:
                    log.warning("Orbit refresh failed (%s); serving the copy from %.0f s ago",
                                exc, age)
                    return self._orbits
                raise OrbitsUnavailable(str(exc)) from exc
            self._orbits = orbits
            self._fetched_at = self._clock()
            return orbits


def from_environment() -> CelestrakOrbitSource:
    return CelestrakOrbitSource(
        url=os.getenv("CELESTRAK_TLE_URL", DEFAULT_URL),
        cache_seconds=float(os.getenv("ORBIT_CACHE_SECONDS", 6 * 3600)),
        max_stale_seconds=float(os.getenv("ORBIT_MAX_STALE_SECONDS", 3 * 86400)),
    )
