# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${owner}
All rights reserved.

This document discloses subject matter in which ${ownerShort} has 
proprietary rights. Recipient of the document shall not duplicate, use or 
disclose in whole or in part, information contained herein except for or on 
behalf of ${ownerShort} to fulfill the purpose for which the document was 
delivered to him.
"""

import json
import logging
from datetime import datetime
from time import perf_counter

from flask import Response

from apps import flask_cache
from apps.utils import date_utils
from apps.utils.date_utils import PeriodID

logger = logging.getLogger(__name__)

# TODO Define ENUM for periods
PREV_QUARTER = 'previous-quarter'


class RestCacheLoader:

    mission_list = ["S1", "S2", "S3", "S5"]
    # table with the validity of the cache, depending on the
    #   time period for the cached data
    #   604800 seconds for data to be updated each hour [1 week]
    #   604800 seconds for data to be updated each day [1 week]
    cache_durations = {
        PeriodID.DAY: 604800,
        PeriodID.WEEK: 604800,
        PeriodID.MONTH: 604800,
        PeriodID.QUARTER: 604800,
        PREV_QUARTER: 604800
    }

    def __init__(self, stat_id, api_key_format, elastic_function):
        self._statistics_id = stat_id
        self._api_key_format = api_key_format
        self._mission_elastic_fun = elastic_function

    def load_cache(self, period_id):
        """
        Load Statistics Rest API Cache for last period_id (days/hour/month) data:
        load data each mission request

        Args:
            period_id (string): one of the values for last period lookup table:
            24h, 7d, 30d, quarter. Defined in dateUtils.

        Returns: N/A

        """
        logger.info("[BEG] Loading %s Cache for last %s",
                    self._statistics_id, period_id)
        cache_start_time = perf_counter()
        # Retrieve data takes in the last 30 days, with reference
        # the beginning of current hour!
        # and store results of query in cache
        start_date, end_date = date_utils.get_last_period_interval(period_id)
        self._load_product_statistics_cache(period_id, start_date, end_date)
        cache_end_time = perf_counter()
        logger.info(
            f"[END] Loading {self._statistics_id} Cache for period last {period_id}, start: {start_date}, end: {end_date} - Execution Time : {cache_end_time - cache_start_time:0.6f}")

    def load_cache_previous_quarter(self):
        logger.info("[BEG] Loading  %s  Cache  for previous quarter",
                    self._statistics_id)
        period_id = PREV_QUARTER
        cache_start_time = perf_counter()
        # Retrieve data takes in the last 3 months and store results of query in cache
        start_date, end_date = date_utils.prev_quarter_interval_from_date(datetime.today())
        self._load_product_statistics_cache(period_id, start_date, end_date)
        cache_end_time = perf_counter()
        logger.info(
            f"[END] Loading Cache for period previous quarter, start: {start_date}, end: {end_date} - Execution Time : {cache_end_time - cache_start_time:0.6f}")

    def load_all_periods_cache(self):
        """
        Load cache for each Time period (excluding previous quarter)
        Returns: N/A

        """
        logger.info("[BEG] Loading %s Cache for All periods",
                    self._statistics_id)
        periods = [PeriodID.DAY, PeriodID.WEEK,
                   PeriodID.MONTH, PeriodID.QUARTER]
        for period in periods:
            self.load_cache(period)
        logger.info(
            f"[END] Loading {self._statistics_id} Cache for all periods")

    def _load_product_statistics_cache(self, period_id, start_date, end_date):
        logger.debug("Setting %s Cache for period: %s, from %s, to %s",
                     self._statistics_id,
                     period_id, start_date, end_date)
        # Validity is taken from configuration!
        # hour based, day based
        seconds_validity = self.cache_durations.get(period_id, 4000)
        # TODO: Manage errors on requests!
        end_date_str = end_date.strftime('%d-%m-%YT%H:%M:%S')
        start_date_str = start_date.strftime('%d-%m-%YT%H:%M:%S')
        logger.debug("Loading period %s: from %s to %s",
                     period_id,
                     start_date_str, end_date_str)
        if period_id == 'previous-quarter':
            rest_api_prefix = self._api_key_format.format('previous', 'quarter')
        else:
            rest_api_prefix = self._api_key_format.format('last', period_id)
        period_data = self._retrieve_statistics_data(period_id, start_date, end_date)
        logger.debug("Saving on cache for last %s publication of type: %s, with cache key: %s, timeout: %d",
                     period_id, self._statistics_id,
                     rest_api_prefix,
                     seconds_validity)
        flask_cache.set(rest_api_prefix,
                        Response(json.dumps(period_data), mimetype="application/json", status=200),
                        seconds_validity)

    def _retrieve_statistics_data(self, period_id, start_date, end_date):
        # Load Only cache mission, if specified in arguments
        period_data = []
        for mission in self.mission_list:
            logger.debug("Loading Publication Cache for period last %s - mission %s", period_id, mission)
            period_data.extend(self._mission_elastic_fun(start_date, end_date, mission))
        # In case, return more information
        publication_period_data = {
            'period': period_id,
            'interval': {
                'from': start_date.isoformat(),
                'to': end_date.isoformat()
            },
            'data': period_data
        }

        return publication_period_data


class RestCache_TrendLoader(RestCacheLoader):

    sub_periods_config = {
        PeriodID.DAY: 24,
        PeriodID.WEEK: 7,
        PeriodID.MONTH: 30,
        PeriodID.QUARTER: 14,
        PREV_QUARTER: 14
    }

    def __init__(self, stat_id, api_key_format, elastic_function):
        RestCacheLoader.__init__(self, stat_id, api_key_format, elastic_function)

    def _retrieve_statistics_data(self, period_id, start_date, end_date):
        logger.debug("Retrieving Trend Data for period %s - from %s to %s",
                     period_id, start_date, end_date)
        trend_start_date = start_date
        trend_end_date = end_date
        # Get number of subperiods for given period
        num_subperiods = self.sub_periods_config.get(period_id, None)
        # If the Period was a Quarter type period,
        # split into weeks.
        # To work on homogenous  subperiods, compute the start of the first week in the period
        # (even if before the period start date)
        # and the end of the last week.
        if period_id in (PeriodID.QUARTER, PREV_QUARTER):
            # TODO: Add a request for full week, or week overlapping interval (that begin/end outside the interval)
            # TODO: ALternatively, manage to perform requests on non uniform subperiods (the last period must
            # end at end time!

            # Get the interval composed of full weeks that is included/coincident with our interval
            #    (otherwise, the interval of full weeks including our interval)
            # IF so, modify accordingly the trend interval, but display only the end of intervals
            # trend_start_date, trend_end_date = date_utils.get_whole_weeks_interval(start_date, end_date)
            # Move back one day start date, to match week intervals
            # trend_start_date = trend_start_date - relativedelta(days=1)
            trend_start_date = date_utils.get_date_before(trend_end_date, border_date=start_date,
                                                          num_days=date_utils.WEEK_DAYS,
                                                          pass_border=True)
            logger.debug("Trend interval from %s to %s, for date interval %s to %s",
                         trend_start_date.isoformat(), trend_end_date.isoformat(),
                         start_date.isoformat(), end_date.isoformat())
            date_diff = trend_end_date - trend_start_date
            logger.debug("Number of days in Week based interval: %d",
                         date_diff.days + 1)
            logger.debug("Requested number of subperiods for quarter: %d", num_subperiods)
            # Compute actual number of subperiods, based on recomputed interval
            num_subperiods = int((date_diff.days + 1) / date_utils.WEEK_DAYS)
            logger.debug("Computed number of subperiods for quarter: %d", num_subperiods)

        if num_subperiods is None:
            raise Exception(f"Period id {period_id} not configured for Trend")
        # Load Only cache mission, if specified in arguments
        # Period data is a list of trend statistics per each mission
        # TODO: split in two: a lis of period_data for each service id

        period_service_data = {}
        for mission in self.mission_list:
            logger.debug("Loading Publication Cache for period last %s - mission %s", period_id, mission)
            logger.debug("Using %d subperiods from %s to %s", num_subperiods, trend_start_date.isoformat(),
                         trend_end_date.isoformat())
            #  Retrieve per Service statistics.
            # Each mission returns a dictionary, specifiying mission statiscs per each service id
            # add the rtrieved data to the corresponding service id section in period_data
            mission_service_data = self._mission_elastic_fun(trend_start_date, trend_end_date, mission, num_subperiods)
            logger.debug("Collecting results from Elastic Function %s", self._mission_elastic_fun.__name__)
            for service, mission_data in mission_service_data['service_trend'].items():
                logger.debug("Saving to cache for mission %s, service %s, data: %s",
                             mission, service, mission_data)
                service_data_record = {}
                # Copy common fis on the per/service structure
                service_data_record ['mission'] = mission_service_data['mission']
                service_data_record['num_periods'] = mission_service_data['num_periods']
                service_data_record['trend'] = mission_data
                # Append mission data for this service
                # Create an item in the dictionary, if service not yet assigned
                period_service_data.setdefault(service, []).append(service_data_record)
            logger.debug("After loading Mission %s, global period Data is %s", mission, period_service_data)
        subperiods = date_utils.get_interval_subperiods(trend_start_date, trend_end_date, int(num_subperiods))
        trend_sample_times = [subp['end_date'].isoformat() for subp in subperiods]
        publication_period_data = {
            'period': period_id,
            'num_subperiods': num_subperiods,
            'interval': {
                'from': trend_start_date.isoformat(),
                'to': trend_end_date.isoformat()
            },
            'data': period_service_data,
            'sample_times': trend_sample_times
        }
        # return data
        return publication_period_data
