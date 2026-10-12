from pydantic import BaseModel

from maas_model.schema_adapter import ApiDate
from typing import List


class AnomalyDatatakesCompleteness(BaseModel):
    datatakeID: str
    L0_: float
    L1_: float
    L2_: float


class Anomaly(BaseModel):
    id: str
    key: str
    title: str
    text: str
    category: str
    impacted_satellite: str
    impacted_item: str
    start: ApiDate
    end: ApiDate
    environment: str
    datatakes_completeness: List[AnomalyDatatakesCompleteness]
    news_link: str
    news_title: str
    publication_date: ApiDate
    modify_date: ApiDate
