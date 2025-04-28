# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) - 2022-${currentYear} Telespazio
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
"""
import logging

import apps.elastic.modules.archive_statistics as elastic_archive
from apps import flask_cache
from apps.cache.loader.cache_loader import RestCacheLoader

logger = logging.getLogger(__name__)
archive_size_api_format = "/api/reporting/cds-product-archive-volume/{}-{}/"

archive_cache_loader = RestCacheLoader(
    "Long Term Archive Volume Statistics",
    archive_size_api_format,
    elastic_archive.get_cds_archive_size_by_mission,
)


def archive_load_cache(period_id):
    """
    Load Long Term Archive Rest API Cache for last period_id (days/hour/month) data:
    load data each mission request
    """
    logger.info("Loading Long Term Archive Cache for last %s", period_id)
    archive_cache_loader.load_cache(period_id)


def load_archive_cache_previous_quarter():
    logger.info("Loading Long Term Archive Cache for previous quarter")
    archive_cache_loader.load_cache_previous_quarter()


def load_archive_cache_lifetime():
    logger.info("Loading Long Term Archive Cache for lifetime")
    archive_cache_loader.load_cache_lifetime()


def load_all_periods_archive_cache():
    archive_cache_loader.load_all_periods_cache()


# TODO: Add checks on arguments!
def get_archive_cached_data(period_type, period_id):
    archive_api_uri = archive_size_api_format.format(period_type, period_id)
    logger.debug("Uri cache key: %s", archive_api_uri)
    if not flask_cache.has(archive_api_uri):
        logger.debug(
            "Loading Cache from API Long Term Archive Volume Last %s", period_id
        )
        if period_type == "last":
            archive_load_cache(period_id)
        elif period_type == "all":
            load_archive_cache_lifetime()
        else:
            load_archive_cache_previous_quarter()
    return flask_cache.get(archive_api_uri)
