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

import logging
from datetime import datetime

from dateutil.relativedelta import relativedelta

from apps.elastic import client as elastic_client
from apps.utils import date_utils

logger = logging.getLogger(__name__)


def fetch_anomalies_last_quarter():
    """
    Fetch the anomalies in the last 3 months with a definite impact on datatakes from Elastic DB, using the
    exposed REST APIs. The start time is set at 00:00:00 of the first day of the temporal interval; the stop time
    is set at 23:59:59 of the day after.
    """
    logger.debug("Fetching Anomalies in the last Quarter")

    # Retrieve data takes in the last 3 months and store results of query in cache
    end_date = datetime.today()
    start_date = end_date - relativedelta(months=3)
    end_date = end_date + relativedelta(days=1)
    end_date = end_date.strftime('%Y-%m-%d')
    start_date = start_date.strftime('%Y-%m-%d')

    try:

        # Auxiliary variable declaration
        anomalies = []
        indices = ["cds-cams-tickets-static"]
        elastic = elastic_client.ElasticClient()

        # Fetch results from Elastic database
        for index in indices:
            try:
                results = elastic.query_scan_date_range(index=index, date_key='occurence_date', from_date=start_date,
                                    to_date=end_date, query={"exists": {"field": "datatake_ids"}})

                # Convert result into array
                logger.debug("Adding result from cds_cams_tickets_static query for end date: %s", end_date)
                anomalies += results

            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)
                raise cex

            except Exception as ex:
                logger.warning("(cds_cams_tickets_static) Received Elastic error for index: %s", index)
                logger.error(ex)

    except Exception as ex:
        logger.error(ex)

    # Return the complete and normalized set of datatakes
    return anomalies


def fetch_anomalies_prev_quarter():
    """
    Fetch the anomalies in the last completed quarter with a definite impact on datatakes from Elastic DB, using the
    exposed REST APIs. The start time is set at 00:00:00 of the first day of the temporal interval; the stop time
    is set at 23:59:59 of the day after.
    """
    logger.debug("Fetching Anomalies in the last Quarter")

    # Retrieve data takes in the previous, completed quarter and store results of query in cache
    start_date, end_date = date_utils.prev_quarter_interval_from_date(datetime.today())
    start_date = datetime.strftime(start_date, '%Y-%m-%d')
    end_date = datetime.strftime(end_date, '%Y-%m-%d')

    try:

        # Auxiliary variable declaration
        anomalies = []
        indices = ["cds-cams-tickets-static"]
        elastic = elastic_client.ElasticClient()

        # Fetch results from Elastic database
        for index in indices:
            try:
                results = elastic.query_scan_date_range(index=index, date_key='occurence_date', from_date=start_date,
                                    to_date=end_date, query={"exists": {"field": "datatake_ids"}})

                # Convert result into array
                logger.debug("Adding result from cds_cams_tickets_static query for end date: %s", end_date)
                anomalies += results

            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)
                raise cex

            except Exception as ex:
                logger.warning("(cds_cams_tickets_static) Received Elastic error for index: %s", index)
                logger.error(ex)

    except Exception as ex:
        logger.error(ex)

    # Return the complete and normalized set of datatakes
    return anomalies
