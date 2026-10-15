from pydantic import BaseModel

from maas_model.schema_adapter import ApiDate
from typing import Optional


class Processor(BaseModel):
    id: Optional[str] = None
    mission: str
    satellite_units: str
    target_ipfs: str
    processing_baseline: str
    release_date: ApiDate
    validity_start_date: ApiDate
    validity_end_date: ApiDate
    release_notes: str
