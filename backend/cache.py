import time
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class CacheEntry:
    value: Any
    ts: float

class TTLCache:
    def __init__(self):
        self._store: dict[str, CacheEntry] = {}

    def get(self, key: str, ttl_seconds: int) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            return None
        if time.time() - entry.ts > ttl_seconds:
            return None
        return entry.value

    def get_stale(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        return entry.value if entry else None

    def set(self, key: str, value: Any) -> None:
        self._store[key] = CacheEntry(value=value, ts=time.time())

cache = TTLCache()
