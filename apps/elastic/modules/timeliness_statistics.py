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
from datetime import datetime
from time import perf_counter

from dateutil.relativedelta import relativedelta

from apps.cache.cache import MissionTimelinessCache
from apps.elastic.client import ElasticClient
from apps.elastic.modules.timeliness_query import TimelinessElasticQuery, TimelinessConfigurationKeys

logger = logging.getLogger(__name__)

TIMELINESS_STATS_AGG = 'timeliness_statistics'
TIMELINESS_OUTLIERS_AGG = 'timeliness_outliers'

def timeliness_convert_to_hour(timeliness_result):
    logger.debug("Convertinv time values to hours in Query Result: %s", timeliness_result)
    # TODO: Timeliness Reults Keys are defined in a caller function:
    # Put in constant!!
    timeliness_stats = timeliness_result[TIMELINESS_STATS_AGG]
    timeliness_pcentiles = timeliness_result[TIMELINESS_OUTLIERS_AGG]['values']

    for key in timeliness_stats:
        if key != 'count' and type(timeliness_stats[key]) is not dict:
            # logger.debug("Converting to hour item with key %s, value: %s",
            #             key, timeliness_stats[key])
            timeliness_stats[key] = 0 if timeliness_stats[key] is None else timeliness_stats[key] / 1000000 / 3600
        elif key != 'count':
            subdict = timeliness_stats[key]
            for subkey in subdict:
                # logger.debug("Converting to hour item in %s with key %s",
                #             key, subkey)
                subdict[subkey] = 0 if subdict[subkey] is None else subdict[subkey] / 3600 / 1000000

    for key in timeliness_pcentiles:
        #logger.debug("Converting to hour percentile item with key %s, value: %s",
        #             key, timeliness_pcentiles[key])
        timeliness_pcentiles[key] = 0 if timeliness_pcentiles[key] is None else timeliness_pcentiles[key] / 3600 / 1000000


def get_cds_timeliness_statistics(start_date: datetime, end_date: datetime,
                                  mission: str, timeliness: str):
    # Use multiple month-based indices if interval is long than 1 month and half
    date_delta = relativedelta(end_date, start_date)
    interval_day_len = date_delta.months * 30 + date_delta.days
    logger.debug("Interval is %d days long", interval_day_len)

    # By default, no subintervals shall be used to reduce number of searched records
    logger.debug("Retrieving Timeliness Statistics for mission %s, timeliness %s, start date: %s, end date: %s",
                 mission, timeliness, start_date, end_date)

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
        return []

    query_builder = TimelinessElasticQuery(mission, timeliness_cfg, True)
    query_builder.set_interval(start_date, end_date)

    #    ========     Restriction of products to be counted

    if constraints_cfg is not None:
        # apply the constraint with a term/terms clause on the must section
        # Browse the constraints
        query_builder.add_constraints(constraints_cfg)

    #   ========    Exclusion specification

    # Build a list of query criteria for timeliness, based on configuration
    # Build and execute a triple query for each query criteria

    # Timeliness Configurations specifies:
    #  threshold (timeliness ok value for publication time)
    #  timeliness (keyword corresponding to this class  of timeliness
    #               to be used when searching products on elastic)
    # Optional/alternative parameters:
    #   level: if a level shall be specified, and returned for the results
    #       Note: the threshold applies for this level products
    #   sensor: if a list of product types shall be specified: the sensor
    #           shall be returned in the results;
    #           product types list shall be retrieved from configuration
    # 1. check if timeliness configuration is a single item, or  a list
    # Retrieve list of Threshold values from configuration
    thresholds_list = timeliness_cfg.get("thresholds")
    if type(thresholds_list) is not list:
        thresholds_list = [thresholds_list]
    stat_agg_name = TIMELINESS_STATS_AGG
    perc_agg_name = TIMELINESS_OUTLIERS_AGG
    publication_timeliness_field = "from_sensing_timeliness"
    # for Extended Stats: collect statistics aggregations;
    # if field is missing, assign value 0
    # use sigma for standard deviation
    #
    # Percentiles aggregation is used to collect outliers
    stat_sigma = 2
    stats_aggs = {
        perc_agg_name: {
            "percentiles": {"field": publication_timeliness_field,
                            "percents": [25.0, 50.0, 75.0]
                            }
        },
        stat_agg_name: {
            "extended_stats": {"field": publication_timeliness_field,
                               "missing": 0, "sigma": stat_sigma}},
    }

    return _retrieve_elastic_timeliness(mission, query_builder,  sensors_cfg,
                                        stats_aggs, thresholds_list, timeliness)


def _retrieve_elastic_timeliness(mission, query_builder,
                                 sensors_cfg,
                                 stats_aggs, thresholds_list, timeliness):
    index_name = 'cds-publication'
    elastic = ElasticClient()
    # Query section: includes must clauses,
    stat_query = query_builder.create_query("statistics")
    results = []
    logger.debug("Executing Timeliness Queries for mission %s, with Aggregation: %s",
                 mission,
                 stats_aggs)
    # logger.debug("List of configurations: %s", thresholds_list)
    # For each query criteria, extract: threshold e, timeliness keywork
    #   and either sensor or level if present
    # Build query and execute
    for threshold_cfg in thresholds_list:
        logger.debug("Executing request for Timeliness parameters: %s", threshold_cfg)
        timeliness_value = threshold_cfg.get('threshold')
        level = threshold_cfg.get(TimelinessConfigurationKeys.LevelKey, '')
        sensor = threshold_cfg.get('sensor', '')
        sensor_cfg = {}
        if sensors_cfg is not None and sensor and sensor in sensors_cfg:
            # check if sensor is requested;
            # if yes, check the sensor configuration
            # add product type list to must
            sensor_cfg = sensors_cfg.get(sensor)
        threshold_stat_query = query_builder._get_timeliness_statistics_query(stat_query,
                                                                              threshold_cfg, sensor_cfg)

        total_value = 0
        try:
            # logger.debug("Counting with query %s", count_query_body)
            logger.debug("Querying the index %s", index_name)
            elastic_query_start_time = perf_counter()
            logger.debug(" Timeliness statistics on index %s, with body: %s",
                         index_name, threshold_stat_query)
            stat_agg_result = elastic.search(index=index_name, query=threshold_stat_query,
                                             aggs=stats_aggs, size=0)['aggregations']
            try:
                timeliness_convert_to_hour(stat_agg_result)
            except Exception as ex:
                logger.warning("Error whli converting Timeliness results time values to hour: %s", ex)
            lapse2_query_end_time = perf_counter()
            logger.debug(
                f"Total Timeliness Query Execution Time on mission {mission}, timeliness {timeliness}, level {level}, "
                f"sensor {sensor} : {lapse2_query_end_time - elastic_query_start_time:0.6f}")

            json_result = {'mission': mission, 'timeliness': timeliness,
                           'threshold': timeliness_value,
                           'statistics': stat_agg_result}
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


def get_cds_mission_timeliness_statistics(start_date: datetime, end_date: datetime, mission: str):
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
    # TODO: Make resustl a Dictionary, and add Start/end date
    logger.debug("Querying timeliness for mission %s from %s to %s excluded",
                mission, start_date, end_date)
    # If interval length >= 20 days and mission = S2,
    # split interval in periods of 10 days each, and accumulate results
    for tim_type in mission_timeliness_types:
        results.extend(get_cds_timeliness_statistics(start_date, end_date,
                                                     mission, tim_type))
    return results
