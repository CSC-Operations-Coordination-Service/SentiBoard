from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class ProcessorsMeta(BaseModel):
    source: str
    fetched_at: datetime
    cache_ttl_seconds: int
    stale: bool = False

class ProcessorsError(BaseModel):
    code: str
    message: str
    details: Optional[dict[str, Any]] = None

class ProcessorsData(BaseModel):
    processors_releases: list[dict[str, Any]] = Field(default_factory=list)

class ProcessorsResponse(BaseModel):
    data: ProcessorsData
    meta: ProcessorsMeta
    error: Optional[ProcessorsError] = None