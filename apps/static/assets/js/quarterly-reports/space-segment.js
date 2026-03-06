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

class SpaceSegment {

    constructor() {

        // Start - stop time range
        /*this.end_date = new Date();
        this.end_date.setUTCHours(23, 59, 59, 0);
        this.start_date = new Date();
        this.start_date.setMonth(this.end_date.getMonth() - 3);
        this.start_date.setUTCHours(0, 0, 0, 0);*/

        // Set of colors used in the pie charts
        this.colorsPool = [
            "#66ff66", "#ff6037", "#ff355e",
            "#50bfe6 ", "#ffcc33 ", "#ff9966",
            "#aaf0d1", "#ffff66", "#ff00cc",
            "#16d0cb", "#fd5b78", "#9c27b0",
            "#ff00cc", "#f57d05", "#fa001d"
        ];

        // Set of colors associated to satellite
        this.satUnavailabilitiesColorMap = {
            'S1A': 'info',
            'S1C': 'info',
            'S2A': 'success',
            'S2B': 'success',
            'S2C': 'success',
            'S3A': 'warning',
            'S3B': 'warning',
            'S5P': 'secondary'
        };

        this.satUnavailabilities = {};
        this.impactedDatatakesBySatellite = {
            'S1A': [], 'S1C': [], 'S2A': [], 'S2B': [], 'S2C': [], 'S3A': [], 'S3B': [], 'S5P': []
        };
        this.impactedDatatakesTablesBySatellite = {};
        this.satellites = {}; // To store SENSING_DATA.stats
    }

    init() {

        /*console.group("[SPACE SEGMENT][SSR INIT]");
        console.log("URL:", window.location.href);
        console.log("Selected period param:", new URLSearchParams(window.location.search).get("period"));
        console.log("SSR datatakes count:", SENSING_DATA?.datatakes?.length);
        console.log("SSR unavailability count:", SENSING_DATA?.unavailability?.length);
        console.groupEnd();*/

        if (!window.SENSING_DATA) {
            console.warn('[SSR] Missing SENSING_DATA');
            return;
        }

        console.info('[SSR] Initializing SpaceSegment');

        // 1. Load Data from SSR object
        this.satellites = SENSING_DATA.stats || {};
        this.loadDatatakesFromSSR(SENSING_DATA.datatakes || []);
        this.loadUnavailabilityFromSSR(SENSING_DATA.unavailability || []);

        // 2. Setup UI Toggle
        this.toggleDatatakesUI(!!SENSING_DATA.detailsAllowed);

        // 3. Render Components
        this.refreshAvailabilityStatus(); // Now updates DOM from SSR data
        this.refreshPieChartsAndBoxesSSR();
        this.refreshDatatakesTablesSSR();

        // 4. Time Period Listener
        const sel = document.getElementById('time-period-select');
        if (sel) {
            sel.addEventListener('change', () => {
                window.location.href = `/space-segment?period=${sel.value}`;
            });
        }

    }

    loadDatatakesFromSSR(datatakes) {
        datatakes.forEach(dt => {
            if (!dt || !dt.satellite_unit) return;
            const sat = dt.satellite_unit.toUpperCase();

            // Map dates
            dt.observation_time_start = new Date(dt.observation_time_start);

            // Filter only impacted for the table
            const isImpacted = dt.last_attached_ticket && dt.completeness_status?.ACQ?.percentage < 100;
            if (isImpacted) {
                if (!this.impactedDatatakesBySatellite[sat]) this.impactedDatatakesBySatellite[sat] = [];
                this.impactedDatatakesBySatellite[sat].push(dt);
            }
        });

    }

    loadUnavailabilityFromSSR(unavailability) {
        unavailability.forEach(u => {
            this.satUnavailabilities[u.key || u.unavailability_reference] = {
                satellite: u.satellite_unit,
                item: u.subsystem,
                duration: u.unavailability_duration / 1_000_000,
                comment: u.comment,
                start: u.start_time,
                type: u.type,
                reference: u.unavailability_reference
            };
        });
    }

    toggleDatatakesUI(showTables) {
        const sats = ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p'];
        sats.forEach(sat => {
            const table = document.getElementById(`${sat}-table-container`);
            const boxes = document.getElementById(`${sat}-boxes-container`);
            if (table && boxes) {
                table.style.display = showTables ? "block" : "none";
                boxes.style.display = showTables ? "none" : "flex";
            }
        });
    }

    datatakesDetailsAuthorizedProcess(response) {
        this.toggleDatatakesUI(true);
    }

    datatakesDetailsAuthorizedError(response) {
        this.toggleDatatakesUI(false);
    }

    successLoadSatUnavailability(response) {

        // Acknowledge the successful retrieval of downlink operations
        var rows = format_response(response);
        console.info('Sat unavailabilities successfully retrieved');

        // Parse response
        for (var i = 0; i < rows.length; ++i) {

            // Auxiliary variables
            var element = rows[i]['_source'];

            // Parse the sat unavailability
            var unavailability = {};
            unavailability['reference'] = element['unavailability_reference'] + ' (' + element['subsystem'] + ')';
            unavailability['satellite'] = element['satellite_unit'];
            unavailability['start'] = element['start_time'];
            unavailability['item'] = element['subsystem'];
            unavailability['type'] = element['type'];
            unavailability['comment'] = element['comment'];

            // Skip the unavailability if referred to the beginning of the event, or
            // if already parsed (remove duplicates)
            if (!element['unavailability_duration']) {
                unavailability['duration'] = 0; // By default, set an average duration of 0h
            } else {
                unavailability['duration'] = element['unavailability_duration'] / 1000000;
            }

            // Store the system unavailability in the member class state vector
            if (!this.satUnavailabilities[unavailability['reference']] ||
                (this.satUnavailabilities[unavailability['reference']] &&
                    this.satUnavailabilities[unavailability['reference']]['duration'] == 0)) {
                this.satUnavailabilities[unavailability['reference']] = unavailability;
            }
        }

        // Log the number of satellite unavailabilties
        console.info("Number of sat unavailabilities: " + Object.keys(this.satUnavailabilities).length);

        // Refresh impacted item status
        this.refreshAvailabilityStatus();

        return;
    }

    refreshAvailabilityStatus() {
        console.info("[SSR] Updating availability bars from pre-computed data");

        const stats = SENSING_DATA.instrument_stats; // Expected from backend
        if (!stats) return;

        Object.keys(stats).forEach(sat => {
            Object.keys(stats[sat]).forEach(instrument => {
                const value = stats[sat][instrument]; // e.g. 99.85
                const id_perc = `${sat.toLowerCase()}-${instrument.toLowerCase()}-avail-perc`;
                const id_bar = `${sat.toLowerCase()}-${instrument.toLowerCase()}-avail-bar`;

                $(`#${id_perc}`).text(value.toFixed(2) + '%');
                $(`#${id_bar}`).css({ "width": value.toFixed(2) + '%' });
            });
        });
    }

    showUnavailabilityEvents(satellite) {

        // Build the message to be displayed
        var count = 0;
        var content = {};
        content.title = 'Unavailability events';

        // Collect unavailabilities
        content.message = '<ul>';
        Object.keys(spaceSegment.satUnavailabilities).forEach(function (ref, key) {
            if (spaceSegment.satUnavailabilities[ref]['satellite'] === satellite &&
                spaceSegment.satUnavailabilities[ref]['item'] != 'EDDS') {
                var unav = spaceSegment.satUnavailabilities[ref];

                // Display only occurrences lasting more than a given threshold
                if (unav['duration'] / (60 * 60) > 0.1) {
                    var duration = (unav['duration'] / (60 * 60)).toFixed(1);
                    content.message += '<li>Ref: ' + unav['reference'] + '; type: ' + unav['type'] + '; occurence date: '
                        + unav['start'].replace('.000Z', '') + '; duration[h]: ' + duration + '</li>';
                } else {
                    count++;
                }
            }
        });
        content.message += '</ul>';

        // If needed, show the number of skipped unavailabilities
        if (count > 0) {
            content.message += '<p> + ' + count.toString() + ' more occurrences omitted for brief duration.</p>'
        }

        // Add other popup properties
        content.icon = 'fa fa-bell';
        content.url = '';
        content.target = '_blank';

        // Message visualization
        var placementFrom = "top";
        var placementAlign = "right";
        var state = spaceSegment.satUnavailabilitiesColorMap[satellite];
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

    refreshPieChartsAndBoxesSSR() {

        const sats = ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p'];
        sats.forEach(sat => {
            const key = sat.toUpperCase();
            const d = this.satellites[key];
            if (!d) return;

            const chartData = {
                "Successful": d.success,
                "Satellite Issue": d.sat_fail || 0,
                "Acquisition Issue": d.acq_fail || 0,
                "Other": d.other_fail || 0,
            };

            this.refreshPieChart(`${sat}-sensing-statistics-pie-chart`, chartData);

            // Update Summary Boxes
            $(`#${sat}-successful-datatakes-box`).html(d.success + "h");
            $(`#${sat}-satellite-failures-box`).html((d.sat_fail || 0) + "h");
            $(`#${sat}-acquisition-failures-box`).html((d.acq_fail || 0) + "h");
            $(`#${sat}-other-failures-box`).html((d.other_fail || 0) + "h");
        });
    }

    clearPieChart(pieId) {
        var chartCanvas = document.getElementById(pieId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        }
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
                    backgroundColor: spaceSegment.colorsPool,
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

    refreshBoxes(satellite, data) {

        // Extract information
        var totSuccessSensing, totSuccessSensingPerc, failedSensingSat, failedSensingSatPerc, failedSensingAcq,
            failedSensingAcqPerc, failedSensingOth, failedSensingOthPerc;
        for (const [key, value] of Object.entries(data)) {
            if (key.toUpperCase().includes('SUCCESS')) {
                totSuccessSensing = value;
                totSuccessSensingPerc = key.substring(key.indexOf(':') + 1, key.lastIndexOf('%')).trim();
            } else if (key.toUpperCase().includes('SATELLITE')) {
                failedSensingSat = value;
                failedSensingSatPerc = key.substring(key.indexOf(':') + 1, key.lastIndexOf('%')).trim();
            } else if (key.toUpperCase().includes('ACQUISITION')) {
                failedSensingAcq = value;
                failedSensingAcqPerc = key.substring(key.indexOf(':') + 1, key.lastIndexOf('%')).trim();
            } else {
                failedSensingOth = value;
                failedSensingOthPerc = key.substring(key.indexOf(':') + 1, key.lastIndexOf('%')).trim();
            }
        }

        // Update boxes
        $('#' + satellite + '-successful-datatakes-box').text(totSuccessSensing +
            ' (' + totSuccessSensingPerc + '%)');
        $('#' + satellite + '-satellite-failures-box').text(failedSensingSat +
            ' (' + failedSensingSatPerc + '%)');
        $('#' + satellite + '-acquisition-failures-box').text(failedSensingAcq +
            ' (' + failedSensingAcqPerc + '%)');
        $('#' + satellite + '-other-failures-box').text(failedSensingOth +
            ' (' + failedSensingOthPerc + '%)');
    }

    showSensingStatistics(satellite) {
        // 1. Get the pre-computed data from the SSR object
        // 'this.satellites' should be populated from 'sensing_stats' in your init()
        const satData = this.satellites[satellite];

        if (!satData) {
            console.error("No data found for satellite:", satellite);
            return;
        }

        // 2. Prepare the notification content
        var content = {
            title: satellite + ' Sensing Statistics',
            icon: 'fa fa-bell'
        };

        // 3. Extract pre-calculated values from the backend
        // Assuming backend provides these based on your 'build_space_segment_ssr' logic
        const successHours = satData.success || 0;
        const unavailability = satData.unavailability || { sat: 0, acq: 0, other: 0 };

        // Calculate total planned (Success + all Failures)
        const totSensing = successHours + unavailability.sat + unavailability.acq + unavailability.other;

        // Calculate percentages safely
        const getPerc = (val) => totSensing > 0 ? ((val / totSensing) * 100).toFixed(2) : "0.00";

        // 4. Build the HTML Message
        let msg = `<b>Planned sensing:</b> ${totSensing.toFixed(2)} [hours]<br />`;
        msg += `<b>Successful sensing:</b> ${successHours.toFixed(2)} (${getPerc(successHours)}%)<br />`;
        msg += `<hr />`;

        // Failures breakdown
        const categories = [
            { label: 'Satellite issues', val: unavailability.sat, key: 'sat_events' },
            { label: 'Acquisition issues', val: unavailability.acq, key: 'acq_events' },
            { label: 'Other issues', val: unavailability.other, key: 'other_events' }
        ];

        categories.forEach(cat => {
            msg += `<b>Sensing failed due to ${cat.label}:</b> ${cat.val.toFixed(2)} [hours] (${getPerc(cat.val)}%)<br />`;

            // Add event list if they exist in the SSR object
            if (satData.events && satData.events[cat.key] && satData.events[cat.key].length > 0) {
                msg += `<ul style="margin-bottom: 5px; font-size: 0.85rem;">`;
                satData.events[cat.key].forEach(anom => {
                    // Use backend formatted dates
                    msg += `<li>${anom.date || ''}: ${anom.type || 'Issue'}. ${anom.description || ''}</li>`;
                });
                msg += `</ul>`;
            }
        });

        content.message = msg;


        $.notify(content, {
            type: "info", // Changed to info for better readability
            placement: { from: "top", align: "right" },
            time: 1000,
            delay: 0, // Keeps it open until user closes or clicks away if configured
        });
    }

    refreshDatatakesTablesSSR() {
        console.log("[SSR] Rendering impacted datatakes tables using DataTables");

        const sats = ['S1A', 'S1C', 'S2A', 'S2B', 'S2C', 'S3A', 'S3B', 'S5P'];

        sats.forEach(sat => {
            const tableId = `${sat.toLowerCase()}-impacted-datatakes-table`;
            const tableEl = $(`#${tableId}`);

            if (!tableEl.length) return;

            // Build datatakes rows
            const rows = this.impactedDatatakesBySatellite[sat] || [];
            const data = rows.map(dt => {
                const key = dt.datatake_id;
                const issueDate = dt.observation_time_start
                    ? moment(dt.observation_time_start).format("YYYY-MM-DD")
                    : "-";
                let issueType = "Other";
                if (dt.cams_origin) {
                    if (dt.cams_origin.includes("Acquis")) issueType = "Acquisition";
                    else if (dt.cams_origin.includes("CAM") || dt.cams_origin.includes("Sat")) issueType = "Satellite";
                }
                const issueLink = dt.last_attached_ticket
                    ? `<a href="https://cams.esa.int/browse/${dt.last_attached_ticket}" target="_blank">${dt.last_attached_ticket}</a>`
                    : "-";
                const completeness = dt.completeness !== undefined ? dt.completeness.toFixed(2) : "-";
                return [key, issueDate, issueType, issueLink, completeness];
            });

            // Initialize DataTable if not already
            if (!this.impactedDatatakesTablesBySatellite[sat]) {
                this.impactedDatatakesTablesBySatellite[sat] = tableEl.DataTable({
                    data: data,
                    columns: [
                        { title: "Data Take ID" },
                        { title: "Date" },
                        { title: "Issue type" },
                        { title: "Issue link" },
                        { title: "L0 Completeness" },
                        {
                            title: "Actions",
                            data: null,
                            render: function (data, type, row) {
                                if (type === 'display') {
                                    return `<button type="button" style="color: #8c90a0" class="btn-link" data-toggle="modal" data-target="#showDatatakeDetailsModal"
                                onclick="spaceSegment.showDatatakeDetails('${row[0]}')"><i class="la flaticon-search-1"></i></button>`;
                                }
                                return data;
                            }
                        }
                    ],
                    language: { emptyTable: "No impacted datatake found" },
                    responsive: true,
                    paging: true,
                    searching: true,
                    info: true,
                    autoWidth: false,
                });
            } else {
                // Table exists: just clear and add new data
                this.impactedDatatakesTablesBySatellite[sat].clear().rows.add(data).draw();
            }
        });

        console.log("[SSR] Impacted datatake tables updated with DataTables");
    }



    buildDatatakesTableRows(satellite) {

        // Auxiliary variable declaration
        var datatakesList = spaceSegment.impactedDatatakesBySatellite[satellite];
        var data = new Array();

        // Loop over each datatake and build the datatake row
        for (var i = 0; i < datatakesList.length; ++i) {

            var element = datatakesList[i];
            var key = element['datatake_id'];
            if (key.includes('S1')) {
                key = spaceSegment.overrideS1DatatakesId(key);
            }

            // Issue date
            var sensing_start = moment(element['observation_time_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            var issueDate = sensing_start.toISOString().split('T')[0];

            // Issue type
            var issueType = '';
            if (element['cams_origin'].includes('Acquis')) {
                issueType = 'Acquisition';
            } else if (element['cams_origin'].includes('CAM') || element['cams_origin'].includes('Sat')) {
                issueType = 'Satellite';
            } else {
                issueType = 'Other (' + element['cams_origin'] + ')';
            }

            // Issue link
            var ticket = 'https://cams.esa.int/browse/' + element['last_attached_ticket'];
            var issueLink = '<a href="' + ticket + '">' + element['last_attached_ticket'] + '</a>';

            // Recalculate the original ACQ completeness
            var acquisitionCompleteness = spaceSegment.recalcDatatakeAcqCompleteness(element);

            // Push the element row, with the collected information
            // Every row is a datatable row, related to a single datatake
            // Datatake status record:
            // element key, sat unit, sensing start, sensing stop, acq status, levels status
            data.push([key, issueDate, issueType, issueLink, acquisitionCompleteness.toFixed(2)]);
        }

        // Return the table rows
        return data;
    }

    overrideS1DatatakesId(datatake_id) {
        let num = datatake_id.substring(4);
        let hexaNum = parseInt(num).toString(16);
        return (datatake_id + ' (' + hexaNum + ')');
    }

    recalcDatatakeAcqCompleteness(datatake) {
        if (datatake['L0_']) {
            return datatake['L0_'];
        } else if (datatake['L1_']) {
            return datatake['L1_'];
        } else if (datatake['L2_']) {
            return datatake['L2_'];
        } else return 0;
    }

    showDatatakeDetails(datatake_id) {

        // Clean the datatake ID from possible appended attribute (i.e., for S1A)
        datatake_id = datatake_id.split('(')[0].trim();

        // Add spinner during query
        $('#space-segment-datatake-details').empty();
        $('#space-segment-datatake-details').html(
            '<div class="spinner">' +
            '<div class="bounce1"></div>' +
            '<div class="bounce2"></div>' +
            '<div class="bounce3"></div>' +
            '</div>');

        // Acknowledge the visualization of the online help
        console.info('Showing detail of datatake: ' + datatake_id);

        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        asyncAjaxCall('/api/worker/cds-datatake/' + datatake_id, 'GET', {}, spaceSegment.successShowDatatakeDetails,
            spaceSegment.errorShowDatatakeDetails);

        return;
    }

    successShowDatatakeDetails(response) {
        var datatake = format_response(response)[0];
        $('#space-segment-datatake-details').empty();
        $('#space-segment-datatake-details').append('<div class="form-group">' +
            '<label>Datatake ID: ' + datatake['key'] + '</label>' +
            '<label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</label>' +
            '<label>Timeliness: ' + datatake['timeliness'] + '</label>' +
            '</div>');
        $('#space-segment-datatake-details').append('<div class="card">' +
            '<div class="card-body">' +
            '<div class="table-responsive"><div class="table-responsive">' +
            '<table id="space-segment-product-level-completeness-table" class="display table table-striped table-hover">' +
            '<thead>' +
            '<tr>' +
            '<th>Product type</th>' +
            '<th style="text-align: center">Status [%]</th>' +
            '</tr>' +
            '<tbody></tbody>' +
            '</thead>' +
            '</table>' +
            '</div>' +
            '</div>' +
            '</div>');
        var dataTakeDetailsTable = $('#space-segment-product-level-completeness-table').DataTable({
            "sDom": "frtp",
            "createdRow": function (row, data, dataIndex) {
                $(row).find('td').eq(0).height(25);
                $(row).find('td').eq(1).height(25);
                $(row).find('td').eq(1).css('text-align', 'center');
                $(row).find('td').eq(1).css('color', 'white');
                var color = '#0aa41b';
                if (data[1] < 90 && data[1] >= 5) color = '#8c90a0';
                if (data[1] < 5) color = '#8c90a0';
                $(row).find('td').eq(1).css('background-color', color);
            }
        });
        for (var key of Object.keys(datatake)) {
            if (key.includes('local_percentage')) {
                dataTakeDetailsTable.row.add([key.replace('_local_percentage', ''), datatake[key].toFixed(2)]).draw();
            }
        }
    }

    errorShowDatatakeDetails(response) {
        $('#space-segment-datatake-details').append(
            '<div class="form-group">' +
            '<label>An error occurred, while retrieving the datatake details</label>' +
            '</div>');
    }

    /*showSpaceSegmentOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing system availability online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'System Availability';
        content.message = 'This view summarizes the global system availability, with details relevant to the main instruments of each satellite.<br>' +
            'Click on the magnifier lens, to display the anomalies causing the discontinuity in the system availability. By default, ' +
            'results are referred to the previous completed quarter.'
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return;
    }*/
}

let spaceSegment = new SpaceSegment();