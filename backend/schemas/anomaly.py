from pydantic import BaseModel

from maas_model.schema_adapter import ApiDate
from typing import List, Optional


class AnomalyDatatakesCompleteness(BaseModel):
    datatakeID: str
    L0_: Optional[float] = None
    L1_: Optional[float] = None
    L2_: Optional[float] = None


class Anomaly(BaseModel):
    id: str
    key: str
    title: str
    text: str
    category: str
    impacted_satellite: Optional[str] = None
    impacted_item: Optional[str] = None
    start: ApiDate
    end: ApiDate
    environment: str
    datatakes_completeness: List[AnomalyDatatakesCompleteness] = []
    news_link: Optional[str] = None
    news_title: Optional[str] = None
    publication_date: ApiDate
    modify_date: ApiDate
