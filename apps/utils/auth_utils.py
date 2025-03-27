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

import hashlib
import logging
import os

import binascii
import flask_login

logger = logging.getLogger(__name__)


def get_user_info():
    user_map = {'is_authenticated': False, 'role': None}
    user = flask_login.current_user

    if not user.is_anonymous:
        user_map['is_authenticated'] = user.is_authenticated
        user_map['role'] = user.role
        user_map['username'] = user.username

    return user_map


def hash_pass(password):
    """Hash a password for storing."""

    salt = hashlib.sha256(os.urandom(60)).hexdigest().encode('ascii')
    pwdhash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'),
                                  salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    return salt + pwdhash  # return bytes


def is_user_authorized(authorized_roles=None):
    if authorized_roles is None or len(authorized_roles) == 0:
        return True

    user = get_user_info()
    for authorized_role in authorized_roles:
        if user.get('role') is not None and user.get('role').upper() == authorized_role.upper():
            return True

    return False


def verify_pass(provided_password, stored_password):
    """Verify a stored password against one provided by user"""

    stored_password = stored_password.decode('ascii')
    salt = stored_password[:64]
    stored_password = stored_password[64:]
    pwdhash = hashlib.pbkdf2_hmac('sha512',
                                  provided_password.encode('utf-8'),
                                  salt.encode('ascii'),
                                  100000)
    pwdhash = binascii.hexlify(pwdhash).decode('ascii')
    return pwdhash == stored_password
