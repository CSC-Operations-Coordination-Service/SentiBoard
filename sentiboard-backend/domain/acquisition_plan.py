"""Acquisition plans: the datatakes ESA plans for S1/S2, with their footprint, as collected from
the ESA plan KML files into `senti-footprint` (sentiboard-backend/collector)."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from domain.datatake import parse_time

SOURCE_FIELDS = (
    "satellite_unit", "datatake_id", "mode", "polarisation", "observation_time_start",
    "observation_time_stop", "absolute_orbit", "relative_orbit", "footprint",
)


@dataclass(frozen=True)
class AcquisitionPlan:
    id: str
    satellite_unit: str | None  # e.g. "S1C"
    datatake_id: str | None  # decimal, as in the MAAS-CDS indices
    mode: str | None
    polarisation: str | None  # S1 only
    observation_time_start: datetime | None
    observation_time_stop: datetime | None
    absolute_orbit: int | None
    relative_orbit: int | None
    footprint: dict[str, Any] | None  # GeoJSON Polygon


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _footprint(value: Any) -> dict[str, Any] | None:
    # OpenSearch keeps the type as written ("polygon"); GeoJSON spells it "Polygon".
    if not isinstance(value, Mapping) or "coordinates" not in value:
        return None
    return {"type": "Polygon", "coordinates": value["coordinates"]}


def plan_from_document(doc_id: str, source: Mapping[str, Any]) -> AcquisitionPlan:
    return AcquisitionPlan(
        id=doc_id,
        **{f: source.get(f) or None for f in ("satellite_unit", "datatake_id", "mode", "polarisation")},
        observation_time_start=parse_time(source.get("observation_time_start")),
        observation_time_stop=parse_time(source.get("observation_time_stop")),
        absolute_orbit=_int(source.get("absolute_orbit")),
        relative_orbit=_int(source.get("relative_orbit")),
        footprint=_footprint(source.get("footprint")),
    )
