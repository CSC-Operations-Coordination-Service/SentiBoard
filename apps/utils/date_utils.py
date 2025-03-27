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
from copy import copy
from datetime import datetime

from dateutil.relativedelta import relativedelta

logger = logging.getLogger(__name__)


def extract_dates_from_text(text):
    list_date_format = []
    try:
        dates = re.findall(r'\d{2}[-]\d{2}[-]\d{4}[T]\d{2}[:]\d{2}[:]\d{2}', text.replace('/', '-'))
        for date in dates:
            try:
                list_date_format.append(datetime.strptime(date, '%d-%m-%YT%H:%M:%S'))
            except Exception as ex:
                continue
        dates = re.findall(
            r'(?:\d{1,2}:\d{1,2} UTC on \d{1,2} )(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (?:\d{1,2}, )?\d{2,4}',
            text)
        for date in dates:
            try:
                date = date.replace('on', '')
                lower = date.find('UTC ') + 4
                upper = 0
                if date.find(' Jan') > -1:
                    upper = date.find(' Jan')
                elif date.find(' Feb') > -1:
                    upper = date.find(' Feb')
                elif date.find(' Mar') > -1:
                    upper = date.find(' Mar')
                elif date.find(' Apr') > -1:
                    upper = date.find(' Apr')
                elif date.find(' Jun') > -1:
                    upper = date.find(' Jun')
                elif date.find(' Jul') > -1:
                    upper = date.find(' Jul')
                elif date.find(' Aug') > -1:
                    upper = date.find(' Aug')
                elif date.find(' Sep') > -1:
                    upper = date.find(' Sep')
                elif date.find(' Oct') > -1:
                    upper = date.find(' Oct')
                elif date.find(' Nov') > -1:
                    upper = date.find(' Nov')
                elif date.find(' Dec') > -1:
                    upper = date.find(' Dec')
                if len(date[lower + 1:upper]) < 2:
                    date = date[:lower] + '0' + date[upper - 1:]
                list_date_format.append(datetime.strptime(date, '%H:%M %Z %d %B %Y'))
            except Exception as ex:
                continue
        dates = re.findall(r'\d{2}[-]\d{2}[-]\d{4}[ ]\d{2}[:]\d{2}[ ][U][T][C]', text.replace('/', '-'))
        for date in dates:
            try:
                list_date_format.append(datetime.strptime(date, '%d-%m-%Y %H:%M %Z'))
            except Exception as ex:
                continue
        dates = re.findall(r'\d{2}[-]\d{2}[-]\d{4}[ ]\d{2}[:]\d{2}[:]\d{2}[ ][U][T][C]', text.replace('/', '-'))
        for date in dates:
            try:
                list_date_format.append(datetime.strptime(date, '%d-%m-%Y %H:%M:%S %Z'))
            except Exception as ex:
                continue

    except Exception as ex:
        return list_date_format

    return list_date_format


def format_date_to_str(string_date, string_format):
    date = None
    try:
        date = datetime.strptime(string_date, string_format)
    except Exception as ex:
        return date
    return date


def last_quarter_interval_from_date(enddate):
    end_date = datetime.strptime(enddate, '%d-%m-%YT%H:%M:%S')
    end_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date + relativedelta(months=-3) + relativedelta(seconds=+1)

    return start_date, end_date


def prev_quarter_interval_from_date(date):
    start_date = datetime.now()
    end_date = datetime.now()
    month = date.month
    year = date.year
    if month in {4, 5, 6}:
        start_date = datetime(year, 1, 1, 0, 0, 0, 0)
        end_date = datetime(year, 3, 31, 23, 59, 59, 999999)
    elif month in {7, 8, 9}:
        start_date = datetime(year, 4, 1, 0, 0, 0, 0)
        end_date = datetime(year, 6, 30, 23, 59, 59, 999999)
    elif month in {10, 11, 12}:
        start_date = datetime(year, 7, 1, 0, 0, 0, 0)
        end_date = datetime(year, 9, 30, 23, 59, 59, 999999)
    else:
        prev_year = year - 1
        start_date = datetime(prev_year, 10, 1, 0, 0, 0, 0)
        end_date = datetime(prev_year, 12, 31, 23, 59, 59, 999999)

    return start_date, end_date


def get_interval_subperiods(start_date: datetime, end_date: datetime, num_periods: int):
    """
        Split a Date/Time interval in num_periods subintervals of same duration.
        Return a list of intervals : dictionaries with (from_date and end_date

    """
    # 1. compute interval duration
    full_interval_len = end_date - start_date
    # 2. compute single sub-interval duration
    sub_interval_len = (end_date - start_date) / num_periods
    logger.debug("Computing Trend using subinterval with len: %s", sub_interval_len)
    # loop until end of interval is reached:
    # Add sub-interval to start - date and get both sub-interval end tiem and
    # next sub-interval start -time

    subintervals = []
    subintervals.append({'start_date': start_date})
    # Final check: last sub-interval end time shall be the same as interval end time
    for i in range(1, num_periods):
        start_time = (start_date + sub_interval_len * i)
        # logger.debug("Sub-period time: %s", start_time)
        subintervals[i - 1].update({'end_date': start_time})
        subintervals.append({'start_date': start_time})
    subintervals[num_periods - 1].update({'end_date': end_date})
    return subintervals


def get_date_before(end_date, border_date,
                    num_days, pass_border=True):
    """
    Look for the first date before border_date, starting from end_date
    going backwards for steps of period_length.
    Args:
        end_date ():
        border_date ():
        num_days ():
        pass_border ():

    Returns:

    """
    # 1. compute number of days between border_date and end_date
    diff_days = (end_date - border_date).days
    # 2. compute number of periods overlapping border_date (if pass_border == True)
    # 3. decrement the number of periods by one if pass_border is False
    num_periods = int(diff_days / num_days)
    if pass_border:
        num_periods += 1
    # 4. compute the start date by subtracting num_periods * num_days from end_date
    start_date = end_date - relativedelta(days= num_periods * num_days)
    # 5. return start_date
    return start_date

# Week Starts at Monday
FIRST_WEEK_DAY = 0
WEEK_DAYS = 7


def get_week_start_after(start_date: datetime, first_week_day):
    """
     * Return first day of full week at or after start_date

    Args:
        start_date ():
        first_week_day (): integer representing the day of the week
        that we are considering fro week start:
            0: Monday
            6: Sunday

    Returns: the date of the first day of the first full week
        at start_date, or following it

    """
    # get start_date week day
    # Add the number of days to reach next week start
    week_start_date = copy(start_date)
    logger.debug("Searching Start of week after date %s", week_start_date.isoformat())
    week_day = week_start_date.weekday()
    # 0: Monday, 1: Tuesday, ... 6: Sunday
    # If start date is on Monday (0), and first week day is Monday
    #   offset to first full week start is 0
    #   if first week day is Sunday, offset is 6 days
    # If start date is on Sunday, next
    days_to_next_week_start = (WEEK_DAYS - week_day + first_week_day) % WEEK_DAYS
    week_start_date += relativedelta(days=days_to_next_week_start)
    logger.debug("Found Start of next week: %s (ISO), %s (non iso)", week_start_date.isoformat(),
                 week_start_date)
    return week_start_date


def get_week_end_before(end_date: datetime, last_week_day):
    """
     *      It looks for the last full week at or before end date (going back,
     *          it searches for the last end of week day before the current end date
     *      and returns the last week day (Sunday)

    Args:
        end_date (Date):
        last_week_day (int): the Day of the week to be considered as first day of the week
            Week days are:
         0: Monday, 6: Sunday

    Returns: the date of the last day of full week that contains end date, or it precedes it
     *      Date interval

    """
    # get end_date
    week_end_date = copy(end_date)
    logger.debug("Searching End of week before date %s", week_end_date.isoformat())
    week_end_week_day = week_end_date.weekday()
    days_from_prev_week_end = (WEEK_DAYS - last_week_day + week_end_week_day) % WEEK_DAYS
    week_end_date -= relativedelta(days=days_from_prev_week_end)
    logger.debug("Found End of week: %s", week_end_date.isoformat())
    return week_end_date


def get_whole_weeks_interval(start_date, end_date):
    first_week_day = FIRST_WEEK_DAY
    last_week_day = (WEEK_DAYS - 1 + FIRST_WEEK_DAY) % WEEK_DAYS
    start_week_first_day = get_week_start_after(start_date, first_week_day)
    end_week_last_day = get_week_end_before(end_date, last_week_day)
    # TODO: assign hour of end_date to both computed dates
    logger.debug("Interval from %s to %s - restricted to include only full weeks: from %s to %s",
                 start_date, end_date,
                 start_week_first_day, end_week_last_day)
    return start_week_first_day, end_week_last_day


class Quarter:

    # TODO: define a list of quarter first day, defined as month/day
    # or a dictionary (quarter_id : month/day)
    # to build the interval:
    # define a date with the specified year, and the month/day taken from the dictionary
    # the end of the interval is 3 months later at 23:59,
    # Only one method is needed!
    def __int__(self, year):
        self.__date = datetime.strptime(year, '%Y')
        return

    def set_year(self, year):
        self.__date = datetime.strptime(year, '%Y')
        return

    def get(self, index):
        if index == 1:
            return self.first()
        elif index == 2:
            return self.second()
        elif index == 3:
            return self.third()
        else:
            return self.fourth()

    def first(self):
        start_date = self.__date.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + relativedelta(months=+3)
        end_date += relativedelta(minutes=-1)
        end_date = end_date.replace(second=59, microsecond=999999)
        return {'start': start_date, 'end': end_date}

    def second(self):
        start_date = self.__date.replace(month=4, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + relativedelta(months=+3)
        end_date += relativedelta(minutes=-1)
        end_date = end_date.replace(second=59, microsecond=999999)
        return {'start': start_date, 'end': end_date}

    def third(self):
        start_date = self.__date.replace(month=7, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + relativedelta(months=+3)
        end_date += relativedelta(minutes=-1)
        end_date = end_date.replace(second=59, microsecond=999999)
        return {'start': start_date, 'end': end_date}

    def fourth(self):
        start_date = self.__date.replace(month=10, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + relativedelta(months=+3)
        end_date += relativedelta(minutes=-1)
        end_date = end_date.replace(second=59, microsecond=999999)
        return {'start': start_date, 'end': end_date}


"""
 Computation of Date/time interval, with end time es to this hour beginning.
 and start of interval based on a period id:
 last 24h: a period 24 hour long
 last 7d: a period 7 days long
 last 30d: a period 30 days long
 last  quarter: a period 3 months long
"""


# TODO: define consnatts for Period identifiers
class PeriodID:
    DAY = '24h'
    WEEK = '7d'
    MONTH = '30d'
    QUARTER = 'quarter'


#    PREV_QUARTER = 'previous-quarter'


interval_length = {
    PeriodID.DAY: relativedelta(hours=24),
    PeriodID.WEEK: relativedelta(days=7),
    PeriodID.MONTH: relativedelta(days=30),
    PeriodID.QUARTER: relativedelta(months=3)
}


def get_last_period_interval(period_id):
    """
    Builds the interval for the specified "last"-period.
    The end of the period is set to the current hour beginning
    The start of the period is x days/hours in the past, at the same hour.
    the number of days/hours depends on the period.

    Args:
        period_id (str): one of: 24h, 7d, 30d, quarter.
            the length of the period is retrieved from a configuration table

    Returns: a tuple with the start/end datetime of the interval requested

    """
    if period_id not in interval_length:
        raise Exception("Invalid period identifier: {}".format(period_id))
    #  Function should have an option to request date only or date+time
    end_date = datetime.utcnow()
    end_date = end_date.replace(minute=0, second=0, microsecond=0)
    start_date = end_date - interval_length.get(period_id)
    return start_date, end_date


def _split_month_interval(start_date: datetime, end_date: datetime, num_days: int):
    # Num days shall be less than one month length
    subperiod_list = []
    num_days_offset = relativedelta(days=num_days)
    start_period = start_date
    while start_period + num_days_offset < end_date:
        start_offset = start_period + num_days_offset
        subperiod_list.append((start_period, start_offset))
        start_period = start_offset
    subperiod_list.append((start_period, end_date))
    # if start_offset < end_date:
    #    subperiod_list.append((start_date, start_offset))
    #    subperiod_list.append((start_offset, end_date))
    # else:
    #    subperiod_list.append((start_date, end_date))
    return subperiod_list


def _month_time_intervals(start_date: datetime, end_date: datetime, num_days: int):
    """
        splits the interval in subperiods, that start and/or
        end at month limits:
            each subperiod is fully included in a  month:
        The algorithm:
            start from start_date:
                the first subperiod ends either at the
                    start_date month end (next day 00:00)
                    or or at start_date + num_days
                if the start of the month is included, it
        return a list of tuples; each tuple is a subperiod of
        the specified interval.
        subperiods are adjacent (each end is the same as next
        subperiod start)
    """
    subperiod_start = start_date
    subperiod_list = []
    num_days_offset = relativedelta(days=num_days)
    while subperiod_start + num_days_offset < end_date:
        # if subperiod_start + num_days_offset has a different
        # month, then: end date = next month first day 00:00
        # else subperiod_start + num_days_offset
        # and end of subperiod_start_month
        offset_date = subperiod_start + num_days_offset
        subperiod_month = subperiod_start.month
        offset_month = offset_date.month
        if offset_month == subperiod_month:
            # the month does not change:
            # use num_days as the period length
            next_start = offset_date
        else:
            # num_days after we are in a different month.
            # set the first day of month as interval limit

            next_start: datetime = subperiod_start + relativedelta(months=1)
            # set start of month, midnight
            next_start.replace(day=1, hour=0, minute=0, second=0)
        subperiod_list.append((subperiod_start, next_start))
        subperiod_start = next_start
    subperiod_list.append((subperiod_start, end_date))
    return subperiod_list


def _date_interval_month_intersection(start_date, end_date, year, month):
    logger.debug("Retrieving interval intersection with month (%s, %s)",
                 year, month)
    month_start = datetime(year=int(year), month=int(month), day=1,
                           hour=0, minute=0, second=0)
    month_end = month_start + relativedelta(months=1)
    # logger.debug("Month: start %s, end %s", month_start, month_end)

    start_interval_date = month_start if start_date < month_start else start_date
    end_interval_date = month_end if end_date > month_end else end_date
    # logger.debug("End Interval: %s, end Month: %s, intersection end: %s",
    #             end_date, month_end, end_interval_date)
    logger.debug("Intersection: %s, %s",
                 start_interval_date, end_interval_date)
    return start_interval_date, end_interval_date


def get_past_day_str(past_num_days, day_format):
    today_day = datetime.today()
    # Retrieve date of past_num_days
    earliest_day = today_day - relativedelta(days=past_num_days)
    earliest_day_str = earliest_day.strftime(day_format)
    return earliest_day_str
