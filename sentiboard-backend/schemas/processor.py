from pydantic import BaseModel, field_validator

from maas_model.schema_adapter import ApiDate
from typing import List, Optional


class Processor(BaseModel):
    id: Optional[str] = None
    mission: Optional[str] = None
    satellite_units: List[str] = []
    target_ipfs: List[str] = []
    processing_baseline: Optional[str] = None
    release_date: Optional[ApiDate] = None
    validity_start_date: Optional[ApiDate] = None
    validity_end_date: Optional[ApiDate] = None
    release_notes: Optional[str] = None

    @field_validator("satellite_units", "target_ipfs", mode="before")
    @classmethod
    def _none_as_empty_list(cls, value):
        # Some stored documents carry null for these keyword arrays; treat it as "none".
        return [] if value is None else value
