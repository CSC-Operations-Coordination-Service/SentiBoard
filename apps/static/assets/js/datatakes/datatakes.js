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

class Datatakes {

    // Move date handling to MIXIN (periodSelection)
    constructor(){

        // Data take table
        try {
            this.dataTakeTable = $('#basic-datatables-data-takes').DataTable({
                "language": {
                  "emptyTable": "Retrieving datatakes..."
                },
                columnDefs: [{
                    targets: -1,
                    data: null,
                    render: function (data, type, row) {
                        if (type === 'display') {
                            let actions = '<button type="button" style="color: #8c90a0" class="btn-link" data-toggle="modal" data-target="#showDatatakeDetailsModal" '+
                                'onclick="datatakes.showDatatakeDetails(\'' + data[0] + '\')"><i class="la flaticon-search-1"></i></button>';
                            return actions;
                        } else {
                            return data;
                        }
                    }
                }]
            });
        } catch(err) {
            console.info('Initializing datatakes class - skipping table creation...')
        }

        // Threshold used to state the completeness
        this.completeness_threshold = 90;

        // Threshold used to state the completeness failure
        this.failure_threshold = 10;

        // The status color of labels in the table, given the ACQ or PUB status
        this.status_colors = {
            'PLANNED': '#8c90a0',
            'PROCESSING': '#8c90a0',
            'DELAYED': '#8c90a0',
            'ACQUIRED': '#0aa41b',
            'PUBLISHED' : '#0aa41b',
            'PARTIAL': 'yellow',
            'UNAVAILABLE': 'red',
            '' : 'yellow'
        }

        this.datatakesEventsMap = {};

        this.datatakeRows = [];

        this.sensingTime24H = 0;
    }

    init() {

        // Hide EC and Copernicus logos from header
        $('#copernicus-logo-header').hide();
        $('#ec-logo-header').hide();

        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

        // Retrieve the time select combo box instance
        var time_period_sel = document.getElementById('time-period-select');

        // Apply filtering on page load
        if (this.filterDatatakesOnPageLoad()) {
            time_period_sel.value = 'last-quarter';
            time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));
        } else {
            time_period_sel.value = 'week';
            time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));
        }

        // Retrieve the data takes by mission
        this.loadDatatakesInPeriod(time_period_sel.value);

        return;
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }
        }
    }

    errorLoadAuthorized(response) {
        return;
    }

    loadDatatakesInPeriod(selected_time_period) {

        // Acknowledge the retrieval of events with impact on DTs
        console.info("Invoking events retrieval...");
        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
            this.successLoadAnomalies.bind(this), this.errorLoadAnomalies);

        // Acknowledge the invocation of rest APIs
        console.info("Invoking Datatakes retrieval...");
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
    }

    successLoadAnomalies(response) {

        // Loop over anomalies, and bind every impaired DT with an anomaly
        var rows = format_response(response);
        for (var i = 0 ; i < rows.length ; ++i) {

            // Auxiliary variables
            var anomaly = rows[i];
            var datatakes_completeness = format_response(anomaly["datatakes_completeness"]);
            for (var index = 0; index < datatakes_completeness.length; ++index) {
                try {
                    for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'','\"')))) {
                        var datatake_id = Object.values(value)[0];
                        var completeness = this.calcDatatakeCompleteness(Object.values(value));
                        if (completeness < this.completeness_threshold) {
                            this.datatakesEventsMap[datatake_id] = anomaly;
                        }
                    }
                } catch (ex) {
                    console.warn("Error ", ex);
                    console.warn('An error occurred, while parsing the product level count string: ' +
                        datatakes_completeness[index].replaceAll('\'','\"'));
                }
            }
        }
        return;
    }

    errorLoadAnomalies(response) {
        console.error(response);
    }

    successLoadDatatakes(response){

        // Acknowledge the successful retrieval of S1/S2 data takes
        var rows = format_response(response);
        console.info('Datatakes successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Parse response
        var data = new Array();
        for (var i = 0 ; i < rows.length ; ++i){

            // Auxiliary variables
            var element = rows[i]['_source'];

            // Satellite unit
            // Include the instrument mode in the sat_unit only in case of S1 and S2
            var sat_unit = element['satellite_unit'];
            if (sat_unit.includes('S1') || sat_unit.includes('S2')) {
                sat_unit += ' (' + element['instrument_mode'] + ')';
            }

            // Mission
            var mission = sat_unit.substring(0, 2);

            // Datatake id
            // Just for S1 mission, convert S1A datatakes into hexadecimal numbers
            var key = element['datatake_id'];
            if (sat_unit.includes('S1')) {
                key = this.overrideS1DatatakesId(key);
            }

            // Sensing start and stop time
            var sensing_start = moment(element['observation_time_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            var sensing_stop = moment(element['observation_time_stop'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();

            // Get the completeness status
            var completenessStatus = element['completeness_status'];

            // Push the element row, with the collected information
            // Every row is a datatable row, related to a single datatake
            // Datatake status record:
            // element key, sat unit, sensing start, sensing stop, acq status, levels status
            data.push(this.buildDatatakeRow(key, sat_unit, element['observation_time_start'], element['observation_time_stop'],
                completenessStatus));
        }

        // Store S1/S2 in the member class state vector
        this.datatakeRows = data;

        // Refresh datatakes table
        this.refreshDatatable();
        return;
    }

    errorLoadDatatake(response){
        console.error(response)
        return;
    }

    calcDatatakeCompleteness(dtCompleteness) {
        var completeness = 0;
        var count = 0;
        for (var i = 1; i < dtCompleteness.length; ++i) {
            count++;
            completeness += dtCompleteness[i];
        }
        return (completeness / count);
    }

    overrideS1DatatakesId(datatake_id) {
        let num = datatake_id.substring(4);
        let hexaNum = parseInt(num).toString(16);
        return (datatake_id + ' (' + hexaNum + ')');
    }

    refreshDatatable() {

        // Acknowledge the refresh of data displayed in the Datatakes table
        console.info('Refreshing Datatakes table data...');

        // Rebuild data to be displayed
        var allMissionData = new Array();
        allMissionData.push.apply(allMissionData, this.datatakeRows);

        // Empty the table and reload rows
        if (this.dataTakeTable) {
            this.dataTakeTable.clear().rows.add(allMissionData).draw();
        }
    }

    buildDatatakeRow(key, sat_unit, startime, endtime, completenessStatus) {

        // Auxiliary variables declaration
        var row = new Array();
        var perc = 0;
        var acq_color, acq_status_str;
        var pub_color, pub_status_str;

        // Push basic row fields
        row.push(key);
        row.push(sat_unit);
        row.push(startime);
        row.push(endtime);

        // Push ACQ status and color
        acq_color = this.status_colors[completenessStatus.ACQ.status];
        acq_status_str = completenessStatus.ACQ.status;
        row.push('<span style="color:'+acq_color+'">' + acq_status_str+'</span>');

        // Assess processing and publication status, assuming no difference between the two
        pub_color = this.status_colors[completenessStatus.PUB.status];
        pub_status_str = completenessStatus.PUB.status;
        perc = completenessStatus.PUB.percentage;

        // Append the PUBLICATION status, with the proper color
        // String with percentage commented out
        var publicationStatus = '<span style="color:' + pub_color + '">' + pub_status_str + ' (' + perc.toFixed(1) + '%)' + '</span>';

        // If the datatake is impaired, add an exclamation mark, with a popup linked to
        // the event page
        var datatake_id = key.split('(')[0].trim();
        if (datatakes.datatakesEventsMap[datatake_id] && perc < this.completeness_threshold) {
            let anomaly = datatakes.datatakesEventsMap[datatake_id];
            let date = anomaly['publicationDate'].substring(0, 10);
            publicationStatus +=
                '<a href="/events?showDayEvents=' + date + '"' +
                    '<i style="color: orange; position: relative; top: -10px; left: -15px" class="btn fas fa-exclamation-triangle" ' +
                    'data-toggle="tooltip" data-html="true" title="' + datatakes.buildAnomalyTooltip(anomaly) + '"></i>' +
                '</a>';
        }

        // Append the publication status
        row.push(publicationStatus);

        // Return the row just built
        return row
    }

    buildAnomalyTooltip(anomaly) {
        var category = anomaly['category'] === 'Platform' ? 'Satellite' : anomaly['category'];
        return (category + ' issue, occurred on ' + anomaly['publicationDate'].substring(0, 10) + '. Click to read more.');
    }

    filterDatatakesOnPageLoad() {
        var queryString = window.location.search;
        var urlParams = new URLSearchParams(queryString);
        var searchFilter = urlParams.get('search');
        if (searchFilter) {
            console.info('Accessing page with search filter: ' + searchFilter);
            var filteredData = this.dataTakeTable.search(searchFilter).draw();
            return true;
        } else {
            return false;
        }
    }

    on_timeperiod_change() {
        var time_period_sel = document.getElementById('time-period-select')
        console.log("Time period changed to "+ time_period_sel.value)
        this.loadDatatakesInPeriod(time_period_sel.value);
    }

    showDatatakesOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing datatakes online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Datatakes table';
        content.message = 'The table collects all datatakes in the last 3 months, including those already planned up to 23:59:59 of tomorrow. ' +
            'Besides the acquisition platform and sensor mode, this table shows, for every datatake, the acquisition status and the total ' +
            'publication completeness, expressed in terms of percentage, with a hourly refresh rate. Records can be filtered by using the ' +
            'search bar in the top-right side of the table, or by selecting the time period of interest in the top-right part of the header bar.';
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return ;
    }

    showAcquisitionColumnOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing acquisition column online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Acquisition Status';
        content.message = 'This column reports the status of datatake acquisition from the Ground Station. Possible values are: </br>' +
            '<ul>' +
                '<li>PLANNED: if the datatake is going to be acquired in the future</li>' +
                '<li>PROCESSING: after the contact with the ground station, and the processing of raw data is ongoing</li>' +
                '<li>ACQUIRED: if the datatake was successfully acquired</li>' +
                '<li>PARTIAL: if the datatake was acquired only in part (e.g., in case of ground station or satellite issues)</li>' +
                '<li>UNAVAILABLE: if the datatake was lost during downlink (e.g., in case of a major issue concerning the ground station or the satellite)</li>' +
            '<ul>';
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return ;
    }

    showPublicationColumnOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing publication column online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Publication Status';
        content.message = 'This column reports the publication status of products associated to a datatake, together with their ' +
            'overall completeness. Possible values are: </br>' +
            '<ul>' +
                '<li>PLANNED: if the datatake is going to be processed and published in the future</li>' +
                '<li>PROCESSING: if the datatake processing is ongoing</li>' +
                '<li>DELAYED: if the datatake processing is taking more than the nominal time</li>' +
                '<li>PUBLISHED: if all expected products were successfully published and the average completess exceeds 90%</li>' +
                '<li>PARTIAL: if not all expected products were successfully published, and/or the average completeness is below 90%</li>' +
                '<li>UNAVAILABLE: if no products could be published (e.g., in case of a datatake lost during downlink)</li>' +
            '<ul>';
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return ;
    }

    showDatatakeDetails(datatake_id) {

        // Clean the datatake ID from possible appended attribute (i.e., for S1A)
        datatake_id = datatake_id.split('(')[0].trim();

        // Add spinner during query
        $('#datatake-details').empty();
        $('#datatake-details').html(
            '<div class="spinner">' +
                '<div class="bounce1"></div>' +
                '<div class="bounce2"></div>' +
                '<div class="bounce3"></div>' +
             '</div>');

        // Acknowledge the visualization of the online help
        console.info('Showing detail of datatake: ' + datatake_id);

        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        asyncAjaxCall('/api/worker/cds-datatake/' + datatake_id, 'GET', {}, this.successShowDatatakeDetails, this.errorShowDatatakeDetails);

        return ;
    }

    successShowDatatakeDetails(response) {
        var datatake = format_response(response)[0];
        $('#datatake-details').empty();
        $('#datatake-details').append('<div class="form-group">' +
            '<label>Datatake ID: ' + datatake['key'] + '</label>' +
            '<label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</label>' +
            '<label>Timeliness: ' + datatake['timeliness'] + '</label>' +
        '</div>');
        $('#datatake-details').append('<div class="card">' +
            '<div class="card-body">' +
                '<div class="table-responsive"><div class="table-responsive">' +
                    '<table id="basic-datatables-product-level-completeness" class="display table table-striped table-hover">' +
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
        var dataTakeDetailsTable = $('#basic-datatables-product-level-completeness').DataTable({
            "sDom": "frtp",
            "createdRow": function(row, data, dataIndex) {
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
                dataTakeDetailsTable.row.add([key.replace('_local_percentage',''), datatake[key].toFixed(2)]).draw();
            }
        }
    }

    errorShowDatatakeDetails(response) {
        $('#datatake-details').append(
            '<div class="form-group">' +
                '<label>An error occurred, while retrieving the datatake details</label>' +
            '</div>');
    }

    calcSensingTime24H(){

        // Retrieve the data takes
        datatakes.loadDatatakesInPeriod('day');

        // Perform 3 parallel async ajax calls to retrieve data takes.
        // Once done, return the total sensing time in the last 24 hours, in hours
        (async() => {
            while(
                datatakes.datatakeRows.length == 0)
                await new Promise(resolve => setTimeout(resolve, 50));
            var start, end, sum = 0;
            var now = moment().format();
            var yesterday = moment().subtract(1, 'days').format();

            // Sum sensing times of data take
            for (var i = 0; i < datatakes.datatakeRows.length; ++i) {
                start = moment(datatakes.datatakeRows[i][2],'yyyy-MM-DDTHH:mm:ss.SSSZ');
                end = moment(datatakes.datatakeRows[i][3],'yyyy-MM-DDTHH:mm:ss.SSSZ');
                if (end.isSameOrAfter(yesterday) && start.isSameOrBefore(now)) {
                    sum += moment.duration(end.diff(start)).asHours();
                }
            }

            // Set the value as a class member
            this.sensingTime24H = sum;

        })();
    }
}

let datatakes = new Datatakes();