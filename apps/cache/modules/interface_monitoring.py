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
from apps import flask_cache

import apps.elastic.modules.interface_monitoring as elastic_interface_monitoring

logger = logging.getLogger(__name__)

interface_monitoring_cache_key = '/api/reporting/cds-interface-status-monitoring/{}-{}/{}'

interface_monitoring_cache_duration = 604800


def load_interface_monitoring_cache_last_quarter(service_name):
    """
            Fetch the failed interface monitoring status in the selected period from Elastic DB using the exposed REST APIs.
            The start time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
            """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Interface Monitoring Status in the last quarter...")
    cache_start_time = perf_counter()

    # Retrieve failed status monitoring interfaces in the last quarter
    status_list_last_quarter = elastic_interface_monitoring.fetch_interface_monitoring_last_quarter(service_name)

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    status_interface_last_24h = []
    status_interface_last_7d = []
    status_interface_last_30d = []
    for dt in status_list_last_quarter:
        status_start = datetime.strptime(dt['_source']['status_time_start'], '%Y-%m-%dT%H:%M:%S.%fZ')
        if now - timedelta(hours=24) <= status_start:
            status_interface_last_24h.append(dt)
        if now - timedelta(days=7) <= status_start:
            status_interface_last_7d.append(dt)
        if now - timedelta(days=30) <= status_start:
            status_interface_last_30d.append(dt)
    _set_interface_monitoring_cache('24h', service_name, status_interface_last_24h)
    _set_interface_monitoring_cache('7d', service_name, status_interface_last_7d)
    _set_interface_monitoring_cache('30d', service_name, status_interface_last_30d)
    _set_interface_monitoring_cache('quarter', service_name, status_list_last_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Interface Monitoring Status in the last quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}")


def load_interface_monitoring_cache_prev_quarter(service_name):
    """
            Fetch the failed interface monitoring status in the selected period from Elastic DB using the exposed REST APIs.
            The start time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
            """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Interface Monitoring Status in the previous quarter...")
    cache_start_time = perf_counter()

    # Retrieve failed status monitoring interfaces in the last quarter
    status_list_prev_quarter = elastic_interface_monitoring.fetch_interface_monitoring_prev_quarter(service_name)
    _set_interface_monitoring_cache('previous-quarter', service_name, status_list_prev_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Interface Monitoring Status in the previous quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}")


def _set_interface_monitoring_cache(period_id, service_name, period_data):
    """
        Store in cache the provided results, and set the validity time of cache according to the data period.
        """

    # Log an acknowledgement message
    logger.debug("Caching acquisitions in period: %s", period_id)

    seconds_validity = interface_monitoring_cache_duration
    if period_id == 'previous-quarter':
        api_prefix = interface_monitoring_cache_key.format('previous', 'quarter', service_name)
    else:
        api_prefix = interface_monitoring_cache_key.format('last', period_id, service_name)
    flask_cache.set(api_prefix, Response(json.dumps(period_data), mimetype="application/json", status=200),
                    seconds_validity)
