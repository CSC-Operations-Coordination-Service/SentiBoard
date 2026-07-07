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

import ast
import logging
from datetime import datetime

from apps import db
from apps.utils.db_utils import generate_uuid

logger = logging.getLogger(__name__)

# The upstream anomaly feed renamed the key prefix "PDGSANOM-" to "GSANOM-" for
# the same anomalies. Both forms refer to one logical anomaly, so we canonicalize
# every key to the "GSANOM-" form before lookups/inserts. This keeps a single row
# per anomaly and prevents the old/new prefixes from creating duplicate rows.
_LEGACY_KEY_PREFIX = "PDGSANOM"
_CANONICAL_KEY_PREFIX = "GSANOM"


def normalize_anomaly_key(key):
    """Return the canonical form of an anomaly key (PDGSANOM-* -> GSANOM-*)."""
    if key and key.startswith(_LEGACY_KEY_PREFIX):
        return _CANONICAL_KEY_PREFIX + key[len(_LEGACY_KEY_PREFIX):]
    return key


class Anomalies(db.Model):
    __tablename__ = "anomalies"

    id = db.Column(db.String(64), primary_key=True)
    key = db.Column(db.String(9999))
    title = db.Column(db.String(9999))
    text = db.Column(db.String(9999))
    publicationDate = db.Column(db.DateTime)
    category = db.Column(db.String(9999))
    impactedSatellite = db.Column(db.String(9999))
    impactedItem = db.Column(db.String(9999))
    start = db.Column(db.DateTime)
    end = db.Column(db.DateTime)
    environment = db.Column(db.String(9999))
    datatakes_completeness = db.Column(db.String(9999))
    newsLink = db.Column(db.String(9999))
    newsTitle = db.Column(db.String(9999))
    modifyDate = db.Column(db.DateTime)

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            if hasattr(value, "__iter__") and not isinstance(value, str):
                value = value[0]

            setattr(self, property, value)


def save_anomaly(
    title,
    key,
    text,
    publication_date,
    category,
    impacted_satellite,
    impacted_item,
    start,
    end,
    environment,
    datatakes_completeness,
    newsLink=None,
    newsTitle=None,
    modify_date=None,
):
    key = normalize_anomaly_key(key)
    if modify_date is None:
        modify_date = datetime.now()
    try:
        anomalies = Anomalies(
            id=str(generate_uuid()),
            key=key,
            title=title,
            text=text,
            publicationDate=publication_date,
            category=category,
            impactedSatellite=impacted_satellite,
            impactedItem=impacted_item,
            start=start,
            end=end,
            environment=environment,
            datatakes_completeness=str(datatakes_completeness),
            newsLink=newsLink,
            newsTitle=newsTitle,
            modifyDate=modify_date,
        )
        db.session.add(anomalies)
        db.session.commit()
        return anomalies
    except Exception as ex:
        db.session.rollback()
    return None


def _build_datatakes_completeness(environment, existing=None):
    """Build the datatakes_completeness entries from the ``environment`` string.

    When ``existing`` (the current stored value, either a list or its string
    repr) is provided, already-computed completeness counters are preserved for
    every datatake ID that is still present, so re-ingesting an anomaly does not
    reset the L0_/L1_/L2_ values populated by the completeness refresh job.
    """
    existing_by_id = {}
    if existing:
        if isinstance(existing, str):
            try:
                existing = ast.literal_eval(existing)
            except (ValueError, SyntaxError):
                existing = []
        if isinstance(existing, list):
            for entry in existing:
                if isinstance(entry, dict) and entry.get("datatakeID"):
                    existing_by_id[entry["datatakeID"]] = entry

    datatakes_completeness = []
    if environment is not None and len(environment) > 0:
        for datatake_id in environment.split(";"):
            if datatake_id is None or len(datatake_id) == 0:
                continue
            if datatake_id in existing_by_id:
                datatakes_completeness.append(existing_by_id[datatake_id])
            else:
                datatakes_completeness.append(
                    {"datatakeID": datatake_id, "L0_": 0, "L1_": 0, "L2_": 0}
                )
    return datatakes_completeness


def update_anomaly(
    title,
    key,
    text,
    publication_date,
    category,
    impacted_satellite,
    impacted_item,
    start,
    end,
    environment,
    newsLink=None,
    newsTitle=None,
    modify_date=None,
):
    key = normalize_anomaly_key(key)
    if modify_date is None:
        modify_date = datetime.now()
    try:
        anomaly = db.session.query(Anomalies).filter(Anomalies.key == key).first()
        if anomaly is not None:
            anomaly.title = title
            anomaly.text = text
            anomaly.publicationDate = publication_date
            anomaly.start = start
            anomaly.end = end
            anomaly.environment = environment
            anomaly.modifyDate = modify_date
            anomaly.category = category
            anomaly.impactedSatellite = impacted_satellite
            anomaly.impactedItem = impacted_item
            anomaly.datatakes_completeness = str(
                _build_datatakes_completeness(
                    environment, existing=anomaly.datatakes_completeness
                )
            )
        else:
            datatakes_completeness = _build_datatakes_completeness(environment)
            anomaly = Anomalies(
                id=str(generate_uuid()),
                key=key,
                title=title,
                text=text,
                publicationDate=publication_date,
                category=category,
                impactedSatellite=impacted_satellite,
                impactedItem=impacted_item,
                start=start,
                end=end,
                environment=environment,
                datatakes_completeness=str(datatakes_completeness),
                newsLink=newsLink,
                newsTitle=newsTitle,
                modifyDate=modify_date,
            )
            db.session.add(anomaly)
        db.session.commit()
        return anomaly
    except Exception as ex:
        db.session.rollback()
    return None


def update_anomaly_categorization(
    key,
    category,
    impacted_item,
    impacted_satellite,
    environment,
    newsLink=None,
    newsTitle=None,
):
    try:
        anomaly = db.session.query(Anomalies).filter(Anomalies.key == key).first()
        if anomaly is not None:
            anomaly.category = category
            anomaly.impactedItem = impacted_item
            anomaly.impactedSatellite = impacted_satellite
            anomaly.environment = environment
            anomaly.newsLink = newsLink
            anomaly.newsTitle = newsTitle
            db.session.commit()
            return anomaly
    except Exception as ex:
        db.session.rollback()
    return None


def update_datatakes_completeness(key, datatakes_completeness):
    try:
        anomaly = db.session.query(Anomalies).filter(Anomalies.key == key).first()
        if anomaly is not None:
            anomaly.datatakes_completeness = str(datatakes_completeness)
            anomaly.modify_date = datetime.now()
            db.session.add(anomaly)
            db.session.commit()
            return anomaly
        else:
            return None
    except Exception as ex:
        db.session.rollback()
        return None


def get_anomalies(start_date=None, end_date=None):
    try:
        if start_date is None or end_date is None:
            return Anomalies.query.order_by(Anomalies.publicationDate.desc()).all()
        else:
            return (
                Anomalies.query.filter(Anomalies.publicationDate != None)
                .filter(Anomalies.publicationDate >= start_date)
                .filter(Anomalies.publicationDate <= end_date)
                .order_by(Anomalies.publicationDate.asc())
                .all()
            )
    except Exception as ex:
        logger.error("Retrieving Anomalies, received error: %s", ex, exc_info=True)
        return None


def get_anomalies_by_information(category, impacted_item, publication_date):
    try:
        return (
            Anomalies.query.filter_by(
                category=category,
                impactedItem=impacted_item,
                publicationDate=publication_date,
            )
            .order_by(Anomalies.modifyDate.asc())
            .all()
        )
    except Exception as ex:
        return None


def get_anomalies_by_environment(environment):
    try:
        search = "%{}%".format(environment)
        return (
            db.session.query(Anomalies)
            .filter(Anomalies.environment.like(search))
            .order_by(Anomalies.modifyDate.asc())
            .all()
        )
    except Exception as ex:
        return None


def delete_anomalies_by_id(uuid):
    try:
        db.session.query(Anomalies).filter(
            Anomalies.id == uuid,
        ).delete()

        db.session.commit()
    except Exception as ex:
        pass
    return
