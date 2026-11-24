"""FastAPI dependencies wiring the ports to their implementations. Tests override them through
`app.dependency_overrides`."""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache

from opensearchpy import connections

from application.cache import TtlCache
from domain.ports import (
    AcquisitionPassRepository,
    AcquisitionPlanRepository,
    DatatakeSource,
    OrbitSource,
)
from infrastructure import celestrak
from infrastructure.cds_opensearch import OpenSearchCdsRepository
from infrastructure.footprint_opensearch import OpenSearchFootprintRepository


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def cds_repository() -> OpenSearchCdsRepository:
    # The default connection, created by main.py's lifespan.
    return OpenSearchCdsRepository(connections.get_connection())


def datatake_source() -> DatatakeSource:
    return cds_repository()


def acquisition_pass_repository() -> AcquisitionPassRepository:
    return cds_repository()


def acquisition_plan_repository() -> AcquisitionPlanRepository:
    return OpenSearchFootprintRepository(connections.get_connection())


@lru_cache(maxsize=1)
def datatake_cache() -> TtlCache:
    # One per process: a window read page by page is built once (application/cache.py).
    return TtlCache(ttl_seconds=60, max_entries=16)


@lru_cache(maxsize=1)
def orbit_source() -> OrbitSource:
    # One instance per process, so its in-memory copy is shared by every request.
    return celestrak.from_environment()
