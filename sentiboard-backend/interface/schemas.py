"""Response schemas of the MAAS-CDS read routes: the API contract (OpenAPI) the frontend
generates its types from. Generic shapes, not tied to one page."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Level = Literal["L0", "L1", "L2"]
Status = Literal[
    "PLANNED", "PROCESSING", "DELAYED", "ACQUIRED", "PUBLISHED", "PARTIAL", "UNAVAILABLE"
]


class DatatakeProduct(BaseModel):
    product_type: str
    product_level: Optional[Level] = Field(
        None, description="Level the product type counts for; null when it matches none."
    )
    percentage: Optional[float] = Field(None, description="Completeness of the product, 0-100.")


class DatatakeCompleteness(BaseModel):
    """Mean completeness per level, over the products of that level. Null: no such product."""

    L0: Optional[float] = None
    L1: Optional[float] = None
    L2: Optional[float] = None


class CompletenessStatusValue(BaseModel):
    status: Status
    percentage: float


class CompletenessStatus(BaseModel):
    acquisition: CompletenessStatusValue = Field(
        description="ACQ: L0 completeness (or the first level present), at least the PUB value."
    )
    publication: CompletenessStatusValue = Field(
        description="PUB: mean of the level completeness values."
    )


class Datatake(BaseModel):
    id: str = Field(description="Datatake identifier, unique in a response.")
    datatake_id: Optional[str] = None
    mission: Optional[str] = Field(None, description='"S1", "S2", "S3" or "S5".')
    satellite_unit: Optional[str] = Field(None, description='e.g. "S1A".')
    observation_time_start: Optional[datetime] = None
    observation_time_stop: Optional[datetime] = None
    instrument_mode: Optional[str] = None
    instrument_swath: Optional[str] = None
    polarization: Optional[str] = None
    absolute_orbit: Optional[str] = None
    relative_orbit: Optional[str] = None
    timeliness: Optional[str] = None
    products: List[DatatakeProduct] = []
    completeness: DatatakeCompleteness
    completeness_status: Optional[CompletenessStatus] = Field(
        None, description="Null when the mission or the sensing stop is unknown."
    )
    cams_tickets: List[str] = []
    last_attached_ticket: Optional[str] = None
    last_attached_ticket_url: Optional[str] = None


class AcquisitionPass(BaseModel):
    id: str
    mission: Optional[str] = None
    satellite_id: Optional[str] = Field(None, description='e.g. "S2A".')
    ground_station: Optional[str] = Field(None, description='Station code, e.g. "SGS".')
    station_unit_id: Optional[str] = None
    antenna_id: Optional[str] = None
    session_id: Optional[str] = None
    downlink_orbit: Optional[str] = None
    downlink_start: Optional[datetime] = None
    downlink_stop: Optional[datetime] = None
    planned_data_start: Optional[datetime] = None
    planned_data_stop: Optional[datetime] = None
    delivery_start: Optional[datetime] = None
    delivery_stop: Optional[datetime] = None
    global_status: Optional[str] = None
    downlink_status: Optional[bool] = None
    delivery_push_status: Optional[bool] = None
    fer_data: Optional[float] = None
    publication_date: Optional[datetime] = None
    cams_tickets: List[str] = []
    last_attached_ticket: Optional[str] = None
    last_attached_ticket_url: Optional[str] = None


class SatelliteOrbit(BaseModel):
    """A two-line element set (TLE); propagate it with SGP4."""

    name: str = Field(description='As published, e.g. "SENTINEL-1A".')
    satellite_unit: Optional[str] = Field(None, description='e.g. "S1A".')
    norad_id: str
    epoch: datetime = Field(description="When the elements are valid.")
    line1: str
    line2: str
