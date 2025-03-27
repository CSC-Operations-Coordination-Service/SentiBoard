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


def fetch_interface_monitoring_last_quarter(service_name):
    """
        Fetch the failed interface monitoring status in the selected period from Elastic DB using the exposed REST APIs.
        The start time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
        """

    # Define data time range
    end_date = datetime.now()
    start_date = end_date - relativedelta(months=3)
    end_date = end_date.strftime('%d-%m-%Y %H:%M:%S')
    start_date = start_date.strftime('%d-%m-%Y %H:%M:%S')

    # Retrieve interface monitoring status from Elastic client
    interface_monitoring_list = _get_cds_interface_monitoring(start_date, end_date, service_name)

    # Return the complete and normalized set of interface monitoring status
    return interface_monitoring_list


def fetch_interface_monitoring_prev_quarter(service_name):
    """
        Fetch the failed interface monitoring status the previous completed quarter from Elastic DB using the exposed REST APIs.
        The start time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
        """

    # Define data time range
    start_date, end_date = date_utils.prev_quarter_interval_from_date(datetime.today())
    start_date = datetime.strftime(start_date, '%d-%m-%Y %H:%M:%S')
    end_date = datetime.strftime(end_date, '%d-%m-%Y %H:%M:%S')

    # Retrieve interface monitoring status from Elastic client
    interface_monitoring_list = _get_cds_interface_monitoring(start_date, end_date, service_name)

    # Return the complete and normalized set of interface monitoring status
    return interface_monitoring_list


def _get_cds_interface_monitoring(start_date, end_date, service_name):
    results = []
    try:

        # Define start and end dates range
        start_date = datetime.strptime(start_date, '%d-%m-%Y %H:%M:%S')
        end_date = datetime.strptime(end_date, '%d-%m-%Y %H:%M:%S')

        # Auxiliary variable declaration
        indices = ["cds-interface-status-monitoring"]
        elastic = elastic_client.ElasticClient()

        # Fetch results from Elastic database
        for index in indices:
            try:
                result = elastic.query_scan_date_range(index=index, date_key='status_time_start', from_date=start_date,
                                                       to_date=end_date, query={"bool": {"must":
                                                        [{"match": {"interface_name": service_name}},
                                                         {"match": {"status": "KO"}}]}})

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
