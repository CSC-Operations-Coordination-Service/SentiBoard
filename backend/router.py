from fastapi import APIRouter, HTTPException
from sentiboard_backend.cache import TTLCache
from sentiboard_backend.schemas import ProcessorsError, ProcessorsResponse
from sentiboard_backend.service import ProcessorsService
from sentiboard_backend.settings import settings


router = APIRouter(prefix="/api/v1/processors", tags=["processors"])
_cache = TTLCache()
_service = ProcessorsService()
_CACHE_KEY = "processors_releases"

@router.get("/releases", response_model=ProcessorsResponse)
async def get_processors_releases():
    cached = _cache.get(_CACHE_KEY, settings.processors_cache_ttl_seconds)
    if cached is not None:
        return _service.build_response(cached, stale=False)

    try:
        releases = await _service.fetch_upstream()
        _cache.set(_CACHE_KEY, releases)
        return _service.build_response(releases, stale=False)
    except Exception as ex:
        stale = _cache.get_stale(_CACHE_KEY)
        if stale is not None:
            err = ProcessorsError(
                code="UPSTREAM_UNAVAILABLE_STALE_FALLBACK",
                message="Upstream unavailable, serving stale cached data",
                details={"exception": str(ex)},
            )
            return _service.build_response(stale, stale=True, error=err)
    raise HTTPException(
        status_code=503,
        detail={
            "code":"UPSTREAM_UNAVAILABLE_STALE_FALLBACK",
            "message":"Unable to fetch processors releases and no cache available",
        },
    )