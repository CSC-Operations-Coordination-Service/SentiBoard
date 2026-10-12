from pydantic import BaseModel

from maas_model.schema_adapter import ApiDate


class Instantmessage(BaseModel):
    id: str
    title: str
    text: str
    link: str
    publication_date: ApiDate
    message_type: str
    modify_date: ApiDate
