/*
 Copernicus Operations Dashboard
 
 Copyright (C) 2025- SERCO
 All rights reserved.
 
 This document discloses subject matter in which SERCO has
 proprietary rights. Recipient of the document shall not duplicate, use or
 disclose in whole or in part, information contained herein except for or on
 behalf of SERCO to fulfill the purpose for which the document was
 delivered to him.
 */
/* archive-statistcs.js*/
(function () {
    if (!window.SSR_ARCHIVE_PAYLOAD) return;

    function getPeriod(period) {
        return window.SSR_ARCHIVE_PAYLOAD[period] || { data: [] };
    }


})();

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

    init(archiveData) {
        if (!archiveData) {
            throw new Error("ARCHIVE_DATA is required (SSR-only mode)");
        }

        this.datasets = archiveData;

        this._bindEvents();

        const periodSelect = document.getElementById("time-period-select");
        const datatypeSelect = document.getElementById("time-trend-data-type-select");

        let defaultPeriod = "prev-quarter-specific";
        if (!this.datasets[this._normalizePeriodKey(defaultPeriod)]) {
            defaultPeriod = "prev-quarter";
        }

        console.info("[ARCHIVE][INIT] Default period:", defaultPeriod);

        if (periodSelect) {
            periodSelect.value = defaultPeriod;
        }

        // Render charts for the selected period
        this.showPeriod(defaultPeriod);

        // APPLY datatype visibility rule IMMEDIATELY
        if (datatypeSelect) {
            this.on_datatype_change({ target: datatypeSelect });
        }
    }

    _humanizePeriod(key) {
        const map = {
            "prev-quarter": "Previous Quarter",
            "lifetime": "Lifetime"
        };
        return map[key] || key;
    }

    _humanizeDatatype(key) {
        const map = {
            volume: "Volume",
            count: "Count",
            missions: "Missions"
        };
        return map[key] || key;
    }
    _bindEvents() {
        document.getElementById("time-period-select")
            .addEventListener("change", (e) => this.showPeriod(e.target.value));

        document.getElementById("time-trend-data-type-select")
            .addEventListener("change", this.on_datatype_change.bind(this));
    }

    showPeriod(periodKey) {
        const ssrKey = this._normalizePeriodKey(periodKey);
        const payload = this.datasets[ssrKey];

        if (!payload || !payload.data) {
            this.clearCharts(PeriodKey); // Clears the 'period' bucket
            return;
        }

        // before drawing the new ones into that same bucket.
        this.clearCharts(PeriodKey);

        this.loadArchive(payload, PeriodKey);

        this.currentPeriod = ssrKey;

        if (window.serviceMonitoring) {
            window.serviceMonitoring.refreshAvailabilityStatus(payload);
        }

        const lifetimePayload = this.datasets["lifetime"];
        if (lifetimePayload?.data?.length) {
            console.info("[ARCHIVE][SSR] Rendering lifetime charts");
            this.loadArchive(lifetimePayload, LifetimeKey);
        }
        this.setLastUpdatedLabel(new Date(payload.interval.to));

    }

    on_datatype_change(ev) {
        const selectedDataType = ev.target.value;
        this.currentDatatype = selectedDataType;

        const showType = selectedDataType === 'volume' ? 'VOL' : 'NUM';
        const hideType = selectedDataType === 'volume' ? 'NUM' : 'VOL';

        // Period charts
        $('#' + this.getRowDivId('period-mission-levels', showType)).show();
        $('#' + this.getRowDivId('period-mission-levels', hideType)).hide();

        // Lifetime charts
        $('#' + this.getRowDivId('lifetime-mission-levels', showType)).show();
        $('#' + this.getRowDivId('lifetime-mission-levels', hideType)).hide();
    }

    setLastUpdatedLabel(lastUpdateTime) {
        var nowDateString = formatDateHour(lastUpdateTime);
        $("#trend-last-updated").text(nowDateString);
    }

    getChartId(chartType, dataType) {
        return "LTA-" + chartType.toLowerCase() + "-" + dataType.toLowerCase() + "-barChart";
    }

    getRowDivId(chartType, dataType) {
        //console.log("Archive, computing row div id for chart " + chartType + "data type " + dataType);
        return "LTA-" + chartType.toLowerCase() + "-" + dataType.toLowerCase() + "-row";
    }

    computeArchiveStatistics(data_rows) {
        var archiveStatistics = new ArchiveMissionStatistics();
        //console.debug("Computing statistics from response: ", data_rows);

        for (const record of data_rows) {

            // Auxiliary variables
            var mission = record.mission;
            var satellite = record.satellite;
            var level = record.product_level;
            var size = record.content_length_sum;
            var count = record.count;
            //console.debug("Mission: " + mission + ", satellite: ", satellite + ", archive: " + level + ", count=" + count);
            archiveStatistics.addSizeStatistic(satellite, level, size);
            archiveStatistics.addCountStatistic(satellite, level, count);
        }
        return archiveStatistics;
    }

    successLoadPeriodArchive(response) {
        var periodType = PeriodKey;
        var json_resp = format_response(response);
        var endPeriodDate = moment(json_resp[0].interval.to, 'yyyy-MM-DDTHH:mm:ss').toDate();
        console.debug("Arc-STATS - Setting Last update to ", endPeriodDate);
        this.setLastUpdatedLabel(endPeriodDate);
        if (endPeriodDate > this.lifetimeEndPeriodDate) {
            console.debug("Loaded Archive Period data for a date after liime data");
        }
        this.loadArchive(json_resp, periodType);
    }

    loadArchive(payload, periodType) {
        if (!payload || typeof payload !== 'object') {
            console.warn('[ARCHIVE][SSR] Invalid payload for', periodType, payload);
            return;
        }

        if (!Array.isArray(payload.data)) {
            console.warn(
                '[ARCHIVE][SSR] Missing `.data` array for',
                periodType,
                payload
            );
            return;
        }

        const rows = payload.data;

        if (!rows.length) {
            console.warn(`[ARCHIVE][SSR] Empty dataset for ${periodType}`);
            return;
        }

        console.info(
            `[ARCHIVE][SSR] Rendering ${rows.length} rows for ${periodType}`
        );

        const archiveStatistics = this.computeArchiveStatistics(rows);

        ['VOL', 'NUM'].forEach(detailType => {
            const chartId = this.getChartId(
                periodType + '-archive-satellites',
                detailType
            );

            this.drawDetailedBarChart(
                chartId,
                archiveStatistics.getDetailStatistics(detailType),
                detailType,
                periodType
            );
        });
    }

    successLoadLifetimeArchive(response) {
        var periodType = LifetimeKey;
        var json_resp = format_response(response);
        var endPeriodDate = moment(json_resp[0].interval.to, 'yyyy-MM-DDTHH:mm:ss').toDate();
        console.debug("Arc-STATS - Setting Last update of lifetime data to ", endPeriodDate);
        this.lifetimeEndPeriodDate = endPeriodDate;
        this.loadArchive(json_resp, periodType);
    }

    errorLoadArchive(response) {
        console.log("Error loading Archive Stats");
        console.error(response);
    }

    showPeriodRows(period) {
        document
            .querySelectorAll('[data-period]')
            .forEach(row => {
                row.style.display =
                    row.dataset.period === period ? "block" : "none";
            });
    }

    _getBarMaxValue(dataMaxValue) {
        var barMaxValue = dataMaxValue * 1.05; // Increment by 5 %;

        var [maxVolumeSize, maxUnit] = normalize_size_decimal(barMaxValue);
        var maxIntVolumeSize = get_nearest_greater_integer_size(maxVolumeSize);
        return [maxIntVolumeSize, unitsize_to_bytes_decimal(maxIntVolumeSize, maxUnit)];
    }


    _extractAllSubObjectsKeys(subObjectList) {
        return Array.from(new Set(subObjectList.flatMap(Object.keys)));
    }

    _integrateMissingValues(detailRecord, keyList) {
        // Ensure every key is present, default 0
        return keyList.map(key => {
            const val = detailRecord[key];
            return (val === null || val === undefined || isNaN(val)) ? 0 : Number(val);
        });
    }

    _buildHomogeneousDetailedDatasets(keyList, archiveDetailedData) {
        const datasets = [];
        const colors = get_satellite_colors();

        // Iterate over each satellite/mission
        for (const [mission, detailData] of Object.entries(archiveDetailedData)) {
            // Ensure all keys are present
            const integratedValues = this._integrateMissingValues(detailData, keyList);

            datasets.push({
                label: mission,
                data: integratedValues,
                backgroundColor: colors[mission] || 'rgba(100,100,100,0.5)',
                borderColor: colors[mission] || 'rgba(100,100,100,1)',
                borderWidth: 1,
            });
        }

        return datasets;
    }

    drawDetailedBarChart(chartId, archiveLevelDetailData, dataType, periodType) {
        console.log("Drawing Stacked Bars with ID " + chartId + ", for period type " + periodType);
        //console.debug("Data to be put on Detail chart: ", archiveLevelDetailData);

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
        //console.debug("Level/Mission Datasets: ", barDetailDatasets);

        var barData = {
            datasets: barDetailDatasets, // datsets with integrated missing elements
            labels: stackLabels  // Names of each dataset elements
        };
        console.debug("Creating Stacked Bar with Data: ", barData);
        var barAxisTicks = {};
        var barStackAxisTicks = {
            beginAtZero: true,
            callback: function (value, index, ticks) {
                var tickLabel = value;
                if (dataType === 'VOL') {
                    tickLabel = format_size_decimal(value);
                } else {
                    // for NUM, format count values (thousand separator)
                    tickLabel = format_count(value);
                }

                return tickLabel;
            }
        };
        var axesTicksConfig = {};
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
        var labelMaxWidths = [10, 8, 9, 12, 12];
        // TODO for each dataset, compute a labelMaxWidth, based on the dataset dataTYpe
        //console.debug("Saving Chart object for periodType ", periodType, ", dataType ", dataType);
        const chartInstance = this; // Capture the chart instance for use in tooltip callbacks
        this.stackBarChart[periodType].set(dataType, new Chart(chartCanvas.getContext('2d'), {
            type: barType,
            data: barData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: true,
                    position: 'right', // 'chartArea',
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
                    yAxes: [{ stacked: true, ticks: axesTicksConfig.y }],
                    xAxes: [
                        {
                            stacked: true,
                            ticks: axesTicksConfig.x
                        }
                    ]
                },
                showTooltips: true,
                customDataType: dataType,
                tooltips: {
                    mode: 'label',
                    callbacks: {
                        title: function (tooltipItems, data) {
                            const dt = tooltipItems[0].chart?.options?.customDataType
                                || chartInstance.currentDatatype === 'volume'
                                ? 'VOL'
                                : 'NUM';

                            return ArchiveStatisticsCharts.buildTooltipTitle(
                                dt, tooltipItems, data);
                        },
                        label: function (tooltipItem, data) {
                            const dt = tooltipItem.chart?.options?.customDataType
                                || chartInstance.currentDatatype === 'volume'
                                ? 'VOL'
                                : 'NUM';

                            return ArchiveStatisticsCharts.buildTooltipLabel(
                                dt, labelMaxWidths, tooltipItem, data);
                        }
                    }
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
        var label = tooltipItems[0].xLabel || tooltipItems[0].yLabel;

        var total = tooltipItems.reduce((sum, item) => {
            var val = parseFloat(item.yLabel) || parseFloat(item.xLabel) || 0;
            return sum + val;
        }, 0);

        var formattedTotal;
        if (dataType === 'VOL') {
            formattedTotal = format_size_decimal(total);
        } else {
            formattedTotal = format_count(total);
        }

        return label + ' (Total: ' + formattedTotal + ')';
    }

    static buildTooltipLabel(dataType, maxWidths, tooltipItem, data) {
        const datasetIdx = tooltipItem.datasetIndex;
        const dataset = data.datasets[datasetIdx];
        const label = dataset.label || '';
        const value = Number(dataset.data[tooltipItem.index]) || 0;

        let formattedValue;
        if (dataType === 'VOL') {
            formattedValue = format_size_decimal(value);
        } else {
            formattedValue = format_count(value);
        }

        return label + ': ' + formattedValue;
    }


    // Clear Charts
    clearCharts(periodType) {
        const key = periodType.toLowerCase();

        if (this.stackBarChart[key]) {
            this.stackBarChart[key].forEach((pChart, dataType) => {
                if (pChart) {
                    pChart.destroy(); // This removes the tooltips and event listeners
                }
            });
            this.stackBarChart[key].clear(); // Clear the Map
        }
    }

    _normalizePeriod(periodKey) {
        if (periodKey === "prev-quarter") return "period";
        if (periodKey === "last") return "period";
        return periodKey; // lifetime, yearly, etc
    }

    _normalizePeriodKey(uiKey) {
        const map = {
            day: "24h",
            week: "7d",
            month: "30d",
            "prev-quarter": "prev-quarter",
            "prev-quarter-specific": "prev-quarter",
            lifetime: "lifetime"
        };

        return map[uiKey] || uiKey;
    }

    _drawChart(chartCanvas, barData, dataType, horizontal) {
        if (!chartCanvas) return;

        // Destroy previous chart instance if exists
        if (chartCanvas.chartInstance) {
            chartCanvas.chartInstance.destroy();
        }

        const barType = horizontal ? 'horizontalBar' : 'bar';

        const scalesConfig = horizontal
            ? { xAxes: [{ stacked: true }], yAxes: [{ stacked: true }] }
            : { yAxes: [{ stacked: true }], xAxes: [{ stacked: true }] };

        chartCanvas.chartInstance = new Chart(chartCanvas.getContext('2d'), {
            type: barType,
            data: barData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: { display: true, position: 'right' },
                scales: scalesConfig,
                tooltips: {
                    mode: 'label',
                    callbacks: {
                        title: (tooltipItems) => tooltipItems[0].xLabel || tooltipItems[0].yLabel,
                        label: (tooltipItem, data) => {
                            const ds = data.datasets[tooltipItem.datasetIndex];
                            const val = ds.data[tooltipItem.index];
                            return `${ds.label}: ${dataType === 'VOL' ? format_size_decimal(val) : format_count(val)}`;
                        }
                    }
                }
            }
        });
    }

}


let archiveStatistics = new ArchiveStatisticsCharts();

(function () {
    const el = document.getElementById('archive-ssr-payload');
    if (!el) {
        console.error('[ARCHIVE][SSR] Missing <script id="archive-ssr-payload">');
        return;
    }

    try {
        window.SSR_ARCHIVE_PAYLOAD = JSON.parse(el.textContent);
        //console.info('[SM][SSR] Archive payload periods:', Object.keys(window.SSR_ARCHIVE_PAYLOAD));
        console.log(
            "[ARCHIVE][SSR] availability_map:",
            SSR_ARCHIVE_PAYLOAD["prev-quarter"]?.availability_map
        );
    } catch (e) {
        console.error('[SM][SSR][FATAL] Invalid JSON in archive payload', e);
        return;
    }

    if (!window.SSR_ARCHIVE_PAYLOAD) return;

    function getPeriod(period) {
        return window.SSR_ARCHIVE_PAYLOAD[period] || { data: [] };
    }

})();
