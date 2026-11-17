"""Read use cases over the MAAS-CDS data: datatakes, acquisition passes, orbits."""

from __future__ import annotations

from collections.abc import Collection
from datetime import datetime, timedelta

from domain.acquisition_pass import AcquisitionPass
from domain.datatake import (
    Datatake,
    datatake_from_completeness_document,
    datatake_from_product_documents,
    group_by_datatake,
    sort_key,
)
from domain.orbit import Orbit
from domain.ports import AcquisitionPassRepository, DatatakeSource, OrbitSource

MISSIONS = ("S1", "S2", "S3", "S5")
# One completeness document per datatake for these missions, product documents for the others.
DATATAKE_DOCUMENT_MISSIONS = ("S1", "S2")
PRODUCT_DOCUMENT_MISSIONS = ("S3", "S5")

# A time window wider than this is refused: it would scan too much of the cds-* indices.
MAX_WINDOW = timedelta(days=31)


class InvalidWindow(ValueError):
    """The requested time window is empty, reversed or too wide."""


def check_window(date_from: datetime, date_to: datetime) -> None:
    if date_to <= date_from:
        raise InvalidWindow("date_to must be after date_from")
    if date_to - date_from > MAX_WINDOW:
        raise InvalidWindow(f"the window may span at most {MAX_WINDOW.days} days")


def list_datatakes(
    source: DatatakeSource,
    date_from: datetime,
    date_to: datetime,
    now: datetime,
    missions: Collection[str] = MISSIONS,
    satellite: str | None = None,
) -> list[Datatake]:
    """Every datatake whose observation starts in [date_from, date_to), by observation start
    then id. `now` decides the PLANNED / PROCESSING / DELAYED statuses."""
    check_window(date_from, date_to)
    datatakes: list[Datatake] = []

    document_missions = [m for m in DATATAKE_DOCUMENT_MISSIONS if m in missions]
    if document_missions:
        for doc_id, doc in source.datatake_documents(
            date_from, date_to, document_missions, satellite
        ):
            datatakes.append(datatake_from_completeness_document(doc_id, doc, now))

    product_missions = [m for m in PRODUCT_DOCUMENT_MISSIONS if m in missions]
    if product_missions:
        groups = group_by_datatake(
            source.product_documents(date_from, date_to, product_missions, satellite)
        )
        for datatake_id, products in groups.items():
            datatakes.append(datatake_from_product_documents(datatake_id, products, now))

    datatakes.sort(key=sort_key)
    return datatakes


def list_acquisition_passes(
    repository: AcquisitionPassRepository,
    date_from: datetime,
    date_to: datetime,
    satellite: str | None,
    ground_station: str | None,
    offset: int,
    limit: int,
) -> list[AcquisitionPass]:
    check_window(date_from, date_to)
    return repository.list_passes(date_from, date_to, satellite, ground_station, offset, limit)


def list_orbits(source: OrbitSource) -> list[Orbit]:
    """Current orbits, by satellite unit then name. Raises OrbitsUnavailable."""
    return sorted(source.orbits(), key=lambda o: (o.satellite_unit or "~", o.name))
