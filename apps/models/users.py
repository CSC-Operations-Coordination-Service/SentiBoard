# -*- encoding: utf-8 -*-
"""
Copyright (c) 2019 - present AppSeed.us
"""

from datetime import datetime

from flask_login import UserMixin

from apps import db, login_manager
from apps.utils.auth_utils import hash_pass
from apps.utils.db_utils import generate_uuid


class Users(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.String(64), primary_key=True)
    username = db.Column(db.String(64), unique=True)
    email = db.Column(db.String(64), unique=True)
    password = db.Column(db.LargeBinary)
    role = db.Column(db.String(64))
    modifyDate = db.Column(db.DateTime)

    def __init__(self, **kwargs):
        for property, value in kwargs.items():
            # depending on whether value is an iterable or not, we must
            # unpack it's value (when **kwargs is request.form, some values
            # will be a 1-element list)
            if hasattr(value, "__iter__") and not isinstance(value, str):
                # the ,= unpack of a singleton fails PEP8 (travis flake8 test)
                value = value[0]

            if property == "password":
                value = hash_pass(value)  # we need bytes here (not plain str)

            setattr(self, property, value)

    def __repr__(self):
        return str(self.username)


@login_manager.user_loader
def get_user(id):
    return Users.query.filter_by(id=id).first()


def get_users():
    try:
        users = Users.query.order_by(Users.modifyDate.asc()).all()
        return users
    except Exception as ex:
        return None


@login_manager.request_loader
def request_loader(request):
    username = request.form.get("username")
    user = Users.query.filter_by(username=username).first()
    return user if user else None


def save_user(username, email, password, role=None):
    try:
        role = role if not None else "ecuser"
        modify_date = datetime.now()
        user = Users(
            id=str(generate_uuid()),
            username=username,
            email=email,
            password=password,
            role=role,
            modifyDate=modify_date,
        )
        db.session.add(user)
        db.session.commit()
        return user
    except Exception as ex:
        db.session.rollback()
    return None


def update_user(id, username, email, password=None, role=None):
    try:
        user = Users.query.filter_by(id=id).first()
        user.username = username
        user.email = email
        if password != "":
            user.password = hash_pass(password)
        user.role = role if role != "" else user.role
        user.modifyDate = datetime.now()
        db.session.commit()
        return user
    except Exception as ex:
        db.session.rollback()
    return None


def delete_user(username):
    try:
        role = Users.query.filter_by(username=username).delete()
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
    return None
