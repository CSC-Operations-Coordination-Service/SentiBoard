"""Read-only access to the MAAS-CDS `cds-*` indices (AGENTS.md §3.3: never written).

Index names follow the legacy app (`_build_cds_completeness_indices`), with a wildcard in place of
the satellite so that a new unit is picked up without a code change:

    S1/S2  cds-completeness-<mission>-<unit>-dd-das           one document per datatake
    S3/S5  cds-completeness-splitted-<mission>-<unit>-dd-das  one document per product
    passes cds-cadip-acquisition-pass-status*
"""

from __future__ import annotations

from collections.abc import Collection, Iterator, Mapping
from datetime import datetime, timezone
from typing import Any

from opensearchpy import OpenSearch, helpers

from domain.acquisition_pass import SOURCE_FIELDS as PASS_FIELDS
from domain.acquisition_pass import AcquisitionPass, pass_from_document

DATATAKE_INDEX = "cds-completeness-{mission}-*-dd-das"
PRODUCT_INDEX = "cds-completeness-splitted-{mission}-*-dd-das"
PASS_INDEX = "cds-cadip-acquisition-pass-status*"

DATATAKE_FIELDS = [
    "datatake_id", "satellite_unit", "observation_time_start", "observation_time_stop",
    "instrument_mode", "instrument_swath", "polarization", "absolute_orbit", "relative_orbit",
    "timeliness", "*_local_percentage", "cams_tickets", "last_attached_ticket",
    "last_attached_ticket_url",
]
PRODUCT_FIELDS = [
    "datatake_id", "satellite_unit", "observation_time_start", "observation_time_stop",
    "product_level", "product_type", "percentage", "absolute_orbit", "relative_orbit",
    "timeliness", "cams_tickets", "last_attached_ticket", "last_attached_ticket_url",
]

# Patterns that match no index return nothing instead of a 404.
_SEARCH_OPTIONS = {"ignore_unavailable": True, "allow_no_indices": True}


def es_time(value: datetime) -> str:
    """A datetime as the UTC string OpenSearch compares dates with."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc)
    return value.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _window_query(
    date_field: str, date_from: datetime, date_to: datetime, terms: Mapping[str, str | None]
) -> dict[str, Any]:
    filters: list[dict[str, Any]] = [
        {"range": {date_field: {"gte": es_time(date_from), "lt": es_time(date_to)}}}
    ]
    filters += [{"term": {field: value}} for field, value in terms.items() if value]
    return {"bool": {"filter": filters}}


class OpenSearchCdsRepository:
    """Implements DatatakeSource and AcquisitionPassRepository (domain/ports.py)."""

    def __init__(self, client: OpenSearch):
        self._client = client

    def _scan(
        self, index_pattern: str, missions: Collection[str], query: dict[str, Any],
        fields: list[str],
    ) -> Iterator[dict[str, Any]]:
        indices = ",".join(index_pattern.format(mission=m.lower()) for m in missions)
        yield from helpers.scan(
            self._client,
            index=indices,
            query={"query": query, "_source": fields},
            **_SEARCH_OPTIONS,
        )

    def datatake_documents(
        self, date_from: datetime, date_to: datetime, missions: Collection[str],
        satellite: str | None,
    ) -> Iterator[tuple[str, Mapping[str, Any]]]:
        query = _window_query(
            "observation_time_start", date_from, date_to, {"satellite_unit": satellite}
        )
        for hit in self._scan(DATATAKE_INDEX, missions, query, DATATAKE_FIELDS):
            yield hit["_id"], hit.get("_source", {})

    def product_documents(
        self, date_from: datetime, date_to: datetime, missions: Collection[str],
        satellite: str | None,
    ) -> Iterator[Mapping[str, Any]]:
        query = _window_query(
            "observation_time_start", date_from, date_to, {"satellite_unit": satellite}
        )
        for hit in self._scan(PRODUCT_INDEX, missions, query, PRODUCT_FIELDS):
            yield hit.get("_source", {})

    def list_passes(
        self, date_from: datetime, date_to: datetime, satellite: str | None,
        ground_station: str | None, offset: int, limit: int,
    ) -> list[AcquisitionPass]:
        body = {
            "query": _window_query(
                "downlink_start", date_from, date_to,
                {"satellite_id": satellite, "ground_station": ground_station},
            ),
            "_source": list(PASS_FIELDS),
            "sort": [{"downlink_start": "asc"}, {"session_id": "asc"}],
            "from": offset,
            "size": limit,
            "track_total_hits": False,
        }
        result = self._client.search(index=PASS_INDEX, body=body, **_SEARCH_OPTIONS)
        return [
            pass_from_document(hit["_id"], hit.get("_source", {}))
            for hit in result["hits"]["hits"]
        ]
