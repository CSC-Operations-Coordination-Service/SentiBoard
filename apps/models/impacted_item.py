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

from apps import db


class ImpactedItem(db.Model):
    __tablename__ = 'ImpactedItem'

    name = db.Column(db.String(64), primary_key=True)
    category = db.Column(db.String(9999))
    synonymous = db.Column(db.String(9999))

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            if hasattr(value, '__iter__') and not isinstance(value, str):
                value = value[0]

            setattr(self, property, value)


def get_impacted_item_by_name(name):
    try:
        return ImpactedItem.query.filter_by(name=name).first()
    except Exception as ex:
        return None


def get_impacted_item_by_category(name):
    try:
        return ImpactedItem.query.filter_by(category=name).all()
    except Exception as ex:
        return []


def get_impacted_item_by_synonymous(synonymous):
    try:
        search = "%{}%".format(synonymous)
        return db.session.query(ImpactedItem).filter(ImpactedItem.synonymous.like(search)).first()
    except Exception as ex:
        return None


def get_impacted_item_by_category_and_synonymous(category, synonymous):
    try:
        search1 = "%{}%".format(category)
        search2 = "%{}%".format(synonymous)
        return db.session.query(ImpactedItem).filter(ImpactedItem.category.like(search1),
                                                     ImpactedItem.synonymous.like(search2)).first()
    except Exception as ex:
        return None
