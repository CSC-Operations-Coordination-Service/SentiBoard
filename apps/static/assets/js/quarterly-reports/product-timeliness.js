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

class ProductTimeliness {
    /**
     * For each mission, list the timeliness types (as specified
     *   in cts-products index ) and associated threshold for publication
     *   in hours.
     * @type type
     */

    // Move date handling to MIXIN (periodSelection)
    /**
     * 
     * @returns {ProductTimeliness}
     */
    constructor() {

        // Set Charts
        this.gaugeCharts = new Map();
    }

    init() {
        console.info("[PT][JS] init() called");

        const select = document.getElementById("time-period-select");
        console.log("[PT][JS] select exists =", !!select);

        if (select) {
            console.log("[PT][JS] select.value at init =", select.value);
            select.addEventListener("change", () => {
                console.log("[PT][JS] on_timeperiod_change fired");
                this.on_timeperiod_change();
            });
        }

        this.successLoadTimeliness();
    }

    successLoadTimelinessForPeriod(period) {
        const sel = document.getElementById('time-period-select');
        if (sel) sel.value = period;

        // Now call the normal successLoadTimeliness()
        this.successLoadTimeliness();
    }
    on_timeperiod_change() {
        const sel = document.getElementById('time-period-select');
        let period = sel.value;
        if (period === 'prev-quarter') {
            period = 'prev-quarter-specific'
        }
        console.log("[PT][JS] on_timeperiod_change()");
        console.log("[PT][JS] selected period =", period);
        console.log("[PT][JS] redirect → /product-timeliness?period=" + period);

        window.location.href = `/product-timeliness?period=${period}`;
    }


    successLoadTimeliness() {
        if (!window.ssrTimelinessData) {
            console.warn("No SSR data for Product Timeliness available");
            return;
        }

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