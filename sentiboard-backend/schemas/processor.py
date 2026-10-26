from pydantic import BaseModel

from typing import Optional
from maas_model.schema_adapter import ApiDate
from maas_model.schema_adapter import ApiList


class Processor(BaseModel):
    id: Optional[str] = None
    mission: Optional[str] = None
    satellite_units: ApiList[str] = []
    target_ipfs: ApiList[str] = []
    processing_baseline: Optional[str] = None
    release_date: Optional[ApiDate] = None
    validity_start_date: Optional[ApiDate] = None
    validity_end_date: Optional[ApiDate] = None
    release_notes: Optional[str] = None
