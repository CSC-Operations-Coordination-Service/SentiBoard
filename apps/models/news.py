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


class News(db.Model):
    __tablename__ = 'news'

    id = db.Column(db.String(64), primary_key=True)
    title = db.Column(db.String(9999))
    text = db.Column(db.String(9999))
    link = db.Column(db.String(9999))
    publicationDate = db.Column(db.DateTime)
    occurrenceDate = db.Column(db.DateTime)
    category = db.Column(db.String(999))
    impactedSatellite = db.Column(db.String(99))
    environment = db.Column(db.String(9999))
    datatakes_completeness = db.Column(db.String(9999))
    modifyDate = db.Column(db.DateTime)

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            if hasattr(value, '__iter__') and not isinstance(value, str):
                value = value[0]

            setattr(self, property, value)


def save_news(title, text, link, publication_date, occurrence_date, category, impacted_satellite, environment,
              datatakes_completeness, modify_date=datetime.now()):
    try:
        news = News(id=str(generate_uuid()), title=title, text=text, link=link, publicationDate=publication_date,
                    occurrenceDate=occurrence_date, category=category, impactedSatellite=impacted_satellite,
                    environment=environment, datatakes_completeness=str(datatakes_completeness), modifyDate=modify_date)
        db.session.add(news)
        db.session.commit()
        return news
    except Exception as ex:
        db.session.rollback()
    return None


def update_news(title, text, link, publication_date, occurrence_date, category, impacted_satellite, environment,
              modify_date=datetime.now()):
    try:
        news = db.session.query(News).filter(News.link == link).first()
        if news is not None:
            news.title = title
            news.text = text
            news.publicationDate = publication_date
            news.modifyDate = modify_date
        else:
            datatakes_completeness = []
            if environment is not None and len(environment) > 0:
                datatake_ids = environment.split(';')
                for datatake_id in datatake_ids:
                    if datatake_id is None or len(datatake_id) == 0:
                        continue
                    entry = {'datatakeID': datatake_id, 'L0_': 0, 'L1_': 0, 'L2_': 0}
                    datatakes_completeness.append(entry)
            news = News(id=str(generate_uuid()), title=title, text=text, link=link, publicationDate=publication_date,
                        occurrenceDate=occurrence_date, category=category, impactedSatellite=impacted_satellite,
                        environment=environment, datatakes_completeness=str(datatakes_completeness),
                        modifyDate=modify_date)
            db.session.add(news)
        db.session.commit()
        return news
    except Exception as ex:
        db.session.rollback()
    return None


def update_news_categorization(link, category, impacted_satellite, environment, occurrenceDate):
    try:
        news = db.session.query(News).filter(News.link == link).first()
        if news is not None:
            news.category = category
            news.impactedSatellite = impacted_satellite
            news.environment = environment
            news.occurrenceDate = datetime.strptime(occurrenceDate, '%d/%m/%Y %H:%M:%S')
            db.session.commit()
            return news
    except Exception as ex:
        db.session.rollback()
    return None


def update_datatakes_completeness(link, datatakes_completeness):
    try:
        news = db.session.query(News).filter(News.link == link).first()
        if news is not None:
            news.datatakes_completeness = str(datatakes_completeness)
            news.modify_date = datetime.now()
            db.session.add(news)
            db.session.commit()
            return news
        else:
            return None
    except Exception as ex:
        db.session.rollback()
        return None


def get_news(start_date=None, end_date=None):
    try:
        if start_date is None or end_date is None:
            return News.query.order_by(News.occurrenceDate.asc()).all()
        else:
            return News.query.filter(News.publicationDate is not None). \
                filter(News.publicationDate >= start_date).filter(News.publicationDate <= end_date).order_by(
                News.occurrenceDate.asc()).all()
    except Exception as ex:
        logger.error("Retrieving News, received error: %s", ex, exc_info=True)
        return None


def get_news_by_information(category, impacted_satellite, occurrence_date):
    try:
        return News.query.filter_by(category=category, impactedSatellite=impacted_satellite,
                                    occurrenceDate=occurrence_date).order_by(News.modifyDate.asc()).all()
    except Exception as ex:
        return None


def get_news_by_environment(environment):
    try:
        search = "%{}%".format(environment)
        return db.session.query(News).filter(News.environment.like(search)).order_by(
            News.modifyDate.asc()).all()
    except Exception as ex:
        return None


def delete_news_by_id(uuid):
    try:
        db.session.query(
            News
        ).filter(
            News.id == uuid,
        ).delete()

        db.session.commit()
    except Exception as ex:
        pass
    return
