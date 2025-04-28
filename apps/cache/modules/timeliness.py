# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) - ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which  has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of  to fulfill the purpose for which the document was
delivered to him.
"""

import logging

import apps.elastic.modules.timeliness as elastic_timeliness
import apps.elastic.modules.timeliness_statistics as elastic_timeliness_stats
from apps.cache.loader.cache_loader import RestCacheLoader
from apps.utils.date_utils import PeriodID

logger = logging.getLogger(__name__)

timeliness_cache_key_format = "/api/reports/cds-product-timeliness/{}-{}/"

timeliness_stats_cache_key_format = "/api/reports/cds-timeliness-statistics/{}-{}/"

old_timeliness_cache_key_format = "/api/reports/cds-product-old-timeliness/{}-{}/"

timeliness_cache_loader = RestCacheLoader(
    "Timeliness",
    timeliness_cache_key_format,
    elastic_timeliness.get_cds_mission_product_timeliness,
)

timeliness_stats_cache_loader: RestCacheLoader = RestCacheLoader(
    "Timeliness Statistics",
    timeliness_stats_cache_key_format,
    elastic_timeliness_stats.get_cds_mission_timeliness_statistics,
)


def timeliness_load_cache(period_id):
    """
    Load Timeliness Rest API Cache for last period_id (days/hour/month) data:
    load data each mission request
    """
    logger.info("Loading Timeliness Cache for last %s", period_id)
    timeliness_cache_loader.load_cache(period_id)


#
# def old_timeliness_load_cache(period_id):
#     """
#     Load Timeliness Rest API Cache for last period_id (days/hour/month) data:
#     load data each mission request
#     """
#     logger.info("Loading OLD Timeliness Cache for last %s", period_id)
#     cache_loader: RestCacheLoader = RestCacheLoader("OLD Timeliness",
#                                                     old_timeliness_cache_key_format,
#                                                     elastic_old_timeliness.get_cds_mission_product_timeliness)
#     cache_loader.load_cache(period_id)


def timeliness_stats_load_cache(period_id):
    """
    Load Timeliness Statistics Rest API Cache for last period_id (days/hour/month) data:
    load data each mission request
    """
    logger.info("Loading Timeliness Statistics Cache for last %s", period_id)
    timeliness_stats_cache_loader.load_cache(period_id)


def timeliness_stats_load_cache_previous_quarter():
    logger.info("Loading Timeliness Statistics Cache for previous quarter")
    timeliness_stats_cache_loader.load_cache_previous_quarter()


def load_timeliness_cache_previous_quarter():
    logger.info("Loading Timeliness Cache for previous quarter")
    timeliness_cache_loader.load_cache_previous_quarter()


def load_all_periods_timeliness_cache():
    periods = [PeriodID.DAY, PeriodID.WEEK, PeriodID.MONTH, PeriodID.QUARTER]
    for period in periods:
        timeliness_load_cache(period)
        timeliness_stats_load_cache(period)
