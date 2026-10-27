from pydantic import BaseModel

from typing import Optional
from maas_model.schema_adapter import ApiDate
from maas_model.schema_adapter import ApiList


class NewsDatatakesCompleteness(BaseModel):
    datatakeID: str
    L0_: Optional[float] = None
    L1_: Optional[float] = None
    L2_: Optional[float] = None


class News(BaseModel):
    id: Optional[str] = None
    title: str
    text: str
    link: str
    publication_date: ApiDate
    occurrence_date: ApiDate
    category: str
    impacted_satellite: str
    environment: str
    datatakes_completeness: ApiList[NewsDatatakesCompleteness] = []
    modify_date: ApiDate
