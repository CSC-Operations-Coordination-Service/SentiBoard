"""Access to `senti-footprint`, the acquisition plans SentiBoard's collector writes
(sentiboard-backend/collector/acquisition-plans.json). Read here, never written."""

from __future__ import annotations

from datetime import datetime

from opensearchpy import OpenSearch

from domain.acquisition_plan import SOURCE_FIELDS, AcquisitionPlan, plan_from_document
from infrastructure.cds_opensearch import _SEARCH_OPTIONS, _window_query

PLAN_INDEX = "senti-footprint"


class OpenSearchFootprintRepository:
    """Implements AcquisitionPlanRepository (domain/ports.py)."""

    def __init__(self, client: OpenSearch):
        self._client = client

    def list_plans(
        self, date_from: datetime, date_to: datetime, satellite: str | None, offset: int,
        limit: int,
    ) -> list[AcquisitionPlan]:
        body = {
            "query": _window_query(
                "observation_time_start", date_from, date_to, {"satellite_unit": satellite}
            ),
            "_source": list(SOURCE_FIELDS),
            "sort": [{"observation_time_start": "asc"}, {"satellite_unit": "asc"}],
            "from": offset,
            "size": limit,
            "track_total_hits": False,
        }
        result = self._client.search(index=PLAN_INDEX, body=body, **_SEARCH_OPTIONS)
        return [
            plan_from_document(hit["_id"], hit.get("_source", {}))
            for hit in result["hits"]["hits"]
        ]
