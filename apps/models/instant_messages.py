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

from apps import db
from apps.utils.db_utils import generate_uuid

logger = logging.getLogger(__name__)


class InstantMessages(db.Model):
    __tablename__ = 'instantMessages'

    id = db.Column(db.String(64), primary_key=True)
    title = db.Column(db.String(9999))
    text = db.Column(db.String(9999))
    link = db.Column(db.String(9999))
    publicationDate = db.Column(db.DateTime)
    messageType = db.Column(db.String(999))
    modifyDate = db.Column(db.DateTime)

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            if hasattr(value, '__iter__') and not isinstance(value, str):
                value = value[0]

            setattr(self, property, value)


def save_instant_messages(title, text, link, publication_date, message_type, modify_date=datetime.now()):
    try:
        instant_message = InstantMessages(id=str(generate_uuid()), title=title, text=text, link=link,
                                           publicationDate=publication_date, messageType=message_type,
                                           modifyDate=modify_date)
        db.session.add(instant_message)
        db.session.commit()
        return instant_message
    except Exception as ex:
        db.session.rollback()
    return None


def update_instant_messages(title, text, link, publication_date, message_type, modify_date=datetime.now()):
    try:
        instant_message = db.session.query(InstantMessages).filter(InstantMessages.id == id).first()
        if instant_message is not None:
            instant_message.title = title
            instant_message.text = text
            instant_message.publicationDate = publication_date
            instant_message.modifyDate = modify_date
        else:
            logger.warning("News with title %s not found, creating new entry", title)
            instant_message = InstantMessages(id=str(generate_uuid()), title=title, text=text, link=link,
                                               publicationDate=publication_date, messageType=message_type,
                                               modifyDate=modify_date)
            db.session.add(instant_message)
        db.session.commit()
        return instant_message
    except Exception as ex:
        db.session.rollback()
    return None


def update_instant_messages_categorization(title, text, link, publication_date, message_type, modify_date=datetime.now()):
    try:
        instant_message = db.session.query(InstantMessages).filter(InstantMessages.id == id).first()
        if instant_message is not None:
            instant_message.title = title
            instant_message.link = link
            instant_message.text = text
            instant_message.publicationDate = publication_date
            instant_message.message_type = message_type
            instant_message.modifyDate = modify_date
            db.session.commit()
            return instant_message
    except Exception as ex:
        db.session.rollback()
    return None

def get_instant_messages(start_date=None, end_date=None):
    try:
        if start_date is None or end_date is None:
            return InstantMessages.query.order_by(InstantMessages.publicationDate.asc()).all()
        else:
            return InstantMessages.query.filter(InstantMessages.publicationDate is not None). \
                filter(InstantMessages.publicationDate >= start_date).filter(InstantMessages.publicationDate <= end_date).order_by(
                InstantMessages.publicationDate.asc()).all()
    except Exception as ex:
        logger.error("Retrieving News, received error: %s", ex, exc_info=True)
        return None



def get_latest_instant_messages(limit=20):
    from apps import db
    return db.session.query(InstantMessages).order_by(InstantMessages.publicationDate.desc()).limit(limit).all()


def delete_instant_messages_by_id(uuid):
    try:
        db.session.query(
            InstantMessages
        ).filter(
            InstantMessages.id == uuid,
        ).delete()

        db.session.commit()
    except Exception as ex:
        pass
    return
