import json
from datetime import datetime, timezone
import httpx
from settings import settings
from schemas import ProcessorsData, ProcessorsError, ProcessorsMeta, ProcessorsResponse

class ProcessorsService:
    async def fetch_upstream(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=settings.processors_timeout_seconds) as client:
            resp = await client.get(settings.processors_upstream_url)
            resp.raise_for_status()
            raw = resp.json()


            graph_raw = raw.get("graph", {})
            graph = json.loads(graph_raw) if isinstance(graph_raw, str) else graph_raw
            releases = graph.get("processors_releases", [])

            if not isinstance(releases, list):
                return []
            return releases

    def build_response(self,
                        releases: list[dict],
                        stale: bool = False,
                        error: ProcessorsError | None = None,) -> ProcessorsResponse:
        return ProcessorsResponse(
            data=ProcessorsData(processors_releases=releases),
            meta=ProcessorsMeta(source="copernicus-configuration-api",
                                fetched_at=datetime.now(timezone.utc),
                                cache_ttl_seconds=settings.processors_cache_ttl_seconds,
                                stale=stale,
                                ),
                                error=error
                                )

service = ProcessorsService()
