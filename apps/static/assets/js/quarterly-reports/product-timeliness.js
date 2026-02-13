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

class ProductTimeliness {
    /**
     * For each mission, list the timeliness types (as specified
     *   in cts-products index ) and associated threshold for publication
     *   in hours.
     * @type type
     */
    // TODO Make class, with mission timeliness types get method
    static timelinessByMission = {
        'S1': ['NRT', 'NTC'],
        'S2': ['NTC'],
        'S3': ['NRT', 'NTC', 'STC'],
        'S5': ['NRT', 'NTC']
    };

    // Move date handling to MIXIN (periodSelection)
    /**
     * 
     * @returns {ProductTimeliness}
     */
    constructor() {

        // Start - stop time range
        this.end_date = new Date();
        this.end_date.setUTCHours(23, 59, 59, 0);
        this.start_date = new Date();
        this.start_date.setMonth(this.end_date.getMonth() - 3);
        this.start_date.setUTCHours(0, 0, 0, 0);

        // Set Charts
        this.gaugeCharts = new Map();
    }

    init() {

        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        //ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

        //  Register event callback for Time period select
        //var time_period_sel = document.getElementById('time-period-select');
        //time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));
        // this.updateDateInterval(time_period_sel.value);

        // Retrieve the timeliness of each type for each mission
        //this.loadTimelinessStatistics('prev-quarter');
        this.successLoadTimeliness();
        return;
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length === 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }

            // Programmatically select the previous quarter as the default time range
            console.info('Programmatically set the time period to previous quarter')
            time_period_sel.value = 'prev-quarter';
        }
    }

    errorLoadAuthorized(response) {
        console.error(response)
        return;
    }

    on_timeperiod_change() {
        var time_period_sel = document.getElementById('time-period-select');
        console.log("Time period changed to " + time_period_sel.value);
        // this.updateDateInterval(time_period_sel.value);
        this.loadTimelinessStatistics(time_period_sel.value);
    }

    updateDateInterval(period_type) {

        // Update start date depending on value of period type
        // one of: day, week, month, quarter
        // take delta to be applied from configuration
        let dates = new ObservationTimePeriod().getIntervalDates(period_type);
        this.start_date = dates[0];
        this.end_date = dates[1];
        return;
    }

    loadTimelinessStatistics(period_type) {
        var timeliness_api_name = 'reports/cds-product-timeliness';
        console.log("Loading statistics for period " + period_type);
        // Clear previous data, if any
        // TODO; put Waiting Spinner
        this.clearAllChartGauges();
        // Acknowledge the invocation of rest APIs
        console.info("Starting retrieval of Timeliness statistics...");
        // Add class Busy to charts
        // 
        // /api/cds-product-timeliness/last-<period_id>
        var urlParamString = getApiTimePeriodId(period_type);
        console.log("Period for API URL: " + urlParamString);
        var that = this;
        var ajaxTimelinessPromises =
            asyncAjaxCall('/api/' + timeliness_api_name + '/' + urlParamString,
                'GET', {},
                that.successLoadTimeliness.bind(that),
                that.errorLoadDownlink);
        // Execute asynchrounous AJAX call
        ajaxTimelinessPromises.then(function () {
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

    successLoadTimeliness() {

        for (const mission in window.ssrTimelinessData) {
            const timelinessMap = window.ssrTimelinessData[mission];

            for (const timelinessType in timelinessMap) {
                const charts = timelinessMap[timelinessType];

                for (const key in charts) {
                    const data = charts[key];

                    if (!data || typeof data.value !== "number") {
                        console.warn("Skipping invalid chart", mission, timelinessType, key);
                        continue;
                    }

                    const record = {
                        mission: mission,
                        timeliness: timelinessType,
                        product_group: key === "_mission" ? "" : key,
                        total_count: 100,
                        on_time: Math.round((data.value / 100) * 100),
                        threshold: data.threshold
                    };

                    this.drawGaugeChart(data.pieId, data.threshold, record);
                }
            }
        }
    }


    errorLoadDownlink(response) {
        console.error(response);
        return;
    }

    // =========     Pie CHart Management  ==========
    /**
    Summary. Computes Identifier for a Pie Chart canvas
    Description. Composes identifier based on parameters
    @param {string} mission | any string; at the moment the following ones
        are expected: S1, S2, S3, S5p
    @param {string} category | one of "DWL", "PUB" (downloaded products,
                    published products)
    @param {string} datatype | one of VOL, NUM: identifies the type of statitstics to
                    be displayed; it is used to build the chart id
    @returns {string} the computed identifier for the corresponding
                    pie chart canvas
    */
    gaugeChartId(mission, category, datatype) {
        // Datatype one of: nrt/ntc/stc (Timeliness type)
        var chartId = mission.toLowerCase() + "-" + datatype.toLowerCase();
        if (category !== "") {
            chartId += "-" + category.toLowerCase();
        }
        chartId += "-gauge-chart";
        return chartId;
    }
    // TODO: A method to clear ALL Charts: 
    // get class chart-container and clear canvas element child
    clearAllChartGauges() {
        for (const gChart of this.gaugeCharts.values()) {
            gChart.destroy();
        }
        for (const gId of this.gaugeCharts.keys()) {
            $('.card', document.getElementById(gId)).eq(0).html(
                '<div class="spinner">' +
                '<div class="bounce1"></div>' +
                '<div class="bounce2"></div>' +
                '<div class="bounce3"></div>' +
                '</div>');
        }
    }

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
    drawGaugeChart(pieId, timeThreshold, timelinessData) {
        console.log("Drawing Gauge with ID " + pieId);
        console.log("Data to be put on chart: ", timelinessData);
        console.log("Threshold: " + timeThreshold);

        var thresholdLabel = format_dayhours(timeThreshold);

        var chartCanvas = document.getElementById(pieId);
        if (!chartCanvas) {
            console.error("Gauge Chart with id " + pieId + " not present on page");
            return;
        }
        chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);

        // Use real SSR values
        const totalCount = timelinessData.total_count;
        const onTime = timelinessData.on_time;
        const dataRemainder = totalCount - onTime;

        var timelinessDataArray = totalCount > 0 ? [onTime, dataRemainder] : [];

        var gaugeData = {
            datasets: totalCount > 0 ? [{
                data: timelinessDataArray,
                backgroundColor: ['#31ce36', '#fdaf4b', '#f3545d'],
                borderRadius: 5,
                borderWidth: 2
            }] : [],
            labels: ['< ' + thresholdLabel]
        };

        var that = this;
        var gaugeChart = new Chart(chartCanvas.getContext('2d'), {
            type: 'doughnut',
            data: gaugeData,
            options: {
                circumference: Math.PI,
                rotation: -1.0 * Math.PI,
                cutoutPercentage: 55,
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: true,
                    position: 'chartArea',
                    labels: { fontColor: 'white', fontSize: 18 },
                    onClick: () => { }
                },
                layout: { padding: { left: 10, right: 10, top: 20, bottom: 20 } },
                centerText: {
                    display: true,
                    color: "white",
                    text: totalCount > 0 ? ((onTime / totalCount) * 100).toFixed(0) + "%" : "0%"
                },
                tooltips: {
                    mode: 'label',
                    callbacks: {
                        label: function (tooltipItem, data) {
                            var idx = tooltipItem.index;
                            var curr_dataset = data.datasets[0];
                            if (idx === 0) {
                                return data.labels[idx] + ': ' + curr_dataset.data[idx];
                            } else {
                                return "Out of threshold: " + curr_dataset.data[1];
                            }
                        }
                    }
                }
            },
            plugins: {
                legend: { onClick: null },
                beforeDraw: function (chart) {
                    if (chart.data.datasets.length && chart.config.options.centerText.display) {
                        that.drawInnerText(chart);
                    }
                },
                afterDraw: function (chart) {
                    if (chart.data.datasets.length === 0) {
                        var ctx = chart.chart.ctx;
                        var width = chart.chart.width;
                        var height = chart.chart.height;
                        chart.clear();
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('No data to display', width / 2, height / 2);
                        ctx.restore();
                    }
                }
            }
        });

        this.gaugeCharts.set(pieId, gaugeChart);
    }

    drawInnerText = (chart) => {

        var width = chart.chart.width,
            height = chart.chart.height,
            ctx = chart.chart.ctx;
        ctx.restore();
        var color = chart.config.options.centerText.color || 'black';
        var legendHeight = chart.legend.height;
        var fontSize = (height / 150).toFixed(2);
        ctx.font = fontSize + "em sans-serif";
        ctx.textBaseline = "top";
        ctx.fillStyle = color;
        // 
        var text = chart.config.options.centerText.text,
            textX = Math.round((width - ctx.measureText(text).width) / 2),
            textY = height - legendHeight + legendHeight / 2; //- chart.chart.outerRadius ; // Put instead on chart center Y
        //textY = height - legendHeight + chart.chart.outerRadius;
        //textY = centerY + height - legendHeight;

        ctx.fillText(text, textX, textY);
        ctx.save();
    }

    showTimelinessOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing timeliness online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Product Timeliness';
        content.message = 'This view provides a summary of the publication timeliness of image products, per each Copernicus Sentinel Mission ' +
            'and timeliness type. Percentages indicate the amount of products published within a fixed timeliness threshold, specified in the ' +
            'label legend, and applicable to the given mission / delivery timeliness type. By default, results are referred to the previous completed quarter.'
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return;
    }
}

let productTimeliness = new ProductTimeliness();