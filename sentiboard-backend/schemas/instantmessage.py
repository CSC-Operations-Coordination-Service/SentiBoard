from pydantic import BaseModel

from typing import Optional
from maas_model.schema_adapter import ApiDate


class Instantmessage(BaseModel):
    id: Optional[str] = None
    title: str
    text: str
    link: str
    publication_date: ApiDate
    message_type: str
    modify_date: ApiDate
