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

class AcquisitionServiceMod {

    constructor() {

        const payload = window.ACQUISITION_PAYLOAD || {};

        this.downlinkPasses = payload.downlink_passes || {};
        this.downlinkAnomalies = payload.downlink_anomalies || {};

        this.globalStats = payload.global || {};
        this.stationsStats = payload.stations || {};
        this.edrsStats = payload.edrs || {};

        this.EDRSPasses = (payload.edrs && payload.edrs.passes) || {};
        this.EDRSAnomalies = (payload.edrs && payload.edrs.anomalies) || {};

        this.charts = {};

        // Set of colors used in the pie charts
        this.colorsPool = [
            "#66ff66", "#ff6037", "#ff355e",
            "#50bfe6 ", "#ffcc33 ", "#ff9966",
            "#aaf0d1", "#ffff66", "#ff00cc",
            "#16d0cb", "#fd5b78", "#9c27b0",
            "#ff00cc", "#f57d05", "#fa001d"
        ];
    }

    init() {
        //  Register event callback for Time period select
        const time_period_sel = document.getElementById('time-period-select');
        if (time_period_sel) {
            time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));
        }

        this.downlinkPasses = window.ACQUISITION_PAYLOAD.downlink_passes || {};
        this.downlinkAnomalies = window.ACQUISITION_PAYLOAD.downlink_anomalies || {};

        this.prepareGlobalStats();
        this.refreshStationBoxesFromPayload();
        this.refreshPieChartsAndBoxes();
        this.refreshEDRSPieChartsAndBoxes();
    }

    on_timeperiod_change() {
        const select = document.getElementById('time-period-select');
        const period = select.value;

        console.log('[ACQUISITION SERVICE] period change->', period);
        window.location.href = `/acquisition-service?period=${period}`;
    }

    prepareGlobalStats() {
        const data = this.globalStats;
        if (!data) return;

        this._globalTotals = {
            planned: data.planned || 0,
            successful: data.successful || 0,
            fail_sat: data.fail_sat || 0,
            fail_acq: data.fail_acq || 0,
            fail_other: data.fail_other || 0
        };
    }


    refreshPieChartsAndBoxes() {
        ['svalbard', 'inuvik', 'maspalomas', 'matera', 'neustrelitz'].forEach((station) => {
            const pieId = `${station}-station-pie-chart-mod`;
            const boxId = `${station}-station-box-mod`;   // ✅ FIXED
            const data = this.calcDownlinkStatistics(station);

            this.refreshPieChart(pieId, data);
            this.refreshBox(boxId.replace('-mod', ''), data);
        });
    }

    refreshStationBoxesFromPayload() {
        if (!this.stationsStats) return;

        Object.entries(this.stationsStats).forEach(([station, stats]) => {
            $(`#${station}-station-box-mod`).text(stats.passes);
            $(`#${station}-station-box-perc-mod`).text(
                `${stats.passes_percentage}%`
            );
        });
    }

    calcDownlinkStatistics(station) {
        var data = {};
        var totPasses = 0, failedPassesAcq = 0, failedPassesSat = 0, failedPassesOther = 0;
        if (!this.downlinkPasses[station]) {
            // Station missing → return all zeros
            data['Successful passes'] = 0;
            data['Impaired passes (Acquisition Service issues)'] = 0;
            data['Impaired passes (Satellite issues)'] = 0;
            data['Impaired passes (Other issues)'] = 0;
            return data;
        }
        for (const [satellite, passes] of Object.entries(this.downlinkPasses[station])) {
            const anomalies = (this.downlinkAnomalies[station] || {})[satellite] || {
                acq: [],
                sat: [],
                other: []
            };
            totPasses += this.downlinkPasses[station][satellite].length;
            failedPassesAcq += anomalies.acq.length;
            failedPassesSat += anomalies.sat.length;
            failedPassesOther += anomalies.other.length;
        }

        const successfulPasses = totPasses - (failedPassesAcq + failedPassesSat + failedPassesOther);
        data['Successful passes'] = successfulPasses;
        data['Impaired passes (Acquisition Service issues)'] = failedPassesAcq;
        data['Impaired passes (Satellite issues)'] = failedPassesSat;
        data['Impaired passes (Other issues)'] = failedPassesOther;
        return data;
    }

    refreshEDRSPieChartsAndBoxes() {
        const pieId = 'edrs-pie-chart-mod';
        const boxId = 'edrs-box';

        // Compute the data using the updated function
        const data = this.calcEDRStatistics();

        // Labels for the pie chart
        const labels = ['Successful passes', 'Acquisition issues', 'Satellite issues', 'Other issues'];

        // Refresh the pie chart
        this.refreshPieChart(pieId, data, labels);

        // Refresh the success box with proper float percentages
        this.refreshBox(boxId, data, labels);
    }


    calcEDRStatistics() {
        const data = {
            'Successful passes': 0,
            'Acquisition issues': 0,
            'Satellite issues': 0,
            'Other issues': 0
        };

        let totPasses = 0;

        // If EDRSPasses is a number (no satellite breakdown)
        if (typeof this.EDRSPasses === 'number') {
            totPasses = this.EDRSPasses;
            const edrsPercentage = this.edrsStats.percentage || 0;
            data['Successful passes'] = +(totPasses * edrsPercentage / 100).toFixed(2);

            const failedTotal = totPasses - data['Successful passes'];
            // Split failed passes proportionally (or leave zeros)
            data['Acquisition issues'] = 0;
            data['Satellite issues'] = 0;
            data['Other issues'] = failedTotal;
            return data;
        }

        // Otherwise, normal satellite breakdown
        for (const [satellite, passes] of Object.entries(this.EDRSPasses)) {
            const satKey = satellite.toLowerCase();
            const anomalies = this.EDRSAnomalies[satKey] || { acq: [], sat: [], other: [] };
            const satTot = Array.isArray(passes) ? passes.length : passes;

            totPasses += satTot;
            data['Acquisition issues'] += anomalies.acq.length;
            data['Satellite issues'] += anomalies.sat.length;
            data['Other issues'] += anomalies.other.length;
        }

        const edrsPercentage = this.edrsStats.percentage || 0; // e.g., 95.95
        data['Successful passes'] = +(totPasses * edrsPercentage / 100).toFixed(2);

        return data;
    }

    refreshPieChart(pieId, data) {
        var chartCanvas = document.getElementById(pieId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        }
        new Chart($('#' + pieId), {
            type: 'pie',
            data: {
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: this.colorsPool,
                    borderWidth: 0
                }],
                labels: Object.keys(data)
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    position: 'bottom',
                    labels: {
                        fontColor: 'rgb(154, 154, 154)',
                        fontSize: 11,
                        usePointStyle: true,
                        padding: 20
                    }
                },
                pieceLabel: {
                    render: 'percentage',
                    fontColor: 'white',
                    fontSize: 14,
                },
                showTooltips: true,
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        top: 20,
                        bottom: 20
                    }
                }
            }
        })
    }

    refreshBox(boxId, data, labels = null) {
        let ok = 0, tot = 0;

        for (const [label, num] of Object.entries(data)) {
            tot += num;
            if (labels && labels.includes(label) && label.toUpperCase().includes('SUCCESS')) {
                ok += num;
            } else if (!labels && label.toUpperCase().includes('SUCCESS')) {
                ok += num;
            }
        }

        const okPerc = tot ? Math.round((ok * 100) / tot) : 0;
        $('#' + boxId + '-mod').text(`${Math.round(ok)}  /  ${Math.round(tot)}`);
        $('#' + boxId + '-perc-mod').text(okPerc.toFixed(2) + '%');
    }

    showAcquisitionStatistics(station) {

        // Auxiliary Variable Declaration
        var target = '';
        var content = {};
        var passes = {};
        var anomalies = {};

        // Retrieve statistics based on the selected station
        if (station === 'edrs') {
            const data = this.calcEDRStatistics();

            const totPasses = Object.values(data).reduce((a, b) => a + b, 0);
            const successfulPasses = data['Successful passes'] || 0;
            const failedAcq = data['Acquisition issues'] || 0;
            const failedSat = data['Satellite issues'] || 0;
            const failedOther = data['Other issues'] || 0;

            const successPerc = totPasses ? ((successfulPasses * 100) / totPasses).toFixed(2) : 0;
            const failAcqPerc = totPasses ? ((failedAcq * 100) / totPasses).toFixed(2) : 0;
            const failSatPerc = totPasses ? ((failedSat * 100) / totPasses).toFixed(2) : 0;
            const failOtherPerc = totPasses ? ((failedOther * 100) / totPasses).toFixed(2) : 0;

            content.title = 'Details on EDRS acquisitions';
            content.message =
                `Planned passes: ${totPasses}; Successful passes: ${successfulPasses} (${successPerc}%).<br/>` +
                `Acquisition Service issues: ${failedAcq} (${failAcqPerc}%); ` +
                `Satellite issues: ${failedSat} (${failSatPerc}%); ` +
                `Other issues: ${failedOther} (${failOtherPerc}%).`;

            // Show per-satellite details only if EDRSPasses is an object
            if (typeof this.EDRSPasses === 'object' && this.EDRSPasses !== null) {
                content.message += '<br/>Details per satellite:<br/><ul>';
                for (const [satellite, passesList] of Object.entries(this.EDRSPasses)) {
                    const satTot = Array.isArray(passesList) ? passesList.length : passesList;
                    const satAnomalies = this.EDRSAnomalies[satellite.toLowerCase()] || { acq: [], sat: [], other: [] };
                    const satSuccess = satTot - (satAnomalies.acq.length + satAnomalies.sat.length + satAnomalies.other.length);

                    const satSuccessPerc = satTot ? ((satSuccess * 100) / satTot).toFixed(2) : 0;
                    const satAcqPerc = satTot ? ((satAnomalies.acq.length * 100) / satTot).toFixed(2) : 0;
                    const satSatPerc = satTot ? ((satAnomalies.sat.length * 100) / satTot).toFixed(2) : 0;
                    const satOtherPerc = satTot ? ((satAnomalies.other.length * 100) / satTot).toFixed(2) : 0;

                    content.message += `<li>${satellite.toUpperCase()}: Planned passes: ${satTot}; ` +
                        `Successful passes: ${satSuccess} (${satSuccessPerc}%).`;

                    if (satTot - satSuccess > 0) {
                        content.message += ` Acquisition: ${satAnomalies.acq.length} (${satAcqPerc}%), ` +
                            `Satellite: ${satAnomalies.sat.length} (${satSatPerc}%), ` +
                            `Other: ${satAnomalies.other.length} (${satOtherPerc}%)`;
                    }
                    content.message += `</li>`;
                }
                content.message += '</ul>';
            }

            content.icon = 'fa fa-bell';
            content.url = '';
            content.target = '_blank';

            // Show popup
            $.notify(content, {
                type: 'danger',
                placement: { from: 'top', align: 'right' },
                time: 1000,
                delay: 0,
            });

            // Refresh the pie chart (function untouched)
            this.refreshPieChart('edrs-pie-chart-mod', data);

            return;
        }
        target = station.charAt(0).toUpperCase();
        content.title = 'Details on ' + station.charAt(0).toUpperCase() + station.slice(1) + ' acquisitions';
        passes = this.downlinkPasses[station];
        anomalies = this.downlinkAnomalies[station];

        // Append global statistics
        var totPasses = 0;
        var totSuccessPasses = 0;
        var acqAnomalies = 0;
        var satAnomalies = 0;
        var otherAnomalies = 0;
        for (const [satellite, anomaliesList] of Object.entries(anomalies)) {
            totPasses += passes[satellite].length;
            acqAnomalies += anomaliesList['acq'].length;
            satAnomalies += anomaliesList['sat'].length;
            otherAnomalies += anomaliesList['other'].length;
            totSuccessPasses = totPasses - (acqAnomalies + satAnomalies + otherAnomalies);
        }
        var totSuccessPassesPerc = (totSuccessPasses * 100) / totPasses;
        var acqAnomaliesPerc = (acqAnomalies * 100) / totPasses;
        var satAnomaliesPerc = (satAnomalies * 100) / totPasses;
        var otherAnomaliesPerc = (otherAnomalies * 100) / totPasses;
        content.message = 'Planned passes: ' + totPasses + '; Successful passes: ' + totSuccessPasses +
            ' (' + totSuccessPassesPerc.toFixed(2) + '%).<br />Acquisition Service issues: ' + acqAnomalies +
            ' (' + acqAnomaliesPerc.toFixed(2) + '%); Satellite issues: ' + satAnomalies +
            ' (' + satAnomaliesPerc.toFixed(2) + '%); Other issues: ' + otherAnomalies +
            ' (' + otherAnomaliesPerc.toFixed(2) + '%).<br />';

        // Append number of anomalies
        content.message += 'Details per satellite:<br />';
        content.message += '<ul>';
        for (const [satellite, anomaliesList] of Object.entries(anomalies)) {
            var satPlanPasses = passes[satellite].length;
            var satAcqAnomalies = anomaliesList['acq'].length;
            var satSatAnomalies = anomaliesList['sat'].length;
            var satOtherAnomalies = anomaliesList['other'].length;
            var satAnomalies = satAcqAnomalies + satSatAnomalies + satOtherAnomalies;
            var satSuccessPasses = satPlanPasses - satAnomalies;
            var satSuccessPassesPerc = (satSuccessPasses * 100) / satPlanPasses;
            content.message += '<li>' + satellite.toUpperCase() + ': ';
            content.message += 'Planned passes: ' + satPlanPasses + '; ';
            content.message += 'Successful passes: ' + satSuccessPasses + ' (' + satSuccessPassesPerc.toFixed(2) + '%). </br>';
            if (satAnomalies > 0) {
                let satAcqAnomaliesPerc = (satAcqAnomalies * 100) / satPlanPasses;
                let satSatAnomaliesPerc = (satSatAnomalies * 100) / satPlanPasses;
                let satOtherAnomaliesPerc = (satOtherAnomalies * 100) / satPlanPasses;
                content.message +=
                    'Acquisition Service issues: ' + satAcqAnomalies + ' (' + satAcqAnomaliesPerc.toFixed(2) + '%); ' +
                    'Satellite issues: ' + satSatAnomalies + ' (' + satSatAnomaliesPerc.toFixed(2) + '%); ' +
                    'Other issues: ' + satOtherAnomalies + ' (' + satOtherAnomaliesPerc.toFixed(2) + '%)';
            }
            content.message += '</li>';
        }
        content.message += '</ul>';

        // Add other popup properties
        content.icon = 'fa fa-bell';
        content.url = '';
        content.target = '_blank';

        // Message visualization
        var placementFrom = "top";
        var placementAlign = "right";
        var state = "danger";
        var style = "withicon";

        $.notify(content, {
            type: state,
            placement: {
                from: placementFrom,
                align: placementAlign
            },
            time: 1000,
            delay: 0,
        });
    }

}
