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
from datetime import datetime
from time import perf_counter

from dateutil.relativedelta import relativedelta

from apps.cache.cache import MissionTimelinessCache
from apps.elastic import client as elastic_client
from apps.elastic.modules.timeliness_query import TimelinessElasticQuery
from apps.utils import elastic_utils

logger = logging.getLogger(__name__)


def get_cds_product_timeliness(start_date: datetime, end_date: datetime, mission: str, timeliness: str, published):
    use_publication = True

    index_name = 'cds-publication' if use_publication else 'cds-product'
    # Use multiple month-based indices if interval is long than 1 month and half
    date_delta = relativedelta(end_date, start_date)
    interval_day_len = date_delta.months * 30 + date_delta.days
    logger.debug("Interval is %d days long", interval_day_len)
    if (interval_day_len > 45 or mission == "S2") and not use_publication:
        indices = elastic_utils.get_month_index_name_from_interval_date(index_name, start_date, end_date)
        logger.debug("Query will be performed on indices: %s", indices)
    else:
        logger.debug("Query will be performed on main index: %s", index_name)
        indices = [index_name]

    # By default no subintervals shall be used to reduce number of searched records
    time_subintervals = []

    elastic = elastic_client.ElasticClient()
    logger.debug("Retrieving Product timeliness for mission %s, timeliness %s, start date: %s, end date: %s",
                 mission, timeliness, start_date, end_date)

    results = []
    # Extract configuration for Mission Timeliness query parameters
    mission_timeliness_cfg = MissionTimelinessCache.load_object(mission)
    logger.debug("Retrieved timeliness configuration: %s", mission_timeliness_cfg)

    # Read sensor configuration, if present
    sensors_cfg = mission_timeliness_cfg.get("sensors", None)

    # Read specific constraints to be applied for this mission products
    constraints_cfg = mission_timeliness_cfg.get("constraints", None)
    # logger.debug("Retrieved constraints configuration: %s for mission %s",
    #             constraints_cfg, mission)

    timeliness_cfg = mission_timeliness_cfg.get(timeliness, None)
    if timeliness_cfg is None:
        logging.error("Requested unknown %s timeliness type for mission %s",
                      timeliness, mission)
        return results

    query_builder = TimelinessElasticQuery(mission, timeliness_cfg, use_publication)
    query_builder.set_interval(start_date, end_date)

    #    ========     Restriction of products to be counted

    if constraints_cfg is not None:
        # apply the constraint with a term/terms clause on the must section
        # Browse the constraints
        query_builder.add_constraints(constraints_cfg)

    #   ========    Exclusion specification
    # logger.debug("Total Must list: %s", must_list)
    #  On Time selection needs a prip_publicaiton_date field set
    pub_field_exist_condition = {"exists": {"field": query_builder.range_time_attribute}}

    # Query section: includes must clauses,
    total_query = query_builder.create_query("count")
    ontime_query = query_builder.create_query("ontime")

    # Only for applying timeliness condition
    # logger.debug("on time Must list: %s", ontime_must_list)
    ontime_query.add_must_clause(pub_field_exist_condition)

    # Build a list of query criteria for timeliness, based on configuration
    # Build and execute a triple query for each query criteria

    # Timeliness Configurations specifies:
    #  threshold (timeliness ok value for publication time)
    #  timeliness (keyword corresponding to this class  of timeliness
    #               to be used when searching products on elastic)
    # Optional/alternative parameters:
    #   level: if a level shall be specified, and returned for the results
    #       Note: the threshold applies for this level products
    #   sensor: if a list of product types shall be specified: the senrso
    #           shall be returned in the results;
    #           product types list shall be retrieved from configuration
    # 1. check if timeliness configuration is a single item, or  a list
    # Retrieve list of Threshold values from configuratin
    thresholds_list = timeliness_cfg.get("thresholds")
    if type(thresholds_list) is not list:
        thresholds_list = [thresholds_list]

    # logger.debug("List of configurations: %s", thresholds_list)
    # For each query criteria, extract: threshold e, timeliness keyword
    #   and either sensor or level if present
    # Build query and execute
    for threshold_cfg in thresholds_list:
        logger.debug("Executing request for Timeliness parameters: %s", threshold_cfg)
        timeliness_value = threshold_cfg.get('threshold')
        level = threshold_cfg.get('product_level', '')
        sensor = threshold_cfg.get('sensor', '')
        sensor_cfg = {}
        if sensors_cfg is not None and sensor and sensor in sensors_cfg:
            # check if sensor is requested;
            # if yes, check the sensor configuration
            # add product type list to must
            sensor_cfg = sensors_cfg.get(sensor)
        count_query_body = query_builder._get_timeliness_product_count_query(total_query,
                                                                             threshold_cfg, sensor_cfg)
        ontime_query_body = query_builder._get_ontime_product_count_query(ontime_query,
                                                                          threshold_cfg, sensor_cfg)

        total_value = on_time = 0
        try:
            # logger.debug("Counting with query %s", count_query_body)
            # Loop through indices
            for index in indices:
                #logger.debug("Querying the index %s", index)
                queries = [{
                    # 'count': count_query_body,
                    'ontime': ontime_query_body}]
                if mission == 'S2' and interval_day_len > 12 and not use_publication:
                    time_subintervals = elastic_utils._get_month_subperiods(start_date, end_date, index)
                    logger.debug("S2 Subintervals for index %s: %s",
                                 index, time_subintervals)
                    if len(time_subintervals):
                        queries = []
                        for subinterval in time_subintervals:
                            # build a pair of queries for each subnterval
                            query_builder.update_query_time_range(ontime_query_body['query'], subinterval)
                            ontime_q = copy.deepcopy(ontime_query_body)
                            queries.append({
                                # 'count': cnt_q,
                                'ontime': ontime_q})

                elastic_query_start_time = perf_counter()
                # TIme request
                count_query_start_time = perf_counter()
                logger.debug("Counting Total on index %s with body: %s", index, count_query_body)
                result = elastic.count(index=index, body=count_query_body)['count']
                total_value += result
                lapse_query_end_time = perf_counter()
                logger.debug(
                    f"Count Query Execution Time (index: {index}) on mission {mission}, timeliness {timeliness}, level {level}, sensor {sensor}: {lapse_query_end_time - count_query_start_time:0.6f}")
                for period_query in queries:
                    # logger.debug("Counting with query timeliness %s", ontime_query_body)
                    logger.debug("Counting Timeliness products on index %s, with body: %s",
                                 index, period_query['ontime'])
                    result = elastic.count(index=index, body=period_query['ontime'])['count']
                    on_time += result
                    lapse1_query_end_time = perf_counter()
                    logger.debug(
                        f"On time Query Execution Time (index: {index}) on mission {mission}, timeliness {timeliness}, level {level}, sensor {sensor} : {lapse1_query_end_time - lapse_query_end_time:0.6f}")

                lapse2_query_end_time = perf_counter()
                logger.debug(
                    f"Total Timeliness Query Execution Time on mission {mission}, timeliness {timeliness}, level {level}, sensor {sensor} : {lapse2_query_end_time - elastic_query_start_time:0.6f}")

            json_result = {'mission': mission, 'timeliness': timeliness,
                           'threshold': timeliness_value,
                           'total_count': total_value, 'on_time': on_time}
            if level is not None and len(level):
                # remove any trailing _ from level
                level = level.strip('_')
                json_result.update({'level': level})
            if sensor is not None and len(sensor):
                json_result.update({'product_group': sensor})
            results.append(json_result)

        except Exception as ex:
            results = []
            logger.error("Failure of Elastic queries for mission %s, timeliness type %s, level: %s, sensor: %s",
                         mission, timeliness, level, sensor)
            logger.error(ex)

    return results


def get_cds_mission_product_timeliness(start_date: datetime, end_date: datetime, mission: str):
    """

    Args:
        start_date ():
        end_date ():
        mission ():

    Returns:

    """
    results = []
    # Extract list of timeliness types for this mission
    mission_timeliness_cfg = MissionTimelinessCache.load_object(mission)
    timeliness_types = MissionTimelinessCache.load_object('timeliness_types')
    mission_timeliness_types = [typ
                                for typ in timeliness_types
                                if typ in mission_timeliness_cfg
                                ]
    # TODO: Make results a Dictionary, and add Start/end date
    logger.debug("Querying timeliness for mission %s from %s to %s excluded",
                 mission, start_date, end_date)
    # If interval length >= 20 days and mission = S2,
    # split interval in periods of 10 days each, and accumulate results
    for tim_type in mission_timeliness_types:
        results.extend(get_cds_product_timeliness(start_date, end_date,
                                                  mission, tim_type,
                                                  published=True))
    return results
