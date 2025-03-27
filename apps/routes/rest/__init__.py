# -*- encoding: utf-8 -*-
"""
Copyright (c) 2019 - present AppSeed.us
"""

from flask import Blueprint

from apps.cache.cache import ConfigCache

blueprint = Blueprint(
    'rest_blueprint',
    __name__,
    url_prefix=ConfigCache.load_object('application_root')
)
