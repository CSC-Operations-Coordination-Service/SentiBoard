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


class Categories(db.Model):
    __tablename__ = "categories"

    name = db.Column(db.String(64), primary_key=True)
    synonymous = db.Column(db.String(9999))

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            if hasattr(value, "__iter__") and not isinstance(value, str):
                value = value[0]

            setattr(self, property, value)


def get_category_by_name(name):
    try:
        return Categories.query.filter_by(name=name).first()
    except Exception as ex:
        return None


def get_category_by_synonymous(synonymous):
    try:
        search = r"\b{}\b".format(synonymous)  # solution to add only
        return (
            db.session.query(Categories)
            .filter(Categories.synonymous.op("~*")(search))
            .first()
        )
    except Exception as ex:
        return None
