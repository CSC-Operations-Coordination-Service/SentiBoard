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

class ArchiveStatisticsCharts {

    constructor() {
        this._detailsHorizontal = false;
        this.gaugeChart = null;
        this.stackBarChart = new Map();
    }

    init() {

        var data_type_sel = document.getElementById('time-trend-data-type-select');
        data_type_sel.value = 'count';
        var showDataType = 'VOL';
        var hideDataTYpe = 'NUM';
        ['#LTA-mission-levels-vol-row'].forEach(function (divId) {
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

        // TODO: Remove: leave to quarterAuthorizeProcess the page loading
        // Retrieve the archiving statistics
        this.loadArchiveStatistics('prev-quarter');
    }

    // TODO: move to a separate class that only manages authorizazion for last quarter
    quarterAuthorizedProcess(response) {
        var time_period_sel = document.getElementById('time-period-select');
        if (response['authorized'] === true) {
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option('Previous Quarter', 'prev-quarter'));
            }

            // Programmatically select the previous quarter as the default time range
            console.info('Programmatically set the time period to previous quarter')
            time_period_sel.value = 'prev-quarter';
        }
        // OR : dispatch time period event generation
        //time_period_sel.dispatchEvent(new Event('change'));
    }

    errorLoadAuthorized(response) {
        console.error(response)
        return;
    }

    on_timeperiod_change(ev) {
        var elId = ev.target.id;
        var elValue = ev.target.value;
        console.info("ARC-Stat: Displayed time period changed to " + elValue);
        var time_period_sel = document.getElementById(elId);
        elValue = time_period_sel.value;
        this.loadArchiveStatistics(elValue);
    }

    on_datatype_change() {
        var data_type_sel = document.getElementById('time-trend-data-type-select');
        var selectedDataType = data_type_sel.value;
        console.info("ARC-Stat: Displayed data type changed to " + selectedDataType);
        var showDataType = 'NUM';
        var hideDataType = 'VOL';
        if (selectedDataType === 'volume') {
            showDataType = 'VOL';
            hideDataType = 'NUM';
        }
        var divSId = this.getRowDivId('mission-levels', showDataType);
        $('#' + divSId).show();
        var divHId = this.getRowDivId('mission-levels', hideDataType);
        $('#' + divHId).hide();
    }

    setLastUpdatedLabel(lastUpdateTime) {
        var nowDateString = formatDateHour(lastUpdateTime);
        $("#trend-last-updated").text(nowDateString);
    }

    // Call API
    loadArchiveStatistics(period_type) {

        var archive_api_name = 'reporting/cds-product-archive-volume';
        console.log("Loading Archive statistics for period " + period_type);
        // 
        // Clear previous data, if any
        // TODO; put Waiting Spinner
        this.clearCharts();
        // Acknowledge the invocation of rest APIs
        console.info("Starting retrieval of Archive statistics...");
        // Add class Busy to charts
        // 
        // /api/cds-product-timeliness/last-<period_id>
        var urlParamString = getApiTimePeriodId(period_type);
        console.log("Period for API URL: " + urlParamString);
        var that = this;
        var ajaxArchivePromises =
                asyncAjaxCall('/api/' + archive_api_name + '/' + urlParamString,
                        'GET', {},
                        that.successLoadArchive.bind(that),
                        that.errorLoadArchive);
        // Execute asynchrounous AJAX call
        ajaxArchivePromises.then(function () {
            console.log("Received all results!");
            var dialog = document.getElementById('window');
            if (dialog !== null) {
                dialog.show();
                document.getElementById('exit').onclick = function () {
                    console.log("Clikc");
                    dialog.close();
                };
            }
        });
        return;
    }

    getChartId(chartType, dataType) {
        return "LTA-" + chartType.toLowerCase() + "-" + dataType.toLowerCase() + "-barChart";
    }

    getRowDivId(chartType, dataType) {
        console.log("Archive, computing row div id for chart " + chartType + "data type " + dataType);
        return "LTA-" + chartType.toLowerCase() + "-" + dataType.toLowerCase() + "-row";
    }

    successLoadArchive(response) {
        // Acknowledge the successful retrieval of downlink operations
        var json_resp = format_response(response);
        console.debug("Arc-STATS - Received response:", json_resp);
        // Update reference time label
        var endPeriodDate = moment(json_resp[0].interval.to, 'yyyy-MM-DDTHH:mm:ss').toDate();
        console.debug("Arc-STATS - Setting Last update to ", endPeriodDate);
        this.setLastUpdatedLabel(endPeriodDate);

        var rows = json_resp[0].data;
        console.info('Archive Statistics successfully retrieved');
        console.info("Number of results: " + rows.length);
        var levels_labels = {
            'L1_': 'L1',
            'L2_': 'L2',
            'L0_': 'L0',
            'AUX': 'AUX'
        };

        // this.clearCharts();
        var archiveStatistics = new ArchiveMissionStatistics();

        // Parse response
        // Each result in response shall specify:
        // mission (just for check) level, size
        // Compute total size for each mission
        // build two structures: one based on all defined levels,
        // specifiying size for each mission , if level defined for that mission
        // oen with total size for each mission
        // TODO: put together levels with different labels!
        for (const record of rows) {
            // Auxiliary variables
            var mission = record.mission;
            var level = record.product_level;
            var size = record.content_length_sum;
            var count = record.count;
            console.debug("Mission " + mission + ", level" + level + ": count=" + count);
            archiveStatistics.addSizeStatistic(mission, level, size);
            archiveStatistics.addCountStatistic(mission, level, count);
        }

        var that = this;
        ['VOL', 'NUM'].forEach(function (detailType) {
            // Draw the Total size of Mission Bar CHart (regardless of site)
            var missionBarChartId = that.getChartId('mission', detailType);
            // We are passing the record object, that contains the data to be fed in the Gauge
            that.drawBarChart(missionBarChartId, archiveStatistics.missionArchiveSizes);

            // Draw the detailed bar chart, with details related to sites
            var levelsBarChartId = that.getChartId('mission-levels', detailType);
            that.drawDetailedBarChart(levelsBarChartId,
                    archiveStatistics.getDetailStatistics(detailType),
                    detailType);
        });
    }

    errorLoadArchive(response) {
        console.log("Error loading Archive Stats");
        console.error(response);
    }

    _getBarMaxValue(dataMaxValue) {
        var barMaxValue = dataMaxValue * 1.05; // Increment by 5 %;
        // Convert max value to volume size and get nearest integer size
        var [maxVolumeSize, maxUnit] = normalize_size(barMaxValue);
        // Convert back nearest volume integer size to byte value
        var maxIntVolumeSize = get_nearest_greater_integer_size(maxVolumeSize);
        return [maxIntVolumeSize, unitsize_to_bytes(maxIntVolumeSize, maxUnit)];
    }

    // Process API Successful Response 
    // Draw Charts (one function to draw missions occupation on period
    //    one function to draw stacked bars to show level occupation for 
    // each mission

    /**
     * 
     * @param {string} pieId | the id of the lement containing the canvas div
     * @param {number} timeThreshold | the number of hours reprsenting the time Threshold for
     *  the data represented 
     * @param {Object} data | a two element object containing:
     *      on_time: the number of products published according to the timliness 
     *      constraint; 
     *      total_count: the total number of generated products (published or not)
     * @returns N/A
     */
    drawBarChart(chartId, archiveMissionVolumeData) {
        console.log("Archive - Drawing  Bars with ID " + chartId);
        // console.log("Data to be put on chart: ", archiveMissionVolumeData);

        var chartCanvas = document.getElementById(chartId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        } else {
            console.error("Bars Chart with id " + chartId + " not present on page");
            return;
        }
        // Data represent: 
        // For each mission: total mission volume on LTA,
        //      for each mission level: volume on LTA
        // and number of archived products 
        // 
        var barDatasets = Object.values(archiveMissionVolumeData);
        var missionNames = Object.keys(archiveMissionVolumeData);
        // TODO Instead of data, make datasets Empty
        var barData = {
            datasets: [{
                    data: barDatasets,
                    //backgroundColor: get_colors(barDatasets.length),
                    label: "Mission Volume"}
            ],
            labels: missionNames
        };
        console.debug("Archive - Drawing Mission Chart with bardata: ", barData);
        console.debug("Archive - Value: ", barDatasets);
        var barMaxValue = Math.max(...barDatasets);
        var [unitMaxValue, newMaxValue] = this._getBarMaxValue(barMaxValue);
        //console.log("Max Mission archive value: ", barMaxValue, "Normalized: ", newMaxValue);
        this.gaugeChart = new Chart(chartCanvas.getContext('2d'), {
            type: 'horizontalBar',
            data: barData,
            options: {
                responsive: true,
                scales: {

                    xAxes: [{
                            ticks: {
                                beginAtZero: true,
                                //min: 1000, // Edit the value according to what you need
                                max: newMaxValue,
                                maxTicksLimit: unitMaxValue,
                                stepWidth: 1,
                                callback: function (value, index, ticks) {
                                    // Convert to Day/Hour if > 25H
                                    var tickLabel = format_size(value).toUpperCase();
                                    return tickLabel;
                                },

                            }
                        }],
                    yAxes: [{
                            stacked: true
                        }]
                },
                showTooltips: true,
                tooltips: {
                    //mode: 'label',
                    callbacks: {
                        label: function (tooltipItem, data) {
                            var idx = tooltipItem.index;
                            var datasetIdx = tooltipItem.datasetIndex;
                            var datasetLabel = data.datasets[datasetIdx].label;
                            var shownValue = data.datasets[datasetIdx].data[idx];
                            // Print the volume value formatting with proper size label
                            if (shownValue === 0.0) {
                                return null;
                            } else {
                                shownValue = format_size(shownValue);
                                return  datasetLabel + ': ' + shownValue;
                            }
                        }
                    }
                    //labelTextColor: function (tooltipItem, chart) {
                    //    return chart.data.datasets[0].backgroundColor[tooltipItem.index];
                    //}
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        top: 20,
                        bottom: 20
                    }
                },
                legend: {
                    display: false
                }
            }
        });
    }

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
        var _colors = get_mission_colors();//get_colors(archiveDetailedData.length);
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

    drawDetailedBarChart(chartId, archiveLevelDetailData, dataType) {
        console.log("Drawing Stacked Bars with ID " + chartId);
        console.debug("Data to be put on Detail chart: ", archiveLevelDetailData);

        var chartCanvas = document.getElementById(chartId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        } else {
            console.error("Stacked Bars Chart with id " + chartId + " not present on page");
            return;
        }
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
                    tickLabel = format_size(value);
                }
                // for NUM, format count values (thousand separator)

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
        this.stackBarChart.set(dataType, new Chart(chartCanvas.getContext('2d'), {
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
                        // Display Size in TB, number of products 
                        // TODO: move to a separate function outside Chart creation
                        // TODO: make value formatting a function, passed by caller (dependend on displayed type)
                        label: function (tooltipItem, data) {
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

    // Clear Charts
    clearCharts() {
        console.log("Arc-STATS: Clearing previous charts");
        // var missionBarChartId = this.getChartId('mission'); 
        if (!this.gaugeChart !== 'undefined' && this.gaugeChart !== null) {
            console.debug("Destroying Mission Chart");
            this.gaugeChart.destroy();
            this.gaugeChart = null;
        }
        // TODO: manage CHARTS saved by data type
        console.debug("Stack Detail bar chart: ", this.stackBarChart.values());
        //for (const [dataType, pChart] of this.stackBarChart) {
        this.stackBarChart.forEach((pChart, dataType, chartTable) => {
            console.log(dataType, pChart);
            console.debug("Arc-STATS: Destroying chart ", pChart, ", type: ", dataType);
            if (pChart !== 'undefined' && pChart !== null) {
                pChart.destroy();
            }
        });
        console.log("Arc-STATS: completed clearing charts");
    }
}

let archiveStatistics = new ArchiveStatisticsCharts();
