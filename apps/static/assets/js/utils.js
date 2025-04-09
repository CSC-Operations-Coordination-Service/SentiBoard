/*
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
*/

function ajaxCall(url, method, dictData, callbackSuccess, callbackError){
    $.ajax({
      url: url,
      type: method,
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      data: JSON.stringify(dictData),
      success: function(response) {
        callbackSuccess(response);
      },
      error: function(xhr) {
        callbackError(xhr);
      }
    });
}

function asyncAjaxDownloadXml(url, method, dictData, callbackSuccess, callbackError){
    return $.ajax({
      url: url,
      type: method,
      contentType: "application/xml; charset=utf-8",
      dataType: "xml",
      async: true,
      data: JSON.stringify(dictData),
      success: function(response) {
        callbackSuccess(response);
      },
      error: function(xhr) {
        callbackError(xhr);
      }
    });
}

function asyncAjaxCall(url, method, dictData, callbackSuccess, callbackError){
    return $.ajax({
      url: url,
      type: method,
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      async: true,
      data: JSON.stringify(dictData),
      success: function(response) {
        callbackSuccess(response);
      },
      error: function(xhr) {
        callbackError(xhr);
      }
    });
}

function asyncAjaxCallParams(url, method, dictData, successParams,
        callbackSuccess, callbackError){
    console.log("Calling ajax " + url + " with parameters ", successParams)
    return $.ajax({
      url: url,
      type: method,
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      async: true,
      data: JSON.stringify(dictData),
      success: function(response) {
        callbackSuccess(successParams, response);
      },
      error: function(xhr) {
        callbackError(xhr);
      }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// TODO: Create a class to manage Size computations/conversions
volume_units_suffixes = {
1000: 'iB',
1024: 'B'
}
function normalize_size(size, factor) {
    // Compute size in biggest volume unit possible
    // Return normalized size and its unit
    var volume_unit = 'G';
    var disp_size = 0;
    var int_size = parseInt(size);
    if (int_size > 0) {
        var disp_size = int_size / (factor * factor * factor);
        if (disp_size > factor) {
            disp_size = disp_size / factor;
            volume_unit = 'T';
        }
        if (disp_size > factor) {
            disp_size = disp_size / factor;
            volume_unit = 'P';
        }
    } else {
        disp_size = 0;
    }
    // TODO: add check
    volume_unit = volume_unit + volume_units_suffixes[factor];
    return [disp_size, volume_unit];    
}

function normalize_size_decimal(size) {
    return normalize_size(size, 1000);
}
function format_count(count) {
// Format integer with thousand separator
// according to current locale
   return  new Intl.NumberFormat().format(count);
}

function getMaxNormalizedSize(sizeList) {
    // retrieve from the list of sizes in bytes
    // the longest one after formatting
    // using the nearest Disk Size unit (MB GB TB PB)
    // Get the max value from normalized values
    //
}

function getFormattedStringLength(number, hasThousandSeparator=True, decimalPlaces=0, unitLength=0) {
    num_base_len = len(str(number));
    if (hasThousandSeparator === True) {
        // Add one char each 3 digits
        num_base_len += num_base_len / 3;
    }
    if (decimalPlaces > 0) {
        // Add comma and decimal digits
        num_base_len += 1 + decimalPlaces;
    }
    if (unitLength > 0){
        // Add a space separator and the unit specification length
        num_base_len += 1 + unitLength;
    }
    return num_base_len;
}

function _base_format_size(size, factor) {
// TODO: make a check on factor to accept only 1024 or 1000?
    // Compute size in GB
//    var volume_unit = 'GB';
//    var disp_size = 0;
//    var int_size = parseInt(size);
//    if (int_size > 0) {
//        var disp_size = int_size / (factor * factor * factor);
//        if (disp_size > factor) {
//            disp_size = disp_size / factor;
//            volume_unit = 'TB';
//        }
//        if (disp_size > factor) {
//            disp_size = disp_size / factor;
//            volume_unit = 'PB';
//        }
//    }
    [disp_size, volume_unit] = normalize_size(size, factor);
    return new Intl.NumberFormat().format(disp_size.toFixed(2)) + ' ' + volume_unit;
}
function format_size(size) {
    return _base_format_size(size, 1024);
}

function format_size_decimal(size) {
    return _base_format_size(size, 1000);
}

function unitsize_to_bytes(volume_size, unit, factor) {
    // TODO: check if factor is a valid value and suffix exists7
    var suffix = volume_units_suffixes[factor];
    var byte_unit = unit.substring(0, unit.length - suffix.length );
    // convert a size in bytes to a size in the specified volume unit
    var unit_size = volume_size * factor * factor * factor;
    // Otherwise define a table with increasing values for multiplier, with keys the unit values
    if (byte_unit !== 'G') {
        unit_size = unit_size * factor;
        if (byte_unit !== 'T') {
            unit_size = unit_size * factor;
            if (byte_unit !== 'P') {
                unit_size = unit_size * factor;
            }
        }
    }
    console.log("Size in Unit ", unit, ": ", volume_size, "; in bytes: ", unit_size);
    return unit_size;
}
function unitsize_to_bytes_decimal(volume_size, unit) {
    return unitsize_to_bytes(volume_size, unit, factor);
}

function get_nearest_greater_integer_size(size_raw_value) {
    // Get display size in Volume units
    // round up to next integer
    return Math.ceil(size_raw_value);
}

function format_dayhours(hours) {
    var hours2Digit = Math.floor(hours *100)/100;
    
    var hoursLabel = ""+new Intl.NumberFormat().format(hours2Digit)+'h';

    if (hours >= 24) {
        var numdays = Math.floor(hours2Digit / 24);
        var numhours = hours2Digit % 24; 
        hoursLabel = ""+numdays+"d";
        if (numhours) {
            numhours = new Intl.NumberFormat().format(numhours);
            hoursLabel += " "+numhours+"h";
        }
    }
    return hoursLabel;
}

/**
    Date time manipulation and formatting functions
**/

function convert_string_datetime_python_to_js(date_string){
    var date = date_string.split('/');
    return new Date(date[1]+'/'+date[0]+'/'+date[2]);
}
/**
  @summary: Provide the week of the year for the given date
  @description: Computes the Week of the year for
    the given date.
    First week in year is 1
    Partial weeks are considered
    TODO: does week start on Sunday or Monday?
*/
function yearWeekOfDate(date) {

}

/**
 * Return first day of week entirely inside the specified
 *      Date interval.
 * @param {Date} start_date
 * @param {Date} end_date
 * @returns {Date}
 */
function getIntervalFirstWeekStart(start_date, end_date, firstWeekDay) {
    // get start_date week day
    // Add the number of days to reach next week start
    var weekStartDate = new Date(start_date);
    var weekDay = weekStartDate.getDay();
    // 0: Sunday, 1: Monday
    // If start date is on Tuesday (2), next Sunday is 5 days later
    // If start date is on Sunday, next
    var daysToNextWeekStart = (7 - weekDay + firstWeekDay) % 7 ;
    console.log("Finding Start of week after date ", weekStartDate.toISOString());
    weekStartDate.setDate(weekStartDate.getDate() + daysToNextWeekStart);
    return weekStartDate;
}

/**
 * Returns last day of week entirely inside the specified
 *      Date interval
 *      It looks for the first full week inside the interval (going back,
 *          it searches for the last end of week day before the current end date
 *      and returns the last week day (Sunday)
 * @param {Date} start_date : the interval start date
 * @param {Date} end_date
 * @returns {Date}
 */
function getIntervalLastWeekEnd(start_date, end_date, lastWeekDay) {
    // get end_date
    var weekEndDate = end_date;
    var weekDay = weekEndDate.getDay();
    var daysFromPrevWeekEnd = (7 - lastWeekDay + weekDay) % 7 ;
    weekEndDate.setDate(weekEndDate.getDate() - daysFromPrevWeekEnd);
    return weekEndDate;
}

function pad2Digits(num) {
    return num.toString().padStart(2, '0');
}

function formatDate(date) {
    var month = pad2Digits(date.getMonth() + 1);
    var day = pad2Digits(date.getDate());
    var year = date.getFullYear();
    return [day, month, year].join('-');
}

function formatUTCDateHour(date) {
  return (
    [
      pad2Digits(date.getUTCDate()),
      pad2Digits(date.getUTCMonth() + 1),
      date.getUTCFullYear(),
    ].join('/') +
    ' ' +
    [
      pad2Digits(date.getUTCHours()),
      pad2Digits(date.getUTCMinutes())
    ].join(':')
  );
}

/**
 * To be used to format Date/Hour to be presented to user,
 * if input date is already UTC!
 * @param {type} date
 * @returns {String}
 */
function formatDateHour(date) {
  return (
    [
      pad2Digits(date.getDate()),
      pad2Digits(date.getMonth() + 1),
      date.getFullYear(),
    ].join('/') +
    ' ' +
    [
      pad2Digits(date.getHours()),
      pad2Digits(date.getMinutes())
    ].join(':')
  );
}

function formatDateTime(date) {
    var month = pad2Digits (date.getMonth() + 1);
    var day = pad2Digits(date.getDate());
    var year = date.getFullYear();
    var hour = pad2Digits(date.getHours());
    var minutes = pad2Digits(date.getMinutes());
    var seconds = pad2Digits(date.getSeconds());
    var dateStr = [day, month, year].join('-');
    var timeStr = [hour, minutes, seconds].join(':');
    return dateStr+"T"+timeStr;
}

function formatUtcDateTime(date_val) {

    // var datetime_str = date_val.toISOString();
    // 5 characters to be removed: .mmmZ (milliseconds and Z for UTC)
    // return datetime_str.substring(0, datetime_str.length -5);
    //return datetime_str.slice(0, -5);
    var month = pad2Digits (date_val.getUTCMonth() + 1);
    var day = pad2Digits(date_val.getUTCDate());
    var year = date_val.getUTCFullYear();
    var hour = pad2Digits(date_val.getUTCHours());
    var minutes = pad2Digits(date_val.getUTCMinutes());
    var seconds = pad2Digits(date_val.getUTCSeconds());
    var dateStr = [day, month, year].join('-');
    var timeStr = [hour, minutes, seconds].join(':');
    return dateStr+"T"+timeStr;
}

function addHours(numOfHours, date = new Date()) {
    date.setTime(date.getTime() + numOfHours * 60 * 60 * 1000);
    return date;
}

function get_mission_colors() {
    return {
        'S1': "#1d7af3",
        'S2': "#59d05d",
        'S3': "#f3545d",
        'S5': "#8f00ff"
    }
}
function get_satellite_colors() {
  return {
        'S1A': "#1d7af3",
        'S1B': "#3399ff",
        'S1C': "#41aade",
        'S2A': "#59d05d",
        'S2B': "#3fae3e",
        'S2C': "#1cae5a",
        'S3A': "#f3545d",
        'S3B': "#fdaf4b",
        'S5P': "#8f00ff"
    };
}
function get_colors(num_colors) {
    var all_colors = ["#1d7af3","#59d05d","#f3545d","#8f00ff","#fdaf4b", 
                    "#0a00ff", "#00ff00",
                      "#ff8f00", "#6861ce", "#1d7bf3", "#f5ed44", "#e26862"];
    while (num_colors > all_colors.length) {
        var color_string = "#"+ Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        all_colors.push(color_string);
    }
    return all_colors.slice(0, num_colors);
}

function format_response(response){
    var rows = response;
    if(!Array.isArray(rows)){
      var arr = [];
      arr.push(rows);
      rows = arr;
    }
    return rows;
}

function minDateTime(date1, date2) {
    if (date1 < date2) {
        return date1;
    } else {
        return date2;
    }
}

function maxDateTime(date1, date2) {
    if (date1 > date2) {
        return date1;
    } else {
        return date2;
    }
}

/**
    Retrieves the quarter for the specified date.
    The quarter is a number (1..4) representing one
    of the year quarters:
    1: 1 Jan to 31 March
    2. 1 Apr to 30 Jun
    3. 1 Jul to 30 Sep
    4. 1 Oct to 31 Dec
*/
function getCurrentQuarter(date1) {

    // Get date month (count from 0)
    var curr_month = date1.getMonth();

    // Retrieve quarter
    // month = 0 (Gen): 0/3 +1 = 1
    // month = 1 (Feb): 1/3 +1 = 1
    // mounth = 7 (Aug): 7/3 + 1 = 3
    // month = 10 (nov): 10 / 3 + 1 = 4
    // mounth = 11 (dec): 11 / 3 + 1 = 4
    var curr_quarter = Math.floor(curr_month / 3) + 1;
    return curr_quarter;
}

function getPreviousQuarter(date1) {
    var curr_year = date1.getFullYear();
    var curr_quarter = getCurrentQuarter(date1);

    // Prev quarter:
    // 4 => 3
    // 3 => 2
    // 2 => 1
    // 1 => 4
    // (quarter - 2 ) % 4 + 1
    // 4%4 -- 0, 3%4 -- 3 2%4 -- 2 1%4 --> 1
    // 4%4 +1 ---> 1 3%4 +1 --->  4
    var prev_quarter = curr_quarter - 1;
    var prev_quarter_year = curr_year;
    if (prev_quarter === 0) {
        prev_quarter = 4;
        prev_quarter_year --;
    }
    return {'year': prev_quarter_year, 'quarter': prev_quarter};
}

function getQuarterInterval(year, quarter_id) {
    var quarter_dates = {
        1: {'start': [1, 1], 'end': [31, 3]},
        2: {'start': [1, 4], 'end': [30, 6]},
        3: {'start': [1, 7], 'end': [30, 9]},
        4: {'start': [1, 10], 'end': [31, 12]}
    };
    var quarter_interval = quarter_dates[quarter_id];
    var start_date = new Date(year, quarter_interval.start[1] -1, quarter_interval.start[0]);
    var end_date = new Date(year, quarter_interval.end[1] -1, quarter_interval.end[0]);
    start_date.setUTCHours(0,0,0,0);
    end_date.setUTCHours(23,59,59,0);
    console.log("Quarter n."+quarter_id + "interval: from "+start_date+" to "+ end_date);
    return [start_date, end_date];
}
// Assumes that 4 quarters are defined,
// starting from 1. No check on getPreviousQuarter return
// validity is made
function getPreviousQuarterRange() {
    var quarter_months = [
    'Jan - Mar',
    'Apr - Jun',
    'Jul - Sep',
    'Oct - Dec'
    ]

    var previous_quarter = getPreviousQuarter(new Date());
    var year_str = previous_quarter['year'];
    var period_str = quarter_months[previous_quarter['quarter'] - 1];
    /*
    if (previous_quarter['quarter'] == 1) {
        period_str = 'Jan - Mar';
    } else if (previous_quarter['quarter'] == 2) {
        period_str = 'Apr - Jun';
    } else if (previous_quarter['quarter'] == 2) {
        period_str = 'Jul - Sep';
    } else {
        period_str = 'Oct - Dec';
    }
    */
    return period_str + ' ' + year_str;
}

/**
    Class used to manipulate time range
*/
class ObservationTimePeriod {

    // Create table from time period to number of days
    //  Time period to Date Granularity (Day, Month)
    time_period_len = {
        'day': [1, 'day'],
        'week': [7, 'day'],
        'month': [30, 'day'],
        'last-quarter': [3, 'month'],
        'prev-quarter': [1, 'quarter']
    };

    constructor() {

        // Interval end date is day before reference date (default reference date: Today)
        this.end_date = new Date();

        // Round the end date to the beginning of the current hour
        this.end_date.setMinutes(0);
        this.end_date.setSeconds(0);
    }

    getIntervalDates(period_type) {
        if (period_type !== 'prev-quarter') {

            // one of: day, week, month, quarter
            // take delta to be applied from configuration
            // TODO: start date as local or instance variable?TBD
            this.start_date = new Date( this.end_date);
            var delta_params = this.time_period_len[period_type];

            // Change Day of date, keeping the Hour (taken when assigning the start date)
            if (delta_params[1] === 'day') {
              this.start_date.setDate(this.end_date.getDate() - delta_params[0]);
            } else if (delta_params[1] === 'month') {
              this.start_date.setMonth(this.end_date.getMonth() - delta_params[0]);
            } else ;
        } else {
            var prev_quarter = getPreviousQuarter(this.end_date);
            var dateInterval = getQuarterInterval(prev_quarter['year'], prev_quarter['quarter']);
            this.start_date = dateInterval[0];
            this.end_date = dateInterval[1];
        }

        // Return the date range
        return [this.start_date, this.end_date];
    }
};

/**
 * Configuration of API period specification
 * based on Period selection
 */
var apiTimePeriodId = {
    day: 'last-24h',
    week: 'last-7d',
    month: 'last-30d',
    'last-quarter': 'last-quarter',
    'prev-quarter': 'previous-quarter',
    'lifetime': 'lifetime'
};

function getApiTimePeriodId(period_type) {
    if (!(period_type in apiTimePeriodId)) {
        console.error("Period Type -"+period_type+"- not known for API calls");
        return;
    }
    return apiTimePeriodId[period_type];
}

function msgNotification(from, align, state, content) {
    $.notify(content,{
        type: state,
        placement: {
            from: from,
            align: align
        },
        time: 1000,
        delay: 0,
    });
}