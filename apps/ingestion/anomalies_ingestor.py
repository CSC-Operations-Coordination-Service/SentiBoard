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

logger = logging.getLogger(__name__)


class AnomaliesIngestor:

    def __int__(self):
        return

    def get_anomalies_jira(self, start=None):
        jira_config = ConfigCache.load_object("cams_issues_config")
        projects = jira_config["projects"]
        jira_client = JiraClient()
        anomalies = []
        extracts = []

        today = datetime.today()
        start_date = today
        if start is None:
            start_date = today - relativedelta(months=3)
            start_date = start_date.replace(hour=0, minute=0, second=0)
            start_date = start_date.strftime("%Y-%m-%d %H:%M")
        else:
            start_date = start
            start_date = start_date.replace(hour=0, minute=0, second=0)
            start_date = start_date.strftime("%Y-%m-%d %H:%M")

        for project in projects:  # text ~ datatake AND
            jql = (
                "project="
                + project
                + " AND "
                + ' created > "'
                + start_date
                + '" AND environment IS NOT NULL ORDER '
                + "BY created DESC "
            )
            extracts += jira_client.search_all(jql)

        for extract in extracts:

            publication_date = None
            if hasattr(extract.fields, "customfield_10123"):
                publication_date = date_utils.format_date_to_str(
                    extract.fields.customfield_10123[
                        0 : extract.fields.customfield_10123.index(".")
                    ],
                    "%Y-%m-%dT%H:%M:%S",
                )  # Occurence date
            else:
                publication_date = date_utils.format_date_to_str(
                    extract.fields.created[0 : extract.fields.created.index(".")],
                    "%Y-%m-%dT%H:%M:%S",
                )

            start = publication_date  # utils.format_date_to_str(extract.fields.customfield_10507[0:extract.fields.customfield_10507.index('.')], '%Y-%m-%dT%H:%M:%S')
            stop = date_utils.format_date_to_str(
                extract.fields.updated[0 : extract.fields.updated.index(".")],
                "%Y-%m-%dT%H:%M:%S",
            )  # utils.format_date_to_str(extract.fields.customfield_10123[0:extract.fields.customfield_10123.index('.')], '%Y-%m-%dT%H:%M:%S')
            environment = None
            if hasattr(extract.fields, "environment"):
                environment = extract.fields.environment
                if environment is not None and len(environment.strip()) > 2:
                    environment = environment.replace(" ", "").replace("SNP", "S5P")

            anomaly = {
                "key": extract.key,
                "publicationDate": publication_date,
                "title": extract.fields.summary,
                "text": extract.fields.description,
                "category": "",
                "impactedItem": "",
                "impactedSatellite": "",
                "start": start,
                "end": stop,
                "environment": environment,
                "webLink": "",
            }

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
                token = str(token)
                token = token.replace("-", "")
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
                    token = token.replace("-", "")
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

            for token in title_tokenized:
                token = str(token)
                if self.not_consistent(token):
                    continue
                category = categories_model.get_category_by_synonymous(token)
                if category is not None:
                    anomaly["category"] = category.name
                    break

            if anomaly["category"] is None or len(anomaly["category"]) == 0:
                for token in text_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    category = categories_model.get_category_by_synonymous(token)
                    if category is not None:
                        anomaly["category"] = category.name
                        break
                    else:
                        anomaly["category"] = "Production"

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

    def get_anomalies_elastic(self, start=None):
        anomalies = []
        records = anomalies_elastic_client.fetch_anomalies_last_quarter()
        for extract in records:

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
                "key": extract["_source"]["key"],
                "publicationDate": public_date,
                "title": extract["_source"]["title"],
                "text": extract["_source"]["description"],
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

            for token in title_tokenized:
                token = str(token)
                if self.not_consistent(token):
                    continue
                category = categories_model.get_category_by_synonymous(token)
                if category is not None:
                    anomaly["category"] = category.name
                    break

            if anomaly["category"] is None or len(anomaly["category"]) == 0:
                for token in text_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    category = categories_model.get_category_by_synonymous(token)
                    if category is not None:
                        anomaly["category"] = category.name
                        break
                    else:
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
