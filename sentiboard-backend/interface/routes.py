"""Read-only routes over the MAAS-CDS data. Thin: parse, call one use case, map to the schema.

Sync handlers on purpose: FastAPI runs them in its threadpool, so the blocking OpenSearch and
HTTP clients never block the event loop.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from application import acquisitions
from application.cache import TtlCache
from domain.ports import AcquisitionPassRepository, DatatakeSource, OrbitSource, OrbitsUnavailable
from interface import dependencies
from interface.schemas import AcquisitionPass, Datatake, SatelliteOrbit

router = APIRouter()

Mission = Literal["S1", "S2", "S3", "S5"]

_WINDOW_DOC = "Time window [date_from, date_to), ISO 8601; UTC when no offset is given. At most 31 days."


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _window(date_from: datetime, date_to: datetime) -> tuple[datetime, datetime]:
    date_from, date_to = _utc(date_from), _utc(date_to)
    try:
        acquisitions.check_window(date_from, date_to)
    except acquisitions.InvalidWindow as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return date_from, date_to


def _datatake_out(datatake) -> Datatake:
    return Datatake.model_validate(asdict(datatake))


@router.get("/datatake/", response_model=List[Datatake], tags=["datatake"])
def list_datatake(
    date_from: datetime = Query(description=_WINDOW_DOC),
    date_to: datetime = Query(description=_WINDOW_DOC),
    mission: Optional[List[Mission]] = Query(None, description="Repeat to select several."),
    satellite: Optional[str] = Query(None, description='Satellite unit, e.g. "S1A".'),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    source: DatatakeSource = Depends(dependencies.datatake_source),
    now: datetime = Depends(dependencies.utc_now),
    cache: TtlCache = Depends(dependencies.datatake_cache),
) -> List[Datatake]:
    """Datatakes whose observation starts in the window, from the MAAS-CDS completeness indices,
    by observation start. Each carries its products, per-level completeness and the ACQ/PUB
    completeness status (legacy rules, evaluated when the window is built). The built window is
    kept 60 s, so reading it page by page scans OpenSearch once."""
    date_from, date_to = _window(date_from, date_to)
    missions = tuple(sorted(set(mission or acquisitions.MISSIONS)))
    datatakes = cache.get_or_compute(
        (date_from, date_to, missions, satellite),
        lambda: acquisitions.list_datatakes(
            source, date_from, date_to, now, missions=missions, satellite=satellite,
        ),
    )
    return [_datatake_out(d) for d in datatakes[offset: offset + limit]]


@router.get("/acquisition-pass/", response_model=List[AcquisitionPass], tags=["acquisition-pass"])
def list_acquisition_pass(
    date_from: datetime = Query(description=_WINDOW_DOC + " Matched on the downlink start."),
    date_to: datetime = Query(description=_WINDOW_DOC + " Matched on the downlink start."),
    satellite: Optional[str] = Query(None, description='Satellite unit, e.g. "S2A".'),
    ground_station: Optional[str] = Query(None, description='Station code, e.g. "SGS".'),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    repository: AcquisitionPassRepository = Depends(dependencies.acquisition_pass_repository),
) -> List[AcquisitionPass]:
    """Downlink passes (CADIP) whose downlink starts in the window, by downlink start."""
    date_from, date_to = _window(date_from, date_to)
    passes = acquisitions.list_acquisition_passes(
        repository, date_from, date_to, satellite, ground_station, offset, limit
    )
    return [AcquisitionPass.model_validate(asdict(p)) for p in passes]


@router.get("/orbit/", response_model=List[SatelliteOrbit], tags=["orbit"])
def list_orbit(source: OrbitSource = Depends(dependencies.orbit_source)) -> List[SatelliteOrbit]:
    """Current two-line element sets of the Sentinel satellites (from Celestrak, cached).
    503 when they cannot be fetched and no recent copy is kept."""
    try:
        orbits = acquisitions.list_orbits(source)
    except OrbitsUnavailable as exc:
        raise HTTPException(status_code=503, detail="Orbit data unavailable") from exc
    return [SatelliteOrbit.model_validate(asdict(o)) for o in orbits]
