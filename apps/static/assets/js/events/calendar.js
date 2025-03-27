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

class Calendar {

  constructor() {

    // Acknowledge the instantiation of calendar widget
    console.info('Instantiating calendar widget...');

    // Init class members
    this.events = [];
    this.filteredEvents = [];
    this.anomalies = {};
    this.details = {};
    this.startEventsDate = new Date();
    this.startEventsDate.setUTCHours(0, 0, 0, 0);

    // Init popup flags
    this.noEventsBeforeDateMsgDisplayed = false;
  }

  init(){

    // Hide the drop-down menu to select the time range
    $('#time-period-select-container').hide();

    // Retrieve the user profile. In case of "ecuser" role, allow
    // the visualization of events up to the beginning of the previous quarter
    ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

    return;
  }

  quarterAuthorizedProcess(response) {
    if (response['authorized'] === true) {
        calendar.loadEventsECUser();
    } else {
        calendar.loadEventsGuestUser();
    }
  }

  errorLoadAuthorized(response) {
    return;
  }

  loadEventsECUser() {

    // EC Users are allowed to access events (anomalies) up to the
    // beginning of the previous quarter
    console.info('Loading events up to the previous quarter...');
    var quarter = getPreviousQuarter(calendar.startEventsDate);
    calendar.startEventsDate.setYear(quarter['year']);
    calendar.startEventsDate.setMonth((quarter['quarter'] * 3 - 3), 1);
    asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
        calendar.succesLoadAnomalies, calendar.errorLoadAnomalies);
  }

  loadEventsGuestUser() {

    // Guest Users are allowed to access events (anomalies) up to 3
    // months before the current date
    console.info('Loading events in the last quarter...');
    calendar.startEventsDate.setMonth(calendar.startEventsDate.getMonth() - 3);
    asyncAjaxCall('/api/events/anomalies/last-quarter', 'GET', {},
        calendar.succesLoadAnomalies, calendar.errorLoadAnomalies);
  }

  succesLoadAnomalies(response){

    // Format the response from the query
    var rows = format_response(response);
    console.info('Events loaded. Num of events: ' + rows.length);

    // Array of impacted datatakes
    var datatakeList = new Array();

    // Loop over the returned anomalies and build the events array
    // and the details dictionary
    for (var i = 0 ; i < rows.length ; ++i) {

        // Auxiliary variable
        var anomaly = rows[i];

        // Check if an anomaly with the same impacted datatake is already displayed. If so,
        // skip the new anomaly
        if (datatakeList.indexOf(anomaly['environment']) > -1) {
            continue ;
        } else {
            datatakeList.push(anomaly['environment']);
        }

        // Append the calendar event instance only if the event has an impact on datatakes (not fully recovered)
        var instance = calendar.buildEventInstanceFromAnomaly(anomaly);
        if (!instance.fullRecover) {

            // Store the anomalies in the class member
            calendar.anomalies[anomaly['key']] = anomaly;

            // Append the event instance
            calendar.events.push(instance);

            // Append event details in the details panel
            calendar.details['day-' + anomaly['key']] = calendar.buildDetailsPanelContentFromAnomaly(anomaly);
        }
    }

    // Instantiate calendar widget
    calendar.calendarInstance = new calendarJs( "myCalendar", {
        autoRefreshTimerDelay: 0,
        maximumEventsPerDayDisplay: 1,
        dragAndDropForEventsEnabled: false,
        exportEventsEnabled: false,
        manualEditingEnabled: false,
        fullScreenModeEnabled: false,
        eventNotificationsEnabled: false,
        useOnlyDotEventsForMainDisplay: false,
        showExtraToolbarButtons: false,
        showHolidays: false,
        tooltipsEnabled: false
    });

    // Initialize the filteredEvents list, considering all
    // records from DB
    Array.prototype.push.apply(calendar.filteredEvents, calendar.events);

    // Set the events
    calendar.calendarInstance.addEvents(calendar.filteredEvents);

    // Override the original behaviour of calendar
    calendar.overrideCalendarBehaviour();

    // Override the original behaviour of calendar also when users
    // changes the month / year
    $('.ib-arrow-left-full').on('click', function(event) {
        calendar.overrideCalendarBehaviour();
        calendar.checkNoEventsBeforeDateMsgDisplay();
    });
    $('.ib-arrow-right-full').on('click', function(event) {
        calendar.overrideCalendarBehaviour();
        calendar.checkNoEventsBeforeDateMsgDisplay();
    });

    // Check the presence of the showDayEvents flag. In case,
    // display automatically the details of the last event
    calendar.showDayEventsOnPageLoad();

    return;
  }

  errorLoadAnomalies(response){
    return;
  }

  buildEventInstanceFromAnomaly(anomaly) {

    // Build the event instance from the anomaly.
    var start_time = moment(anomaly['start'], 'DD/MM/YYYY HH:mm:ss').toDate();
    var end_time = moment(anomaly['end'], 'DD/MM/YYYY HH:mm:ss').toDate();

    // Generate a simplified, custom description for the reported anomaly
    // Choose color code based on platform
    var title = "Event(s)";
    var item = "";
    var description = "";
    var color = "blue";
    var recovered = false;

    // Append impacted item
    item += anomaly["impactedSatellite"];
    description += "Impacted Satellite: " + item + '. ';

    // Choose an appropriate description
    if (anomaly["category"] === "Platform") {
        // title = "Satellite";
        description += 'Issue type: Satellite / Instrument. ';
    } else if (anomaly["category"] === "Acquisition") {
        // title = "Acquisition";
        description += 'Issue type: Acquisition. ';
    } else if (anomaly["category"] === "Production") {
        // title = "Production";
        description += 'Issue type: Production. ';
    } else if (anomaly["category"] === "Data access") {
        // title = "Data Access"
        description += 'Issue type: Data Access. ';
    } else if (anomaly["category"] === "Calibration") {
        // title = "Calibration"
        description += 'Issue type: Calibration ';
    } else if (anomaly["category"] === "Manoeuvre") {
        // title = "Manoeuvre"
        description += 'Issue type: Manoeuvre ';
    } else ;

    // Override the end date in the Calendar view only
    end_time.setTime(start_time.getTime() + 1);

    // Analyze the impact on production, anc choose the proper colour. If all products associated to
    // data takes where restored, display the anomaly in green; otherwise, use default orange color.
    color = "#273295";
    var threshold = 90;
    var datatakes_completeness = format_response(anomaly['datatakes_completeness']);
    var completeness = 0;
    var allRecovered = true;
    for (var index = 0; index < datatakes_completeness.length; ++index) {
        try {
            for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'','\"')))) {
                var objValues = Object.values(value);
                completeness = calendar.calcDatatakeCompleteness(objValues);
                if (completeness < threshold) {
                    allRecovered = false;
                }
            }
        } catch (ex) {
            console.warn('An error occurred, while parsing the product level count string');
            console.warn("Error ", ex);
            console.warn(anomaly);
        }
    }

    // Set the anomaly to green if and only if all impacted datatakes have been recovered
    if (allRecovered) {
        color = "#31ce36";
        recovered = true;
        // console.info('Recovered anomaly: ' + anomaly['key']);
    }

    // Return the event instance
    return {
        id: anomaly['key'],
        from: start_time,
        to: end_time,
        title: title,
        group: title,
        description: description,
        color: color,
        colorText: "white",
        colorBorder: "white",
        fullRecover: recovered
    };
  }

  buildDetailsPanelContentFromAnomaly(anomaly) {

    // Build content to be displayed in the details panel
    var title = "";
    var category = anomaly["category"] == 'Platform' ? 'Satellite' : anomaly["category"];
    var item = anomaly["impactedSatellite"];

    // Until a full parsing of anomaly text is implemented, the start time is based
    // on the publication date, and the end time is set as 1 hour later
    var start_time = moment(anomaly['start'], 'DD/MM/YYYY HH:mm:ss').toDate();

    // Every impacted datatake shall be linked to the Datatake table
    var detailsContent =
        '<div>' +
            '<p style="color: white; font-size: 14px">Occurrence date:  ' +
                '<span style="font-weight: bold">' + start_time + '</span></p>' +
            '<p></p>' +
            '<p style="color: white; font-size: 14px">Impacted satellite:  ' +
                '<span style="font-weight: bold">' + item + '</span></p>' +
            '<p></p>' +
            '<p style="color: white; font-size: 14px">Issue type:  ' +
                '<span style="font-weight: bold">' + category + '</span></p>' +
            '<p></p>';

    // Append the list of impacted data takes
    if (anomaly["environment"]) {
        detailsContent += '<p style="color: white; font-size: 14px">List of impacted datatakes:  </br><ul>';
        var dts = anomaly["environment"].split(";");
        dts.forEach(function(value, index, array) {
            if (value) {
                var dtStatus = calendar.calcDatatakeStatus(anomaly, value);
                let hexaVal = value;
                if (value.includes('S1')) {
                    hexaVal = calendar.overrideS1DatatakesId(value)
                }
                detailsContent +=
                    '<li>' +
                        '<div style="display: flex">' +
                            '<a href="/data-takes.html?search=' + value + '" target="_blank">' + hexaVal + '</a>' +
                            '<div class="status-circle-dt-' + dtStatus + '"></div>' +
                        '</di>' +
                    '</li>';
            }
             if (index > 10) {
                detailsContent +=
                    '<li>' +
                        '<div style="display: flex">... (' + (dts.length - index).toString() + ' more)</div>' +
                    '</li>';
                dts.length = index;
            }
        });
        detailsContent += '</ul></p><p></p></div>';
    } else {
        detailsContent += '</div>';
    }

    // Append the link to the related news on Sentinel Online
    if (anomaly['newsLink']) {
        detailsContent += '<div><p style="color: white">Read more details on Sentinel Online:<br /><a href="' +
            anomaly["newsLink"] + '" target="_blank">' + anomaly["newsTitle"] + '</a></p></div>';
    }

    // Return the HTML displayed in the details panel
    return detailsContent;
  }

  overrideS1DatatakesId(datatake_id) {
    let num = datatake_id.trim().substring(4);
    let hexaNum = parseInt(num).toString(16);
    return (datatake_id + ' (' + hexaNum + ')');
  }

  calcDatatakeStatus(anomaly, datatake_id) {

    // Return one possible value in range: "ok", "partial", "failed", "undef"
    let datatakes_completeness = format_response(anomaly["datatakes_completeness"]);
    var completeness = 0;
    for (var index = 0; index < datatakes_completeness.length; ++index) {
        try {
            for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'','\"')))) {
                var objValues = Object.values(value);
                if (objValues[0] == datatake_id) {
                    completeness = calendar.calcDatatakeCompleteness(objValues);
                    if (completeness >= 90) {
                        return 'ok';
                    } else if (completeness >= 10 && completeness < 90) {
                        return 'partial';
                    } else if (completeness < 10) {
                        return 'failed';
                    } else {
                        return 'undef';
                    }
                }
            }
        } catch (ex) {
            console.warn("Error ", ex);
            console.warn('An error occurred, while parsing the product level count string: ' +
                datatakes_completeness[index].replaceAll('\'','\"'));
        }
    }

    // If the datatake cannot be found, assume that the status is "undef"
    return 'undef';
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

  overrideCalendarBehaviour() {

    // Programmatically hide objects with class "plus-x-events", to disable their
    // original behavior; instead, display an icon permitting to show the events
    // of the day
    $('.calendar-details').remove();
    $('.calendar-plus-x-events').remove();
    $('.plus-x-events').each(function() {
        var dayID = $(this).parent().attr("id");
        var numEvents = $(this).attr('events');
        $(this).replaceWith('');
            // '<p class="calendar-plus-x-events" onclick="calendar.showDayEvents(\'' + dayID + '\')">' +
                // '<a href=\'#\' style="color: white"> + ' + numEvents + ' events</a></p>');
    });

    // Hide the default expand-day button
    $('.ib-arrow-expand-left-right-icon').each(function() {
        $(this).replaceWith('');
    });

    // On click, display the event details in the relevant panel
    $('body').on('click', '.event', function(event) {
        console.info('Clicked event: ' + event.target.id);
        // $('.timeline-event-details').html(calendar.details[event.target.id]);
        calendar.showDayEvents($(this).parent().attr("id"));
    });
  }

  showDayEvents(dayID) {

    // Retrieve the first anomaly of the selected day, picking the 2nd or the 3rd
    // child. By default, the child of interest is the 2nd one; however, in the
    // last day of month, when the month label is present, the correct child element
    // is the 3rd one.
    var id = $('#' + dayID).children().eq(2).attr('id');
    if (typeof id !== 'undefined' && id !== false) {
        id = id.replace("day-","");
    } else {
        id = $('#' + dayID).children().eq(3).attr('id').replace("day-","");
    }

    // Manage anomalies
    let event = calendar.anomalies[id];
    let eventDate = event['start'];

    // Retrieve the selected day
    var sel_day = moment(eventDate, 'DD/MM/YYYY HH:mm:ss').toDate();
    console.info('Expand selected day: ' + moment(sel_day).format('DD/MM/YYYY'));

    // Loop over the anomalies, and display details of all the anomalies falling in the selected day
    $('.timeline-event-details').html('');
    for (const [key, anomaly] of Object.entries(calendar.anomalies)) {
        var start = moment(anomaly['start'], 'DD/MM/YYYY HH:mm:ss').toDate();
        if (sel_day.getFullYear() === start.getFullYear() && sel_day.getMonth() === start.getMonth() &&
                sel_day.getDate() === start.getDate()) {
            console.info('Appending anomaly details: ' + key);
            $('.timeline-event-details').append(calendar.details['day-' + key] +
                '</br><hr class="solid" style="background-color: grey">');
        }
    }
  }

  filterEvents(filter) {

    // If the filter is not empty, loop over the anomalies, and display the
    // anomalies matching the filter
    if (filter) {

        // Clear the array hosting the filtered anomalies
        calendar.filteredEvents.length = 0;

        // Iterate over the anomalies, and add only those matching the pattern
        for (var i = 0; i < calendar.events.length; ++i) {
            var anomaly = calendar.events[i];
            if (anomaly['description'].toUpperCase().includes(filter.toUpperCase())) {
                calendar.filteredEvents.push(anomaly);
            }
        }

    } else {

        // If the filter is empty, restore the whole set of anomalies
        Array.prototype.push.apply(calendar.filteredEvents, calendar.events);
    }

    // Set the events
    calendar.calendarInstance.setEvents(calendar.filteredEvents);

    // Override the original behaviour of calendar
    calendar.overrideCalendarBehaviour();
  }

  showDayEventsOnPageLoad() {
    var queryString = window.location.search;
    var urlParams = new URLSearchParams(queryString);
    var showDayEvents = urlParams.get('showDayEvents');
    if (showDayEvents) {
        console.info('Showing day events on: ' + showDayEvents);
        $('.timeline-event-details').html('');
        for (const [key, anomaly] of Object.entries(calendar.anomalies)) {
            const publicationDate = anomaly['publicationDate'];
            if (publicationDate.includes(showDayEvents)) {

                // Retrieve year and month
                var parts = showDayEvents.split('/');
                var currDate = new Date(parts[2], parts[1] - 1, parts[0]);
                calendar.calendarInstance.setCurrentDisplayDate(currDate);

                // Set the content of the panel details
                $('.timeline-event-details').append(calendar.details['day-' + anomaly['key']] +
                '</br><hr class="solid" style="background-color: grey">');
            }
        }
    }

    // Override the original behaviour of calendar
    calendar.overrideCalendarBehaviour();
  }

  checkNoEventsBeforeDateMsgDisplay() {
    if (!calendar.noEventsBeforeDateMsgDisplayed) {
        var date = calendar.calendarInstance.getCurrentDisplayDate().setDate(1);
        if (date < calendar.startEventsDate) {
            var content = {};
            content.title = 'Dashobard Events Viewer';
            content.message = 'This view is intended to show only the most recent events. ' +
                'No events are displayed, before ' + calendar.startEventsDate;
            content.icon = 'fa fa-calendar';
            var state = 'info';
            var placementFrom = 'top';
            var placementAlign = 'center';
            $.notify(content,{
				type: state,
				placement: {
					from: placementFrom,
					align: placementAlign
				},
				time: 1000,
				delay: 0,
			});
            calendar.noEventsBeforeDateMsgDisplayed = true;
        }
    }
  }

  showEventsOnlineHelp() {

    // Acknowledge the visualization of the online help
    console.info('Showing events online help message...');

    // Auxiliary variable declaration
    var from = 'top';
    var align = 'center';
    var state = 'info';
    var content = {};
    content.title = 'Events view';
    content.message = 'This view shows the events occurred on a given date and the possible impact on user products completeness. ' +
        'Events are categorized according to the following issue types:<br>' +
        ' - Satellite: issue due to instrument unavailability<br>' +
        ' - Calibration: issue occurred during sensor calibration<br>' +
        ' - Manoeuvre: issue occurred during the execution of a manoeuvre<br>' +
        ' - Acquisition: issue occurring during the reception of the data at the ground station<br>' +
        ' - Production: issue occurred during data processing<br>' +
        'By clicking on each occurrence, the list of possibly impacted datatakes considering their sensing times is ' +
        'displayed in the right-side panel, together with further event details.';
    content.icon = 'flaticon-round';

    // Display notification message
    msgNotification(from, align, state, content);

    return ;
  }

  showCalendarSwitchOnlineHelp() {

    // Acknowledge the visualization of the online help
    console.info('Showing calendar switch online help message...');

    // Auxiliary variable declaration
    var from = 'top';
    var align = 'center';
    var state = 'info';
    var content = {};
    content.title = 'Calendar switch';
    content.message = 'Select the "Calendar" view, to display events arranged on a monthly calendar. By selecting the "Timeline" view, ' +
        'events will be displayed on a dynamic Gantt chart.';
    content.icon = 'flaticon-round';

    // Display notification message
    msgNotification(from, align, state, content);

    return ;
  }

}

let calendar = new Calendar();