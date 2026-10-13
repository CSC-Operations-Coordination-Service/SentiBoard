# pylint: skip-file
"""
DA0 classes generated from index templates.

**DO NOT EDIT, ONLY INHERIT !**

Generated date: 2026-10-13T16:02:59.116846+00:00

Generated from:
    - ../tests/fixtures/news_template.json
"""

from opensearchpy import Float, Keyword, Nested, Text, InnerDoc

from maas_model import MAASDocument, ZuluDate

__all__ = ["News"]


class News(MAASDocument):
    """
    Mapping class for index: news

    Generated from: ../tests/fixtures/news_template.json
    """

    class Index:
        "inner class for DSL"

        name = "news"

    @classmethod
    def _matches(cls, hit):
        return hit["_index"].startswith("news")

    category = Keyword()

    datatakes_completeness = Nested()

    environment = Keyword()

    id = Keyword()

    impacted_satellite = Keyword()

    link = Keyword()

    modify_date = ZuluDate()

    occurrence_date = ZuluDate()

    publication_date = ZuluDate()

    text = Text()

    title = Text()
