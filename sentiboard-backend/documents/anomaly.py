# pylint: skip-file
"""
DA0 classes generated from index templates.

**DO NOT EDIT, ONLY INHERIT !**

Generated date: 2026-10-15T14:44:20.758874+00:00

Generated from:
    - ../index_templates/senti-anomaly_template.json
"""

from opensearchpy import Float, Keyword, Nested, Text, InnerDoc

from maas_model import MAASDocument, ZuluDate

__all__ = ["Anomaly"]


class Anomaly(MAASDocument):
    """
    Mapping class for index: senti-anomaly

    Generated from: ../index_templates/senti-anomaly_template.json
    """

    class Index:
        "inner class for DSL"

        name = "senti-anomaly"

    @classmethod
    def _matches(cls, hit):
        return hit["_index"].startswith("senti-anomaly")

    category = Keyword()

    datatakes_completeness = Nested()

    end = ZuluDate()

    environment = Keyword()

    id = Keyword()

    impacted_item = Keyword()

    impacted_satellite = Keyword()

    key = Keyword()

    modify_date = ZuluDate()

    news_link = Keyword()

    news_title = Text()

    publication_date = ZuluDate()

    start = ZuluDate()

    text = Text()

    title = Text()
