# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) - 2022- Telespazio
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
"""

import logging
from time import perf_counter

from apps.cache.cache import PublicationProductTreeCache, ConfigCache
from apps.elastic import client as elastic_client
from apps.utils import date_utils as utils

logger = logging.getLogger(__name__)
# mission_satellites = {
#     "S1": ["S1A", "S1B"],
#     "S2": ["S2A", "S2B"],
#     "S3": ["S3A", "S3B"],
#     "S5": ["S5P"]
# }

# TODO: Chnage name to reflect retrieving both size and count
def get_cds_archive_size_by_mission(start_date, end_date, mission):
    # TODO: make parametric: field group gnid to be specified/configured
    # At the moment we are grouping by service_id
    logger.debug(f"[BEG] CDS LONG TERM ARCHIVE VOLUME for mission {mission}, start: {start_date}, end: {end_date}")
    results = []
    cfg = ConfigCache.load_object('archive_config')
    mission_satellites = cfg.get('mission_satellites')
    # archive_levels = cfg.get('statistics_levels')
    archive_levels = ["L0_"]

    for satellite in mission_satellites.get(mission):
        results.extend(_get_cds_archive_size_by_satellite(start_date, end_date,
                                                          mission, satellite,
                                                          archive_levels))
    logger.debug(
        f"[END] CDS LONG TERM ARCHIVE VOLUME for mission {mission}, start: {start_date}, end: {end_date}")
    return results

def _get_cds_archive_size_by_satellite(start_date, end_date, mission, satellite,
                                       levels):
    index = 'cds-publication'
    time_field =  'sensing_start_date' # 'publication_date'
    elastic = elastic_client.ElasticClient()
    results = []

    # TIme API
    api_start_time = perf_counter()
    if len(levels):
        level_condition = {
            "terms": {
                "product_level": levels
            }
        }
    else:
        level_condition = {
            {
                "term": {
                    "product_level": levels[0]
                }
            }
        }
    # Restriction on Product Level = L0
    query = {
        "bool": {
            "must": [
                {
                    "range": {
                        time_field: {
                            "gte": start_date,
                            "lte": end_date
                        }
                    }
                },
                level_condition,
                {
                    "term": {
                        "satellite_unit": satellite
                    }
                },
                {
                    "term": {
                        "service_type": 'LTA'
                    }
                },
            ]
        }
    }
    # Add Aggregation level by satellite
    aggs = {
        "group_by_level": {
            "terms": {"field": "service_id"},
            "aggs": {
                "total_size": {"sum": {"field": "content_length"}}
            }
        }
    }

    try:
        # Make Time Measurement for single query execution
        logger.debug(f"CDS LONG TERM ARCHIVE - Query for mission {mission} start: {start_date}, end: {end_date}: {query}")
        query_start_time = perf_counter()
        level_data = \
            elastic.search(index=index, query=query, aggs=aggs, size=0)['aggregations']['group_by_level'][
                'buckets']
        #  aggregate results by level (e.g. field specified in "group_by_level" aggregation)
        for result in level_data:
            total_size, total_count, level = (result['total_size']['value'],
                                              result['doc_count'],
                                              result['key'])
            results.append({'index': index, 'mission': mission,
                            'satellite': satellite,
                            'content_length_sum': total_size,
                            'count': total_count,
                            'product_level': level})
        query_end_time = perf_counter()
        # logger.debug(f"Query for mission {mission}, product_type: {productType}, start: {start_date},  Query Execution Time : {query_end_time - query_start_time:0.6f}")
    except Exception as ex:
        logger.error("Failure of Long Term Archive Elastic query for mission %s, start: %s, end: %s",
                     mission, start_date, end_date)
        logger.error(ex)
        return []

    # Make Time Measurement for API measurement
    api_end_time = perf_counter()
    logger.debug(
        f"[END] CDS LONG TERM ARCHIVE VOLUME for mission {mission}, satellite {satellite}, start: {start_date}, end: {end_date} - Execution Time : {api_end_time - api_start_time:0.6f}")
    return results
