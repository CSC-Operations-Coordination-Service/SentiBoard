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

// TODO: Receive from Backend at start time, or read from DOM
//     (set by template, reading from configuration)
// var pub_service_list = ['DHUS', 'DAS'];
var pub_service_list = [ 'DAS'];
class TrendChart {

    static subperiod_config = {
        'day': [24, 'hour'],
        'week': [7, 'weekday'],
        'month': [30, 'monthday'],
        'last-quarter': [14, 'week'],
        'prev-quarter': [14, 'week']
    };

    // Javascript defines 0 for Sunday
    // Specify what is considered first Week Day
    // Set to 1 if first week day is Monday
    static firstWeekDayIndex = 1;
    // Set to 0 (Sunday) last day of week
    static lastWeekDayIndex = 0;
    static one_day = 1000 * 60 * 60 * 24;
    static one_week = TrendChart.one_day * 7;
    static trendChartBaseParams = {
        pointBorderColor: "#FFF",
        pointBorderWidth: 2,
        pointHoverRadius: 4,
        pointHoverBorderWidth: 1,
        pointRadius: 4,
        backgroundColor: 'transparent',
        fill: true,
        borderWidth: 2
    };
}

class TrendChartLabels {
    // TODO: CHange: generate a time string list, and apply convertToHourLabels!
    static _buildHourLabels(start_time, num_labels) {
        console.log("Building Hour Labels");
        var firstHour = start_time.getUTCHours();
        var labels = [];
        for (let i = 1; i <= num_labels; i++) {
            var tempDay = new Date(start_time);
            tempDay.setUTCHours(firstHour + i);
            labels.push("H" + pad2Digits(tempDay.getUTCHours()));
        }
        return labels;
    }

    static _buildWeekLabels(start_date, num_labels) {
        console.log("Building " + num_labels + " Week Labels from ", start_date);
        var sampleHour = "H" + pad2Digits(start_date.getUTCHours());
        var weekDays = {2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat', 1: 'Sun'};
        var labels = [];
        var first_day = start_date.getDay();

        for (let i = 1; i <= num_labels; i++) {
            labels.push(weekDays[((first_day + i) % 7) + 1] + " " + sampleHour);
        }
        return labels;
    }

    static _buildDayLabels(start_date, num_labels, day_offset) {
        console.log("Building " + num_labels + " Month Day Labels, from Day " + start_date + " with day offset " + day_offset);

        var intervalDelta = day_offset || 1;
        var sampleHour = "H" + pad2Digits(start_date.getUTCHours());
        var labels = [];
        var tempDay = new Date(start_date);
        for (let i = 1; i <= num_labels; i++) {
            tempDay.setDate(tempDay.getDate() + intervalDelta);
            var nextDay = tempDay.getDate();
            // Month start at 0 - realign for human usage
            var nextMonth = tempDay.getMonth() + 1;
            labels.push(pad2Digits(nextDay) + "/" + pad2Digits(nextMonth) + " " + sampleHour);
        }
        return labels;
    };
            // TODO: Move to utilities?
            /**
             * Convert a list of time values received as strings to
             * Labels for Hours.
             * Tiem values are expected to be already UTC,
             * In any case they are considered as-is
             * @param {type} time_string_list
             * @returns {unresolved}
             */
            static convertToHourLabels(time_string_list) {
        var labels = time_string_list.map(function (time_str) {
            // Convert to date
            // Or jsut parse and extract Hour, Day, Month
            var sampleTime = new Date(time_str);
            return "H" + pad2Digits(sampleTime.getHours());
        });
        return labels;
    }

    static convertToWeekLabels(time_string_list) {
        var weekDays = {2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat', 1: 'Sun'};
        var labels = time_string_list.map(function (time_str) {
            // Convert to date
            // Or jsut parse and extract Hour, Day, Month
            var sampleTime = new Date(time_str);
            var weekIndex = sampleTime.getDay() % 7 + 1;
            return weekDays[weekIndex] + " H" + pad2Digits(sampleTime.getHours());
        });
        return labels;
    }

    static convertToDayLabels(time_string_list) {
        // 2022-12-12T17:00:00
        var labels = time_string_list.map(function (time_str) {
            // Convert to date
            // Or jsut parse and extract Hour, Day, Month
            var sampleTime = new Date(time_str);
            return pad2Digits(sampleTime.getDate()) + "/" + pad2Digits(sampleTime.getMonth() + 1) + " H" + pad2Digits(sampleTime.getHours());
        });
        return labels;
    }

    static buildTrendPeriodLabels(subperiodType, startDate, numPeriods) {
        // TODO: CHANGE: get Time String List, based on start_date, numperiods, SubPeriodType
        // Then call updateTrendChartLabels
        var labels;
        // Input : number of periods, type of periods
        // first period date (day/day of week/ month)
        // hour, weekday, monthday
        switch (subperiodType) {
            case 'hour':
                // If type = hour, startHour, startHour+1 ... startHour+numperiods -1 e.g. 12H, 13H, 14H
                labels = TrendChartLabels._buildHourLabels(startDate, numPeriods);
                break;
            case 'weekday':
                // if type = weekday start week day, next week day... Mon, Tue, Wed ... from start date
                labels = TrendChartLabels._buildWeekLabels(startDate, numPeriods);
                break;
            case 'monthday':
                // if type = monthday: start date in form dd/mm, start date +1 ...
                labels = TrendChartLabels._buildDayLabels(startDate, numPeriods);
                break;
            case 'week':
                // if type = week: start date in form dd/mm, start date +7 ...
                //
                labels = TrendChartLabels._buildDayLabels(startDate, numPeriods, 7);
                break;
        }
        return labels;
    }

    static getTrendPeriodLabels(subperiodType, numSamples) {
        var periodLabels = [];
        switch (subperiodType) {
            case 'hour':
                // If type = hour, startHour, startHour+1 ... startHour+numperiods -1 e.g. 12H, 13H, 14H
                periodLabels = TrendChartLabels.convertToHourLabels(numSamples);
                break;
            case 'weekday':
                // if type = weekday start week day, next week day... Mon, Tue, Wed ... from start date
                periodLabels = TrendChartLabels.convertToWeekLabels(numSamples);
                break;
            case 'monthday':
                // if type = monthday: start date in form dd/mm, start date +1 ...
                periodLabels = TrendChartLabels.convertToDayLabels(numSamples);
                break;
            case 'week':
                // if type = week: start date in form dd/mm, start date +7 ...
                periodLabels = TrendChartLabels.convertToDayLabels(numSamples);
                break;
        }
        return periodLabels;
    }
}

class PublicationStatistics {

    // Each Trend Chart builds only once its element id to address
    // chart eelemnt on DOM
    /*
     this.service_charts = {
     'DHUS': new ServiceTrendChart('DHUS'),
     'DAS': new ServiceTrendChart('DAS')
     };
     */

    init() {
        console.log("Publication Trend init");
        var data_type_sel = document.getElementById('time-trend-data-type-select');
        data_type_sel.value = 'count';
        var showDataType = 'VOL';
        var hideDataTYpe = 'NUM';
        [ '#published-trend-das-vol-row'].forEach(function (divId) {
            $(divId).hide();
        });
        data_type_sel.addEventListener('change', this.on_datatype_change.bind(this));
        //
        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

        // Register event callback for Time period select
        var time_period_sel = document.getElementById('time-period-select');
        time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));

        this.trendCharts = new Map();
        // TODO: to be executed by event listener
        this.loadPeriodData('prev-quarter');
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }

            // Programmatically select the previous quarter as the default time range
            console.info('Programmatically set the time period to previous quarter')
            time_period_sel.value = 'prev-quarter';
        }
        // TODO: dispatch "change" event
    }

    errorLoadAuthorized(response) {
        console.error(response)
        return;
    }

    updateDateInterval(period_type) {
        this.period_type = period_type;
        var observationTimePeriod = new ObservationTimePeriod();
        var dates = observationTimePeriod.getIntervalDates(period_type);
        this.end_date = dates[1];
        this.start_date = dates[0];
    }

    on_timeperiod_change(ev) {
        var elValue = ev.target.value;
        console.info("Trend Chart: Displayed Time period changed to " + elValue);
        this.loadPeriodData(elValue);
    }

    on_datatype_change() {
        var data_type_sel = document.getElementById('time-trend-data-type-select');
        var dataType = data_type_sel.value;
        console.log("Displayed data type changed to " + dataType);
        // Loop on DAS/DHUS, VOL/NUM
        // TODO: THESE MUST BE HANDLED BY TREND CHART CLASS!
        // Build id in function!
        var that = this;
        //['VOL', 'NUM'].forEach(function(dataType) {
        [ '#published-trend-das-vol-row',  '#published-trend-das-num-row'].forEach(function (divId) {
            $(divId).toggle();
        });
    }

    initTrendParameters(selectedTimePeriod) {

        this.updateDateInterval(selectedTimePeriod);
        var period_type = this.period_type;
        // TBD: Periods computed by Client, or returned by Server?? TBD
        this.trend_numperiods = TrendChart.subperiod_config[period_type][0];
        // Sub Period Type is needed to create labels for subperiods in line chart
        this.trend_subperiodtype = TrendChart.subperiod_config[period_type][1];
        // Offset w.r.t. interval start of first period start time/day
        // 0 means: count numperiods subperiods of type subperiod type
        // from interval start: last subperiod end is the last value of the thrend
        // it must not pass the interval end.
        this.trend_firstperiod_offset = 0;
        if (period_type === 'prev-quarter') {
            var prev_quarter = getPreviousQuarter(this.end_date);
            [this.start_date, this.end_date] = getQuarterInterval(prev_quarter['year'], prev_quarter['quarter']);
        }
        this.trendStartDate = new Date(this.start_date);
        this.trendEndDate = new Date(this.end_date);
        console.log("Computing Trend Previous Quarter parametrs. end date: ", this.end_date, "start_date:", this.start_date);
        if (TrendChart.subperiod_config[period_type][1] === 'week') {
            // TODO: Add a request for full week, or week overlapping interval (that begin/end outside the interval)
            // Get the interval composed of full weeks that is included/coincident with our interval
            //    (otherwise, the interval of full weeks including our interval)
            // IF so, modify accordingly the trend interval, but display only the end of intervals
            this.trendStartDate = getIntervalFirstWeekStart(this.start_date, this.end_date, TrendChart.firstWeekDayIndex);
            this.trendEndDate = getIntervalLastWeekEnd(this.start_date, this.end_date, TrendChart.lastWeekDayIndex);
            this.trend_numperiods = Math.floor((this.trendEndDate - this.trendStartDate) / TrendChart.one_week) + 1;
            this.trend_numperiods = this.trend_numperiods.toFixed(0);
        }
        console.log("Trend: start from ", this.trendStartDate, " to", this.trendEndDate, " num periods: ", this.trend_numperiods);
    }

    // TODO: Move to Chart Class
    missionColors = get_mission_colors();
    missionTrendChartParams = {
        'S1': {
            label: "Sentinel-1",
            borderColor: this.missionColors['S1'],
            pointBackgroundColor: this.missionColors['S1']
        },
        'S2': {
            label: "Sentinel-2",
            borderColor: this.missionColors['S2'],
            pointBackgroundColor: this.missionColors['S2']
        },
        'S3': {
            label: "Sentinel-3",
            borderColor: this.missionColors['S3'],
            pointBackgroundColor: this.missionColors['S3']
        },
        'S5': {
            label: "Sentinel-5",
            borderColor: this.missionColors['S5'],
            pointBackgroundColor: this.missionColors['S5']
        }
    };

    buildTrendPeriodLabels() {
        // TODO: CHANGE: get Time String List, based on start_date, numperiods, SubPeriodType
        // Then call updateTrendChartLabels
        return TrendChartLabels.buildTrendPeriodLabels(this.trend_subperiodtype,
                this.start_date,
                this.trend_numperiods);
    }

    // TODO: Move to chart Class
    _initTrendChart(service, dataType, timeLabels) {
        var chartId = this.trendChartId(service, dataType);
        console.log("Initializing Chart with ID: ", chartId);
        var multipleLineChart = document.getElementById(chartId).getContext('2d');
        var axisTicks = {
            beginAtZero: true,
            //min: 1000, // Edit the value according to what you need
            //max: newMaxValue,
            callback: function (value, index, ticks) {
                //console.log("Converting tick ", index, " value ", value);
                // Convert to propert GB/TB label, with value scaled down
                var tickLabel = value;
                if (dataType === 'VOL') {
                    tickLabel = format_size(value);
                }
                // for NUM, format count values (thousand separator)

                return tickLabel;
            }};
        // TODO: Clear previous Chart if existent
        var multipleLineTrendChart = new Chart(multipleLineChart, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    position: 'top'
                },
                tooltips: {
                    bodySpacing: 4,
                    mode: "nearest",
                    intersect: 0,
                    position: "nearest",
                    xPadding: 10,
                    yPadding: 10,
                    caretPadding: 10
                },
                layout: {
                    padding: {left: 15, right: 15, top: 15, bottom: 15}
                },
                scales: {
                    yAxes: [{
                            ticks: axisTicks
                        }]
                }
            }
        });
        // Save chart to allow clearing it
        if (dataType === 'VOL') {
            multipleLineTrendChart.options.tooltips.callbacks.label = function (tooltipItem, data) {
                var idx = tooltipItem.index;
                var datasetIdx = tooltipItem.datasetIndex;
                var datasetLabel = data.datasets[datasetIdx].label;
                var shownValue = data.datasets[datasetIdx].data[idx];
                if (shownValue === 'null' || shownValue === null || shownValue === 0) {
                    return "N/A";
                    // throw '';
                }
                // Print the volume value formatting with proper size label
                if (dataType === 'VOL') {
                    shownValue = format_size(shownValue);
                }
                return  datasetLabel + ': ' + shownValue;
            };

        }
        this.trendCharts.set(chartId, multipleLineTrendChart);
    }

    initTrendCharts() {
        // Compute labels
        var periodLabels = this.buildTrendPeriodLabels();
        console.log("Labels for Trend Chart: ", periodLabels);

        // Init charts for configured Service Id in list distribution-services
        for (const service of pub_service_list) {
            this._initTrendChart(service, 'NUM', periodLabels);
            this._initTrendChart(service, 'VOL', periodLabels);
        }
    }

    // TODO: Move to TrendChart Class
    updateTrendChartsLabels(sampleTimes) {
        // Build period labels from Sample times.
        // Format based on Period Type
        var responsePeriodLabels = TrendChartLabels.getTrendPeriodLabels(this.trend_subperiodtype,
                sampleTimes);
        for (const service of pub_service_list) {
            this.updateChartLabels(service, 'NUM', responsePeriodLabels);
            this.updateChartLabels(service, 'VOL', responsePeriodLabels);
        }
    }

    updateChartLabels(service, dataType, timeLabels) {
        var chartId = this.trendChartId(service, dataType);
        console.log("Updating Labels for Chart with el id: " + chartId);
        console.log("Current list of chart IDs: ", )
        var serviceChart = this.trendCharts.get(chartId);

        // Draw Chart with updated labels
        serviceChart.data.labels = timeLabels;
        serviceChart.update();
    }

    loadPeriodData(timePeriod) {
        this.initTrendParameters(timePeriod);
        console.info("Querying and loading Publication trend from " + this.start_date + " to " + this.end_date);
        this.clearTrendCharts();

        // Trend Chart is common to all missions, so we need to initailize it
        // outside the mission loop
        this.initTrendCharts();
        var that = this;

        var apiUrls = this.getCountVolumeApiUrls(timePeriod);
        // perform two parallel requests for Volume and Count
        var ajaxPublishPromises = [
            asyncAjaxCallParams(apiUrls.NUM,
                    'GET', {},
                    ['NUM'],
                    that.successLoadTrend.bind(that),
                    that.errorLoadPublication),
            asyncAjaxCallParams(apiUrls.VOL,
                    'GET', {},
                    ['VOL'],
                    that.successLoadTrend.bind(that),
                    that.errorLoadPublication)
        ];
        // Define a set of promises and enable the Time Period Selection
        // after all promises have been resolved
//            $.when(
//                (async() => {
//                    await Promise.all(ajaxPublishPromises);
//                    })()
//                ).then(() => {
//                                this.enableTimePeriodSel(true);
//                            }
//                        );

//        this.setLastUpdatedLabel(this.last_updated_date);
    }

    errorLoadPublication(response) {
        console.log("Error loading Publication Trend: ", response.status);
        console.error(response);
        $.notify("Error loading Publication Trend: ", response.status);
    }

    successLoadTrend(parameters, response) {
        var api_response = format_response(response);
        var dataType;
        [dataType] = parameters;
        console.debug("Trend response: ", api_response[0]);
        console.debug("Related to Data Type", dataType);
        // console.info("Trend Response from date "+api_response.interval.from + " to date "+api_response.interval.to);
        // Read from response:
        // List of sampe dates
        // That are needed to build Period Labels
        var endPeriodDate = moment(api_response[0].interval.to, 'yyyy-MM-DDTHH:mm:ss').toDate();
        this.setLastUpdatedLabel(endPeriodDate);
        this.updateTrendChartsLabels(api_response[0].sample_times);

        var service_data_recs = api_response[0].data;
        // data is an object, with key the services
        var that = this;

        for (const [service, service_records] of Object.entries(service_data_recs)) {
            console.log("Service: " + service + " - Received Trend response:", service_records);
            // Reinitialize Labels using num periods!
            //
            // For each Mission in the response:
            // Call draw Trend, loading mission data from response
            // Convert response data to a dictionary: mission: array of values
            // Extract mission data from response and save to Object
            // Pass it along to Chart update
            var chartId = that.trendChartId(service, dataType);
            var multipleLineTrendChart = that.trendCharts.get(chartId);
            for (const mission_data of service_records) {
                console.log("Service " + service + " - Calling Draw Mission Trend Data for mission " + mission_data.mission + ", dataType: " + dataType + " with chart Id: " + chartId);
                that.drawMissionTrendChart(multipleLineTrendChart,
                        mission_data.mission,
                        mission_data.trend);
            };
        }
    }

    setLastUpdatedLabel(lastUpdateTime) {
        var nowDateString = formatDateHour(lastUpdateTime);
        $("#publication-trend-last-updated").text(nowDateString);
    }

    // TODO Move to Chart Class
    /*
     Draw Trend Multiline CHart
     Define a common set of labels on the X Axis based on the
     Time interval and number/type of sub-intervals
     Load each line with mission specific data
     */
    drawMissionTrendChart(trendChart, mission, missionpublicationTrend) {
        console.info("Drawing trend for mission " + mission);
        console.debug(" with data: ", missionpublicationTrend);
        // copy wiht spread common parameters
        // Configure the Trend Chart using parameters depending
        // on the mission
        var mission_data = {...TrendChart.trendChartBaseParams};
        var mission_params = this.missionTrendChartParams[mission];
        Object.keys(mission_params).forEach(function (paramkey) {
            mission_data[paramkey] = mission_params[paramkey];
        });
        console.log("Mission " + mission + ", " + "Adding data to chart: ", missionpublicationTrend);
        mission_data.data = missionpublicationTrend;
        // Get Trend Chart for service service
        trendChart.data.datasets.push(mission_data);
        trendChart.update();
    }

    clearTrendCharts() {
        for (const tChart of this.trendCharts.values()) {
            tChart.destroy();
        }
        for (const tId of this.trendCharts.keys()) {
            $('.card', document.getElementById(tId)).eq(0).html(
                    '<div class="spinner">' +
                    '<div class="bounce1"></div>' +
                    '<div class="bounce2"></div>' +
                    '<div class="bounce3"></div>' +
                    '</div>');
        }
    }
    trendChartId(pub_service, dataType) {
        console.log("Computing Chart el id for service " + pub_service, ", data type: ", dataType);
        // Datatype one of: nrt/ntc/stc (Timeliness type)
        var chartId = pub_service.toLowerCase();
        chartId += "-" + dataType.toLowerCase() + "-multipleLineChart";
        return chartId;
    }

    /**
     * Build the API URLs for Size(Volume) and Count APIs,
     * depending on the currently selected period
     * @param {type} period_type
     * @returns {apiUrls}
     */
    getCountVolumeApiUrls(period_type) {
        // TODO Move activation of API to Trend class
        var count_api_name = 'statistics/cds-product-publication-trend';
        var size_api_name = 'statistics/cds-product-publication-volume-trend';
        console.log("Retrieving API id for period type " + period_type);
        var urlParamString = getApiTimePeriodId(period_type);
        console.log("Period for API URL: " + urlParamString);
        var apiUrls = {
            'VOL': '/api/' + size_api_name + '/' + urlParamString,
            'NUM': '/api/' + count_api_name + '/' + urlParamString
        };
        return apiUrls;
    }
    showPublicationTimeSeriesOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing publication time series online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Publication Time Series';
        content.message = 'This chart displays the time trend of the number of products published in the selected time period, ' +
                'per each mission. For systematic missions (Copernicus Sentinel-3 and Copernicus Sentinel-5p), possible fluctuations are due ' +
                'to nominal recovery or reprocessing operations; for the other missions, fluctuations can be due to tasking activities.</br>' +
                'By clicking on a label in the legend, it is possible to hide/show the time series of the selected mission.';
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return;
    }
}

console.log("Instantiating Publication Trend");
let publicationStatistics = new PublicationStatistics();
