# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) - ${startYear}-${currentYear} ${SERCO}
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

from dateutil.relativedelta import relativedelta
from flask import Response

import apps.ingestion.news_ingestor as news_ingestor
import apps.models.anomalies as anomalies_model
import apps.models.news as news_model
from apps.models.instant_messages import (
    get_instant_messages,
)
from apps import flask_cache
from apps.utils import db_utils, date_utils

logger = logging.getLogger(__name__)

anomalies_cache_key = "/api/events/cds-anomalies/{}-{}"

news_cache_key = "/api/events/cds-news/{}-{}"

events_cache_duration = 604800


def load_anomalies_cache_last_quarter():
    """
    Fetch the anomalies in the last 3 months from the local MYSQL DB, and store results in cache for future reuse.
    The start time is set at 00:00 of the first day of the temporal interval; the stop time is set at 23:59
    """

    cache_key = anomalies_cache_key.format("last", "quarter")
    if flask_cache.get(cache_key):
        return  

    logger.info("[BEG] Loading Anomalies Cache in the last quarter...")
    cache_start_time = perf_counter()

    # Retrieve anomalies in the last quarter from local MYSQL DB
    start_date = datetime.today() - relativedelta(months=3)
    end_date = datetime.today()
    end_date = end_date.replace(hour=23, minute=59, second=59)
    anomalies_last_quarter = anomalies_model.get_anomalies(start_date, end_date)

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    anomalies_last_24h = []
    anomalies_last_7d = []
    anomalies_last_30d = []
    for anomaly in anomalies_last_quarter:

        # Populate cache
        if now - timedelta(hours=24) <= anomaly.start:
            anomalies_last_24h.append(anomaly)
        if now - timedelta(days=7) <= anomaly.start:
            anomalies_last_7d.append(anomaly)
        if now - timedelta(days=30) <= anomaly.start:
            anomalies_last_30d.append(anomaly)

    _set_anomalies_cache("24h", anomalies_last_24h)
    _set_anomalies_cache("7d", anomalies_last_7d)
    _set_anomalies_cache("30d", anomalies_last_30d)
    _set_anomalies_cache("quarter", anomalies_last_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Anomalies Cache in the last quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_anomalies_cache_previous_quarter():
    """
    Fetch the anomalies since the beginning of the previous, completed quarter up to today from the local MYSQL DB,
    and store results in cache for future reuse. The start time is set at 00:00 of the first day of the temporal
    interval; the stop time is set at 23:59:59 of today
    """

    cache_key = anomalies_cache_key.format("previous", "quarter")
    if flask_cache.get(cache_key):
        return 
    
    logger.info("[BEG] Loading Anomalies Cache since the previous quarter...")
    cache_start_time = perf_counter()

    # Define data time range
    start_date, end_date = date_utils.prev_quarter_interval_from_date(datetime.today())
    end_date = datetime.today()
    end_date = end_date.replace(hour=23, minute=59, second=59)

    # Retrieve anomalies up to the previous completed quarter from CAMS
    anomalies_prev_quarter = anomalies_model.get_anomalies(start_date, end_date)

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    anomalies_last_24h = []
    anomalies_last_7d = []
    anomalies_last_30d = []
    anomalies_last_quarter = []
    for anomaly in anomalies_prev_quarter:

        # Populate cache
        if now - timedelta(hours=24) <= anomaly.start:
            anomalies_last_24h.append(anomaly)
        if now - timedelta(days=7) <= anomaly.start:
            anomalies_last_7d.append(anomaly)
        if now - timedelta(days=30) <= anomaly.start:
            anomalies_last_30d.append(anomaly)
        if now - relativedelta(months=3) <= anomaly.start:
            anomalies_last_quarter.append(anomaly)
    _set_anomalies_cache("24h", anomalies_last_24h)
    _set_anomalies_cache("7d", anomalies_last_7d)
    _set_anomalies_cache("30d", anomalies_last_30d)
    _set_anomalies_cache("quarter", anomalies_last_quarter)
    _set_anomalies_cache("previous-quarter", anomalies_prev_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Anomalies Cache in the previous quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_anomalies_cache_full_history():
    cache_key = anomalies_cache_key.format("full", "history")
    if flask_cache.get(cache_key):
        logger.debug("[SKIP] full history cache already warm")
        return

    logger.info("[BEG] Loading Anomalies Cache full history...")
    cache_start_time = perf_counter()


    start_date = datetime(2025, 3, 1, 0, 0, 0)
    end_date = datetime.today().replace(hour=23, minute=59, second=59)

    anomalies_full = anomalies_model.get_anomalies(start_date, end_date)
    _set_anomalies_cache("full-history", anomalies_full)

    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Anomalies Cache full history - Execution Time: {cache_end_time - cache_start_time:0.6f}"
    )


def _set_anomalies_cache(period_id, period_data):
    """
    Store in cache the provided results, and set the validity time of cache according to the data period.
    """

    # Log an acknowledgement message
    logger.debug("Caching anomalies in period: %s", period_id)

    seconds_validity = events_cache_duration
    if period_id == "previous-quarter":
        api_prefix = anomalies_cache_key.format("previous", "quarter")
    elif period_id == "full-history":
        api_prefix = anomalies_cache_key.format("full", "history")
    else:
        api_prefix = anomalies_cache_key.format("last", period_id)

    flask_cache.set(
        api_prefix,
        Response(
            json.dumps(period_data, cls=db_utils.AlchemyEncoder),
            mimetype="application/json",
            status=200,
        ),
        seconds_validity,
    )


def load_news_cache_last_quarter():
    """
    Fetch the news in the last 3 months from DB. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 23:59
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading News Cache in the last quarter...")
    cache_start_time = perf_counter()

    # Retrieve anomalies in the last quarter from local MYSQL DB
    start_date = datetime.today() - relativedelta(months=3)
    end_date = datetime.today()
    end_date = end_date.replace(hour=23, minute=59, second=59)
    messages_last_quarter = get_instant_messages(start_date, end_date)
    if messages_last_quarter is None:
        logger.error("Failed to fetch instant messages for the last quarter")
        return
    logger.info(
        "DB returned %d messages (start=%s, end=%s) for the last quarter",
        len(messages_last_quarter),
        start_date,
        end_date,
    )

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    logger.info("now=%s, 24h boundary=%s", now, now - timedelta(hours=24))

    msgs_last_24h, msgs_last_7d, msgs_last_30d = [], [], []
    try:
        for msg in messages_last_quarter:
            logger.info("msg id=%d, publication date: %s", msg.id, msg.publicationDate)

            # Populate cache
            if now - timedelta(hours=24) <= msg.publicationDate:
                msgs_last_24h.append(msg)
            if now - timedelta(days=7) <= msg.publicationDate:
                msgs_last_7d.append(msg)
            if now - timedelta(days=30) <= msg.publicationDate:
                msgs_last_30d.append(msg)
    except Exception as ex:
        logger.error(
            "Error while processing messages for cache population: %s",
            ex,
            exc_info=True,
        )

    _set_news_cache("24h", msgs_last_24h)
    _set_news_cache("7d", msgs_last_7d)
    _set_news_cache("30d", msgs_last_30d)
    _set_news_cache("quarter", messages_last_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading News Cache in the last quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_news_cache_previous_quarter():
    """
    Fetch the news in the last 3 months from DB. The start time is set at 00:00 of the first day of the temporal interval; the
    stop time is set at 23:59 of today
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading News Cache in the previous quarter...")
    cache_start_time = perf_counter()

    # Define data time range
    start_date, end_date = date_utils.prev_quarter_interval_from_date(datetime.today())
    end_date = datetime.today()
    end_date = end_date.replace(hour=23, minute=59, second=59)

    # Retrieve anomalies up to the previous completed quarter from CAMS
    messages_prev_quarter = get_instant_messages(start_date, end_date)

    if messages_prev_quarter is None:
        logger.error("Failed to fetch instant messages for the previous quarter")
        return

    logger.info(
        "Fetched %d instant messages for previous quarter", len(messages_prev_quarter)
    )

    # Populate cache: results for sub-periods can be deduced from results in the last quarter
    now = datetime.now()
    msgs_last_24h = []
    msgs_last_7d = []
    msgs_last_30d = []
    msgs_last_quarter = []
    for msg in messages_prev_quarter:

        # Populate cache
        if now - timedelta(hours=24) <= msg.publicationDate:
            msgs_last_24h.append(msg)
        if now - timedelta(days=7) <= msg.publicationDate:
            msgs_last_7d.append(msg)
        if now - timedelta(days=30) <= msg.publicationDate:
            msgs_last_30d.append(msg)
        if now - relativedelta(months=3) <= msg.publicationDate:
            msgs_last_quarter.append(msg)
    _set_news_cache("24h", msgs_last_24h)
    _set_news_cache("7d", msgs_last_7d)
    _set_news_cache("30d", msgs_last_30d)
    _set_news_cache("quarter", msgs_last_quarter)
    _set_news_cache("previous-quarter", messages_prev_quarter)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading News Cache in the previous quarter - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def _set_news_cache(period_id, period_data):
    """
    Store in cache the provided results, and set the validity time of cache according to the data period.
    """

    # Log an acknowledgement message
    logger.debug("Caching news in period: %s", period_id)

    seconds_validity = events_cache_duration
    if period_id == "previous-quarter":
        api_prefix = news_cache_key.format("previous", "quarter")
    else:
        api_prefix = news_cache_key.format("last", period_id)
    flask_cache.set(
        api_prefix,
        Response(
            json.dumps(period_data, cls=db_utils.AlchemyEncoder),
            mimetype="application/json",
            status=200,
        ),
        seconds_validity,
    )
