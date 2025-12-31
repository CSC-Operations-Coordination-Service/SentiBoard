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
        this.end_date = new Date();
        this.end_date.setUTCHours(23, 59, 59, 0);
        this.start_date = new Date();
        this.start_date.setMonth(this.end_date.getMonth() - 3);
        this.start_date.setUTCHours(0, 0, 0, 0);

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

        // Set the current user profile
        this.profile = '';

        // Set of satellite unavailabilities
        this.satUnavailabilities = {};

        // Set of datatakes by satellite
        this.datatakesBySatellite = {
            'S1A': [],
            'S1C': [],
            'S2A': [],
            'S2B': [],
            'S2C': [],
            'S3A': [],
            'S3B': [],
            'S5P': []
        };

        // Set of datatakes by satellite
        this.impactedDatatakesBySatellite = {
            'S1A': [],
            'S1C': [],
            'S2A': [],
            'S2B': [],
            'S2C': [],
            'S3A': [],
            'S3B': [],
            'S5P': []
        };

        // Set the bootstrap tables for each datatake
        this.impactedDatatakesTablesBySatellite = {
            'S1A': null,
            'S1C': null,
            'S2A': null,
            'S2B': null,
            'S2C': null,
            'S3A': null,
            'S3B': null,
            'S5P': null
        };

        // Set of impacted instruments by satellite
        this.impactedInstrumentBySatellite = {
            'S1A': ['SAR', 'PDHT', 'OCP', 'EDDS'],
            'S1C': ['SAR', 'PDHT', 'OCP', 'EDDS'],
            'S2A': ['MSI', 'MMFU', 'OCP', 'EDDS', 'STR'],
            'S2B': ['MSI', 'MMFU', 'OCP', 'EDDS', 'STR'],
            'S2C': ['MSI', 'MMFU', 'OCP', 'EDDS', 'STR'],
            'S3A': ['OLCI', 'SLSTR', 'SRAL', 'MWR', 'EDDS'],
            'S3B': ['OLCI', 'SLSTR', 'SRAL', 'MWR', 'EDDS'],
            'S5P': ['TROPOMI', 'EDDS']
        };

        // Set the categorized anomalies map
        this.categorizedAnomalies = {};

        // Set the completeness threshold for displaying the anomaly in the list
        this.completenessThreshold = 0.9999;

        this.isSSR = true;
    }

    init() {

        if (!window.SENSING_DATA) {
            console.warn('[SSR] Missing SENSING_DATA');
            return;
        }

        console.info('[SSR] Initializing SpaceSegment from SSR');

        const datatakes = Array.isArray(SENSING_DATA.datatakes) ? SENSING_DATA.datatakes : [];
        const unavailability = Array.isArray(SENSING_DATA.unavailability) ? SENSING_DATA.unavailability : [];

        this.loadDatatakesFromSSR(datatakes);
        this.loadUnavailabilityFromSSR(unavailability);

        //const allowed = !!SENSING_DATA.detailsAllowed;

        ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p'].forEach(sat => {
            //document.getElementById(`${sat}-table-container`).style.display = allowed ? "block" : "none";
            document.getElementById(`${sat}-table-container`).style.display = "block";
            //document.getElementById(`${sat}-boxes-container`).style.display = allowed ? "none" : "flex";
            document.getElementById(`${sat}-boxes-container`).style.display = "none";
        });

        console.log("[SSR] Stats rendered to DOM with correct colors");
        this.refreshPieChartsAndBoxesSSR();
        this.refreshDatatakesTablesSSR();

    }

    loadDatatakesFromSSR(datatakes) {
        if (!Array.isArray(datatakes)) {
            console.warn('[SSR] datatakes is not an array:', datatakes);
            return;
        }

        datatakes.forEach(dt => {
            if (!dt || !dt.satellite_unit) return;

            dt.observation_time_start = new Date(dt.observation_time_start);
            dt.observation_time_stop = new Date(dt.observation_time_stop);

            const sat = dt.satellite_unit.toUpperCase();

            if (!this.datatakesBySatellite[sat]) {
                this.datatakesBySatellite[sat] = [];
            }

            this.datatakesBySatellite[sat].push(dt);

            // Check if this datatake would be considered "impacted"
            const isImpacted = dt.last_attached_ticket && dt.completeness_status?.ACQ?.percentage < 100;
            if (isImpacted) {
                if (!this.impactedDatatakesBySatellite[sat]) this.impactedDatatakesBySatellite[sat] = [];
                this.impactedDatatakesBySatellite[sat].push(dt);
            }

            console.log('[SSR] Loaded datatake:', dt, 'Impacted?', isImpacted);
        });

        console.info('[SSR] Datatakes loaded per satellite:', this.datatakesBySatellite);
        console.info('[SSR] Impacted datatakes per satellite:', this.impactedDatatakesBySatellite);
    }


    loadUnavailabilityFromSSR(unavailability) {
        if (!unavailability) return;
        unavailability.forEach(u => {
            this.satUnavailabilities[u.key] = {
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

    /*quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }

            // Programmatically select the previous quarter as the default time range
            console.info('Programmatically set the time period to previous quarter')
            time_period_sel.value = 'prev-quarter';
        }
    }*/

    /*quarterAuthorizedError(response) {
        console.error(response)
        return;
    }*/

    /*datatakesDetailsAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p'].forEach(function (sat) {
                $('#' + sat + '-table-container').show();
                $('#' + sat + '-boxes-container').hide();
            });
        }
    }*/

    /*datatakesDetailsAuthorizedError(response) {
        ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p'].forEach(function (sat) {
            $('#' + sat + '-table-container').hide();
            $('#' + sat + '-boxes-container').show();
        });
    }*/

    /*on_timeperiod_change() {
        var time_period_sel = document.getElementById('time-period-select')
        var selected_time_period = time_period_sel.value
        console.log("Time period changed to " + selected_time_period)
        this.updateDateInterval(selected_time_period)
        this.loadSatUnavailabilityInPeriod(selected_time_period);
        this.loadDatatakesInPeriod(selected_time_period);
    }*/

    /*updateDateInterval(period_type) {

        // Update start date depending on value of period type
        // one of: day, week, month, quarter
        // take delta to be applied from configuration
        console.info('Updating time interval: ' + period_type);
        let dates = new ObservationTimePeriod().getIntervalDates(period_type);
        this.start_date = dates[0];
        this.end_date = dates[1];
        return;
    }*/

    /*loadSatUnavailabilityInPeriod(selected_time_period) {

        // Clear previous data, if any
        this.satUnavailabilities = {};

        // Acknowledge the invocation of rest APIs
        console.info("Invoking Sat unavailabilities retrieval...");

        // Execute asynchrounous AJAX call
        if (selected_time_period === 'day') {
            asyncAjaxCall('/api/reporting/cds-sat-unavailability/last-24h', 'GET', {},
                this.successLoadSatUnavailability.bind(this), this.errorLoadSatUnavailability);
        } else if (selected_time_period === 'week') {
            asyncAjaxCall('/api/reporting/cds-sat-unavailability/last-7d', 'GET', {},
                this.successLoadSatUnavailability.bind(this), this.errorLoadSatUnavailability);
        } else if (selected_time_period === 'month') {
            asyncAjaxCall('/api/reporting/cds-sat-unavailability/last-30d', 'GET', {},
                this.successLoadSatUnavailability.bind(this), this.errorLoadSatUnavailability);
        } else if (selected_time_period === 'prev-quarter') {
            asyncAjaxCall('/api/reporting/cds-sat-unavailability/previous-quarter', 'GET', {},
                this.successLoadSatUnavailability.bind(this), this.errorLoadSatUnavailability);
        } else {
            asyncAjaxCall('/api/reporting/cds-sat-unavailability/last-quarter', 'GET', {},
                this.successLoadSatUnavailability.bind(this), this.errorLoadSatUnavailability);
        }

        return;
    }*/

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

    /*errorLoadSatUnavailability(response) {
        console.error(response)
        return;
    }*/

    refreshAvailabilityStatus() {
        if (this.isSSR) {
            console.info("[SSR] Skipping availability recomputation");
            return;
        }
        var periodDurationSec = (this.end_date.getTime() - this.start_date.getTime()) / 1000;
        var availabilityStatus = {
            'S1A': { 'SAR': 100, 'EDDS': 100, 'PDHT': 100, 'OCP': 100 },
            'S1C': { 'SAR': 100, 'EDDS': 100, 'PDHT': 100, 'OCP': 100 },
            'S2A': { 'MSI': 100, 'MMFU': 100, 'OCP': 100, 'EDDS': 100, 'STR': 100 },
            'S2B': { 'MSI': 100, 'MMFU': 100, 'OCP': 100, 'EDDS': 100, 'STR': 100 },
            'S2C': { 'MSI': 100, 'MMFU': 100, 'OCP': 100, 'EDDS': 100, 'STR': 100 },
            'S3A': { 'OLCI': 100, 'SLSTR': 100, 'SRAL': 100, 'MWR': 100, 'EDDS': 100 },
            'S3B': { 'OLCI': 100, 'SLSTR': 100, 'SRAL': 100, 'MWR': 100, 'EDDS': 100 },
            'S5P': { 'TROPOMI': 100, 'EDDS': 100 }
        };

        Object.keys(this.satUnavailabilities).forEach(function (ref, key) {
            var satellite = spaceSegment.satUnavailabilities[ref]['satellite'];
            var impactedItem = spaceSegment.satUnavailabilities[ref]['item'];
            if (impactedItem in availabilityStatus[satellite]) {
                availabilityStatus[satellite][impactedItem] -=
                    (spaceSegment.satUnavailabilities[ref]['duration'] / periodDurationSec * 100);
            } else {

                // Introduce a dedicate management of Star Trackers unavailabilities: issues affecting any
                // of the star trackers are mapped vs the same status bar
                if (impactedItem.toUpperCase() === 'STR-1' || impactedItem.toUpperCase() === 'STR-2') {
                    availabilityStatus[satellite]['STR'] -=
                        (spaceSegment.satUnavailabilities[ref]['duration'] / periodDurationSec * 100);
                }

                // Introduce a dedicated management of S5p mission unavailabilities.
                if (satellite.toUpperCase() === 'S5P') {
                    availabilityStatus[satellite]['TROPOMI'] -=
                        (spaceSegment.satUnavailabilities[ref]['duration'] / periodDurationSec * 100);
                }

                // Introduce a dedicated management of S3 mission unavailabilities. Since a single unavailability may
                // affect more than one instrument, a further check is needed, to assess the impact on a specific
                // instrument by looking t the unavailability comment.
                if (satellite.toUpperCase() === 'S3A' || satellite.toUpperCase() === 'S3B') {
                    var s3items = ['OLCI', 'SLSTR', 'SRAL', 'MWR'];
                    for (var index = 0; index < s3items.length; ++index) {
                        if (spaceSegment.satUnavailabilities[ref]['comment'].includes(s3items[index])) {
                            availabilityStatus[satellite][s3items[index]] -=
                                (spaceSegment.satUnavailabilities[ref]['duration'] / periodDurationSec * 100);
                        }
                    }
                }
            }
        });
        Object.keys(availabilityStatus).forEach(function (sat, key) {
            Object.keys(availabilityStatus[sat]).forEach(function (instrument, key2) {
                var id_perc = sat.toLowerCase() + '-' + instrument.toLowerCase() + '-avail-perc';
                var id_bar = sat.toLowerCase() + '-' + instrument.toLowerCase() + '-avail-bar';
                var value = availabilityStatus[sat][instrument];
                $('#' + id_perc).text(value.toFixed(2) + '%');
                $('#' + id_bar).css({ "width": value.toFixed(2) + '%' });
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

    /*loadDatatakesInPeriod(selected_time_period) {

        // Clear previous data, if any - datatakes
        this.datatakesBySatellite = {
            'S1A': [],
            'S1C': [],
            'S2A': [],
            'S2B': [],
            'S2C': [],
            'S3A': [],
            'S3B': [],
            'S5P': []
        };

        // Clear previous data, if any - impacted datatakes
        this.impactedDatatakesBySatellite = {
            'S1A': [],
            'S1C': [],
            'S2A': [],
            'S2B': [],
            'S2C': [],
            'S3A': [],
            'S3B': [],
            'S5P': []
        };

        // Clear previous data, if any - categorized events
        this.categorizedAnomalies = {};

        // Acknowledge the invocation of rest APIs
        console.info("Invoking Datatakes retrieval...");

        // Execute asynchronous AJAX call
        if (selected_time_period === 'day') {
            asyncAjaxCall('/api/worker/cds-datatakes/last-24h', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else if (selected_time_period === 'week') {
            asyncAjaxCall('/api/worker/cds-datatakes/last-7d', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else if (selected_time_period === 'month') {
            asyncAjaxCall('/api/worker/cds-datatakes/last-30d', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else if (selected_time_period === 'prev-quarter') {
            asyncAjaxCall('/api/worker/cds-datatakes/previous-quarter', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else {
            asyncAjaxCall('/api/worker/cds-datatakes/last-quarter', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        }

        return;
    }*/

    /*successLoadDatatakes(response) {

        // Acknowledge the successful retrieval of S1/S2 data takes
        var rows = format_response(response);
        console.info('Datatakes successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Parse response
        for (var i = 0; i < rows.length; ++i) {

            // Auxiliary variables
            var element = rows[i]['_source'];

            // Satellite unit
            var sat_unit = element['satellite_unit'];

            // Sensing start and stop time
            element['observation_time_start'] = moment(element['observation_time_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            element['observation_time_stop'] = moment(element['observation_time_stop'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();

            // Push the datatake in the proper array
            this.datatakesBySatellite[sat_unit].push(element);

            // Check the presence of any related ticket: in case of anomalies,
            // store the datatake in a dedicated structure
            if (element['last_attached_ticket'] && element['completeness_status'].ACQ.percentage < 100) {
                this.impactedDatatakesBySatellite[sat_unit].push(element);
            }
        }

        // Refresh the datatakes statistics displayed in the pie charts and boxes
        this.refreshPieChartsAndBoxes();

        // Refresh the datatakes tables and boxes
        this.refreshDatatakesTables();

        return;
    }*/

    /*refreshPieChartsAndBoxes() {
        if (this.isSSR) {
            console.info('[SSR] Skipping sensing recomputation in JS');
            return;
        }
        ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p'].forEach(function (satellite) {

            // Remove existing data from the pie charts
            var pieId = satellite.toLowerCase() + '-sensing-statistics-pie-chart';
            spaceSegment.clearPieChart(pieId);

            // Recalculate statistics
            var data = {};
            SSR_PIE_DATA[satellite.toUpperCase()].forEach(e => {
                data[e.label] = e.value;
            });
            // Update the corresponding pie chart
            spaceSegment.refreshPieChart(pieId, data);
            spaceSegment.refreshBoxes(satellite, data);
        })
    }*/

    refreshPieChartsAndBoxesSSR() {

        console.log("[SSR] Rendering L0 sensing pie charts & summary boxes");

        for (const sat of ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p']) {

            const key = sat.toUpperCase();

            if (!SENSING_DATA.stats[key]) continue;

            const d = SENSING_DATA.stats[key];

            // --- 1. PIE CHART DATA FORMAT ---
            const chartData = {
                "Successful": d.success,
                "Satellite Issue": d.sat_fail || 0,
                "Acquisition Issue": d.acq_fail || 0,
                "Other": d.other_fail || 0,
            };

            // draw pie
            spaceSegment.clearPieChart(`${sat}-sensing-statistics-pie-chart`);
            spaceSegment.refreshPieChart(`${sat}-sensing-statistics-pie-chart`, chartData);

            // --- 2. UPDATE BOXES ---
            document.querySelector(`#${sat}-successful-datatakes-box`).innerHTML = d.success + "h";
            document.querySelector(`#${sat}-satellite-failures-box`).innerHTML = (d.sat_fail || 0) + "h";
            document.querySelector(`#${sat}-acquisition-failures-box`).innerHTML = (d.acq_fail || 0) + "h";
            document.querySelector(`#${sat}-other-failures-box`).innerHTML = (d.other_fail || 0) + "h";

            // Show the box container
            document.querySelector(`#${sat}-boxes-container`).style.display = "flex";
        }
    }

    /*errorLoadDatatake(response) {
        console.error(response)
        return;
    }*/

    clearPieChart(pieId) {
        var chartCanvas = document.getElementById(pieId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        }
    }

    calcSensingStatistics(satellite) {

        // Auxiliary variable declaration
        var data = {};
        satellite = satellite.toUpperCase();
        var hours = 0, totSensing = 0, failedSensingAcq = 0, failedSensingSat = 0, failedSensingOther = 0;

        // Compute statistics and collect unavailability events
        spaceSegment.categorizedAnomalies[satellite] = { 'sat_events': {}, 'acq_events': {}, 'other_events': {} };
        spaceSegment.datatakesBySatellite[satellite].forEach(function (datatake) {
            if (datatake['l0_sensing_duration']) {
                hours = datatake['l0_sensing_duration'] / 3600000000;
            } else {
                hours = (datatake['observation_time_stop'].getTime() - datatake['observation_time_start'].getTime()) / 3600000;
            }
            totSensing += hours;
            if (datatake['last_attached_ticket'] && datatake['cams_origin']) {
                let ticket_id = datatake['last_attached_ticket'];
                let compl = spaceSegment.recalcDatatakeAcqCompleteness(datatake) / 100;
                if (datatake['cams_origin'].includes('Acquis') && compl < spaceSegment.completenessThreshold) {
                    failedSensingAcq += hours * (1 - compl);
                    spaceSegment.categorizedAnomalies[satellite]['acq_events'][ticket_id] =
                    {
                        'reference': ticket_id, 'type': datatake['cams_origin'], 'description': datatake['cams_description'],
                        'date': datatake['observation_time_start'].toISOString().split('T')[0]
                    };
                } else if (datatake['cams_origin'].includes('CAM') || datatake['cams_origin'].includes('Sat')
                    && compl < spaceSegment.completenessThreshold) {
                    failedSensingSat += hours * (1 - compl);
                    spaceSegment.categorizedAnomalies[satellite]['sat_events'][ticket_id] =
                    {
                        'reference': ticket_id, 'type': datatake['cams_origin'], 'description': datatake['cams_description'],
                        'date': datatake['observation_time_start'].toISOString().split('T')[0]
                    };
                } else {
                    failedSensingOther += hours * (1 - compl);
                    if (compl <= spaceSegment.completenessThreshold) {
                        spaceSegment.categorizedAnomalies[satellite]['other_events'][ticket_id] =
                        {
                            'reference': ticket_id, 'type': datatake['cams_origin'], 'description': datatake['cams_description'],
                            'date': datatake['observation_time_start'].toISOString().split('T')[0]
                        };
                    }
                }
            }
        });

        // Sort anomalies
        Object.keys(spaceSegment.categorizedAnomalies[satellite]['sat_events']).sort();
        Object.keys(spaceSegment.categorizedAnomalies[satellite]['acq_events']).sort();
        Object.keys(spaceSegment.categorizedAnomalies[satellite]['other_events']).sort();

        // Compute percentages and return
        let successfulSensing = totSensing - (failedSensingAcq + failedSensingSat + failedSensingOther);
        let successfulSensingPerc = (successfulSensing / totSensing).toFixed(2) * 100;
        let failedSensingAcqPerc = (failedSensingAcq / totSensing).toFixed(2) * 100;
        let failedSensingSatPerc = (failedSensingSat / totSensing).toFixed(2) * 100;
        let failedSensingOtherPerc = (failedSensingOther / totSensing).toFixed(2) * 100;
        data['Successful sensing: ' + successfulSensingPerc + '%'] = successfulSensing.toFixed(2);
        data['Sensing failed due to Acquisition issues: ' + failedSensingAcqPerc + '%'] = failedSensingAcq.toFixed(2);
        data['Sensing failed due to Satellite issues: ' + failedSensingSatPerc + '%'] = failedSensingSat.toFixed(2);
        data['Sensing failed due to Other issues: ' + failedSensingOtherPerc + '%'] = failedSensingOther.toFixed(2);
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
        if (this.isSSR) {
            console.info("[SSR] Skipping availability recomputation");
            return;
        }

        // Auxiliary Variable Declaration
        var content = { title: satellite + ' Sensing Statistics' };

        // Append global statistics
        var tickets_list = [];
        var hours = 0, totSensing = 0, failedSensingAcq = 0, failedSensingSat = 0, failedSensingOther = 0;
        spaceSegment.datatakesBySatellite[satellite].forEach(function (datatake) {
            if (datatake['l0_sensing_duration']) {
                hours = datatake['l0_sensing_duration'] / 3600000000;
            } else {
                hours = (datatake['observation_time_stop'].getTime() - datatake['observation_time_start'].getTime()) / 3600000;
            }
            totSensing += hours;
            if (datatake['last_attached_ticket'] && datatake['cams_origin']) {
                let compl = spaceSegment.recalcDatatakeAcqCompleteness(datatake) / 100;
                if (datatake['cams_origin'].includes('Acquis')) {
                    failedSensingAcq += hours * (1 - compl);
                } else if (datatake['cams_origin'].includes('CAM') || datatake['cams_origin'].includes('Sat')) {
                    failedSensingSat += hours * (1 - compl);
                } else {
                    failedSensingOther += hours * (1 - compl);
                }
            }
        });
        var totSuccessSensing = totSensing - (failedSensingAcq + failedSensingSat + failedSensingOther);
        var totSuccessSensingPerc = (totSuccessSensing / totSensing) * 100;
        var failedSensingAcqPerc = (failedSensingAcq / totSensing) * 100;
        var failedSensingSatPerc = (failedSensingSat / totSensing) * 100;
        var failedSensingOtherPerc = (failedSensingOther / totSensing) * 100;
        content.message = 'Planned sensing [hours]: ' + totSensing.toFixed(2) + '<br />';
        content.message += 'Successful sensing [hours]: ' + totSuccessSensing.toFixed(2) +
            ' (' + totSuccessSensingPerc.toFixed(2) + '%)<br />';

        // Display satellite events
        content.message += 'Sensing failed due to Satellite issues [hours]: ' +
            failedSensingSat.toFixed(2) + ' (' + failedSensingSatPerc.toFixed(2) + '%)<br />';
        if (failedSensingSat > 0) {
            content.message += 'Events list:<br />';
            content.message += '<ul>';
            for (let key in spaceSegment.categorizedAnomalies[satellite]['sat_events']) {
                let anom = spaceSegment.categorizedAnomalies[satellite]['sat_events'][key];
                content.message += '<li>' + anom['date'] + ': ' + anom['type'] + ' issue. ' + anom['description'] + '</li>';
            }
            content.message += '</ul>';
        }

        // Display Acquisition events
        content.message += 'Sensing failed due to Acquisition issues [hours]: ' +
            failedSensingAcq.toFixed(2) + ' (' + failedSensingAcqPerc.toFixed(2) + '%)<br />';
        if (failedSensingAcq > 0) {
            content.message += 'Events list:<br />';
            content.message += '<ul>';
            for (let key in spaceSegment.categorizedAnomalies[satellite]['acq_events']) {
                let anom = spaceSegment.categorizedAnomalies[satellite]['acq_events'][key];
                content.message += '<li>' + anom['date'] + ': ' + anom['type'] + ' issue. ' + anom['description'] + '</li>';
            }
            content.message += '</ul>';
        }

        // Display other events
        content.message += 'Sensing failed due to Other issues [hours]: ' +
            failedSensingOther.toFixed(2) + ' (' + failedSensingOtherPerc.toFixed(2) + '%)<br />';
        if (failedSensingOther > 0) {
            content.message += 'Events list:<br />';
            content.message += '<ul>';
            for (let key in spaceSegment.categorizedAnomalies[satellite]['other_events']) {
                let anom = spaceSegment.categorizedAnomalies[satellite]['other_events'][key];
                content.message += '<li>' + anom['date'] + ': ' + anom['type'] + ' issue. ' + anom['description'] + '</li>';
            }
            content.message += '</ul>';
        }

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

    refreshDatatakesTables() {
        ['s1a', 's1c', 's2a', 's2b', 's2c', 's3a', 's3b', 's5p'].forEach(function (satellite) {

            // Initialize the existing tables
            var tableId = satellite.toLowerCase() + '-impacted-datatakes-table';
            satellite = satellite.toUpperCase();

            // Build datatakes rows
            var data = spaceSegment.buildDatatakesTableRows(satellite);

            // Update the corresponding table
            if (!spaceSegment.impactedDatatakesTablesBySatellite[satellite]) {
                spaceSegment.initializeDatatakesTable(satellite, tableId);
            }
            if (spaceSegment.impactedDatatakesTablesBySatellite[satellite]) {
                spaceSegment.impactedDatatakesTablesBySatellite[satellite].clear().rows.add(data).draw();
            }
        })
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


    initializeDatatakesTable(satellite, tableId) {
        try {
            console.info('Initialiazing ' + satellite + ' table...');
            this.impactedDatatakesTablesBySatellite[satellite] = $('#' + tableId).DataTable({
                "language": {
                    "emptyTable": "No impacted datatake found"
                },
                columnDefs: [{
                    targets: -1,
                    data: null,
                    render: function (data, type, row) {
                        if (type === 'display') {
                            let actions = '<button type="button" style="color: #8c90a0" class="btn-link" data-toggle="modal" data-target="#showDatatakeDetailsModal" ' +
                                'onclick="spaceSegment.showDatatakeDetails(\'' + data[0] + '\')"><i class="la flaticon-search-1"></i></button>';
                            return actions;
                        } else {
                            return data;
                        }
                    }
                }]
            });
        } catch (err) {
            console.warn(err);
            console.info('Initializing space segment class - skipping table creation.')
        }
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

    showSpaceSegmentOnlineHelp() {

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
    }
}

let spaceSegment = new SpaceSegment();