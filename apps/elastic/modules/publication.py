# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) -
All rights reserved.

This document discloses subject matter in which  has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of  to fulfill the purpose for which the document was
delivered to him.
"""
import copy
import logging
from time import perf_counter

from apps.cache.cache import PublicationProductTreeCache
from apps.elastic import client as elastic_client
from apps.utils import date_utils as utils

logger = logging.getLogger(__name__)


# define a base query format string, with a variable product type condition
# then resolve for each product type
def _get_publication_base_query(start_date, end_date, mission, publication_service):
    return {
        "bool": {
            "must": [
                {"range": {"publication_date": {"gte": start_date, "lte": end_date}}},
                {"term": {"mission": mission}},
                {"term": {"service_type": "DD"}},
                {"term": {"service_id": publication_service}},
            ]
        }
    }


def get_cds_publication_size_by_mission(start_date, end_date, mission):
    logger.debug(
        f"[BEG] CDS PUBLICATION VOLUME for mission {mission}, start: {start_date}, end: {end_date}"
    )
    index = "cds-publication"
    elastic = elastic_client.ElasticClient()
    results = []

    productLevel_list = PublicationProductTreeCache.load_object(mission).get("levels")
    publication_service = PublicationProductTreeCache.load_object(
        "current_publication_service"
    )
    aggs = {"content_length_sum": {"sum": {"field": "content_length"}}}

    # TIme API
    api_start_time = perf_counter()

    for productLevel, level_value in productLevel_list.items():
        logger.debug(
            "[INFO] productLevel=%s | type=%s | value=%s",
            productLevel,
            type(level_value),
            level_value,
        )
        if isinstance(level_value, dict):
            for productTimeliness, productType_list in level_value.items():
                for productType in productType_list:
                    query = {
                        "bool": {
                            "must": [
                                {
                                    "range": {
                                        "publication_date": {
                                            "gte": start_date,
                                            "lte": end_date,
                                        }
                                    }
                                },
                                {"term": {"mission": mission}},
                                {"term": {"product_type": productType}},
                                {"term": {"timeliness": productTimeliness}},
                                {"term": {"service_type": "DD"}},
                                {"term": {"service_id": publication_service}},
                            ]
                        }
                    }

                    try:
                        # Make Time Measurement for single query execution
                        query_start_time = perf_counter()
                        result = elastic.search(
                            index=index, query=query, aggs=aggs, size=0
                        )["aggregations"]["content_length_sum"]["value"]
                        results.append(
                            {
                                "index": index,
                                "mission": mission,
                                "productLevel": productLevel,
                                "productType": productType,
                                "content_length_sum": result,
                            }
                        )
                        query_end_time = perf_counter()
                        logger.debug(
                            f"Query for mission {mission}, product_type: {productType}, start: {start_date},  Query Execution Time : {query_end_time - query_start_time:0.6f}"
                        )
                    except Exception as ex:
                        logger.error(
                            "Failure on mission %s, product type %s: %s",
                            mission,
                            productType,
                            ex,
                        )
                        continue
        elif isinstance(level_value, list):
            for productType in level_value:
                query = {
                    "bool": {
                        "must": [
                            {
                                "range": {
                                    "publication_date": {
                                        "gte": start_date,
                                        "lte": end_date,
                                    }
                                }
                            },
                            {"term": {"mission": mission}},
                            {"term": {"product_type": productType}},
                            {"term": {"service_type": "DD"}},
                            {"term": {"service_id": publication_service}},
                        ]
                    }
                }

                try:
                    # Make Time Measurement for single query execution
                    query_start_time = perf_counter()
                    result = elastic.search(
                        index=index, query=query, aggs=aggs, size=0
                    )["aggregations"]["content_length_sum"]["value"]
                    results.append(
                        {
                            "index": index,
                            "mission": mission,
                            "productLevel": productLevel,
                            "productType": productType,
                            "content_length_sum": result,
                        }
                    )
                    query_end_time = perf_counter()
                    logger.debug(
                        f"Query for mission {mission}, product_type: {productType}, start: {start_date},  Query Execution Time : {query_end_time - query_start_time:0.6f}"
                    )
                except Exception as ex:
                    logger.error(
                        "Failure on mission %s, product type %s: %s",
                        mission,
                        productType,
                        ex,
                    )
                    continue
        else:
            logger.error(
                "[ERROR] Unexpected type for productLevel %s: %s",
                productLevel,
                type(level_value),
            )
    # Make Time Measurement for API measurement
    api_end_time = perf_counter()
    logger.debug(
        f"[END] CDS PUBLICATION VOLUME for mission {mission}, start: {start_date}, end: {end_date} - Execution Time : {api_end_time - api_start_time:0.6f}"
    )
    return results


def get_cds_publication_count_by_mission(start_date, end_date, mission):
    """

    Args:
        start_date (string): Start date of the interval for the statistics ;
        end_date (string): End date of the interval for the statistics
        mission (string):

    Returns: a dictionary with the following structure, repoeated for
    each product type (product level is determined by product type); at the moment, only
    one index is searched for:
    'index': index,
    'mission': mission,
    'productLevel': product_level,
             'productType': product_type,
              'count': the number of products of that product type for the requested period

    """
    logger.debug(
        f"[BEG] CDS PUBLICATION COUNT for mission {mission}, start: {start_date}, end: {end_date}"
    )
    index = "cds-publication"
    elastic = elastic_client.ElasticClient()
    results = []
    # TODO get object and extract productLevel list and filename end
    productLevel_list = PublicationProductTreeCache.load_object(mission).get("levels")
    publication_service = PublicationProductTreeCache.load_object(
        "current_publication_service"
    )
    product_type_format_query = _get_publication_base_query(
        start_date, end_date, mission, publication_service
    )
    logger.debug(
        "CDS PUBLICATION COUNT - reference base query: %s", product_type_format_query
    )
    # TIme API
    api_start_time = perf_counter()
    for product_level, productType_list in productLevel_list.items():
        for product_type in productType_list:
            query = copy.deepcopy(product_type_format_query)
            query["bool"]["must"].append({"term": {"product_type": product_type}})
            body = {"query": query}

            try:
                result = elastic.count(index=index, body=body)["count"]
                # logger.debug("Received COUNT result %s for mission %s, level %s, type %s",
                #            result, mission, productLevel, productType)
                results.append(
                    {
                        "index": index,
                        "mission": mission,
                        "productLevel": product_level,
                        "productType": product_type,
                        "count": result,
                    }
                )
            except Exception as ex:
                logger.error("Failure on mission %s: %s", mission, ex)
                continue
    api_end_time = perf_counter()
    logger.debug(
        f"CDS PUBLICATION COUNT for mission {mission}, start: {start_date}, end: {end_date} - Execution Time : {api_end_time - api_start_time:0.6f}"
    )
    return results


def get_cds_publication_size_trend_by_mission(
    start_date, end_date, mission, num_periods
):
    """

    Args:
        start_date ():
        end_date ():
        mission ():
        num_periods ():

    Returns:
        A dictionary in the format:
        'mission': <the mission retrieved>
        'service_trend': a dictionary with two entries: DAS, DHUS:
            <service_id>: <list of statistics per each pireod>
        'num_periods': the number of subperiods requested
    """
    logger.debug(
        f"[BEG] CDS PUBLICATION SIZE TREND for mission {mission}, start: {start_date}, end: {end_date}"
    )

    trend_result = {"mission": mission, "service_trend": {}, "num_periods": num_periods}
    index = "cds-publication"
    elastic = elastic_client.ElasticClient()
    service_results = {}
    subperiods = utils.get_interval_subperiods(start_date, end_date, int(num_periods))

    aggs = {"content_length_sum": {"sum": {"field": "content_length"}}}
    # TIme API
    api_start_time = perf_counter()
    # TODO: using multiple month-based indices would lead to possible errors for periods
    # spanning over adjacent months
    # e.g.: if periodi is a a week, and the week is overlapping two consecutive monghs,
    # the two values from the first and the second month should be added for the same period.
    #   i.e., we should check if there results related to the same sub-period, and collapse into
    #    one single result, by summing the values
    services = PublicationProductTreeCache.load_object("active_publication_services")

    #    for index in indices:
    for service_id in services:
        logger.debug(
            "Publication Size Trend: Collecting statistics for service %s", service_id
        )
        results = []
        for period_id, subperiod in enumerate(subperiods, start=1):
            # logger.debug("Publication Size Trend: Querying Mission %s, for period %d, subperiod: %s",
            #             mission, period_id, subperiod)
            subperiod_query = _get_publication_base_query(
                subperiod["start_date"], subperiod["end_date"], mission, service_id
            )
            #
            # logger.debug("CDS TREND VOLUEM - Query: %s", subperiod_query)
            try:
                result = elastic.search(
                    index=index, query=subperiod_query, aggs=aggs, size=0
                )["aggregations"]["content_length_sum"]["value"]
                # logger.debug("Received size result %s for mission %s, subperiod %s, dates %s",
                #             result, mission, period_id, subperiod)
                # Todo: change format of result: specify subperiod date range and put
                # count as a field of the record
                results.append(result)
            except Exception as ex:
                logger.error("Failure on mission %s: %s", mission, ex)
                continue
        service_results[service_id] = results
        # logger.debug("Mission: %s, results per service: %s", mission, service_results)
    # If multiple period id results, they should be summed up!
    trend_result["service_trend"] = service_results
    logger.debug("Retrieved Trend: %s", trend_result)
    api_end_time = perf_counter()
    logger.debug(
        f"[END] CDS PUBLICATION SIZE TREND for mission {mission}, start: {start_date}, end: {end_date} - Execution Time : {api_end_time - api_start_time:0.6f}"
    )
    return trend_result


def get_cds_publication_trend_by_mission(start_date, end_date, mission, num_periods):
    """

    Args:
        start_date ():
        end_date ():
        mission ():
        num_periods ():

    Returns:
        A dictionary in the format:
        'mission': <the mission retrieved>
        'service_trend': a dictionary with two entries: DAS, DHUS:
            <service_id>: <list of statistics per each pireod>
        'num_periods': the number of subperiods requested
    """
    logger.debug(
        f"[BEG] CDS PUBLICATION TREND for mission {mission}, start: {start_date}, end: {end_date}"
    )

    trend_result = {"mission": mission, "service_trend": {}, "num_periods": num_periods}
    index = "cds-publication"
    elastic = elastic_client.ElasticClient()
    service_results = {}
    subperiods = utils.get_interval_subperiods(start_date, end_date, int(num_periods))
    # TIme API
    api_start_time = perf_counter()
    # TODO: using multiple month-based indices would lead to possible errors for periods
    # spanning over adjacent months
    # e.g.: if periodi is a a week, and the week is overlapping two consecutive monghs,
    # the two values from the first and the second month should be added for the same period.
    #   i.e., we should check if there results related to the same sub-period, and collapse into
    #    one single result, by summing the values
    services = PublicationProductTreeCache.load_object("active_publication_services")
    #    for index in indices:
    for service_id in services:
        logger.debug(
            "Publication Trend: Collecting statistics for service %s", service_id
        )
        results = []
        for period_id, subperiod in enumerate(subperiods, start=1):
            # logger.debug("Publication Trend: Querying Mission %s, for period %d, subperiod: %s",
            #             mission, period_id, subperiod)
            subperiod_query = _get_publication_base_query(
                subperiod["start_date"], subperiod["end_date"], mission, service_id
            )
            query = {"query": subperiod_query}
            try:
                result = elastic.count(index=index, body=query)["count"]
                logger.debug(
                    "Received result %s for mission %s, subperiod %s, dates %s",
                    result,
                    mission,
                    period_id,
                    subperiod,
                )
                logger.debug(
                    "Publication Statistics Trend Count from index %s, query %s",
                    index,
                    query,
                )
                # Todo: change format of result: specify subperiod date range and put
                # count as a field of the record
                results.append(result)
            except Exception as ex:
                logger.error("Failure on mission %s: %s", mission, ex)
                continue
        service_results[service_id] = results
        # logger.debug("Mission: %s, results per service: %s", mission, service_results)
    # If multiple period id results, they should be summed up!
    trend_result["service_trend"] = service_results
    # logger.debug("Retrieved Trend: %s", trend_result)
    api_end_time = perf_counter()
    logger.debug(
        f"[END] CDS PUBLICATION TREND for mission {mission}, start: {start_date}, end: {end_date} - Execution Time : {api_end_time - api_start_time:0.6f}"
    )
    return trend_result
