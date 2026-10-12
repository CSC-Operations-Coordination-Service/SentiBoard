from pydantic import BaseModel

from maas_model.schema_adapter import ApiDate
from typing import List


class NewsDatatakesCompleteness(BaseModel):
    datatakeID: str
    L0_: float
    L1_: float
    L2_: float


class News(BaseModel):
    id: str
    title: str
    text: str
    link: str
    publication_date: ApiDate
    occurence_date: ApiDate
    category: str
    impacted_satellite: str
    environment: str
    datatakes_completeness: List[NewsDatatakesCompleteness]
    modify_date: ApiDate
