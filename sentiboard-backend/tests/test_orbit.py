"""TLE parsing (domain/orbit.py) and the cached Celestrak source (infrastructure/celestrak.py).
No network: the fetch function and the clock are injected."""

from datetime import datetime, timezone

import pytest

from domain.orbit import checksum_ok, parse_tle, satellite_unit_of, tle_epoch
from domain.ports import OrbitsUnavailable
from infrastructure.celestrak import CelestrakOrbitSource

# Published by Celestrak on 2026-11-17 (public data).
S1A = (
    "SENTINEL-1A             \n"
    "1 39634U 14016A   26321.17087910  .00000593  00000+0  13269-3 0  9994\n"
    "2 39634  98.1586 326.2825 0001348  88.0012 272.1343 14.60165340672330\n"
)
S2A = (
    "SENTINEL-2A             \n"
    "1 40697U 15028A   26321.15163228  .00000074  00000+0  44715-4 0  9999\n"
    "2 40697  98.5662  33.7568 0001154  95.7581 264.3733 14.30817467595606\n"
)


def test_parse_tle_reads_every_entry():
    orbits = parse_tle(S1A + S2A)
    assert [(o.name, o.satellite_unit, o.norad_id) for o in orbits] == [
        ("SENTINEL-1A", "S1A", "39634"),
        ("SENTINEL-2A", "S2A", "40697"),
    ]
    assert orbits[0].line1.startswith("1 39634U")
    assert orbits[0].line2.startswith("2 39634")


def test_parse_tle_skips_a_corrupt_entry_and_resynchronises():
    corrupt = S1A.replace("0  9994", "0  9990")  # wrong checksum
    assert [o.name for o in parse_tle(corrupt + S2A)] == ["SENTINEL-2A"]
    assert [o.name for o in parse_tle("garbage line\n" + S2A)] == ["SENTINEL-2A"]
    assert parse_tle("") == []


def test_parse_tle_accepts_3le_name_prefix():
    assert parse_tle("0 " + S2A)[0].name == "SENTINEL-2A"


def test_epoch():
    line1 = S1A.splitlines()[1]
    epoch = tle_epoch(line1)
    assert epoch.date() == datetime(2026, 11, 17, tzinfo=timezone.utc).date()  # day 321 of 2026
    assert epoch.tzinfo == timezone.utc


def test_checksum():
    assert checksum_ok(S1A.splitlines()[1])
    assert not checksum_ok("1 short")


@pytest.mark.parametrize(
    "name, unit",
    [("SENTINEL-1A", "S1A"), ("sentinel-5p", "S5P"), (" SENTINEL-6B ", "S6B"),
     ("SENTINEL-1", None), ("ISS (ZARYA)", None)],
)
def test_satellite_unit_of(name, unit):
    assert satellite_unit_of(name) == unit


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def source(fetch, clock):
    return CelestrakOrbitSource(
        url="http://tle", cache_seconds=100, max_stale_seconds=1000, fetch=fetch, clock=clock
    )


def test_source_caches_until_expiry():
    calls = []
    clock = Clock()
    src = source(lambda url: calls.append(url) or S1A, clock)
    assert src.orbits()[0].satellite_unit == "S1A"
    clock.now += 99
    src.orbits()
    assert calls == ["http://tle"]
    clock.now += 2
    src.orbits()
    assert len(calls) == 2


def test_source_serves_last_good_copy_when_refresh_fails():
    clock = Clock()
    answers = iter([S1A])

    def fetch(_url):
        try:
            return next(answers)
        except StopIteration:
            raise OSError("down") from None

    src = source(fetch, clock)
    src.orbits()
    clock.now += 500  # expired, still within max_stale
    assert src.orbits()[0].satellite_unit == "S1A"
    clock.now += 600  # beyond max_stale
    with pytest.raises(OrbitsUnavailable):
        src.orbits()


def test_source_unavailable_without_any_copy():
    def down(_url):
        raise OSError("down")

    with pytest.raises(OrbitsUnavailable):
        source(down, Clock()).orbits()
    with pytest.raises(OrbitsUnavailable):  # an answer without TLEs counts as a failure
        source(lambda _url: "<html>rate limited</html>", Clock()).orbits()
