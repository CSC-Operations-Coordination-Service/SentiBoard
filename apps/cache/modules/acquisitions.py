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

import apps.elastic.modules.acquisitions as elastic_acquisitions
from apps import flask_cache

logger = logging.getLogger(__name__)

acquisitions_cache_key = "/api/reporting/cds-acquisitions/{}-{}"

edrs_acquisitions_cache_key = "/api/reporting/cds-edrs-acquisitions/{}-{}"

acquisitions_cache_duration = 604800


def load_acquisitions_cache_last_quarter():
    """
    Fetch the acquisitions in the last 3 months from Elastic DB using the exposed REST APIs, and store results
    in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 23:59
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Acquisitions Cache in the last quarter...")
    cache_start_time = perf_counter()

    # Retrieve acquisitions in the last quarter
    acq_last_quarter = elastic_acquisitions.fetch_acquisitions_last_quarter()

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    acq_last_24h = []
    acq_last_7d = []
    acq_last_30d = []
    for dt in acq_last_quarter:
        acq_stop = datetime.strptime(
            dt["_source"]["planned_data_start"], "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        if now - timedelta(hours=24) <= acq_stop:
            acq_last_24h.append(dt)
        if now - timedelta(days=7) <= acq_stop:
            acq_last_7d.append(dt)
        if now - timedelta(days=30) <= acq_stop:
            acq_last_30d.append(dt)
    _set_acquisitions_cache("24h", acq_last_24h)
    _set_acquisitions_cache("7d", acq_last_7d)
    _set_acquisitions_cache("30d", acq_last_30d)
    _set_acquisitions_cache("quarter", acq_last_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Acquisitions Cache in the last quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_acquisitions_cache_previous_quarter():
    """
    Fetch the acquisitions in the last 3 months from Elastic DB using the exposed REST APIs, and store results
    in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 23:59
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Acquisitions Cache in the previous quarter...")
    cache_start_time = perf_counter()

    # Retrieve acquisitions in the last quarter
    acq_prev_quarter = elastic_acquisitions.fetch_acquisitions_prev_quarter()
    _set_acquisitions_cache("previous-quarter", acq_prev_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Acquisitions Cache in the previous quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def _set_acquisitions_cache(period_id, period_data):
    """
    Store in cache the provided results, and set the validity time of cache according to the data period.
    """

    # Log an acknowledgement message
    logger.debug("Caching acquisitions in period: %s", period_id)

    seconds_validity = acquisitions_cache_duration
    if period_id == "previous-quarter":
        api_prefix = acquisitions_cache_key.format("previous", "quarter")
    else:
        api_prefix = acquisitions_cache_key.format("last", period_id)
    flask_cache.set(
        api_prefix,
        Response(json.dumps(period_data), mimetype="application/json", status=200),
        seconds_validity,
    )


def load_edrs_acquisitions_cache_last_quarter():
    """
    Fetch the EDRS acquisitions in the last 3 months from Elastic DB using the exposed REST APIs, and store
    results in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 259
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading EDRS Acquisitions Cache in the last quarter...")
    cache_start_time = perf_counter()

    # Retrieve EDRS acquisitions in the last quarter
    edrs_acq_last_quarter = elastic_acquisitions.fetch_edrs_acquisitions_last_quarter()

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    edrs_acq_last_24h = []
    edrs_acq_last_7d = []
    edrs_acq_last_30d = []
    for dt in edrs_acq_last_quarter:
        edrs_acq_stop = datetime.strptime(
            dt["_source"]["planned_link_session_start"], "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        if now - timedelta(hours=24) <= edrs_acq_stop:
            edrs_acq_last_24h.append(dt)
        if now - timedelta(days=7) <= edrs_acq_stop:
            edrs_acq_last_7d.append(dt)
        if now - timedelta(days=30) <= edrs_acq_stop:
            edrs_acq_last_30d.append(dt)
    _set_edrs_acquisitions_cache("24h", edrs_acq_last_24h)
    _set_edrs_acquisitions_cache("7d", edrs_acq_last_7d)
    _set_edrs_acquisitions_cache("30d", edrs_acq_last_30d)
    _set_edrs_acquisitions_cache("quarter", edrs_acq_last_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading EDRS Acquisitions Cache in the last quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_edrs_acquisitions_cache_previous_quarter():
    """
    Fetch the EDRS acquisitions in the last 3 months from Elastic DB using the exposed REST APIs, and store results
    in cache for future reuse. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set 23:59
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading EDRS Acquisitions Cache in the previous quarter...")
    cache_start_time = perf_counter()

    # Retrieve EDRS acquisitions in the last quarter
    edrs_acq_prev_quarter = elastic_acquisitions.fetch_edrs_acquisitions_prev_quarter()
    _set_edrs_acquisitions_cache("previous-quarter", edrs_acq_prev_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading EDRS Acquisitions Cache in the previous quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def _set_edrs_acquisitions_cache(period_id, period_data):
    """
    Store in cache the provided results, and set the validity time of cache according to the data period.
    """

    # Log an acknowledgement message
    logger.debug("Caching EDRS acquisitions in period: %s", period_id)

    seconds_validity = acquisitions_cache_duration
    if period_id == "previous-quarter":
        api_prefix = edrs_acquisitions_cache_key.format("previous", "quarter")
    else:
        api_prefix = edrs_acquisitions_cache_key.format("last", period_id)
    flask_cache.set(
        api_prefix,
        Response(json.dumps(period_data), mimetype="application/json", status=200),
        seconds_validity,
    )
