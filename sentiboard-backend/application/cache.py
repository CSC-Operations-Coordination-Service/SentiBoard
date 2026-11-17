"""A small in-memory TTL cache for use-case results.

`GET /datatake/` builds the whole window (scan + grouping + status) before slicing a page out
of it. A client reading a window page by page (offset/limit, 1000 at a time) would rebuild it for
every page; with this cache the window is built once and the next pages are served from memory.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Hashable
from typing import Any


class TtlCache:
    """Thread-safe: FastAPI runs sync routes in a threadpool. One lock per key, so concurrent
    requests for the same window build it once, and different windows build in parallel."""

    def __init__(
        self, ttl_seconds: float = 60, max_entries: int = 16,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._ttl = ttl_seconds
        self._max = max_entries
        self._clock = clock
        self._lock = threading.Lock()
        self._entries: OrderedDict[Hashable, tuple[float, Any]] = OrderedDict()
        self._key_locks: dict[Hashable, threading.Lock] = {}

    def get_or_compute(self, key: Hashable, compute: Callable[[], Any]) -> Any:
        with self._lock:
            hit = self._fresh(key)
            if hit is not None:
                return hit[1]
            key_lock = self._key_locks.setdefault(key, threading.Lock())
        with key_lock:
            with self._lock:
                hit = self._fresh(key)  # built by another request meanwhile
                if hit is not None:
                    return hit[1]
            value = compute()  # an exception is not cached
            with self._lock:
                self._entries[key] = (self._clock() + self._ttl, value)
                self._entries.move_to_end(key)
                while len(self._entries) > self._max:
                    old, _ = self._entries.popitem(last=False)
                    self._key_locks.pop(old, None)
            return value

    def _fresh(self, key: Hashable) -> tuple[float, Any] | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry[0] <= self._clock():
            del self._entries[key]
            return None
        return entry
