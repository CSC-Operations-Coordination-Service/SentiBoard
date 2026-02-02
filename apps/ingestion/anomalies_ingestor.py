# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
"""

import logging
import re
from datetime import datetime

from dateutil.relativedelta import relativedelta

from apps.cache.cache import ConfigCache
from apps.jira.client import JiraClient
from apps.elastic.modules import anomalies as anomalies_elastic_client
from apps.models import anomalies as anomalies_model
from apps.models import categories as categories_model
from apps.models import impacted_item as impacted_item_model
from apps.models import impacted_satellite as impacted_satellite_model
from apps.utils import date_utils

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

logger = logging.getLogger(__name__)


class AnomaliesIngestor:
    def __int__(self):
        return

    def get_anomalies_elastic(self, start=None):
        anomalies = []
        records = anomalies_elastic_client.fetch_anomalies_last_quarter()
        for idx, extract in enumerate(records):
            # Normalize source (dict OR object)
            source = extract["_source"]
            origin = (
                source.get("origin")
                if isinstance(source, dict)
                else getattr(source, "origin", None)
            )

            # Create the anomaly record with baseline properties
            public_date = date_utils.format_date_to_str(
                source["occurence_date"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            start_date = date_utils.format_date_to_str(
                source["created"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            end_date = date_utils.format_date_to_str(
                source["updated"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            anomaly = {
                "key": source["key"],
                "publicationDate": public_date,
                "title": source["title"],
                "text": source["description"],
                "category": "",
                "impactedItem": "",
                "impactedSatellite": "",
                "start": start_date,
                "end": end_date,
                "environment": "",
            }

            # Parse the environment field from datatake_ids
            anomaly["environment"] = ";".join(source["datatake_ids"])

            # logger.info(
            #    "[ANOMALY DEBUG][RAW] key=%s | origin=%s | source_type=%s | title=%s",
            #    anomaly["key"],
            #    origin,
            #    type(source).__name__,
            #    anomaly["title"],
            # )

            # -----------------------------
            # Impacted satellite detection
            # -----------------------------
            title_tokenized = (
                anomaly["title"]
                .replace("[", " ")
                .replace("]", " ")
                .replace("(", " ")
                .replace(")", " ")
                .replace("_", " ")
                .replace(":", " ")
                .replace("/", " ")
                .replace("*", " ")
                .split()
            )
            text_tokenized = (
                anomaly["text"]
                .replace("[", " ")
                .replace("]", " ")
                .replace("(", " ")
                .replace(")", " ")
                .replace("_", " ")
                .replace(":", " ")
                .replace("/", " ")
                .replace("*", " ")
                .split()
            )

            for token in title_tokenized:
                if self.not_consistent(token):
                    continue
                impacted_satellite = (
                    impacted_satellite_model.get_impacted_satellite_by_synonymous(token)
                )
                if impacted_satellite:
                    anomaly["impactedSatellite"] = impacted_satellite.name
                    break

            if not anomaly["impactedSatellite"]:
                for token in text_tokenized:
                    if self.not_consistent(token):
                        continue
                    impacted_satellite = (
                        impacted_satellite_model.get_impacted_satellite_by_synonymous(
                            token
                        )
                    )
                    if impacted_satellite:
                        anomaly["impactedSatellite"] = impacted_satellite.name
                        break
            # -----------------------------
            #  ORIGIN-BASED CATEGORY MAP
            # -----------------------------
            if origin == "Satellite":
                anomaly["category"] = "Platform"
            elif origin == "Production":
                anomaly["category"] = "Production"
            elif origin == "DD":
                anomaly["category"] = "Data access"
            elif origin == "LTA":
                anomaly["category"] = "Archive"
            elif origin == "Acquisition":
                anomaly["category"] = "Acquisition"
            elif origin == "RFI":
                anomaly["category"] = "Acquisition"
            elif origin == "CAM":
                anomaly["category"] = "Manoeuvre"
            # nothing mapping directly to Calibration
            # in case of Other, keep as '', let the rest of the code handle it

            #    logger.info(
            #        "[ANOMALY DEBUG][ORIGIN MAP] key=%s | origin=%s | category_after_origin=%s",
            #        anomaly["key"],
            #        origin,
            #        anomaly["category"],
            #    )

            # -----------------------------
            # Keyword-based category fallback
            # -----------------------------
            if not anomaly["category"]:
                for token in title_tokenized:
                    if self.not_consistent(token):
                        continue
                    category = categories_model.get_category_by_synonymous(token)
                    if category:
                        anomaly["category"] = category.name
                        break

            if not anomaly["category"]:
                for token in text_tokenized:
                    if self.not_consistent(token):
                        continue
                    category = categories_model.get_category_by_synonymous(token)
                    if category:
                        anomaly["category"] = category.name
                        break
                else:
                    anomaly["category"] = "Acquisition"

            # -----------------------------
            # Impacted item detection
            # -----------------------------
            for token in title_tokenized:
                if self.not_consistent(token):
                    continue
                impacted_item = (
                    impacted_item_model.get_impacted_item_by_category_and_synonymous(
                        anomaly["category"], token
                    )
                )
                if impacted_item:
                    anomaly["impactedItem"] = impacted_item.name
                    break

            if not anomaly["impactedItem"]:
                for token in text_tokenized:
                    if self.not_consistent(token):
                        continue
                    impacted_item = impacted_item_model.get_impacted_item_by_category_and_synonymous(
                        anomaly["category"], token
                    )
                    if impacted_item:
                        anomaly["impactedItem"] = impacted_item.name
                        break

            anomalies.append(anomaly)

        return anomalies

    def ingest_anomalies(self, start=None):
        logger.info("[ENTRY] INGEST ANOMALIES")
        list_anomalies = self.get_anomalies_elastic()

        # Loop over all retrieved anomalies, and save or update them
        for anomaly in list_anomalies:
            anomalies_model.update_anomaly(
                title=anomaly["title"],
                key=anomaly["key"],
                text=anomaly["text"],
                publication_date=anomaly["publicationDate"],
                category=anomaly["category"],
                impacted_satellite=anomaly["impactedSatellite"],
                impacted_item=anomaly["impactedItem"],
                start=anomaly["start"],
                end=anomaly["end"],
                environment=anomaly.get("environment"),
            )

    def not_consistent(self, token):
        excluded_tokens = [
            "-",
            "in",
            "and",
            "or",
            "the",
            "of",
            "to",
            "due",
            "ok",
            "i.e",
            "i.e.",
            "is",
        ]
        return token.isdigit() or len(token) == 1 or token in excluded_tokens
