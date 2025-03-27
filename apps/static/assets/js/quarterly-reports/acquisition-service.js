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

class AcquisitionService {

    constructor(){

        // Set of downlink passes, grouped by Station and Satellite
        this.downlinkPasses = {
            'svalbard': {'s1a': [], 's2a': [], 's2b': [], 's3a': [], 's3b': []},
            'inuvik': {'s2a': [], 's2b': []},
            'maspalomas': {'s1a': [], 's2a': [], 's2b': []},
            'matera': {'s1a': [], 's2a': [], 's2b': []},
            'neustrelitz': {'s1a': []},
            's5p-dlr': {'s5p': []}
        };

        // Set of anomalies, grouped by Station, and divided by "Ground Segment" and "Space Segment"
        this.downlinkAnomalies = {
            'svalbard': {'s1a': {'acq': [], 'sat': [], 'other': []}, 's2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []},
                         's3a': {'acq': [], 'sat': [], 'other': []}, 's3b': {'acq': [], 'sat': [], 'other': []}},
            'inuvik': {'s2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []}},
            'maspalomas': {'s1a': {'acq': [], 'sat': [], 'other': []}, 's2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []}},
            'matera': {'s1a': {'acq': [], 'sat': [], 'other': []}, 's2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []}},
            'neustrelitz': {'acq': [], 'sat': [], 'other': []},
            'edrs': {'s1a': {'acq': [], 'sat': [], 'other': []}},
            's5p-dlr': {'s5p': {'acq': [], 'sat': [], 'other': []}}
        };

        // Set of EDRS passes, grouped by Satellite
        this.EDRSPasses = {
            's1a': [],
            's2a': [],
            's2b': []
        };

        // Set of EDRS operations, grouped by Satellite
        this.EDRSAnomalies = {
            's1a': {'acq': [], 'sat': [], 'other': []},
            's2a': {'acq': [], 'sat': [], 'other': []},
            's2b': {'acq': [], 'sat': [], 'other': []},
        };

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

        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

        //  Register event callback for Time period select
        var time_period_sel = document.getElementById('time-period-select');
        time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this))

        // Retrieve the downlink operations and related anomalies
        this.loadAcquisitionsInPeriod('prev-quarter');

        // Retrieve the EDRS operations and related anomalies
        this.loadEDRSAcquisitionsInPeriod('prev-quarter');

        return;
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option('Previous Quarter', 'prev-quarter'));
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
        var time_period_sel = document.getElementById('time-period-select')
        var selected_time_period = time_period_sel.value
        console.log("Time period changed to "+ selected_time_period)
        this.loadAcquisitionsInPeriod(selected_time_period);
        this.loadEDRSAcquisitionsInPeriod(selected_time_period);
    }

    loadAcquisitionsInPeriod(selected_time_period) {

        // Clear previous data, if any
        this.downlinkPasses = {
            'svalbard': {'s1a': [], 's2a': [], 's2b': [], 's3a': [], 's3b': []},
            'inuvik': {'s2a': [], 's2b': []},
            'maspalomas': {'s1a': [], 's2a': [], 's2b': []},
            'matera': {'s1a': [], 's2a': [], 's2b': []},
            'neustrelitz': {'s1a': []},
            's5p-dlr': {'s5p': []}
        };

        this.downlinkAnomalies = {
            'svalbard': {'s1a': {'acq': [], 'sat': [], 'other': []}, 's2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []},
                         's3a': {'acq': [], 'sat': [], 'other': []}, 's3b': {'acq': [], 'sat': [], 'other': []}},
            'inuvik': {'s2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []}},
            'maspalomas': {'s1a': {'acq': [], 'sat': [], 'other': []}, 's2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []}},
            'matera': {'s1a': {'acq': [], 'sat': [], 'other': []}, 's2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []}},
            'neustrelitz': {'s1a': {'acq': [], 'sat': [], 'other': []}},
            'edrs': {'s1a': {'acq': [], 'sat': [], 'other': []}, 's2a': {'acq': [], 'sat': [], 'other': []}, 's2b': {'acq': [], 'sat': [], 'other': []}},
            's5p-dlr': {'s5p': {'acq': [], 'sat': [], 'other': []}}
        };

        // Clear pie charts and boxes
        this.clearGlobalBoxes();
        this.clearPieChartsAndBoxes();

        // Acknowledge the invocation of rest APIs
        console.info("Invoking Acquisitions retrieval...");

        // Execute asynchrounous AJAX call
        if (selected_time_period === 'day') {
            asyncAjaxCall('/api/reporting/cds-acquisitions/last-24h', 'GET', {},
                this.successLoadAcquisitions.bind(this), this.errorLoadAcquisitions);
        } else if (selected_time_period === 'week') {
            asyncAjaxCall('/api/reporting/cds-acquisitions/last-7d', 'GET', {},
                this.successLoadAcquisitions.bind(this), this.errorLoadAcquisitions);
        } else if (selected_time_period === 'month') {
            asyncAjaxCall('/api/reporting/cds-acquisitions/last-30d', 'GET', {},
                this.successLoadAcquisitions.bind(this), this.errorLoadAcquisitions);
        } else if (selected_time_period === 'prev-quarter') {
            asyncAjaxCall('/api/reporting/cds-acquisitions/previous-quarter', 'GET', {},
                this.successLoadAcquisitions.bind(this), this.errorLoadAcquisitions);
        } else {
            asyncAjaxCall('/api/reporting/cds-acquisitions/last-quarter', 'GET', {},
                this.successLoadAcquisitions.bind(this), this.errorLoadAcquisitions);
        }

        return;
    }

    successLoadAcquisitions(response){

        // Acknowledge the successful retrieval of downlink operations
        var rows = format_response(response);
        console.info('Acquisitions successfully retrieved');
        console.info("Number of acquisitions: " + rows.length);

        // Parse response
        for (var i = 0 ; i < rows.length ; ++i) {

            // Auxiliary variables
            var element = rows[i]['_source'];

            // Parse the downlink operation
            var downlink = {};
            downlink['satellite_id'] = element['satellite_id'];
            downlink['station'] = this.getStationName(element);
            downlink['acq_start'] = moment(element['first_frame_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            downlink['acq_stop'] = moment(element['last_frame_stop'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            downlink['antenna_id'] = element['antenna_id'];
            downlink['front_end_status'] = element['front_end_status'];
            downlink['antenna_status'] = element['antenna_status'];
            downlink['delivery_push_status'] = element['delivery_push_status'];
            downlink['notes'] = element['notes'];
            downlink['failed_frames_perc'] = element['fer_downlink'] * 100 ;
            downlink['acquisition_service_status'] = (downlink['antenna_status'] === 'OK'
                && downlink['delivery_push_status'] === 'OK') ? 'OK' : 'NOK';

            // Check the presence of the "cams_origin" attribute.
            try {

                // Retrieve the CAMS origin of the anomaly
                downlink['origin'] = element['cams_origin'];

                // If a link with a CAMS anomaly is present, and if the "notes" field is empty,
                // fill it with the CAMS anomaly description
                if (!downlink['notes'].trim()) {
                    downlink['notes'] = element['cams_description'];
                }
            } catch (exception) {
                downlink['origin'] = '';
            }

            // Store the downlink operation in the member class state vector
            // Skip S5P passes, not managed in the framework of Coord Desk
            try {
                this.downlinkPasses[downlink['station'].toLowerCase()][downlink['satellite_id'].toLowerCase()].push(downlink);
            } catch (exception) {
                let sat = downlink['satellite_id'];
                let stat = element['ground_station'];
                // console.debug('Skipping pass of ' + sat + ' on ' + stat);
                continue ;
            }

            // Store the reference to the anomaly (if present) in the member class state vector
            if (downlink['origin'] && downlink['origin'].trim() != '') {
                if (downlink['origin'].includes('Acquis')) {
                    console.info(downlink['notes']);
                    this.downlinkAnomalies[downlink['station'].toLowerCase()][downlink['satellite_id'].toLowerCase()]['acq'].push(downlink['notes']);
                } else if (downlink['origin'].includes('Sat')) {
                    console.info(downlink['notes']);
                    this.downlinkAnomalies[downlink['station'].toLowerCase()][downlink['satellite_id'].toLowerCase()]['sat'].push(downlink['notes']);
                } else {
                    console.info(downlink['notes']);
                    this.downlinkAnomalies[downlink['station'].toLowerCase()][downlink['satellite_id'].toLowerCase()]['other'].push(downlink['notes']);
                }
            }
        }

        // Invoke refresh of related widgets
        this.refreshGlobalBoxes();
        this.refreshPieChartsAndBoxes();

        return;
    }

    errorLoadDownlink(response){
        console.error(response)
        return;
    }

    getStationName(element) {
        var name = '';
        if (element['ground_station'].includes('MPS')) {
            name = 'Maspalomas';
        } else if (element['ground_station'].includes('SGS')) {
            name = 'Svalbard';
        } else if (element['ground_station'].includes('INS') || element['ground_station'].includes('INU')) {
            name = 'Inuvik';
        } else if (element['ground_station'].includes('MTI')) {
            name = 'Matera';
        } else if (element['ground_station'].includes('NSG')) {
            name = 'Neustrelitz';
        } else {
            console.warn('Unknown GS: ' + element['ground_station']);
        }
        return name;
    }

    clearGlobalBoxes() {
        ['planned-acquisitions', 'successful-acquisitions', 'satellite-failures', 'acquisition-failures'].
                forEach(function(item) {
            var boxId = item.toLowerCase() + '-global-box';
            $('#' + boxId).html(
                '<div class="spinner">' +
                    '<div class="bounce1"></div>' +
                    '<div class="bounce2"></div>' +
                    '<div class="bounce3"></div>' +
                '</div>');
        })
    }

    clearPieChartsAndBoxes() {
        ['svalbard', 'inuvik', 'maspalomas', 'matera', 'neustrelitz'].forEach(function(station) {
            var pieId = station.toLowerCase() + '-station-pie-chart';
            var boxId = station.toLowerCase() + '-station-box';
            acquisitionService.clearPieChart(pieId);
            acquisitionService.clearBox(boxId);
        })
    }

    refreshGlobalBoxes() {
        var data = acquisitionService.calcGlobalDownlinkStatistics();
        var ok = 0, sat = 0, acq = 0, other = 0, tot = 0;
        for (const [label, num] of Object.entries(data)) {
            tot += num;
            if (label.toUpperCase().includes('SUCCESS')) {
                ok += num;
            }
            if (label.toUpperCase().includes('SATELLITE')) {
                sat += num;
            }
            if (label.toUpperCase().includes('ACQUISITION')) {
                acq += num;
            }
            if (label.toUpperCase().includes('OTHER')) {
                other += num;
            }
        }
        $('#planned-acquisitions-global-box').text(tot);
        var okPerc = ok * 100.0 / tot;
        $('#successful-acquisitions-global-box').text(ok + ' (' + okPerc.toFixed(2) + '%)');
        var satPerc = sat * 100.0 / tot;
        $('#satellite-failures-global-box').text(sat + ' (' + satPerc.toFixed(2) + '%)');
        var acqPerc = acq * 100.0 / tot;
        $('#acquisition-failures-global-box').text(acq + ' (' + acqPerc.toFixed(2) + '%)');
    }

    refreshPieChartsAndBoxes() {
        ['svalbard', 'inuvik', 'maspalomas', 'matera', 'neustrelitz'].forEach(function(station) {
            var pieId = station.toLowerCase() + '-station-pie-chart';
            var boxId = station.toLowerCase() + '-station-box';
            var data = acquisitionService.calcDownlinkStatistics(station);
            acquisitionService.refreshPieChart(pieId, data);
            acquisitionService.refreshBox(boxId, data);
        })
    }

    calcGlobalDownlinkStatistics() {
        var data = {};
        var totPasses = 0, failedPassesAcq = 0, failedPassesSat = 0, failedPassesOther = 0;
        for (const station of Object.keys(acquisitionService.downlinkPasses)) {
            for (const [satellite, passes] of Object.entries(acquisitionService.downlinkPasses[station])) {
                totPasses += acquisitionService.downlinkPasses[station][satellite].length;
                failedPassesAcq += acquisitionService.downlinkAnomalies[station][satellite]['acq'].length;
                failedPassesSat += acquisitionService.downlinkAnomalies[station][satellite]['sat'].length;
                failedPassesOther += acquisitionService.downlinkAnomalies[station][satellite]['other'].length;
            }
        }
        var successfulPasses = totPasses - (failedPassesAcq + failedPassesSat + failedPassesOther);
        data['Successful passes'] = successfulPasses;
        data['Impaired passes (Acquisition Service issues)'] = failedPassesAcq;
        data['Impaired passes (Satellite issues)'] = failedPassesSat;
        data['Impaired passes (Other issues)'] = failedPassesOther;
        return data;
    }

    calcDownlinkStatistics(station) {
        var data = {};
        var totPasses = 0, failedPassesAcq = 0, failedPassesSat = 0, failedPassesOther = 0;
        for (const [satellite, passes] of Object.entries(acquisitionService.downlinkPasses[station])) {
            totPasses += acquisitionService.downlinkPasses[station][satellite].length;
            failedPassesAcq += acquisitionService.downlinkAnomalies[station][satellite]['acq'].length;
            failedPassesSat += acquisitionService.downlinkAnomalies[station][satellite]['sat'].length;
            failedPassesOther += acquisitionService.downlinkAnomalies[station][satellite]['other'].length;
        }
        var successfulPasses = totPasses - (failedPassesAcq + failedPassesSat + failedPassesOther);
        data['Successful passes'] = successfulPasses;
        data['Impaired passes (Acquisition Service issues)'] = failedPassesAcq;
        data['Impaired passes (Satellite issues)'] = failedPassesSat;
        data['Impaired passes (Other issues)'] = failedPassesOther;
        return data;
    }

    loadEDRSAcquisitionsInPeriod(selected_time_period) {

        // Clear previous data, if any
        this.EDRSPasses = {
            's1a': [],
            's2a': [],
            's2b': []
        };

        this.EDRSAnomalies = {
            's1a': {'acq': [], 'sat': [], 'other': []},
            's2a': {'acq': [], 'sat': [], 'other': []},
            's2b': {'acq': [], 'sat': [], 'other': []},
        };

        // Clear pie charts and boxes
        this.clearEDRSPieChartsAndBoxes();

        // Acknowledge the invocation of rest APIs
        console.info("Invoking EDRS retrieval...");

        // Execute asynchronous AJAX call
        if (selected_time_period === 'day') {
            asyncAjaxCall('/api/reporting/cds-edrs-acquisitions/last-24h', 'GET', {},
                this.successLoadEDRS.bind(this), this.errorLoadEDRS);
        } else if (selected_time_period === 'week') {
            asyncAjaxCall('/api/reporting/cds-edrs-acquisitions/last-7d', 'GET', {},
                this.successLoadEDRS.bind(this), this.errorLoadEDRS);
        } else if (selected_time_period === 'month') {
            asyncAjaxCall('/api/reporting/cds-edrs-acquisitions/last-30d', 'GET', {},
                this.successLoadEDRS.bind(this), this.errorLoadEDRS);
        } else if (selected_time_period === 'prev-quarter') {
            asyncAjaxCall('/api/reporting/cds-edrs-acquisitions/previous-quarter', 'GET', {},
                this.successLoadEDRS.bind(this), this.errorLoadEDRS);
        } else {
            asyncAjaxCall('/api/reporting/cds-edrs-acquisitions/last-quarter', 'GET', {},
                this.successLoadEDRS.bind(this), this.errorLoadEDRS);
        }

        return;
    }

    successLoadEDRS(response){

        // Acknowledge the successful retrieval of downlink operations
        var rows = format_response(response);
        console.info('EDRS operations successfully retrieved');
        console.info("Number of EDRS operations: " + rows.length);

        // Parse response
        for (var i = 0 ; i < rows.length ; ++i) {

            // Auxiliary variables
            var element = rows[i]['_source'];

            // Parse the EDRS operation
            var edrs = {};
            edrs['mission'] = element['mission'];
            edrs['satellite'] = element['satellite_id'];
            edrs['geo_satellite'] = element['geo_satellite_id'];
            edrs['start'] = element['planned_link_session_start'];
            edrs['stop'] = element['planned_link_session_stop'];
            edrs['spacecraft_status'] = element['spacecraft_execution'];
            edrs['status'] = element['total_status'];
            edrs['station'] = element['ground_station'];
            edrs['notes'] = element['notes'];

            // Collect CAMS anomaly origin
            try {
                edrs['origin'] = element['cams_origin'];
            } catch (exception) {
                edrs['origin'] = '';
            }

            // Store the downlink operation in the member class state vector
            this.EDRSPasses[edrs['satellite'].toLowerCase()].push(edrs);

            // Store the reference to the anomaly (if present) in the member class state vector
            if (edrs['origin'] && edrs['origin'].trim() != '') {
                if (edrs['origin'].includes('Acquis')) {
                    this.EDRSAnomalies[edrs['satellite'].toLowerCase()]['acq'].push(edrs['notes']);
                } else if (edrs['origin'].includes('Sat')) {
                    this.EDRSAnomalies[edrs['satellite'].toLowerCase()]['sat'].push(edrs['notes']);
                } else {
                    this.EDRSAnomalies[edrs['satellite'].toLowerCase()]['other'].push(edrs['notes']);
                }
            }
        }

        // Invoke refresh of related widgets
        this.refreshEDRSPieChartsAndBoxes();

        return;
    }

    errorLoadEDRS(response){
        console.error(response)
        return;
    }

    calcEDRSStatistics() {
        var data = {};
        var totPasses = 0, failedPassesAcq = 0, failedPassesSat = 0, failedPassesOther = 0;
        for (const [satellite, passes] of Object.entries(acquisitionService.EDRSPasses)) {
            totPasses += acquisitionService.EDRSPasses[satellite.toLowerCase()].length;
            failedPassesAcq += acquisitionService.EDRSAnomalies[satellite.toLowerCase()]['acq'].length;
            failedPassesSat += acquisitionService.EDRSAnomalies[satellite.toLowerCase()]['sat'].length;
            failedPassesOther += acquisitionService.EDRSAnomalies[satellite.toLowerCase()]['other'].length;
        }
        let successfulPasses = totPasses - (failedPassesAcq + failedPassesSat + failedPassesOther);
        data['Successful passes'] = successfulPasses;
        data['Impaired passes (Acquisition Service issues)'] = failedPassesAcq;
        data['Impaired passes (Satellite issues)'] = failedPassesSat;
        data['Impaired passes (Other issues)'] = failedPassesOther;
        return data;
    }

    clearEDRSPieChartsAndBoxes() {
        var pieId = 'edrs-pie-chart';
        var boxId = 'edrs-box';
        acquisitionService.clearPieChart(pieId);
        acquisitionService.clearBox(boxId);
    }

    refreshEDRSPieChartsAndBoxes() {
        var pieId = 'edrs-pie-chart';
        var boxId = 'edrs-box';
        var data = acquisitionService.calcEDRSStatistics();
        var labels = ['Successful', 'Acquisition Service issues', 'Satellite issues', 'Other issues'];
        acquisitionService.refreshPieChart(pieId, data, labels);
        acquisitionService.refreshBox(boxId, data, labels);
    }

    clearPieChart(pieId) {
        var chartCanvas = document.getElementById(pieId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        }
    }

    clearBox(boxId) {
        $('#' + boxId).html(
                '<div class="spinner">' +
                    '<div class="bounce1"></div>' +
                    '<div class="bounce2"></div>' +
                    '<div class="bounce3"></div>' +
                '</div>');
        $('#' + boxId + '-perc').html(
                '<div class="spinner">' +
                    '<div class="bounce1"></div>' +
                    '<div class="bounce2"></div>' +
                    '<div class="bounce3"></div>' +
                '</div>');
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
					backgroundColor : acquisitionService.colorsPool,
					borderWidth: 0
				}],
				labels: Object.keys(data)
			},
			options : {
				responsive: true,
				maintainAspectRatio: false,
				legend: {
					position : 'bottom',
					labels : {
						fontColor: 'rgb(154, 154, 154)',
						fontSize: 11,
						usePointStyle : true,
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
        $('#' + boxId).text(ok + ' / ' + tot);
        $('#' + boxId + '-perc').text(okPerc.toFixed(2) + '%');
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
            passes = acquisitionService.EDRSPasses;
            anomalies = acquisitionService.EDRSAnomalies;
        } else {
            target = station.charAt(0).toUpperCase();
            content.title = 'Details on ' + station.charAt(0).toUpperCase() + station.slice(1) + ' acquisitions';
            passes = acquisitionService.downlinkPasses[station];
            anomalies = acquisitionService.downlinkAnomalies[station];
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

        $.notify(content,{
            type: state,
            placement: {
                from: placementFrom,
                align: placementAlign
            },
            time: 1000,
            delay: 0,
        });
    }


    showAcquisitionServiceOnlineHelp() {

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

        return ;
    }
}

let acquisitionService = new AcquisitionService();