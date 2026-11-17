"""Datatakes read from the MAAS-CDS completeness indices, with their completeness and status.

Faithful port of the legacy rules in `apps/elastic/modules/datatakes.py` and
`apps/utils/satellite_registry.py` (branch `support/sentiboard-2026-10-09`):

- S1/S2: one completeness document per datatake. Each product type is a `<type>_local_percentage`
  field; its level comes from the type name (`_calc_s1/_s2_datatake_completeness`).
- S3/S5: one document per product (the "splitted" indices), grouped here by `datatake_id`; the
  level comes from `product_level` (`_calc_s3/_s5_datatake_completeness`), the observation window
  from the products (`_calc_s3_s5_datatake_observation_window`).
- Status: `_calc_datatake_completeness_status`, with `now` passed in instead of read.

Differences from the legacy code, none of which changes a computed number:
- times are timezone-aware UTC and parsed leniently (with or without fractional seconds);
- a null percentage is skipped instead of crashing the sum;
- a datatake whose mission is unknown, or that has no sensing stop, gets no status instead of
  raising KeyError.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

LEVELS = ("L0", "L1", "L2")

# Hours after sensing stop during which a datatake still counts as in processing
# (legacy satellite_registry `time_threshold_hours`, one value per mission).
MISSION_TIME_THRESHOLD_HOURS = {"S1": 8, "S2": 10, "S3": 696, "S5": 48}

COMPLETENESS_THRESHOLD = 90.0
FAILURE_THRESHOLD = 10.0
# The DELAYED window extends the processing window by this factor.
DELAY_FACTOR = 1.2

LOCAL_PERCENTAGE_SUFFIX = "_local_percentage"
# S2 completeness documents also carry per-level aggregates (`L0_..._local_percentage`, ...).
# They are not products: the legacy code skips them, so they are left out here too.
S2_AGGREGATE_PREFIXES = ("L0_", "L1A_", "L1B_", "L1C_", "L2A_")

# S3/S5 observation window: products of these types do not widen it, and it never exceeds
# 97 minutes (about one orbit).
WINDOW_SKIPPED_TYPES = ("DO", "NAV", "GM", "TN", "HKM", "HKM2", "OPER")
MAX_WINDOW = timedelta(minutes=97)

PLANNED = "PLANNED"
PROCESSING = "PROCESSING"
DELAYED = "DELAYED"
ACQUIRED = "ACQUIRED"
PUBLISHED = "PUBLISHED"
PARTIAL = "PARTIAL"
UNAVAILABLE = "UNAVAILABLE"


@dataclass(frozen=True)
class Product:
    """One product type of a datatake and how complete it is."""

    product_type: str
    product_level: str | None  # "L0", "L1", "L2", or None when the type matches no level
    percentage: float | None


@dataclass(frozen=True)
class StatusValue:
    status: str
    percentage: float


@dataclass(frozen=True)
class CompletenessStatus:
    """Legacy `completeness_status`: ACQ (acquisition) and PUB (publication)."""

    acquisition: StatusValue
    publication: StatusValue


@dataclass(frozen=True)
class Datatake:
    id: str
    datatake_id: str | None
    mission: str | None
    satellite_unit: str | None
    observation_time_start: datetime | None
    observation_time_stop: datetime | None
    instrument_mode: str | None
    instrument_swath: str | None
    polarization: str | None
    absolute_orbit: str | None
    relative_orbit: str | None
    timeliness: str | None
    products: tuple[Product, ...]
    completeness: Mapping[str, float]  # level -> mean percentage, only the levels present
    completeness_status: CompletenessStatus | None
    cams_tickets: tuple[str, ...]
    last_attached_ticket: str | None
    last_attached_ticket_url: str | None


# ── helpers ───────────────────────────────────────────────────────────────────────────────────


def mission_of(satellite_unit: str | None) -> str | None:
    """"S1A" -> "S1", "S5P" -> "S5"; None for anything that is not a Sentinel unit."""
    if satellite_unit and len(satellite_unit) >= 2 and satellite_unit[0] == "S" \
            and satellite_unit[1].isdigit():
        return satellite_unit[:2]
    return None


def parse_time(value: Any) -> datetime | None:
    """An OpenSearch date (ISO string, or epoch milliseconds) as an aware UTC datetime."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _text(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _tickets(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, (list, tuple)):
        return tuple(str(v) for v in value if v is not None)
    return (str(value),)


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ── product levels ────────────────────────────────────────────────────────────────────────────


def s1_product_level(product_type: str) -> str | None:
    """Level of an S1 product type, matched on its `<type>_local_percentage` field name."""
    key = product_type + LOCAL_PERCENTAGE_SUFFIX
    if any(tag in key for tag in ("_0C_", "_0S_", "_0A_", "_0N_")):
        return "L0"
    if any(tag in key for tag in ("_1A_", "_1S_")):
        return "L1"
    if any(tag in key for tag in ("_2A_", "_2S_")):
        return "L2"
    return None


def is_s2_aggregate(product_type: str) -> bool:
    return any(product_type.startswith(prefix) for prefix in S2_AGGREGATE_PREFIXES)


def s2_product_level(product_type: str) -> str | None:
    key = product_type + LOCAL_PERCENTAGE_SUFFIX
    if "L0_" in key:
        return "L0"
    if "L1A_" in key or "L1B_" in key or "L1C_" in key:
        return "L1"
    if "L2A_" in key:
        return "L2"
    return None


# Substring of `product_level` that marks each level (legacy `level_ids`).
_SPLITTED_LEVEL_TAGS = {
    "S3": (("L0", "L0_"), ("L1", "L1_"), ("L2", "L2_")),
    "S5": (("L0", "L0_"), ("L1", "L1B"), ("L2", "L2_")),
}


def splitted_product_level(mission: str | None, product_level: str | None) -> str | None:
    """Level of an S3/S5 product from its `product_level` field."""
    if not product_level:
        return None
    for level, tag in _SPLITTED_LEVEL_TAGS.get(mission or "", ()):
        if tag in product_level:
            return level
    return None


# ── completeness and status ───────────────────────────────────────────────────────────────────


def level_completeness(products: Iterable[Product]) -> dict[str, float]:
    """Mean percentage per level, over the products that have a level and a percentage."""
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for product in products:
        if product.product_level is None or product.percentage is None:
            continue
        sums[product.product_level] = sums.get(product.product_level, 0.0) + product.percentage
        counts[product.product_level] = counts.get(product.product_level, 0) + 1
    return {level: sums[level] / counts[level] for level in LEVELS if level in counts}


def completeness_status(
    completeness: Mapping[str, float],
    mission: str | None,
    observation_time_stop: datetime | None,
    now: datetime,
) -> CompletenessStatus | None:
    """ACQ and PUB status of a datatake (legacy `_calc_datatake_completeness_status`)."""
    threshold_hours = MISSION_TIME_THRESHOLD_HOURS.get(mission or "")
    if threshold_hours is None or observation_time_stop is None:
        return None

    if now <= observation_time_stop:
        return CompletenessStatus(StatusValue(PLANNED, 0.0), StatusValue(PLANNED, 0.0))

    # ACQ: L0, or the first level present when L0 is missing (happens for S5P).
    acq = next((completeness[level] for level in LEVELS if level in completeness), 0.0)
    present = [completeness[level] for level in LEVELS if level in completeness]
    pub = sum(present) / len(present) if present else 0.0
    acq = max(acq, pub)

    elapsed = now - observation_time_stop
    window = timedelta(hours=threshold_hours)
    if elapsed < window:
        return CompletenessStatus(
            StatusValue(ACQUIRED if acq > COMPLETENESS_THRESHOLD else PROCESSING, acq),
            StatusValue(PUBLISHED if pub > COMPLETENESS_THRESHOLD else PROCESSING, pub),
        )
    if elapsed < window * DELAY_FACTOR and pub < COMPLETENESS_THRESHOLD:
        return CompletenessStatus(
            StatusValue(ACQUIRED if acq > COMPLETENESS_THRESHOLD else DELAYED, acq),
            StatusValue(DELAYED, pub),
        )
    return CompletenessStatus(
        StatusValue(_final_status(acq, ACQUIRED), acq),
        StatusValue(_final_status(pub, PUBLISHED), pub),
    )


def _final_status(percentage: float, complete: str) -> str:
    if percentage >= COMPLETENESS_THRESHOLD:
        return complete
    if percentage >= FAILURE_THRESHOLD:
        return PARTIAL
    return UNAVAILABLE


# ── building datatakes ────────────────────────────────────────────────────────────────────────


def _with_completeness(base: dict[str, Any], products: tuple[Product, ...], now: datetime) -> Datatake:
    completeness = level_completeness(products)
    status = completeness_status(
        completeness, base["mission"], base["observation_time_stop"], now
    )
    return Datatake(
        products=products, completeness=completeness, completeness_status=status, **base
    )


def datatake_from_completeness_document(
    doc_id: str, source: Mapping[str, Any], now: datetime
) -> Datatake:
    """An S1/S2 datatake from its single completeness document."""
    satellite_unit = _text(source.get("satellite_unit"))
    # The legacy code tells S1 from S2 by the satellite in the document id.
    mission = mission_of(satellite_unit) or mission_of(doc_id[:3])

    products: list[Product] = []
    for key, value in source.items():
        if not key.endswith(LOCAL_PERCENTAGE_SUFFIX):
            continue
        product_type = key[: -len(LOCAL_PERCENTAGE_SUFFIX)]
        if mission == "S1":
            level = s1_product_level(product_type)
        elif mission == "S2":
            if is_s2_aggregate(product_type):
                continue
            level = s2_product_level(product_type)
        else:
            level = None
        products.append(Product(product_type, level, _number(value)))
    products.sort(key=lambda p: p.product_type)

    return _with_completeness(
        {
            # The legacy list uses the document id as the datatake id.
            "id": doc_id,
            "datatake_id": _text(source.get("datatake_id")),
            "mission": mission,
            "satellite_unit": satellite_unit,
            "observation_time_start": parse_time(source.get("observation_time_start")),
            "observation_time_stop": parse_time(source.get("observation_time_stop")),
            "instrument_mode": _text(source.get("instrument_mode")),
            "instrument_swath": _text(source.get("instrument_swath")),
            "polarization": _text(source.get("polarization")),
            "absolute_orbit": _text(source.get("absolute_orbit")),
            "relative_orbit": _text(source.get("relative_orbit")),
            "timeliness": _text(source.get("timeliness")),
            "cams_tickets": _tickets(source.get("cams_tickets")),
            "last_attached_ticket": _text(source.get("last_attached_ticket")),
            "last_attached_ticket_url": _text(source.get("last_attached_ticket_url")),
        },
        tuple(products),
        now,
    )


def observation_window(
    product_sources: list[Mapping[str, Any]],
) -> tuple[datetime | None, datetime | None]:
    """Observation window of an S3/S5 datatake from its products. Starts from the first product
    whatever its type, then widens with every product whose type is not skipped, capped at 97
    minutes after the start (checked after each product, as in the legacy code)."""
    start = parse_time(product_sources[0].get("observation_time_start"))
    stop = parse_time(product_sources[0].get("observation_time_stop"))
    for source in product_sources:
        product_type = str(source.get("product_type") or "")
        if any(skipped in product_type for skipped in WINDOW_SKIPPED_TYPES):
            continue
        p_start = parse_time(source.get("observation_time_start"))
        p_stop = parse_time(source.get("observation_time_stop"))
        if p_start is not None and (start is None or p_start < start):
            start = p_start
        if p_stop is not None and (stop is None or p_stop > stop):
            stop = p_stop
        if start is not None and stop is not None and stop - start > MAX_WINDOW:
            stop = start + MAX_WINDOW
    return start, stop


def _first(product_sources: list[Mapping[str, Any]], field: str) -> str | None:
    return next(
        (_text(s.get(field)) for s in product_sources if _text(s.get(field)) is not None), None
    )


def datatake_from_product_documents(
    datatake_id: str, product_sources: list[Mapping[str, Any]], now: datetime
) -> Datatake:
    """An S3/S5 datatake from its product documents (at least one)."""
    satellite_unit = datatake_id[:3]  # legacy: the unit is the id's first three characters
    mission = mission_of(satellite_unit)
    start, stop = observation_window(product_sources)

    products = tuple(
        sorted(
            (
                Product(
                    str(s.get("product_type") or ""),
                    splitted_product_level(mission, _text(s.get("product_level"))),
                    _number(s.get("percentage")),
                )
                for s in product_sources
            ),
            key=lambda p: p.product_type,
        )
    )

    # CAMS fields: the last product that has one wins, as in the legacy loop.
    cams: dict[str, Any] = {}
    for source in product_sources:
        for field in ("cams_tickets", "last_attached_ticket", "last_attached_ticket_url"):
            if field in source:
                cams[field] = source[field]

    first_type = str(product_sources[0].get("product_type") or "")
    return _with_completeness(
        {
            "id": datatake_id,
            "datatake_id": datatake_id,
            "mission": mission,
            "satellite_unit": satellite_unit,
            "observation_time_start": start,
            "observation_time_stop": stop,
            # legacy: characters 5-8 of the first product type, e.g. "OL_" in "S3A_OL_1_EFR___"
            "instrument_mode": _text(first_type[5:8]),
            "instrument_swath": None,
            "polarization": None,
            "absolute_orbit": _first(product_sources, "absolute_orbit"),
            "relative_orbit": _first(product_sources, "relative_orbit"),
            "timeliness": _first(product_sources, "timeliness"),
            "cams_tickets": _tickets(cams.get("cams_tickets")),
            "last_attached_ticket": _text(cams.get("last_attached_ticket")),
            "last_attached_ticket_url": _text(cams.get("last_attached_ticket_url")),
        },
        products,
        now,
    )


def group_by_datatake(
    product_sources: Iterable[Mapping[str, Any]],
) -> dict[str, list[Mapping[str, Any]]]:
    """S3/S5 product documents grouped by `datatake_id`, in arrival order. Products without a
    datatake id cannot belong to a datatake and are dropped."""
    groups: dict[str, list[Mapping[str, Any]]] = {}
    for source in product_sources:
        datatake_id = _text(source.get("datatake_id"))
        if datatake_id is None:
            continue
        groups.setdefault(datatake_id, []).append(source)
    return groups


def sort_key(datatake: Datatake) -> tuple[datetime, str]:
    start = datatake.observation_time_start or datetime.min.replace(tzinfo=timezone.utc)
    return start, datatake.id
