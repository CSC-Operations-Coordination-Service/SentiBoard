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

import json
import logging
from datetime import datetime, timedelta
from time import perf_counter
from flask import Response, current_app
from threading import Lock
import apps.elastic.modules.datatakes as elastic_datatakes
from apps import flask_cache

# Thread-safe in-memory cache
_completeness_cache = {}
_cache_lock = Lock()

logger = logging.getLogger(__name__)

datatakes_cache_key = "/api/worker/cds-datatakes/{}-{}"

datatakes_by_day_cache_key = "/datatake/day"

datatakes_cache_duration = 604800


def load_datatakes_cache_last_quarter():
    """
    Fetch the datatakes in the last 3 months from Elastic DB using the exposed REST APIs, and store results
    in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 23:59.
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Datatakes Cache in the last quarter...")
    cache_start_time = perf_counter()

    # Retrieve datatakes in the last quarter
    dt_last_quarter = elastic_datatakes.fetch_anomalies_datatakes_last_quarter()

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    dt_last_24h = []
    dt_last_7d = []
    dt_last_30d = []
    for dt in dt_last_quarter:
        sensing_stop = datetime.strptime(
            dt["_source"]["observation_time_stop"], "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        if now - timedelta(hours=24) <= sensing_stop:
            dt_last_24h.append(dt)
        if now - timedelta(days=7) <= sensing_stop:
            dt_last_7d.append(dt)
        if now - timedelta(days=30) <= sensing_stop:
            dt_last_30d.append(dt)
    _set_datatakes_cache("24h", dt_last_24h)
    _set_datatakes_cache("7d", dt_last_7d)
    _set_datatakes_cache("30d", dt_last_30d)
    _set_datatakes_cache("quarter", dt_last_quarter)

    # Note: future datatakes are missing
    logger.info("Building the day-based index of Datatakes in the last 30 days")
    dt_day_table = _build_datatakes_daily_index(dt_last_30d)
    # Cache results
    logger.info("Saving on cache the day-based index of Datatakes")
    flask_cache.set(datatakes_by_day_cache_key, dt_day_table, datatakes_cache_duration)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Datatakes Cache in the last quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_datatakes_cache_previous_quarter():
    """
    Fetch the datatakes in the last 3 months from Elastic DB using the exposed REST APIs, and store results
    in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 23:59
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Datatakes Cache in the previous quarter...")
    cache_start_time = perf_counter()

    # Retrieve datatakes in the last quarter
    dt_prev_quarter = elastic_datatakes.fetch_anomalies_datatakes_prev_quarter()

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    _set_datatakes_cache("previous-quarter", dt_prev_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Datatakes Cache in the previous quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_datatake_details(datatake_id):
    return elastic_datatakes.fetch_datatake_details(datatake_id)


def _set_datatakes_cache(period_id, period_data):
    """
    Store in cache the provided results, and set the validity time of cache according to the data period.
    """

    # Log an acknowledgement message
    logger.debug("Caching datatakes in period: %s", period_id)

    seconds_validity = datatakes_cache_duration
    if period_id == "previous-quarter":
        api_prefix = datatakes_cache_key.format("previous", "quarter")
    else:
        api_prefix = datatakes_cache_key.format("last", period_id)
    flask_cache.set(
        api_prefix,
        Response(json.dumps(period_data), mimetype="application/json", status=200),
        seconds_validity,
    )


def _build_datatakes_daily_index(dt_list, by_end_date=False):
    """
     Load on Table associated to keys the datatakes in the passed list
     The Datatakes are indexed by DatatakeId (including the platform)
     Use Date string as key

    Args:
        dt_list ():

    Returns: Saves on Flask Cache a dictionary: key day string (format dd-mm-yyyy),
    value: a list of  datatake dictionaries (_source values), as found in datatake/anomalies caches.
    Completeness value is saved on fields: 'L0_', 'L1_', 'L2_'

    """
    dt_day_table = {}
    for dt in dt_list:
        dt_data = dt["_source"]
        start_date = dt_data["observation_time_start"]
        dt_id = dt_data["datatake_id"]
        key_day = start_date[:10]
        dt_sat = dt_id[:3]
        # logger.debug("Adding Datatake with ID %s, Satellite %s to Table for day %s",
        #              dt_id, dt_sat, key_day)
        # dt_day_table.setdefault(key_day, {}).update({dt_id: dt['_source']})
        dt_sat_table = dt_day_table.setdefault(key_day, {})
        dt_sat_table.setdefault(dt_sat, {}).update({dt_id: dt_data})
        if by_end_date:
            end_date = dt_data["observation_time_stop"]
            key_end_day = end_date[:10]
            if key_end_day != key_day:
                # Add item for this datatake with key the datatake id
                dt_sat_table = dt_day_table.setdefault(key_end_day, {})
                dt_sat_table.setdefault(dt_sat, {}).update({dt_id: dt_data})

    return dt_day_table


def get_daily_datatakes():
    datatakes_api_uri = datatakes_cache_key.format("last", "quarter")
    if not flask_cache.has(datatakes_api_uri):
        logger.debug("Datatakes Cache (needed by acquisition plan) not yet loaded")
        load_datatakes_cache_last_quarter()
    daily_datatakes = flask_cache.get(datatakes_by_day_cache_key)
    return daily_datatakes


def get_satellite_day_datatakes(satellite, day):
    daily_datatakes = get_daily_datatakes()
    # Extract Datatake for specified Day, Satellite
    # Sort the datatakes by ID
    satellite_day_datatakes = daily_datatakes.get(day).get(satellite)
    logger.debug(
        "Datatakes for Satellite %s, day %s: %s",
        satellite,
        day,
        list(satellite_day_datatakes.values()),
    )
    return list(satellite_day_datatakes.values())


def generate_completeness_cache(datatakes_data):
    """
    Generate summary of all datatakes completeness and store in-memory.
    """
    global _completeness_cache
    temp_cache = {}

    for d in datatakes_data:
        datatake_id = d.get("id")
        src = d.get("raw", {}) or {}
        completeness_list = [
            {"productType": k, "status": round(v, 2)}
            for k, v in src.items()
            if k.endswith("_local_percentage") and isinstance(v, (int, float))
        ]
        temp_cache[datatake_id] = completeness_list

    with _cache_lock:
        _completeness_cache = temp_cache.copy()
        current_app.logger.info(
            f"[CACHE] completeness cache keys: {_completeness_cache.keys()}"
        )


def get_completeness_list(datatake_id):
    """
    Retrieve precomputed completeness list for a datatake.
    """
    return _completeness_cache.get(datatake_id, [])
