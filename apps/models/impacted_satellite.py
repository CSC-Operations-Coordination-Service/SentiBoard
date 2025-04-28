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


class ImpactedSatellite(db.Model):
    __tablename__ = "impactedSatellite"

    name = db.Column(db.String(64), primary_key=True)
    synonymous = db.Column(db.String(9999))

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            if hasattr(value, "__iter__") and not isinstance(value, str):
                value = value[0]

            setattr(self, property, value)


def get_impacted_satellite(name):
    try:
        return ImpactedSatellite.query.filter_by(name=name).first()
    except Exception as ex:
        return None


def get_impacted_satellite_all():
    try:
        return (
            ImpactedSatellite.query.all().order_by(ImpactedSatellite.name.asc()).all()
        )
    except Exception as ex:
        return None


def get_impacted_satellite_by_synonymous(synonymous):
    try:
        search = "%{}%".format(synonymous)
        return (
            db.session.query(ImpactedSatellite)
            .filter(ImpactedSatellite.synonymous.like(search))
            .first()
        )
    except Exception as ex:
        return None
