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

from datetime import datetime

from dateutil.relativedelta import relativedelta

from apps.elastic import client as elastic_client
from apps.utils import date_utils
from apps.utils.elastic_utils import logger


def fetch_unavailability_last_quarter():
    """
        Fetch the unavailabilities in the last 3 months from Elastic DB using the exposed REST APIs. The start time
        is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
        """

    # Define data time range
    end_date = datetime.today()
    start_date = end_date - relativedelta(months=3)
    end_date = end_date.strftime('%d-%m-%Y')
    start_date = start_date.strftime('%d-%m-%Y')

    # Retrieve unavailabilities from Elastic client
    unav_last_quarter = _get_cds_unavailability(start_date, end_date)

    # Return the complete and normalized set of unavailabilities
    return unav_last_quarter


def fetch_unavailability_prev_quarter():
    """
        Fetch the unavailabilities in the previous completed quarter from Elastic DB using the exposed REST APIs. The start
        time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
        """

    # Define data time range
    start_date, end_date = date_utils.prev_quarter_interval_from_date(datetime.today())
    start_date = datetime.strftime(start_date, '%d-%m-%Y')
    end_date = datetime.strftime(end_date, '%d-%m-%Y')

    # Retrieve unavailabilities from Elastic client
    unav_prev_quarter = _get_cds_unavailability(start_date, end_date)

    # Return the complete and normalized set of unavailabilities
    return unav_prev_quarter


def _get_cds_unavailability(start_date, end_date):
    results = []
    try:

        # Define start and end dates range
        start_date = datetime.strptime(start_date, '%d-%m-%Y')
        end_date = datetime.strptime(end_date, '%d-%m-%Y')

        # Auxiliary variable declaration
        indices = ["cds-sat-unavailability"]
        elastic = elastic_client.ElasticClient()

        # Fetch results from Elastic database
        for index in indices:
            try:
                result = elastic.query_date_range(index, 'start_time', start_date, end_date)

                # Convert result into array
                results += result

            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)
                raise cex

            except Exception as ex:
                logger.error(ex)

    except Exception as ex:
        logger.error(ex)

    # Return the response
    return results
