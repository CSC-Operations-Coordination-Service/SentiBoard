# pylint: skip-file
"""
DAO classes generated from index templates.

**DO NOT EDIT, ONLY INHERIT !**

Generated date: 2026-08-05T12:10:29.592409+00:00

Generated from:
    - maas_model/templates/processor_template.json
"""

from opensearchpy import Keyword, Text, InnerDoc

from maas_model import MAASDocument, ZuluDate

__all__ = ["Processor"]


class Processor(MAASDocument):
    """
    Mapping class for index: processor

    Generated from: maas_model/templates/processor_template.json
    """

    class Index:
        "inner class for DSL"

        name = "processor"

    @classmethod
    def _matches(cls, hit):
        return hit["_index"].startswith("processor")

    _PARTITION_FIELD = "release_date"

    _PARTITION_FIELD_FORMAT = "%Y-%m"

    id = Keyword()

    mission = Keyword()

    processing_baseline = Keyword()

    release_date = ZuluDate()

    release_notes = Text()

    satellite_units = Keyword()

    target_ipfs = Keyword()

    validity_end_date = ZuluDate()

    validity_start_date = ZuluDate()
