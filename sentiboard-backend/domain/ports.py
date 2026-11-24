"""Repository ports: what the use cases need from the data stores. Implemented in
`infrastructure/`, wired in by the FastAPI dependencies in `interface/`."""

from __future__ import annotations

from collections.abc import Collection, Iterable, Mapping
from datetime import datetime
from typing import Any, Protocol

from domain.acquisition_pass import AcquisitionPass
from domain.acquisition_plan import AcquisitionPlan
from domain.orbit import Orbit


class DatatakeSource(Protocol):
    """Raw MAAS-CDS completeness documents (read-only `cds-*` indices)."""

    def datatake_documents(
        self, date_from: datetime, date_to: datetime, missions: Collection[str],
        satellite: str | None,
    ) -> Iterable[tuple[str, Mapping[str, Any]]]:
        """(document id, source) of every S1/S2 datatake document whose observation starts in
        [date_from, date_to), for the given missions among "S1", "S2"."""
        ...

    def product_documents(
        self, date_from: datetime, date_to: datetime, missions: Collection[str],
        satellite: str | None,
    ) -> Iterable[Mapping[str, Any]]:
        """Source of every S3/S5 product document whose observation starts in
        [date_from, date_to), for the given missions among "S3", "S5"."""
        ...


class AcquisitionPassRepository(Protocol):
    def list_passes(
        self, date_from: datetime, date_to: datetime, satellite: str | None,
        ground_station: str | None, offset: int, limit: int,
    ) -> list[AcquisitionPass]:
        """Passes whose downlink starts in [date_from, date_to), by downlink start."""
        ...


class AcquisitionPlanRepository(Protocol):
    def list_plans(
        self, date_from: datetime, date_to: datetime, satellite: str | None, offset: int,
        limit: int,
    ) -> list[AcquisitionPlan]:
        """Planned datatakes whose observation starts in [date_from, date_to), by start."""
        ...


class OrbitsUnavailable(Exception):
    """No orbit data could be obtained, and no recent enough copy is kept."""


class OrbitSource(Protocol):
    def orbits(self) -> list[Orbit]:
        """Current orbits. Raises OrbitsUnavailable."""
        ...
