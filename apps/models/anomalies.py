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

from apps import db
from apps.utils.db_utils import generate_uuid

logger = logging.getLogger(__name__)


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
    modify_date=datetime.now(),
):
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
    modify_date=datetime.now(),
):
    try:
        anomaly = db.session.query(Anomalies).filter(Anomalies.key == key).first()

        if anomaly is not None:
            anomaly.title = title
            anomaly.text = text
            anomaly.publicationDate = publication_date
            anomaly.start = start
            anomaly.end = end
            anomaly.environment = environment
            anomaly.modify_date = modify_date
        else:
            datatakes_completeness = []
            if environment is not None and len(environment) > 0:
                datatake_ids = environment.split(";")
                for datatake_id in datatake_ids:
                    if datatake_id is None or len(datatake_id) == 0:
                        continue
                    entry = {"datatakeID": datatake_id, "L0_": 0, "L1_": 0, "L2_": 0}
                    datatakes_completeness.append(entry)
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
        query = Anomalies.query
        if start_date is None or end_date is None:
            query = query.filter(
                Anomalies.start is not None,
                Anomalies.end is not None,
                Anomalies.start >= start_date,
                Anomalies.start <= end_date,
            )

        anomalies = query.order_by(Anomalies.publicationDate.asc()).all()

        # --- LOGGING ONLY: first 10 anomalies, most recent first ---
        logger.info("[DB] Retrieved %d anomalies", len(anomalies))
        sorted_anomalies = sorted(
            anomalies,
            key=lambda x: getattr(x, "publicationDate", datetime.min),
            reverse=True,
        )
        # for idx, a in enumerate(sorted_anomalies[:10]):
        # --- try:
        #    logger.info(
        #        "[DB SAMPLE %d] key=%s | env=%s | category=%s | pubDate=%s",
        #        idx,
        #        getattr(a, "key", None),
        #        getattr(a, "environment", None),
        #        getattr(a, "category", None),
        #        getattr(a, "publicationDate", None),
        #    )
        # except Exception as ex:
        #    logger.warning("[DB SAMPLE %d] Failed to log anomaly: %s", idx, ex)
        # --- END LOGGING ---
        return anomalies
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
