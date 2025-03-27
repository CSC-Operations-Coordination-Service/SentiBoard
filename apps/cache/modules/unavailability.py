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

from flask import Response

import apps.elastic.modules.unavailability as elastic_unavailability
from apps import flask_cache

logger = logging.getLogger(__name__)

unavailability_cache_key = '/api/reporting/cds-sat-unavailability/{}-{}'

unavailability_cache_duration = 604800


def load_unavailability_cache_last_quarter():
    """
    Fetch the unavailabilities in the last 3 months from Elastic DB using the exposed REST APIs, and store results
    in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 23:59
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Sat Unavailability Cache in the last quarter...")
    cache_start_time = perf_counter()

    # Retrieve unavailabilities in the last quarter
    sat_unav_last_quarter = elastic_unavailability.fetch_unavailability_last_quarter()

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    sat_unav_last_24h = []
    sat_unav_last_7d = []
    sat_unav_last_30d = []
    for dt in sat_unav_last_quarter:
        unav_stop = datetime.strptime(dt['_source']['start_time'], '%Y-%m-%dT%H:%M:%S.%fZ')
        if now - timedelta(hours=24) <= unav_stop:
            sat_unav_last_24h.append(dt)
        if now - timedelta(days=7) <= unav_stop:
            sat_unav_last_7d.append(dt)
        if now - timedelta(days=30) <= unav_stop:
            sat_unav_last_30d.append(dt)
    _set_unavailability_cache('24h', sat_unav_last_24h)
    _set_unavailability_cache('7d', sat_unav_last_7d)
    _set_unavailability_cache('30d', sat_unav_last_30d)
    _set_unavailability_cache('quarter', sat_unav_last_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(f"[END] Loading Sat Unavailability Cache in the last quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}")


def load_unavailability_cache_previous_quarter():
    """
        Fetch the unavailabilities in the last 3 months from Elastic DB using the exposed REST APIs, and store results
        in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
        stop time is set at 23:59
        """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Sat Unavailability Cache in the previous quarter...")
    cache_start_time = perf_counter()

    # Retrieve acquisitions in the last quarter
    acq_prev_quarter = elastic_unavailability.fetch_unavailability_prev_quarter()
    _set_unavailability_cache('previous-quarter', acq_prev_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(f"[END] Loading Sat Unavailability Cache in the previous quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}")


def _set_unavailability_cache(period_id, period_data):
    """
        Store in cache the provided results, and set the validity time of cache according to the data period.
        """

    # Log an acknowledgement message
    logger.debug("Caching acquisitions in period: %s", period_id)

    seconds_validity = unavailability_cache_duration
    if period_id == 'previous-quarter':
        api_prefix = unavailability_cache_key.format('previous', 'quarter')
    else:
        api_prefix = unavailability_cache_key.format('last', period_id)
    flask_cache.set(api_prefix, Response(json.dumps(period_data), mimetype="application/json", status=200),
                    seconds_validity)
