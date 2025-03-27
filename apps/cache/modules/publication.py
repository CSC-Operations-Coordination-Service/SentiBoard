# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${owner}
All rights reserved.

This document discloses subject matter in which ${ownerShort} has 
proprietary rights. Recipient of the document shall not duplicate, use or 
disclose in whole or in part, information contained herein except for or on 
behalf of ${ownerShort} to fulfill the purpose for which the document was 
delivered to him.
"""

import logging

import apps.elastic.modules.publication as elastic_publication
from apps.cache.loader.cache_loader import RestCacheLoader, RestCache_TrendLoader

logger = logging.getLogger(__name__)

PUBLICATION_COUNT = "NUM"
PUBLICATION_VOLUME = "VOL"
PUBLICATION_TREND = "TREND"
PUBLICATION_VOLUME_TREND = "VOL_TREND"
stat_types = [PUBLICATION_COUNT, PUBLICATION_VOLUME, PUBLICATION_TREND, PUBLICATION_VOLUME_TREND]

publication_trend_api_format = '/api/statistics/cds-product-publication-trend/{}-{}/'
publication_volume_trend_api_format = '/api/statistics/cds-product-publication-volume-trend/{}-{}/'
publication_size_api_format = '/api/statistics/cds-product-publication-volume/{}-{}/'
publication_count_api_format = '/api/statistics/cds-product-publication-count/{}-{}/'

publication_cache_loaders = {
    PUBLICATION_COUNT: RestCacheLoader("Publication Statistics",
                                       publication_count_api_format,
                                       elastic_publication.get_cds_publication_count_by_mission),
    PUBLICATION_VOLUME: RestCacheLoader("Publication Volume Statistics",
                                        publication_size_api_format,
                                        elastic_publication.get_cds_publication_size_by_mission),
    PUBLICATION_TREND: RestCache_TrendLoader("Publication Trend Statistics",
                                             publication_trend_api_format,
                                             elastic_publication.get_cds_publication_trend_by_mission),
    PUBLICATION_VOLUME_TREND: RestCache_TrendLoader("Publication Volume Trend Statistics",
                                                    publication_volume_trend_api_format,
                                                    elastic_publication.get_cds_publication_size_trend_by_mission)
}


def load_publication_cache_previous_quarter(stat_type: str):
    """
    Load Publication Rest API Cache for previous quarter (w.r.t. today()):
    load data each mission request
    Load the cache for data of Statistic type: VOL/NUM/TREND
    """
    logger.info("Loading Publication Statistics Cache for type %s for previous quarter",
                stat_type)
    # Select cache loader based on stat type
    cache_loader: RestCacheLoader = publication_cache_loaders.get(stat_type, None)
    if cache_loader is not None:
        cache_loader.load_cache_previous_quarter()


def load_publication_cache(stat_type: str, period_id: str):
    """
    Load Publication Rest API Cache for last period_id (days/hour/month) data:
    load data each mission request
    Load the cache for data of Statistic type: VOL/NUM/TREND
    """
    logger.info("Loading Publication Statistics Cache for type %s for last %s",
                stat_type, period_id)
    # Select cache loader based on stat type
    cache_loader: RestCacheLoader = publication_cache_loaders.get(stat_type, None)
    if cache_loader is not None:
        cache_loader.load_cache(period_id)


periods = ['24h', '7d', '30d', 'quarter']


def load_all_periods_publication_cache():
    """
    Load all publication caches: for each period foreseen, and for each
    publication statistic foreseen (Volume, Count)
    Returns: N/A
    Side effect: caches are loaded with fresh data

    """
    logger.info("[BEG] CDS PUBLICATION (VOLUME/COUNT) - Loading All periods cache")
    for stat_type in stat_types:
        for period in periods:
            load_publication_cache(stat_type, period)
    logger.info("[END] CDS PUBLICATION (VOLUME/COUNT) - Loading All periods cache")


def load_all_periods_publication_stats_cache():
    """
    Load all publication statistics caches: for each period foreseen, and for each
    publication statistic foreseen (Volume, Count)
    Returns: N/A
    Side effect: caches are loaded with fresh data

    """
    logger.info("[BEG] CDS PUBLICATION (VOLUME/COUNT) - Loading All periods cache")
    for stat_type in (PUBLICATION_COUNT, PUBLICATION_VOLUME):
        for period in periods:
            load_publication_cache(stat_type, period)
    logger.info("[END] CDS PUBLICATION (VOLUME/COUNT) - Loading All periods cache")


def load_all_periods_publication_trend_cache():
    """
    Load all publication trend caches: for each period foreseen, and for each
    publication statistic foreseen (Volume, Count)
    Returns: N/A
    Side effect: caches are loaded with fresh data

    """
    logger.info("[BEG] CDS PUBLICATION TREND (VOLUME/COUNT) - Loading All periods cache")
    for stat_type in (PUBLICATION_TREND, PUBLICATION_VOLUME_TREND):
        for period in periods:
            load_publication_cache(stat_type, period)
    logger.info("[END] CDS PUBLICATION TREND (VOLUME/COUNT) - Loading All periods cache")


def load_period_publication_trend_cache(period):
    """
    Load all publication trend caches for specified period , and for each
    publication statistic foreseen (Volume, Count)
    Returns: N/A
    Side effect: caches are loaded with fresh data

    """
    logger.info("[BEG] CDS PUBLICATION TREND (VOLUME/COUNT) - Loading %s period cache", period)
    for stat_type in (PUBLICATION_COUNT, PUBLICATION_VOLUME):
        load_publication_cache(stat_type, period)
    logger.info("[END] CDS PUBLICATION TREND (VOLUME/COUNT) - Loading %s period cache", period)


def load_all_previous_quarter_publication_cache():
    logger.info("[BEG] CDS PUBLICATION (VOLUME/COUNT) - Loading Previous Quarter cache")
    for stat_type in stat_types:
        load_publication_cache_previous_quarter(stat_type)
    logger.info("[END] CDS PUBLICATION (VOLUME/COUNT) - Loading Previous Quarter cache")
