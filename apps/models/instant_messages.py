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
from datetime import datetime, timezone

from apps import db
from apps.utils.db_utils import generate_uuid

logger = logging.getLogger(__name__)


# ── messageType ↔ status mapping ──────────────────────────────────────────
#
#   messageType  │  status     (shown in UI)
#   ─────────────┼─────────────────────────
#   warning      │  new        yellow !
#   info         │  new        yellow !  (legacy fallback)
#   success      │  resolved   green  ✓
#   danger       │  disaster   red    ⚠
#   (anything)   │  new        safe default
#

_TYPE_TO_STATUS = {
    "warning": "new",
    "info": "new",
    "success": "resolved",
    "danger": "disaster",
}

_STATUS_TO_TYPE = {
    "new": "warning",
    "resolved": "success",
    "disaster": "danger",
}


def message_type_to_status(message_type: str) -> str:
    """Derive the UI status from a messageType string."""
    return _TYPE_TO_STATUS.get((message_type or "").lower(), "new")


def status_to_message_type(status: str) -> str:
    """Convert a UI status back to the messageType stored in the DB."""
    return _STATUS_TO_TYPE.get((status or "").lower(), "warning")


class InstantMessages(db.Model):
    __tablename__ = "instantMessages"

    id = db.Column(db.String(64), primary_key=True)
    title = db.Column(db.String(9999))
    text = db.Column(db.String(9999))
    link = db.Column(db.String(9999))
    publicationDate = db.Column(db.DateTime)
    messageType = db.Column(db.String(999))
    modifyDate = db.Column(db.DateTime)

    def __init__(self, **kwargs):
        for prop, value in kwargs.items():
            if hasattr(value, "__iter__") and not isinstance(value, str):
                value = value[0]
            setattr(self, prop, value)

    @property
    def status(self) -> str:
        """Read-only derived property — no DB column needed."""
        return message_type_to_status(self.messageType)

    def to_dict(self, pub_str: str = None) -> dict:
        """Serialise to a dict for Jinja templates or JSON responses."""
        return {
            "id": self.id,
            "title": self.title,
            "text": self.text,
            "link": self.link,
            "messageType": self.messageType,
            "status": self.status,  # always present, derived
            "publicationDate": pub_str
            or (self.publicationDate.isoformat() if self.publicationDate else None),
        }


def save_instant_messages(
    title,
    text,
    link,
    publication_date,
    message_type=None,
    status=None,
    modify_date=None,
):
    """
    Create a new message.
    Pass either message_type ('warning'/'success'/'danger')
    or status ('new'/'resolved'/'disaster') — status takes priority if both.
    """
    if modify_date is None:
        modify_date = datetime.now()
    if status:
        message_type = status_to_message_type(status)
    try:
        msg = InstantMessages(
            id=str(generate_uuid()),
            title=title,
            text=text,
            link=link,
            publicationDate=publication_date,
            messageType=message_type,
            modifyDate=modify_date,
        )
        db.session.add(msg)
        db.session.commit()
        return msg
    except Exception as ex:
        logger.error("save_instant_messages failed: %s", ex, exc_info=True)
        db.session.rollback()
    return None


def update_instant_messages(
    id,
    title,
    text,
    link,
    publication_date,
    message_type=None,
    status=None,
    modify_date=None,
):
    """
    Update an existing message by id.
    Pass either message_type or status — status takes priority if both.
    """
    if modify_date is None:
        modify_date = datetime.now()
    if status:
        message_type = status_to_message_type(status)
    try:
        msg = db.session.query(InstantMessages).filter(InstantMessages.id == id).first()

        if msg is not None:
            msg.title = title
            msg.text = text
            msg.link = link
            msg.publicationDate = publication_date
            msg.messageType = message_type
            msg.modifyDate = modify_date
        else:
            logger.warning("News id %s not found, creating new entry", id)
            msg = InstantMessages(
                id=str(generate_uuid()),
                title=title,
                text=text,
                link=link,
                publicationDate=publication_date,
                messageType=message_type,
                modifyDate=modify_date,
            )
            db.session.add(msg)

        db.session.commit()
        return msg
    except Exception as ex:
        logger.error("update_instant_messages failed: %s", ex, exc_info=True)
        db.session.rollback()
        logger.exception("Error updating instant message: %s", message_id)
    return None


def get_instant_messages(start_date=None, end_date=None):
    try:
        q = InstantMessages.query
        if start_date and end_date:
            q = q.filter(
                InstantMessages.publicationDate.isnot(None),
                InstantMessages.publicationDate >= start_date,
                InstantMessages.publicationDate <= end_date,
            )
        return q.order_by(InstantMessages.publicationDate.asc()).all()
    except Exception as ex:
        logger.error("get_instant_messages failed: %s", ex, exc_info=True)
        return None


def get_latest_instant_messages(limit=20):
    return (
        db.session.query(InstantMessages)
        .order_by(InstantMessages.publicationDate.desc())
        .limit(limit)
        .all()
    )


def delete_instant_messages_by_id(uuid):
    try:
        db.session.query(InstantMessages).filter(InstantMessages.id == uuid).delete()
        db.session.commit()
    except Exception as ex:
        logger.error("delete_instant_messages_by_id failed: %s", ex, exc_info=True)
        db.session.rollback()
