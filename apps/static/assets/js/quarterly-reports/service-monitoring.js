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

class ServiceMonitoring {

    constructor() {

        // Start - stop time range
        this.end_date = new Date();
        this.end_date.setUTCHours(23, 59, 59, 0);
        this.start_date = new Date();
        this.start_date.setMonth(this.end_date.getMonth() - 3);
        this.start_date.setUTCHours(0, 0, 0, 0);

        // Set of colors associated to service
        this.serviceColorMap = {
            'DAS': 'info',
            'DHUS': 'warning',
            'ACRI': 'primary',
            'CLOUDFERRO': 'secondary',
            'EXPRIVIA': 'success',
            'WERUM': 'warning'
        };

        // Minimum completeness value for datatakes (percentage)
        this.interfaceStatusMap = {
            'DAS': [],
            'DHUS': [],
            'ACRI': [],
            'CLOUDFERRO': [],
            'EXPRIVIA': [],
            'WERUM': []
        };
    }

    init() {

        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

        //  Register event callback for Time period select
        var time_period_sel = document.getElementById('time-period-select');
        time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));

        // Retrieve the monitoring interfaces
        this.updateDateInterval('prev-quarter');

        // Clean class variable
        this.interfaceStatusMap = {'DAS': [], 'DHUS': [], 'ACRI': [], 'CLOUDFERRO': [], 'EXPRIVIA': [], 'WERUM': []};

        // Retrieve the failed monitoring interfaces
        this.loadDASMonitoringInterfaceInPeriod('prev-quarter');
        // this.loadDHUSMonitoringInterfaceInPeriod('prev-quarter');
        this.loadAcriMonitoringInterfaceInPeriod('prev-quarter');
        this.loadCloudFerroMonitoringInterfaceInPeriod('prev-quarter');
        this.loadExpriviaMonitoringInterfaceInPeriod('prev-quarter');
        this.loadWerumMonitoringInterfaceInPeriod('prev-quarter');

        return;
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length == 4) {
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
        var time_period_sel = document.getElementById('time-period-select')
        var selected_time_period = time_period_sel.value
        console.log("Time period changed to "+ selected_time_period)
        this.updateDateInterval(selected_time_period)

        // Clean class variable
        this.interfaceStatusMap = {'DAS': [], 'DHUS': [], 'ACRI': [], 'CLOUDFERRO': [], 'EXPRIVIA': [], 'WERUM': []};

        // Retrieve the failed monitoring interfaces
        this.loadDASMonitoringInterfaceInPeriod(selected_time_period);
        // this.loadDHUSMonitoringInterfaceInPeriod(selected_time_period);
        this.loadAcriMonitoringInterfaceInPeriod(selected_time_period);
        this.loadCloudFerroMonitoringInterfaceInPeriod(selected_time_period);
        this.loadExpriviaMonitoringInterfaceInPeriod(selected_time_period);
        this.loadWerumMonitoringInterfaceInPeriod(selected_time_period);
    }

    updateDateInterval(period_type) {

        // Update start date depending on value of period type
        // one of: day, week, month, quarter
        // take delta to be applied from configuration
        console.info('Updating time interval: ' + period_type);
        let dates = new ObservationTimePeriod().getIntervalDates(period_type);
        this.start_date = dates[0];
        this.end_date = dates[1];
        return;
    }

    loadDASMonitoringInterfaceInPeriod(selected_time_period) {
        this.loadMonitoringInterfaceInPeriod(selected_time_period, 'DD_DAS');
    }

    loadDHUSMonitoringInterfaceInPeriod(selected_time_period) {
        this.loadMonitoringInterfaceInPeriod(selected_time_period, 'DD_DHUS');
    }

    loadAcriMonitoringInterfaceInPeriod(selected_time_period) {
        this.loadMonitoringInterfaceInPeriod(selected_time_period, 'LTA_Acri');
    }

    loadCloudFerroMonitoringInterfaceInPeriod(selected_time_period) {
        this.loadMonitoringInterfaceInPeriod(selected_time_period, 'LTA_CloudFerro');
    }

    loadExpriviaMonitoringInterfaceInPeriod(selected_time_period) {
        this.loadMonitoringInterfaceInPeriod(selected_time_period, 'LTA_Exprivia');
    }

    loadWerumMonitoringInterfaceInPeriod(selected_time_period) {
        this.loadMonitoringInterfaceInPeriod(selected_time_period, 'LTA_Werum');
    }

    loadMonitoringInterfaceInPeriod(selected_time_period, service_name) {

        // Acknowledge the invocation of rest APIs
        console.info("Retrieving status monitoring for: " + service_name);

        // Execute asynchronous AJAX call
        if (selected_time_period === 'day') {
            asyncAjaxCall('/api/reporting/cds-interface-status-monitoring/last-24h/' + service_name, 'GET', {},
                this.successLoadInterfaceStatus.bind(this), this.errorLoadInterfaceStatus);
        } else if (selected_time_period === 'week') {
            asyncAjaxCall('/api/reporting/cds-interface-status-monitoring/last-7d/' + service_name, 'GET', {},
                this.successLoadInterfaceStatus.bind(this), this.errorLoadInterfaceStatus);
        } else if (selected_time_period === 'month') {
            asyncAjaxCall('/api/reporting/cds-interface-status-monitoring/last-30d/' + service_name, 'GET', {},
                this.successLoadInterfaceStatus.bind(this), this.errorLoadInterfaceStatus);
        } else if (selected_time_period === 'prev-quarter') {
            asyncAjaxCall('/api/reporting/cds-interface-status-monitoring/previous-quarter/' + service_name, 'GET', {},
                this.successLoadInterfaceStatus.bind(this), this.errorLoadInterfaceStatus);
        } else {
            asyncAjaxCall('/api/reporting/cds-interface-status-monitoring/last-quarter/' + service_name, 'GET', {},
                this.successLoadInterfaceStatus.bind(this), this.errorLoadInterfaceStatus);
        }
        return;
    }

    successLoadInterfaceStatus(response){

        // Acknowledge the successful retrieval of monitoring interfaces
        var rows = format_response(response);
        console.info('List of failed monitoring interfaces successfully retrieved');

        // Parse response
        for (var i = 0 ; i < rows.length ; ++i) {

            // Auxiliary variables
            var element = rows[i]['_source'];

            // Parse the failed monitoring interface
            var status = {};
            var start = moment(element['status_time_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            status['start'] = start;
            var stop = moment(element['status_time_stop'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            status['stop'] = stop;

            // Status duration
            if (!element['status_duration']) {
                status['duration'] = 0; // By default, set an average duration of 0h
            } else {
                status['duration'] = element['status_duration'];
            }

            // Store the failed monitoring interfaces in a dedicated class member
            if (element['interface_name'] === 'DD_DAS') {
                this.interfaceStatusMap['DAS'].push(status);
            } else if (element['interface_name'] === 'DD_DHUS') {
                this.interfaceStatusMap['DHUS'].push(status);
            } else if (element['interface_name'] === 'LTA_Acri') {
                this.interfaceStatusMap['ACRI'].push(status);
            } else if (element['interface_name'] === 'LTA_CloudFerro') {
                this.interfaceStatusMap['CLOUDFERRO'].push(status);
            } else if (element['interface_name'] === 'LTA_Exprivia') {
                this.interfaceStatusMap['EXPRIVIA'].push(status);
            } else if (element['interface_name'] === 'LTA_Werum') {
                this.interfaceStatusMap['WERUM'].push(status);
            } else {
                console.warning('Invalid service name: ' + element['interface_name']);
            }
        }

        // Refresh impacted item status
        this.refreshAvailabilityStatus();
        return;
    }

    errorLoadInterfaceStatus(response){
        console.error(response)
        return;
    }

    refreshAvailabilityStatus() {
        var periodDurationSec = (this.end_date.getTime() - this.start_date.getTime()) / 1000;
        Object.keys(this.interfaceStatusMap).forEach(function(key) {
            var serviceUnavDurationSec = 0, serviceAvailabityPerc = 0;
            serviceMonitoring.interfaceStatusMap[key].forEach(function(item) {
                serviceUnavDurationSec += (item['stop'].getTime() - item['start'].getTime()) / 1000;
            });
            serviceAvailabityPerc = (1 - serviceUnavDurationSec / periodDurationSec) * 100;
            var id_interface_perc = key.toLowerCase() + '-interface-avail-perc';
            var id_perc = key.toLowerCase() + '-avail-perc';
            var id_bar = key.toLowerCase() + '-avail-bar';
            $('#' + id_interface_perc).text(serviceAvailabityPerc.toFixed(2) + '%');
            $('#' + id_perc).text(serviceAvailabityPerc.toFixed(2) + '%');
            $('#' + id_bar).css({"width": serviceAvailabityPerc.toFixed(2) + '%'});
        })
    }

    showDASUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('DAS');
    }

    showDHUSUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('DHUS');
    }

    showAcriUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('ACRI');
    }

    showCloudFerroUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('CLOUDFERRO');
    }

    showExpriviaUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('EXPRIVIA');
    }

    showWerumUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('WERUM');
    }

    showUnavailabilityEvents(service_name) {

        // Build the message to be displayed
        var content = {};
        content.title = service_name + ' Unavailability events';

        // Sort array
        serviceMonitoring.interfaceStatusMap[service_name].sort(function(a, b) {
            return b['start'].getTime() - a['start'].getTime();
        });

        // Collect unavailabilities
        content.message = '<ul>';
        if (serviceMonitoring.interfaceStatusMap[service_name].length > 0) {
            content.message = '<ul>';
            serviceMonitoring.interfaceStatusMap[service_name].forEach(function(item) {
                content.message += '<li>Unavailability start: ' + formatUTCDateHour(item['start']) + '; duration [min]: '
                        + ((item['stop'].getTime() - item['start'].getTime()) / 60000).toFixed(2) + '</li>';
            });
        } else {
            content.message += '<li>No events reported</li>';
        }
        content.message += '</ul>';

        // Add other popup properties
        content.icon = 'fa fa-bell';
        content.url = '';
        content.target = '_blank';

        // Message visualization
        var placementFrom = "top";
        var placementAlign = "right";
        var state = serviceMonitoring.serviceColorMap[service_name];
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
}

let serviceMonitoring = new ServiceMonitoring();