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


class UserRole(db.Model):
    __tablename__ = 'userRole'

    name = db.Column(db.String(64), primary_key=True)
    description = db.Column(db.String(9999))

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            if hasattr(value, '__iter__') and not isinstance(value, str):
                value = value[0]

            setattr(self, property, value)


def get_roles():
    try:
        return UserRole.query.all()
    except Exception as ex:
        return []


def save_role(name, description=''):
    try:
        role = UserRole(name=name, description=description)
        db.session.add(role)
        db.session.commit()
        return role
    except Exception as ex:
        db.session.rollback()
    return None


def delete_role(name):
    try:
        role = UserRole.query.filter_by(name=name).delete();
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
    return None
