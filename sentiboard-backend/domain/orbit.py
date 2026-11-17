"""Satellite orbits as two-line element sets (TLE), the standard NORAD format.

Pure parsing: the text comes from an infrastructure source (Celestrak). Consumers propagate the
elements themselves (SGP4); the backend only serves them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

_SENTINEL_NAME = re.compile(r"SENTINEL-(\d)([A-Z])")


@dataclass(frozen=True)
class Orbit:
    name: str  # as published, e.g. "SENTINEL-1A"
    satellite_unit: str | None  # e.g. "S1A"; None for a name that is not a Sentinel unit
    norad_id: str  # catalogue number as written in the TLE (may be Alpha-5)
    epoch: datetime  # when the elements are valid (UTC)
    line1: str
    line2: str


def satellite_unit_of(name: str) -> str | None:
    """"SENTINEL-1A" -> "S1A". None for other names."""
    match = _SENTINEL_NAME.fullmatch(name.strip().upper())
    return f"S{match.group(1)}{match.group(2)}" if match else None


def checksum_ok(line: str) -> bool:
    """TLE line checksum: digits count their value, '-' counts 1, modulo 10, in column 69."""
    if len(line) < 69 or not line[68].isdigit():
        return False
    total = sum(int(c) if c.isdigit() else 1 if c == "-" else 0 for c in line[:68])
    return total % 10 == int(line[68])


def tle_epoch(line1: str) -> datetime:
    """Epoch in columns 19-32 of line 1: two-digit year (57-99 = 19xx) and fractional day."""
    year = int(line1[18:20])
    year += 1900 if year >= 57 else 2000
    day = float(line1[20:32])
    return datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day - 1)


def parse_tle(text: str) -> list[Orbit]:
    """Every valid three-line entry (name, line 1, line 2) in `text`. Entries with a bad line
    prefix, checksum or epoch are skipped, so one corrupt entry does not hide the others."""
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    orbits: list[Orbit] = []
    i = 0
    while i + 2 < len(lines):
        name, line1, line2 = lines[i], lines[i + 1], lines[i + 2]
        if not (line1.startswith("1 ") and line2.startswith("2 ")):
            i += 1  # resynchronise on the next line
            continue
        i += 3
        if not (checksum_ok(line1) and checksum_ok(line2)):
            continue
        try:
            epoch = tle_epoch(line1)
        except ValueError:
            continue
        name = name.strip()
        if name.startswith("0 "):  # optional "0 " prefix of the 3LE format
            name = name[2:].strip()
        orbits.append(
            Orbit(
                name=name,
                satellite_unit=satellite_unit_of(name),
                norad_id=line1[2:7].strip(),
                epoch=epoch,
                line1=line1,
                line2=line2,
            )
        )
    return orbits
