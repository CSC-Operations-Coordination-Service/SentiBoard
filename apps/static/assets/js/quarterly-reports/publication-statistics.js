/*
 Copernicus Operations Dashboard
 
 Copyright (C) ${startYear}-${currentYear} ${SERCO}
 All rights reserved.
 
 This document discloses subject matter in which SERCO has
 proprietary rights. Recipient of the document shall not duplicate, use or
 disclose in whole or in part, information contained herein except for or on
 behalf of SERCO to fulfill the purpose for which the document was
 delivered to him.
 */

// TODO: Receive from Backend at start time, or read from DOM
//     (set by template, reading from configuration)
// var pub_service_list = ['DHUS', 'DAS'];
var pub_service_list = ['DAS'];

(function loadSSRPayload() {
    const el = document.getElementById("publication-trend-ssr");
    if (!el) {
        console.warn("[SSR] publication-trend-ssr script not found");
        return;
    }

    try {
        const payload = JSON.parse(el.textContent);

        //console.log("[SSR] Payload loaded:", payload);

        window.PUBLICATION_TREND_DATA =
            payload?.trend || payload?.publication_trend || null;

        window.PUBLICATION_VOLUME_TREND_DATA =
            payload?.volume || payload?.publication_volume || null;

        window.SSR_DATA_TYPE = payload?.default_datatype || "NUM";

        window.SSR_PERIOD_TYPE = payload?.period_type;  // effective period for data
        window.SSR_UI_PERIOD = payload?.ui_period;      // for dropdown selection

    } catch (e) {
        console.error("[SSR] Failed to parse SSR payload", e);
    }
})();


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
        var weekDays = { 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat', 1: 'Sun' };
        var labels = [];
        var first_day = start_date.getUTCDay();

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
            tempDay.setDate(tempDay.getUTCDate() + intervalDelta);
            var nextDay = tempDay.getUTCDate();
            // Month start at 0 - realign for human usage
            var nextMonth = tempDay.getUTCMonth() + 1;
            labels.push(pad2Digits(nextDay) + "/" + pad2Digits(nextMonth) + " " + sampleHour);
        }
        return labels;
    };

    static convertToHourLabels(time_string_list) {
        return time_string_list.map(time_str => {
            const d = new Date(time_str.endsWith("Z") ? time_str : time_str + "Z");
            return "H" + pad2Digits(d.getUTCHours());
        });
    }

    static convertToWeekLabels(time_string_list) {
        const weekDays = { 1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat' };
        return time_string_list.map(time_str => {
            const d = new Date(time_str.endsWith("Z") ? time_str : time_str + "Z");
            const weekIndex = d.getUTCDay() + 1;
            return weekDays[weekIndex] + " H" + pad2Digits(d.getUTCHours());
        });
    }

    static convertToDayLabels(time_string_list) {
        // 2022-12-12T17:00:00
        var labels = time_string_list.map(function (time_str) {
            // Convert to date
            // Or jsut parse and extract Hour, Day, Month
            var sampleTime = new Date(time_str);
            return pad2Digits(sampleTime.getUTCDate()) + "/" + pad2Digits(sampleTime.getUTCMonth() + 1) + " H" + pad2Digits(sampleTime.getUTCHours());
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

    constructor() {
        this.trendCharts = new Map();

        this.period_type = null;
        this.trend_subperiodtype = null;
        this.trend_numperiods = null;

        this.start_date = null;
        this.end_date = null;

        this.missionColors = get_mission_colors();
    }

    init() {
        console.log("[PublicationStatistics] INIT");

        // Fail-safe SSR period reading
        if (!window.SSR_PERIOD_TYPE) {
            console.warn("[SSR WARNING] SSR_PERIOD_TYPE not set, defaulting to prev-quarter");
            window.SSR_PERIOD_TYPE = "prev-quarter";
        }

        this.period_type = window.SSR_PERIOD_TYPE || "prev-quarter";

        this.dataType = window.SSR_DATA_TYPE || "NUM";
        const dropDownValue = window.SSR_UI_PERIOD;
        console.log("[SSR DEBUG] SSR_UI_PERIOD=", dropDownValue);
        console.log("[SSR DEBUG] SSR_PERIOD_TYPE=", window.SSR_PERIOD_TYPE);
        console.log("[SSR DEBUG] Setting select value to ", this.period_type);
        console.log("[INIT] Period resolved as:", this.period_type);
        console.log("[INIT] DataType:", this.dataType);

        // Compute trend parameters
        this.initTrendParameters(this.period_type);

        // Init charts
        this.initTrendCharts();

        // Apply SSR data safely
        this.applySSRData(
            this.period_type,
            window.PUBLICATION_TREND_DATA || {},
            window.PUBLICATION_VOLUME_TREND_DATA || {}
        );

        // Bind controls safely
        const $dataTypeSelect = $('#time-trend-data-type-select');
        $dataTypeSelect.off('change').on('change', () => this.on_datatype_change());
        $dataTypeSelect.val('count');

        $('#published-trend-das-num-row').show();
        $('#published-trend-das-vol-row').hide();

        const $periodSelect = $("#time-period-select");
        const dropdownValue = window.SSR_UI_PERIOD || window.SSR_PERIOD_TYPE;  // dropdown

        $periodSelect.val(dropdownValue);
        console.log("[TIME SELECT INIT] select after =", $periodSelect.val());

        $periodSelect.off("change.publicationStats").on("change.publicationStats", (e) => {
            const selected = e.target.value;
            console.log("[PUB STATS][PERIOD CHANGE]",
                "User selected:", selected,
                "| current SSR period:", this.period_type
            );
            if (selected !== this.period_type) {
                window.location.href =
                    `${window.location.pathname}?time-period-select=${selected}`;
            }
        });

    }


    formatDateHourUTC(date) {
        return (
            pad2Digits(date.getUTCDate()) + "/" +
            pad2Digits(date.getUTCMonth() + 1) + "/" +
            date.getUTCFullYear() + " " +
            pad2Digits(date.getUTCHours()) + ":" +
            pad2Digits(date.getUTCMinutes())
        );
    }
    onPeriodChange(period) {
        window.location.href =
            `/data-access?time-period-select=${period}`;
    }

    applySSRData(periodKey, trendResponse, volumeResponse) {
        //console.log("[PUB STATS] applySSRData", periodKey);

        //  SUPPORT BOTH SHAPES
        const trend = trendResponse?.trend ?? trendResponse;

        if (!trend || !trend.sample_times?.length) {
            console.warn("[PUB STATS] No SSR trend data", trendResponse);
            return;
        }

        const lastSampleTime = trend.sample_times.at(- 1);
        const normalized =
            lastSampleTime.replace(/(\.\d{3})\d+$/, '$1') + 'Z';
        const lastUpdateUtc = new Date(normalized);
        this.setLastUpdatedLabel(lastUpdateUtc);

        /*console.log(
            "[UTC CHECK]",
            "raw:", lastSampleTime,
            "utc:", lastUpdateUtc.toISOString(),
            "local:", lastUpdateUtc.toString()
        );*/

        /*console.log(
            "[PUB STATS] SSR samples:",
            trend.sample_times.length,
            "services:",
            Object.keys(trend.data || {})
        );*/

        //  Update labels
        this.updateTrendChartsLabels(trend.sample_times);

        //  Draw NUM datasets
        for (const [service, missions] of Object.entries(trend.data || {})) {
            missions.forEach(mission => {
                const chart = this.trendCharts.get(
                    this.trendChartId(service, 'NUM')
                );
                if (!chart) {
                    console.warn("[PUB STATS] Chart not found for", service);
                    return;
                }

                this.drawMissionTrendChart(
                    chart,
                    mission.mission,
                    mission.trend
                );
            });
        }

        //  Draw VOL datasets (if present)
        const volumeTrend = volumeResponse?.trend ?? volumeResponse;
        if (volumeTrend?.data) {
            for (const [service, missions] of Object.entries(volumeTrend.data)) {
                missions.forEach(mission => {
                    const chart = this.trendCharts.get(
                        this.trendChartId(service, 'VOL')
                    );
                    if (!chart) return;

                    this.drawMissionTrendChart(
                        chart,
                        mission.mission,
                        mission.trend
                    );
                });
            }
        }

        console.log("[PUB STATS] SSR trend rendered successfully");

    }

    updateDateInterval(period_type) {
        this.period_type = period_type;
        var observationTimePeriod = new ObservationTimePeriod();
        var dates = observationTimePeriod.getIntervalDates(period_type);
        this.end_date = dates[1];
        this.start_date = dates[0];
    }


    on_datatype_change() {
        const dataType = $('#time-trend-data-type-select').val();
        console.log("[UI] DataType changed to", dataType);

        if (dataType === 'count') {
            $('#published-trend-das-num-row').show();
            $('#published-trend-das-vol-row').hide();
        } else {
            $('#published-trend-das-num-row').hide();
            $('#published-trend-das-vol-row').show();
        }
    }

    initTrendParameters(period_type) {
        const obs = new ObservationTimePeriod();
        const dates = obs.getIntervalDates(period_type);

        this.start_date = dates[0];
        this.end_date = dates[1];

        this.trend_numperiods =
            TrendChart.subperiod_config[period_type][0];
        this.trend_subperiodtype =
            TrendChart.subperiod_config[period_type][1];

        console.log(
            "[TREND PARAMS]",
            "subperiod:", this.trend_subperiodtype,
            "num:", this.trend_numperiods
        );
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
        return TrendChartLabels.buildTrendPeriodLabels(
            this.trend_subperiodtype,
            this.start_date,
            this.trend_numperiods);
    }

    // TODO: Move to chart Class
    _initTrendChart(service, dataType, timeLabels) {
        var chartId = this.trendChartId(service, dataType);
        //console.log("Initializing Chart with ID: ", chartId);
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
            }
        };
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
                    padding: { left: 15, right: 15, top: 15, bottom: 15 }
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
                return datasetLabel + ': ' + shownValue;
            };

        }
        this.trendCharts.set(chartId, multipleLineTrendChart);
    }

    initTrendCharts() {
        // Compute labels
        const labels = this.buildTrendPeriodLabels();

        for (const service of pub_service_list) {
            this._initTrendChart(service, "NUM", labels);
            this._initTrendChart(service, "VOL", labels);
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
        //console.log("Updating Labels for Chart with el id: " + chartId);
        //console.log("Current list of chart IDs: ", chartId)
        var serviceChart = this.trendCharts.get(chartId);

        // Draw Chart with updated labels
        serviceChart.data.labels = timeLabels;
        serviceChart.update();
    }

    setLastUpdatedLabel(lastUpdateTime) {
        const utcString = this.formatDateHourUTC(lastUpdateTime);
        $("#publication-trend-last-updated").text(utcString);
    }


    drawMissionTrendChart(trendChart, mission, missionpublicationTrend) {
        //console.info("Drawing trend for mission " + mission);
        //console.debug(" with data: ", missionpublicationTrend);
        // copy wiht spread common parameters
        // Configure the Trend Chart using parameters depending
        // on the mission
        var mission_data = { ...TrendChart.trendChartBaseParams };
        var mission_params = this.missionTrendChartParams[mission];
        Object.keys(mission_params).forEach(function (paramkey) {
            mission_data[paramkey] = mission_params[paramkey];
        });
        //console.log("Mission " + mission + ", " + "Adding data to chart: ", missionpublicationTrend);
        mission_data.data = missionpublicationTrend;
        // Get Trend Chart for service service
        trendChart.data.datasets.push(mission_data);
        trendChart.update();
    }


    trendChartId(pub_service, dataType) {
        //console.log("Computing Chart el id for service " + pub_service, ", data type: ", dataType);
        // Datatype one of: nrt/ntc/stc (Timeliness type)
        var chartId = pub_service.toLowerCase();
        chartId += "-" + dataType.toLowerCase() + "-multipleLineChart";
        return chartId;
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