"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
"""

import logging
import re
from datetime import datetime

from dateutil.relativedelta import relativedelta

from apps.elastic import client
from apps.utils import date_utils

logger = logging.getLogger(__name__)


def _get_month_subperiods(start_date: datetime, end_date: datetime, index_name):
    index_re = re.compile(r"cds-product-(?P<year>\d\d\d\d)-(?P<month>\d\d)")
    matches = index_re.search(index_name)
    if matches is None:
        raise Exception("Wrong index name")
    year, month = matches.groups()
    # logger.debug("Found index matches: %s", matches)
    logger.debug("Index: %s, year: %s, month: %s", index_name, year, month)
    month_interval_start, month_interval_end = (
        date_utils._date_interval_month_intersection(start_date, end_date, year, month)
    )
    return date_utils._split_month_interval(
        month_interval_start, month_interval_end, num_days=10
    )


#
# Define a class: initialized with mission, starend date
# Retrieve query passing timeliness configuration


def get_cds_publication_from_datake(id):
    index = "cds-publication"
    elastic = client.ElasticClient()
    results = []
    try:
        query = {"query": {"term": {"datatake_id": id}}}
        results = elastic.get_connection().search(index=index, body=query)["hits"][
            "hits"
        ]
    except Exception as ex:
        logger.error(ex)
    return results


def get_month_index_name_from_interval_date(base_index_name, start_date, end_date):
    # Compute index name on a month base
    indices = []
    logger.debug("Retrieving Indexes for interval %s, %s", start_date, end_date)

    while start_date <= end_date or start_date.month == end_date.month:
        month = str(start_date.month)
        year = str(start_date.year)
        if len(month) == 1:
            month = "0" + month
        indices.append(f"{base_index_name}-{year}-{month}")
        start_date += relativedelta(months=+1)
    # if len(indices) == 0:
    #    indices = []
    # elif len(indices) > 3:
    #    # just take the last three months, if more were found
    #    indices = indices[-3:]
    logger.debug("Found indices: %s", indices)
    return indices


def get_index_name_from_interval_date(base_index_name, start_date, end_date):
    # Compute index name on a month base
    indices = get_month_index_name_from_interval_date(
        base_index_name, start_date, end_date
    )
    indices.append(base_index_name + "-static")
    indices.append(base_index_name)
    return indices


def get_index_name_from_interval_year(base_index_name, start_date, end_date):
    indices = []
    while start_date < end_date:
        year = str(start_date.year)
        indices.append(base_index_name + "-" + year)
        start_date += relativedelta(years=+1)
    if len(indices) == 0:
        indices = []
    elif len(indices) > 3:
        indices = indices[-3:]
    # Add this index to manage cases where index by month is not present (prod env)
    indices.append(base_index_name + "-static")
    indices.append(base_index_name)
    return indices
