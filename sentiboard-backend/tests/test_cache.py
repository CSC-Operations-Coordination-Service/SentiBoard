"""TtlCache (application/cache.py): expiry, eviction, errors not cached, one build per key."""

import threading

import pytest

from application.cache import TtlCache


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


def test_hit_until_expiry():
    clock, calls = Clock(), []
    cache = TtlCache(ttl_seconds=10, clock=clock)
    build = lambda: calls.append(1) or len(calls)  # noqa: E731
    assert cache.get_or_compute("k", build) == 1
    clock.now += 9.9
    assert cache.get_or_compute("k", build) == 1
    clock.now += 0.2
    assert cache.get_or_compute("k", build) == 2


def test_keys_are_separate_and_oldest_is_evicted():
    cache = TtlCache(max_entries=2, clock=Clock())
    cache.get_or_compute("a", lambda: "A")
    cache.get_or_compute("b", lambda: "B")
    cache.get_or_compute("c", lambda: "C")  # evicts "a"
    assert cache.get_or_compute("b", lambda: "new") == "B"
    assert cache.get_or_compute("a", lambda: "A2") == "A2"


def test_errors_are_not_cached():
    cache = TtlCache(clock=Clock())

    def boom():
        raise RuntimeError("down")

    with pytest.raises(RuntimeError):
        cache.get_or_compute("k", boom)
    assert cache.get_or_compute("k", lambda: "ok") == "ok"


def test_concurrent_requests_for_one_key_build_it_once():
    cache, calls, gate = TtlCache(), [], threading.Event()

    def slow():
        calls.append(1)
        gate.wait(2)
        return "v"

    results = []
    threads = [threading.Thread(target=lambda: results.append(cache.get_or_compute("k", slow)))
               for _ in range(5)]
    for t in threads:
        t.start()
    gate.set()
    for t in threads:
        t.join()
    assert results == ["v"] * 5
    assert calls == [1]
