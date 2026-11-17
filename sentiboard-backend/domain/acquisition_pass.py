"""Acquisition passes: one satellite-to-ground-station downlink session, as consolidated by
MAAS-CDS in the CADIP pass-status index. Served as they are; no business rule applies yet."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from domain.datatake import parse_time


@dataclass(frozen=True)
class AcquisitionPass:
    id: str
    mission: str | None
    satellite_id: str | None  # e.g. "S2A"
    ground_station: str | None  # station code, e.g. "SGS", "MTI", "INS", "NSG", "MPS_"
    station_unit_id: str | None
    antenna_id: str | None
    session_id: str | None
    downlink_orbit: str | None
    downlink_start: datetime | None
    downlink_stop: datetime | None
    planned_data_start: datetime | None
    planned_data_stop: datetime | None
    delivery_start: datetime | None
    delivery_stop: datetime | None
    global_status: str | None
    downlink_status: bool | None
    delivery_push_status: bool | None
    fer_data: float | None
    publication_date: datetime | None
    cams_tickets: tuple[str, ...]
    last_attached_ticket: str | None
    last_attached_ticket_url: str | None


# Source fields read from the index, also used as the query's `_source` list.
SOURCE_FIELDS = (
    "mission", "satellite_id", "ground_station", "station_unit_id", "antenna_id", "session_id",
    "downlink_orbit", "downlink_start", "downlink_stop", "planned_data_start",
    "planned_data_stop", "delivery_start", "delivery_stop", "global_status", "downlink_status",
    "delivery_push_status", "fer_data", "publication_date", "cams_tickets",
    "last_attached_ticket", "last_attached_ticket_url",
)

_TIMES = (
    "downlink_start", "downlink_stop", "planned_data_start", "planned_data_stop",
    "delivery_start", "delivery_stop", "publication_date",
)
_TEXTS = (
    "mission", "satellite_id", "ground_station", "station_unit_id", "antenna_id", "session_id",
    "downlink_orbit", "global_status", "last_attached_ticket", "last_attached_ticket_url",
)


def _text(value: Any) -> str | None:
    return None if value is None or value == "" else str(value)


def _bool(value: Any) -> bool | None:
    return value if isinstance(value, bool) else None


def _float(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def pass_from_document(doc_id: str, source: Mapping[str, Any]) -> AcquisitionPass:
    tickets = source.get("cams_tickets")
    if tickets is None:
        tickets = ()
    elif not isinstance(tickets, (list, tuple)):
        tickets = (tickets,)
    return AcquisitionPass(
        id=doc_id,
        **{field: _text(source.get(field)) for field in _TEXTS},
        **{field: parse_time(source.get(field)) for field in _TIMES},
        downlink_status=_bool(source.get("downlink_status")),
        delivery_push_status=_bool(source.get("delivery_push_status")),
        fer_data=_float(source.get("fer_data")),
        cams_tickets=tuple(str(t) for t in tickets if t is not None),
    )
