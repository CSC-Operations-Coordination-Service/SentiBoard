# pylint: skip-file
"""
DA0 classes generated from index templates.

**DO NOT EDIT, ONLY INHERIT !**

Generated date: 2026-10-15T14:44:21.602255+00:00

Generated from:
    - ../tests/fixtures/instantmessage_template.json
"""

from opensearchpy import Keyword, Text, InnerDoc

from maas_model import MAASDocument, ZuluDate

__all__ = ["Instantmessage"]


class Instantmessage(MAASDocument):
    """
    Mapping class for index: instantmessage

    Generated from: ../tests/fixtures/instantmessage_template.json
    """

    class Index:
        "inner class for DSL"

        name = "instantmessage"

    @classmethod
    def _matches(cls, hit):
        return hit["_index"].startswith("instantmessage")

    id = Keyword()

    link = Keyword()

    message_type = Keyword()

    modify_date = ZuluDate()

    publication_date = ZuluDate()

    text = Text()

    title = Text()
