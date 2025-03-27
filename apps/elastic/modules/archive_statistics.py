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

from apps.cache.cache import PublicationProductTreeCache
from apps.elastic import client as elastic_client
from apps.utils import date_utils as utils

logger = logging.getLogger(__name__)


def get_cds_archive_size_by_mission(start_date, end_date, mission):
    logger.debug(f"[BEG] CDS LONG TERM ARCHIVE VOLUME for mission {mission}, start: {start_date}, end: {end_date}")
    index = 'cds-publication'
    elastic = elastic_client.ElasticClient()
    results = []

    # TIme API
    api_start_time = perf_counter()

    query = {
        "bool": {
            "must": [
                {
                    "range": {
                        "publication_date": {
                            "gte": start_date,
                            "lte": end_date
                        }
                    }
                },
                {
                    "term": {
                        "mission": mission
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
        # TODO: aggregate results by level
        for result in level_data:
            total_size, total_count, level = (result['total_size']['value'],
                                              result['doc_count'],
                                              result['key'])
            results.append({'index': index, 'mission': mission,
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

    # TODO Make Time Measurement for API measurement
    api_end_time = perf_counter()
    logger.debug(
        f"[END] CDS LONG TERM ARCHIVE VOLUME for mission {mission}, start: {start_date}, end: {end_date} - Execution Time : {api_end_time - api_start_time:0.6f}")
    return results
