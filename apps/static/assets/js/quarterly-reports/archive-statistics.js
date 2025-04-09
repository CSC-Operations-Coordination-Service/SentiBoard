/*
 Copernicus Operations Dashboard
 
 Copyright (C) 2022- Telespazio
 All rights reserved.
 
 This document discloses subject matter in which TPZ has
 proprietary rights. Recipient of the document shall not duplicate, use or
 disclose in whole or in part, information contained herein except for or on
 behalf of TPZ to fulfill the purpose for which the document was
 delivered to him.
 */

class ArchiveMissionStatistics {

    constructor(stat_type) {
        this.reset();
        this.missionArchiveSizes = {};
        this.missionLevelsArchiveSizes = {};
        this.levelMissionsArchiveSizes = {};
        this.missionArchiveCount = {};
        this.levelMissionsArchiveCount = {};
    }

    reset() {

    }

    _addMissionLevelSize(mission, level, size) {
        // Update Mission Size for level
        if (!(level in this.missionLevelsArchiveSizes)) {
            this.missionLevelsArchiveSizes[level] = {};
        }
        if (!(mission in this.missionLevelsArchiveSizes[level])) {
            this.missionLevelsArchiveSizes[level][mission] = 0;
        }
        this.missionLevelsArchiveSizes[level][mission] += size;
    }

    _addLevelSize(mission, level, size) {
        // Update level size for mission
        if (!(mission in this.levelMissionsArchiveSizes)) {
            this.levelMissionsArchiveSizes[mission] = {};
        }
        if (!(level in this.levelMissionsArchiveSizes[mission])) {
            this.levelMissionsArchiveSizes[mission][level] = 0;
        }
        this.levelMissionsArchiveSizes[mission][level] += size;
    }

    _addMissionSize(mission, size) {
        // CHeck if mission is present in missionArchiveSizes
        if (!(mission in this.missionArchiveSizes)) {
            this.missionArchiveSizes[mission] = 0;
        }
        this.missionArchiveSizes[mission] += size;
    }

    _addMissionCount(mission, count) {
        // CHeck if mission is present in missionArchiveSizes
        if (!(mission in this.missionArchiveCount)) {
            this.missionArchiveCount[mission] = 0;
        }
        this.missionArchiveCount[mission] += count;
    }

    _addLevelCount(mission, level, count) {
        // Update level size for mission
        if (!(mission in this.levelMissionsArchiveCount)) {
            this.levelMissionsArchiveCount[mission] = {};
        }
        if (!(level in this.levelMissionsArchiveCount[mission])) {
            this.levelMissionsArchiveCount[mission][level] = 0;
        }
        this.levelMissionsArchiveCount[mission][level] += count;
    }

    addSizeStatistic(mission, level, size) {
        // Update total size for MissionvelSize
        this._addMissionSize(mission, size);
        this._addMissionLevelSize(mission, level, size);
        this._addLevelSize(mission, level, size);
    }

    addCountStatistic(mission, level, count) {
        this._addMissionCount(mission, count);
        this._addLevelCount(mission, level, count);
    }

    getDetailStatistics(detailType) {
        // 'VOL' or 'NUM'
        if (detailType === 'VOL') {
            return this.levelMissionsArchiveSizes;
        }
        if (detailType === 'NUM') {
            return this.levelMissionsArchiveCount;
        }
        throw "Unknown data type " + detailType;
    }
};

var PeriodKey = 'period';
var LifetimeKey = 'lifetime';

class ArchiveStatisticsCharts {
    constructor() {
        this._detailsHorizontal = false;
        this.stackBarChart = {};
        this.stackBarChart[PeriodKey] = new Map();
        this.stackBarChart[LifetimeKey] = new Map();
    }

    init() {

        var data_type_sel = document.getElementById('time-trend-data-type-select');
        data_type_sel.value = 'count';
        var showDataType = 'VOL';
        var hideDataTYpe = 'NUM';
        ['#LTA-period-mission-levels-vol-row'].forEach(function (divId) {
            $(divId).hide();
        });
        ['#LTA-lifetime-mission-levels-vol-row'].forEach(function (divId) {
            $(divId).hide();
        });
        data_type_sel.addEventListener('change', this.on_datatype_change.bind(this));

        // TODO: move to a dedicated class to manage Time Selection "last quarter" authorizatin
        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

        //  Register event callback for Time period select
        var time_period_sel = document.getElementById('time-period-select');
        time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this))

        this.loadArchiveLifetimeStatistics();
        // Page Loading managed by quarterAuthorizeProcess
    }

    // TODO: move to a separate class that only manages authorizazion for last quarter
    quarterAuthorizedProcess(response) {
        var time_period_sel = document.getElementById('time-period-select');
        if (response['authorized'] === true) {
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }

            // Programmatically select the previous quarter as the default time range
            console.info('Programmatically set the time period to previous quarter')
            time_period_sel.value = 'prev-quarter';
        }
        // OR : dispatch time period event generation
        time_period_sel.dispatchEvent(new Event('change'));
    }

    errorLoadAuthorized(response) {
        console.error(response);
    }

    on_timeperiod_change(ev) {
        var elValue = ev.target.value;
        console.info("ARC-Stat: Displayed time period changed to " + elValue);
        this.loadArchiveStatistics(elValue);
    }

    on_datatype_change(ev) {
        // var data_type_sel = document.getElementById('time-trend-data-type-select');
        // var selectedDataType = data_type_sel.value;
        var selectedDataType = ev.target.value;
        console.info("ARC-Stat: Displayed data type changed to " + selectedDataType);
        var showDataType = 'NUM';
        var hideDataType = 'VOL';
        if (selectedDataType === 'volume') {
            showDataType = 'VOL';
            hideDataType = 'NUM';
        }
        // Hide/show rows for Period Mission Charts
        var divSId = this.getRowDivId('period-mission-levels', showDataType);
        $('#' + divSId).show();
        var divHId = this.getRowDivId('period-mission-levels', hideDataType);
        $('#' + divHId).hide();
        // Hide/show rows for Lifetime Mission Charts
        divSId = this.getRowDivId('lifetime-mission-levels', showDataType);
        $('#' + divSId).show();
        divHId = this.getRowDivId('lifetime-mission-levels', hideDataType);
        $('#' + divHId).hide();
    }

    setLastUpdatedLabel(lastUpdateTime) {
        var nowDateString = formatDateHour(lastUpdateTime);
        $("#trend-last-updated").text(nowDateString);
    }

    loadArchiveLifetimeStatistics() {
        var archive_api_name = 'reporting/cds-product-archive-volume';
        var period_type = LifetimeKey;
        console.log("Loading Archive statistics for period " + period_type);
        // this.clearCharts(period_type);
        //
        // Acknowledge the invocation of rest APIs
        console.info("Starting retrieval of Archive lifetime statistics...");
        // Add class Busy to charts
        //
        var urlParamString = getApiTimePeriodId(period_type);
        console.log("Period for API URL: " + urlParamString);
        var that = this;
        var ajaxArchivePromises =
                asyncAjaxCall('/api/' + archive_api_name + '/' + urlParamString,
                        'GET', {},
                        that.successLoadLifetimeArchive.bind(that),
                        that.errorLoadArchive);
    }

    // Call API
    loadArchiveStatistics(period_id) {

        var archive_api_name = 'reporting/cds-product-archive-volume';
        console.log("Loading Archive statistics for period " + period_id);
        // 
        // Clear previous data, if any
        // TODO; put Waiting Spinner
        this.clearCharts(PeriodKey);
        // Acknowledge the invocation of rest APIs
        console.info("Starting retrieval of Archive statistics...");
        // Add class Busy to charts
        // 
        // /api/cds-product-timeliness/last-<period_id>
        var urlParamString = getApiTimePeriodId(period_id);
        console.log("Period for API URL: " + urlParamString);
        var that = this;
        var ajaxArchivePromises =
                asyncAjaxCall('/api/' + archive_api_name + '/' + urlParamString,
                        'GET', {},
                        that.successLoadPeriodArchive.bind(that),
                        that.errorLoadArchive);
        // THis promise resolution should remove Waiting spinner: At present it is not doing it
        // TODO: REMOVE!
        // Execute asynchronous AJAX call
        ajaxArchivePromises.then(function () {
            console.log("Received all results!");
            var dialog = document.getElementById('window');
            if (dialog !== null) {
                dialog.show();
                document.getElementById('exit').onclick = function () {
                    dialog.close();
                };
            }
        });
    }

    getChartId(chartType, dataType) {
        return "LTA-" + chartType.toLowerCase() + "-" + dataType.toLowerCase() + "-barChart";
    }

    getRowDivId(chartType, dataType) {
        console.log("Archive, computing row div id for chart " + chartType + "data type " + dataType);
        return "LTA-" + chartType.toLowerCase() + "-" + dataType.toLowerCase() + "-row";
    }

    computeArchiveStatistics(data_rows) {
        var archiveStatistics = new ArchiveMissionStatistics();
        console.debug("Computing statistics from response: ", data_rows);
        // Parse response
        // Each result in response shall specify:
        // mission (just for check) level, size
        // Compute total size for each mission
        // build two structures: one based on all defined levels,
        // specifying size for each mission , if level defined for that mission
        // oen with total size for each mission
        // TODO: put together levels with different labels!
        for (const record of data_rows) {

            // Auxiliary variables
            var mission = record.mission;
            var satellite= record.satellite;
            var level = record.product_level;
            var size = record.content_length_sum;
            var count = record.count;
            console.debug("Mission: " + mission + ", satellite: ", satellite + ", archive: " + level + ", count=" + count);
            archiveStatistics.addSizeStatistic(satellite, level, size);
            archiveStatistics.addCountStatistic(satellite, level, count);
        }
        return archiveStatistics;
    }

    // Extend to manage also LIFETIME query, by filling
    // two separate charts
    successLoadPeriodArchive(response) {
        // Read Response
        //   Load Statistics Object
        //
        var periodType = PeriodKey;
        // Acknowledge the successful retrieval of downlink operations
        var json_resp = format_response(response);
        // Update reference time label
        var endPeriodDate = moment(json_resp[0].interval.to, 'yyyy-MM-DDTHH:mm:ss').toDate();
        console.debug("Arc-STATS - Setting Last update to ", endPeriodDate);
        this.setLastUpdatedLabel(endPeriodDate);
        // TODO: Check endPeriodDate against         this.lifetimeEndPeriodDate
        // If needed send request for Lifetime data loading/updating
        if (endPeriodDate > this.lifetimeEndPeriodDate) {
            console.debug("Loaded Archive Period data for a date after liime data");
        }
        this.loadArchive(json_resp, periodType);
    }

    loadArchive(json_data, periodType) {
        console.debug("Arc-STATS - "+ periodType + " - Received response:", json_data);

        var rows = json_data[0].data;
        console.info('Archive Statistics successfully retrieved');
        console.info("Number of results: " + rows.length);
        var archiveStatistics = this.computeArchiveStatistics(rows);

        var that = this;
        ['VOL', 'NUM'].forEach(function (detailType) {
            // Draw the detailed bar chart, with details related to sites
            // TODO: mission-levels ---- period-archive-satellites
            var levelsBarChartId = that.getChartId(periodType+'-archive-satellites', detailType);
            that.drawDetailedBarChart(levelsBarChartId,
                    archiveStatistics.getDetailStatistics(detailType),
                    detailType, periodType);
        });
    }
    // TODO: Unify successLoadArchive functions
    successLoadLifetimeArchive(response) {
        // Read Response
        //   Load Statistics Object
        //
        var periodType = LifetimeKey;
        var json_resp = format_response(response);
        // Update reference time label
        /*
        TODO: Be sure to maintain Lifetime and period statistics synchronized to reference period
          It could happen that we start in a X reference time hour, and
            after a while, the period data is switched to next time hour.
            If that happens (to be checked by a function activated by the Period Statistics Load)
            load again the Lifetime statistics
            TO that purpose, we need to save lastUpdate for Lifetime data on a Class variable!!
        */
        var endPeriodDate = moment(json_resp[0].interval.to, 'yyyy-MM-DDTHH:mm:ss').toDate();
        console.debug("Arc-STATS - Setting Last update of lifetime data to ", endPeriodDate);
        this.lifetimeEndPeriodDate = endPeriodDate;
        this.loadArchive(json_resp, periodType);
    }

    errorLoadArchive(response) {
        console.log("Error loading Archive Stats");
        console.error(response);
    }

    _getBarMaxValue(dataMaxValue) {
        var barMaxValue = dataMaxValue * 1.05; // Increment by 5 %;
        // Convert max value to volume size and get nearest integer size
        // E.g. max value = 234567890 bytes
        // returns 23.4 MB
        var [maxVolumeSize, maxUnit] = normalize_size_decimal(barMaxValue);
        // Convert back nearest volume integer size to byte value
        var maxIntVolumeSize = get_nearest_greater_integer_size(maxVolumeSize);
        // Return Max value in higheest unit, and the corresponding value in bytes
        // That is, return the absolute value corresponding to a tick
        return [maxIntVolumeSize, unitsize_to_bytes_decimal(maxIntVolumeSize, maxUnit)];
    }

    // Process API Successful Response 
    // Draw Charts
    //  show one stacked bar for each Archive Site
    //     Each bar shows value for each satellite data stored at the corresponding archive

    _extractAllSubObjectsKeys(subObjectList) {
        // Extract the list of all keys present in the objects
        // in hte pased list
        return Array.from(new Set(subObjectList.flatMap(Object.keys)));
    }

    _integrateMissingValues(detailRecord, keyList) {
        // Detail record is integrated with object entries for the missing keys
        // Add fields to current Detail record object
        // Return only values
        return keyList.map(function (key) {
            //return Object.assign(detailRecord, keyList.forEach(function(key) {

            if (!(key in detailRecord)) {
                return null;
            } else {
                return detailRecord[key];
            }
        });
    }

    // Interpolate labels inside each dataset:
    // datasets: [
    //   {label : 'dataset1Label', data: dataset1_data_array, backgroundColor: bgColor1 },
    //   {label : 'dataset2Label', data: dataset2_data_array, backgroundColor: bgColor2 },
    //]
    // For each dataset, the label is the corresponding key
    // the external labels are the sorted keys of the datasets values
    // All datasets must have data array of the same length
    // Keys with no values shall be repalced by a 0 value
    _buildHomogeneousDetailedDatasets(archiveDetailKeys,
                                      archiveDetailedData) {
        var _datasets = [];
        var _colors = get_satellite_colors();//get_colors(archiveDetailedData.length);
        console.debug("Building datasets for ", archiveDetailedData);
        for (const  [archiveItem, detailData] of  Object.entries(archiveDetailedData)) {
            console.debug("Detail Single item (" + archiveItem + "): ", detailData);
            // Build the data array, with all possible elements
            // by taking all values for the DetailObjecs Keys
            // 0 if the key is not present in original detailData
            // Label is the corresponsind key
            var integratedDetailValues = this._integrateMissingValues(detailData, archiveDetailKeys);
            console.debug("Signle Item with missing keys integrated ", integratedDetailValues);
            var detailRecord = {
                label: archiveItem,
                data: integratedDetailValues,
                backgroundColor: _colors[archiveItem],
                //borderWidth: 2,
                fill: false
            };
            _datasets.push(detailRecord);
        }
        return _datasets;
    }

    drawDetailedBarChart(chartId, archiveLevelDetailData, dataType, periodType) {
        console.log("Drawing Stacked Bars with ID " + chartId + ", for period type "+periodType);
        console.debug("Data to be put on Detail chart: ", archiveLevelDetailData);

        var chartCanvas = document.getElementById(chartId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        } else {
            console.error("Stacked Bars Chart with id " + chartId + " not present on page");
            return;
        }
        // Get the labels to associate with legends (labels for each portion of a stack
        var stackLabels = this._extractAllSubObjectsKeys(Object.values(archiveLevelDetailData)).sort();
        console.debug("Extracted all Level Keys", stackLabels);
        var barDetailDatasets = this._buildHomogeneousDetailedDatasets(stackLabels, archiveLevelDetailData);
        console.debug("Level/Mission Datasets: ", barDetailDatasets);
        //         var max_w = Math.max(...statisticsGroupData.datasets.map(({statisticsData}) => statisticsData.whiskerMax));
        //var barMaxValue = Math.max(...barDetailDatasets.map(({detailRecord}) => data));
        //var [unitMaxValue, newMaxValue] = this._getBarMaxValue(barMaxValue);
        // TODO: compute NewMax Value on selected datasets (as in Timeliness Product)
        // 
        // Each bar on each stack is related to a level, with relevant Label
        // The stack label, instead, is relevant to the mission
        // Each dataset is associated to a level; for each level, 
        // a list of objects with mission: size is barDetailDatasets
        var barData = {
            datasets: barDetailDatasets, // datsets with integrated missing elements
            labels: stackLabels  // Names of each dataset elements
        };
        console.debug("Creating Stacked Bar with Data: ", barData);
        var barAxisTicks = {};
        var barStackAxisTicks = {
            beginAtZero: true,
            //min: 1000, // Edit the value according to what you need
            //max: newMaxValue,
            callback: function (value, index, ticks) {
                //console.log("Converting tick ", index, " value ", value);
                // Convert to propert GB/TB label, with value scaled down
                var tickLabel = value;
                if (dataType === 'VOL') {
                    tickLabel = format_size_decimal(value);
                } else {
                    // for NUM, format count values (thousand separator)
                    tickLabel = format_count(value);
                }

                return tickLabel;
            }};
        var axesTicksConfig = {};
        // Configure Axis on vertical or horizontal based on bar chart orientation
        var barStackAxis = 'x';
        var barAxis = 'y';
        var barType = 'horizontalBar';
        if (!this._detailsHorizontal === true) {
            barType = 'bar';
            barStackAxis = 'y';
            barAxis = 'x';
        }
        axesTicksConfig[barStackAxis] = barStackAxisTicks;
        axesTicksConfig[barAxis] = barAxisTicks;
        // TODO: Compute for each archive dataset the max value, and the corresponding string length
        // for VOL/NUM dataTYpes
        var labelMaxWidths = [10, 8, 9, 12, 12];
        // TODO for each dataset, compute a labelMaxWidth, based on the dataset dataTYpe
        console.debug("Saving Chart object for periodType ", periodType, ", dataType ", dataType);
        this.stackBarChart[periodType].set(dataType, new Chart(chartCanvas.getContext('2d'), {
            type: barType,
            data: barData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: true,
                    position: 'right', // 'chartArea',
                    //usePointStyle: true,
                    //pointStyle: 'line',
                    labels: {
                        fontColor: 'white',
                        fontSize: 14
                    },
                    onClick: function (e, legendItem) {
                        // hide/show dataset corresponding to legend item
                        var dsIndex = legendItem.datasetIndex;
                        var ci = this.chart;
                        var meta = ci.getDatasetMeta(dsIndex);
                        meta.hidden = meta.hidden === null ? !ci.data.datasets[dsIndex].hidden : null;
                        ci.update();
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 20,
                        bottom: 20
                    }
                },
                scales: {
                    yAxes: [{stacked: true, ticks: axesTicksConfig.y}],
                    xAxes: [
                        {
                            stacked: true,
                            ticks: axesTicksConfig.x
                        }
                    ]
                },
                showTooltips: true,
                tooltips: {
                    mode: 'label',
                    callbacks: {
                        // Display for each dataset Size in TB, or number of products, depending on selected type onp ge
                        // TODO: Add a funciton to modify Tooltip titel, by adding total of
                        //   corresponding dataset
                        title: (tooltipItems, data) =>  {
                                return ArchiveStatisticsCharts.buildTooltipTitle(dataType,
                                                            tooltipItems, data);
                            },
                        // TODO: move to a separate function outside Chart creation
                        // TODO: make value formatting a function, passed by caller (dependend on displayed type)
                        label: (tooltipItems, data) =>  {
                                return ArchiveStatisticsCharts.buildTooltipLabel(dataType,
                                                            labelMaxWidths,
                                                            tooltipItems, data);
                        }
                    }
                    //labelTextColor: function (tooltipItem, chart) {
                    //    return chart.data.datasets[0].backgroundColor[tooltipItem.index];
                    //}
                }
            },
            plugins:
                    {
                        beforeDraw: function (c) {
                            var legends = c.legend.legendItems;
                            legends.forEach(function (e) {
                                e.fill = false;
                            });
                        }
                    }
        }));
    }

    static buildTooltipTitle(dataType, tooltipItems, data) {
        //Return value for title
        var idx = tooltipItems.index;
        // console.log("Title for items ", tooltipItems);
        var archiveTotal = tooltipItems.reduce((accumulator, barStack) => {
            // console.log("Summing mission dataset: ", barStack.yLabel);
            return accumulator + (barStack.yLabel || 0);
        }, 0);
        if (dataType === 'VOL') {
            archiveTotal = format_size_decimal(archiveTotal);
        } else {
            archiveTotal = format_count(archiveTotal);
        }

        return tooltipItems[0].xLabel + ': ' + archiveTotal;
    }

    static buildTooltipLabel (dataType, maxWidths, tooltipItem, data) {
        var idx = tooltipItem.index;
        var datasetIdx = tooltipItem.datasetIndex;
        // THis is the mission value for this archive
        var datasetLabel = data.datasets[datasetIdx].label;
        var shownValue = data.datasets[datasetIdx].data[idx];
        if (shownValue === 'null' || shownValue === null || shownValue === 0) {
            return "N/A";
            // throw '';
        }
        // Print the volume value formatting with proper size label
        if (dataType === 'VOL') {
            shownValue = format_size_decimal(shownValue);
        } else {
            shownValue = format_count(shownValue);
        }
        //Note that Intl has format that performs the padding
        // return  datasetLabel + ': ' + shownValue;
        return  datasetLabel + ': ' + shownValue.padStart(maxWidths[idx]);
    }

    // Clear Charts
    clearCharts(periodType) {
        console.log("Arc-STATS: Clearing previous charts of period type ", periodType);
        var idPeriodType = periodType.toLowerCase();
        //for (const [dataType, pChart] of this.stackBarChart) {
        this.stackBarChart[idPeriodType].forEach((pChart, dataType, chartTable) => {
            console.log(dataType, pChart);
            console.debug("Arc-STATS: Destroying ", periodType, " chart ", pChart, ", Data Type: ", dataType);
            if (pChart !== 'undefined' && pChart !== null) {
                pChart.destroy();
            }
        });
        console.log("Arc-STATS: completed clearing charts");
    }
}

let archiveStatistics = new ArchiveStatisticsCharts();
