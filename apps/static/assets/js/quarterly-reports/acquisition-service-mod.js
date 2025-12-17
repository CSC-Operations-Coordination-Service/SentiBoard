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
        /*this.impactedDatatakesBySatellite = payload.impacted_datatakes_by_satellite || {};
        this.EDRSPasses = payload.edrs_passes || {};
        this.EDRSAnomalies = payload.edrs_anomalies || {};*/
        this.globalStats = payload.global || {};
        this.stationsStats = payload.stations || {};
        this.edrsStats = payload.edrs || {};

        this.refreshEDRSPieChartsAndBoxes();

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


        const payload = window.ACQUISITION_PAYLOAD;

        //  Register event callback for Time period select
        const time_period_sel = document.getElementById('time-period-select');
        if (payload.quarter_authorized == true && time_period_sel) {
            time_period_sel.value = 'prev-quarter';
        }
        this.downlinkPasses = window.ACQUISITION_PAYLOAD.downlink_passes || {};
        this.downlinkAnomalies = window.ACQUISITION_PAYLOAD.downlink_anomalies || {};
        this.prepareGlobalStats();
        this.refreshStationBoxesFromPayload();
        this.refreshPieChartsAndBoxes();
        this.refreshEDRSPieChartsAndBoxes();
    }

    on_timeperiod_change() {
        const period = document.getElementById('time-period-select').value;
        window.location.href = `/acquisition-service.html?period=${period}`;
    }

    clearGlobalBoxes() {
        ['planned-acquisitions', 'successful-acquisitions', 'satellite-failures', 'acquisition-failures',
            'other-failures'].forEach(function (item) {
                var boxId = item.toLowerCase() + '-global-box';
                $('#' + boxId + '-mod').html(
                    '<div class="spinner">' +
                    '<div class="bounce1"></div>' +
                    '<div class="bounce2"></div>' +
                    '<div class="bounce3"></div>' +
                    '</div>');
            })
    }

    clearPieChartsAndBoxes() {
        ['svalbard', 'inuvik', 'maspalomas', 'matera', 'neustrelitz'].forEach(function (station) {
            var pieId = station.toLowerCase() + '-station-pie-chart-mod';
            var boxId = station.toLowerCase() + '-station-box-mod';
            this.clearPieChart(pieId);
            this.clearBox(boxId);
        })
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


    calcGlobalDownlinkStatistics() {
        var data = {};
        var totPasses = 0, failedPassesAcq = 0, failedPassesSat = 0, failedPassesOther = 0;
        for (const station of Object.keys(this.downlinkPasses)) {
            if (station.toUpperCase().includes('DLR')) continue;
            for (const [satellite, passes] of Object.entries(this.downlinkPasses[station])) {
                totPasses += this.downlinkPasses[station][satellite].length;
                failedPassesAcq += this.downlinkAnomalies[station][satellite]['acq'].length;
                failedPassesSat += this.downlinkAnomalies[station][satellite]['sat'].length;
                failedPassesOther += this.downlinkAnomalies[station][satellite]['other'].length;
            }
        }
        var successfulPasses = totPasses - (failedPassesAcq + failedPassesSat + failedPassesOther);
        data['Successful passes'] = successfulPasses;
        data['Impaired passes (Acquisition Service issues)'] = failedPassesAcq;
        data['Impaired passes (Satellite issues)'] = failedPassesSat;
        data['Impaired passes (Other issues)'] = failedPassesOther;
        return data;
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
        if (!this.edrsStats || Object.keys(this.edrsStats).length === 0) return;

        const data = {
            'Successful passes': this.edrsStats.successful,
            'Other issues': Math.max(
                0,
                (this.edrsStats.total || 0) - this.edrsStats.successful
            )
        };

        this.refreshPieChart('edrs-pie-chart-mod', data);
    }


    calcEDRSStatistics() {
        var data = {};
        var totPasses = 0, failedPassesAcq = 0, failedPassesSat = 0, failedPassesOther = 0;
        for (const [satellite, passes] of Object.entries(this.EDRSPasses)) {
            totPasses += this.EDRSPasses[satellite.toLowerCase()].length;
            failedPassesAcq += this.EDRSAnomalies[satellite.toLowerCase()]['acq'].length;
            failedPassesSat += this.EDRSAnomalies[satellite.toLowerCase()]['sat'].length;
            failedPassesOther += this.EDRSAnomalies[satellite.toLowerCase()]['other'].length;
        }
        let successfulPasses = totPasses - (failedPassesAcq + failedPassesSat + failedPassesOther);
        data['Successful passes'] = successfulPasses;
        data['Impaired passes (Acquisition Service issues)'] = failedPassesAcq;
        data['Impaired passes (Satellite issues)'] = failedPassesSat;
        data['Impaired passes (Other issues)'] = failedPassesOther;
        return data;
    }

    hasImpactOnDatatakes(anomalyId, sat_unit) {
        for (const datatake of this.impactedDatatakesBySatellite[sat_unit]) {
            if (datatake['last_attached_ticket'].includes(anomalyId)) {
                return true;
            }
        }
        return false;
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

    refreshBox(boxId, data) {
        var ok = 0, tot = 0;
        for (const [label, num] of Object.entries(data)) {
            tot += num;
            if (label.toUpperCase().includes('SUCCESS')) {
                ok += num;
            }
        }
        var okPerc = ok * 100.0 / tot;
        $('#' + boxId + '-mod').text(ok + ' / ' + tot);
        $('#' + boxId + '-perc-mod').text(okPerc.toFixed(2) + '%');
    }

    clearPieChart(pieId) {
        var chartCanvas = document.getElementById(pieId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        }
    }

    clearBox(boxId) {
        $('#' + boxId + '-mod').html(
            '<div class="spinner">' +
            '<div class="bounce1"></div>' +
            '<div class="bounce2"></div>' +
            '<div class="bounce3"></div>' +
            '</div>');
        $('#' + boxId + '-perc-mod').html(
            '<div class="spinner">' +
            '<div class="bounce1"></div>' +
            '<div class="bounce2"></div>' +
            '<div class="bounce3"></div>' +
            '</div>');
    }

    showAcquisitionStatistics(station) {

        // Auxiliary Variable Declaration
        var target = '';
        var content = {};
        var passes = {};
        var anomalies = {};

        // Retrieve statistics based on the selected station
        if (station === 'edrs') {
            target = 'EDRS';
            content.title = 'Details on EDRS acquisitions';
            passes = this.EDRSPasses;
            anomalies = this.EDRSAnomalies;
        } else {
            target = station.charAt(0).toUpperCase();
            content.title = 'Details on ' + station.charAt(0).toUpperCase() + station.slice(1) + ' acquisitions';
            passes = this.downlinkPasses[station];
            anomalies = this.downlinkAnomalies[station];
        }

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

    showAcquisitionServiceModOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing acquisitions online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Acquisition Service';
        content.message = 'This view summarizes the global status of the Acquisition Service. The page is divided into two sections: <br>' +
            ' - Global acquisitions statistics, per Ground Station (the violet boxes);<br>' +
            ' - Details on acquisition failures (the pie charts);<br>' +
            'Click on a pie chart to display the anomalies causing the discontinuity in the system availability. By default, ' +
            'results are referred to the previous completed quarter.'
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return;
    }

}
