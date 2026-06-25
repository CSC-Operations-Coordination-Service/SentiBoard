# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${SERCO}
All rights reserved.

This document discloses subject matter in which SERCO has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of SERCO to fulfill the purpose for which the document was
delivered to him.
"""

import logging
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
from apps.utils.acquisitions_utils import SATELLITE_DATA_CUTOFFS

logger = logging.getLogger(__name__)


class AnomaliesIngestor:
    def __init__(self):
        return

    def get_anomalies_elastic(self, start=None, end=None):
        anomalies = []
        if start and end:
            records = anomalies_elastic_client.fetch_anomalies_by_range(start, end)
        else:
            records = anomalies_elastic_client.fetch_anomalies_last_quarter()
        
        logger.info("fetched %d anomalies from elastic", len(records))
        for extract in records:
            src = extract.get("_source", {})
            if not src:
                logger.warning("Skipping anomaly without _source: %s", extract)
                continue

            origin = src.get("origin")
            if origin == "Dashboard":
                logger.info("Skipping Dashboard-correlate anomaly: %s", src.get("key"))
                continue

            # Create the anomaly record with baseline properties
            public_date = date_utils.format_date_to_str(
                extract["_source"]["occurence_date"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            start_date = date_utils.format_date_to_str(
                extract["_source"]["created"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            end_date = date_utils.format_date_to_str(
                extract["_source"]["updated"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            anomaly = {
                "key": src.get("key"),
                "publicationDate": public_date,
                "title": src.get("title", ""),
                "text": src.get("description"),
                "category": "",
                "impactedItem": "",
                "impactedSatellite": "",
                "start": start_date,
                "end": end_date,
                "environment": "",
            }

            # Parse the environment field from datatake_ids
            environment = ";".join(extract["_source"]["datatake_ids"])
            anomaly["environment"] = environment

            # From tha anomaly title and description, try to retrieve the impacted satellite, item and the category
            title_tokenized = (
                (anomaly["title"] or "")
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
                (anomaly["text"] or "")
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
                token = str(token)
                if self.not_consistent(token):
                    continue
                impacted_satellite = (
                    impacted_satellite_model.get_impacted_satellite_by_synonymous(token)
                )
                if impacted_satellite is not None:
                    anomaly["impactedSatellite"] = impacted_satellite.name
                    break

            if (
                anomaly["impactedSatellite"] is None
                or len(anomaly["impactedSatellite"]) == 0
            ):
                for token in text_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    impacted_satellite = (
                        impacted_satellite_model.get_impacted_satellite_by_synonymous(
                            token
                        )
                    )
                    if impacted_satellite is not None:
                        anomaly["impactedSatellite"] = impacted_satellite.name
                        break

            origin = extract["_source"].get("origin", None)

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
            elif origin == "MP":                  
                anomaly["category"] = "Acquisition"
                logger.info("[ORIGIN_MAP] MP anomaly found: key=%s title=%s", src.get("key"), src.get("title"))
            elif origin in ("IPF", "ADGS"):      
                anomaly["category"] = "Production"
                logger.info("[ORIGIN_MAP] MP anomaly found: key=%s title=%s", src.get("key"), src.get("title"))
            # nothing mapping directly to Calibration
            # in case of Other, keep as '', let the rest of the code handle it

            if not anomaly["category"]:
                for token in title_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    category = categories_model.get_category_by_synonymous(token)
                    if category is not None:
                        anomaly["category"] = category.name
                        break

            if not anomaly["category"]:
                for token in text_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    category = categories_model.get_category_by_synonymous(token)
                    if category is not None:
                        anomaly["category"] = category.name
                        break
                if not anomaly["category"]:
                    anomaly["category"] = "Acquisition"

            for token in title_tokenized:
                token = str(token)
                if self.not_consistent(token):
                    continue
                impacted_item = (
                    impacted_item_model.get_impacted_item_by_category_and_synonymous(
                        anomaly["category"], token
                    )
                )
                if impacted_item is not None:
                    anomaly["impactedItem"] = impacted_item.name
                    break

            if anomaly["impactedItem"] is None or len(anomaly["impactedItem"]) == 0:
                for token in text_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    impacted_item = impacted_item_model.get_impacted_item_by_category_and_synonymous(
                        anomaly["category"], token
                    )
                    if impacted_item is not None:
                        anomaly["impactedItem"] = impacted_item.name
                        break

            anomalies.append(anomaly)

        return anomalies

    def ingest_anomalies(self, start=None):
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
    
    def ingest_anomalies_range(self, start, end):
        list_anomalies = self.get_anomalies_elastic(start=start, end=end)
        ingested = 0
        skipped = 0
    
        S1D_CUTOFF = datetime(2026, 4, 17)  # naive, local comparison

        for anomaly in list_anomalies:
            satellite = anomaly.get("impactedSatellite", "") or ""
            environment = anomaly.get("environment", "") or ""

            satellite_upper = satellite.upper()
            environment_upper = environment.upper()
            is_s1d = "1D" in satellite_upper or "S1D" in environment_upper

            if is_s1d:
                pub_date = anomaly.get("publicationDate")
                if pub_date:
                    try:
                        if isinstance(pub_date, str):
                            pub_dt = datetime.fromisoformat(pub_date.replace("Z", ""))
                        else:
                            # already a datetime — strip timezone unconditionally
                            pub_dt = pub_date.replace(tzinfo=None)

                        if pub_dt < S1D_CUTOFF:
                            logger.debug(
                                "[BACKFILL SKIP] S1D anomaly %s dated %s before cutoff, skipping",
                                anomaly.get("key"), pub_dt
                            )
                            skipped += 1
                            continue
                    except Exception as ex:
                        logger.warning("[BACKFILL] Date parse failed for %s: %s — skipping", anomaly.get("key"), ex)
                        skipped += 1
                        continue

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
            ingested += 1

        logger.info("[BACKFILL] Done — ingested: %d, skipped: %d", ingested, skipped)
        return ingested, skipped

