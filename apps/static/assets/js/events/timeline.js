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

class Timeline {

  constructor() {

    // Acknowledge the instantiation of calendar widget
    console.info('Instantiating timeline widget...');

    // Init class members
    this.groups = new vis.DataSet([
        { id: 1, content: 'Satellite Operations' },
        { id: 2, content: 'Ground Operations' },
        // { id: 2, content: 'Acquisition' },
        // { id: 3, content: 'Production' },
        // { id: 4, content: 'Data&nbsp;Access' },
        // { id: 5, content: 'Archive' }
    ]);

    this.events = new vis.DataSet();
    this.filteredEvents = new vis.DataSet();
    this.anomalies = {};
    this.details = {};
    this.startEventsDate = new Date();
    this.startEventsDate.setUTCHours(0, 0, 0, 0);
    this.endEventsDate = new Date();
    this.endEventsDate.setUTCHours(23, 59, 59, 0);
  }

  init() {

    // Hide the drop-down menu to select the time range
    $('#time-period-select-container').hide();

    // Retrieve the user profile. In case of "ecuser" role, allow
    // the visualization of events up to the beginning of the previous quarter
    ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

    return;
  }

  quarterAuthorizedProcess(response) {
    if (response['authorized'] === true) {
        timeline.loadEventsECUser();
    } else {
        timeline.loadEventsGuestUser();
    }
  }

  errorLoadAuthorized(response) {
    return;
  }

  loadEventsECUser() {

    // EC Users are allowed to access events / anomalies up to the
    // beginning of the previous quarter
    console.info('Loading events up to the previous quarter...');
    asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
            timeline.succesLoadAnomalies, timeline.errorLoadAnomalies);
  }

  loadEventsGuestUser() {

    // Guest Users are allowed to access events / anomalies up to 3
    // months before the current date
    console.info('Loading events in the last quarter...');
    asyncAjaxCall('/api/events/anomalies/last-quarter', 'GET', {},
            timeline.succesLoadAnomalies, timeline.errorLoadAnomalies);
  }

  succesLoadAnomalies(response){

    // Format the response from the query
    var rows = format_response(response);
    console.info('Anomalies loaded. Num of events: ' + rows.length);

    // Array of impacted datatakes
    var datatakeList = new Array();

    // Define the events
    for(var i = 0 ; i < rows.length ; ++i){

        // Auxiliary variable
        var anomaly = rows[i];

        // Check if an anomaly with the same impacted datatake is already displayed. If so,
        // skip the new anomaly
        if (datatakeList.indexOf(anomaly['environment']) > -1) {
            continue ;
        } else {
            datatakeList.push(anomaly['environment']);
        }

        // Append the event to the Timeline only if the event has an impact on datatakes (not fully recovered)
        var instance = timeline.buildEventInstanceFromAnomaly(anomaly);
        if (!instance.fullRecover) {

            // Store the anomaly in the class member
            timeline.anomalies[anomaly['key']] = anomaly;

            // Append the event instance
            timeline.events.add(instance);

            // Append event details in the details panel
            timeline.details[anomaly['key']] = timeline.buildDetailsPanelContentFromAnomaly(anomaly);
        }
    }

    // Set the time range of the Timeline
    var minDate = new Date('2022-08-01');
    var maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);

    var options = {
        stack: false,
        min: minDate,
        max: maxDate,
        zoomMin: 1000 * 60 * 60, // one week in milliseconds
        editable: false,
        margin: {
            item: 10, // minimal margin between items
            axis: 5 // minimal margin between items and the axis
        },
        orientation: 'top'
    };

    // Build the timeline
    if (!timeline.timelineInstance) {
        let container = document.getElementById('myTimeline');
        timeline.timelineInstance = new vis.Timeline(container, null, options);
        timeline.timelineInstance.setGroups(timeline.groups);
    }
    timeline.timelineInstance.setItems(timeline.events);

    // Set the displayed time range around the current date
    var beg_date = new Date();
    var beg_date_ms = beg_date.getTime() - 5 * 24 * 60 * 60 * 1000;
    var end_date = new Date();
    var end_date_ms = end_date.getTime() + 24 * 60 * 60 * 1000;
    timeline.timelineInstance.setWindow(beg_date_ms, end_date_ms);

    // Display the details panel on event click
    timeline.timelineInstance.on('click', function (properties) {
        if (properties.item) {
            console.info('Clicked event: ' + properties.item);
            $('.timeline-event-details').html(timeline.details[(properties.item)]);
        }
    });

    // Check the presence of the showDayEvents flag. In case,
    // display automatically the details of the last event
    timeline.showDayEventsOnPageLoad();

    return;
  }

  errorLoadAnomalies(response){
    return;
  }

  buildEventInstanceFromAnomaly(anomaly) {

    // Build the event instance from the anomaly.
    // Until a full parsing of anomaly text is implemented, the start time is based
    // on the publication date, and the end time is set as 1 hour later
    var start_time = moment(anomaly['start'], 'DD/MM/YYYY HH:mm:ss').toDate();
    var end_time = moment(anomaly['end'], 'DD/MM/YYYY HH:mm:ss').toDate();

    // Create a new event to add in the Timeline
    // Modify the end date, based on the issue type
    var title;
    var cssClass;
    var category_id;
    var category = anomaly["category"];
    if (category == 'Platform'){
        title = 'Satellite';
        category_id = 1;
        cssClass = 'production';
        end_time.setTime(start_time.getTime() + 3 * 60 * 60 * 1000);
    } else if(category == 'Acquisition'){
        title = 'Acquisition';
        category_id = 2;
        cssClass = 'production';
        end_time.setTime(start_time.getTime() + 15 * 60 * 1000);
    } else if(category == 'Production'){
        title = 'Production';
        // category_id = 3;
        category_id = 2;
        cssClass = 'production';
        end_time.setTime(start_time.getTime() + 120 * 60 * 1000);
    } else{
        title = 'Data Access';
        // category_id = 4;
        category_id = 2;
        cssClass = 'production';
        end_time.setTime(start_time.getTime() + 3 * 60 * 60 * 1000);
    }

    // Analyze the impact on production, anc choose the proper colour. If all products associated to
    // data takes where restored, display the anomaly in green; otherwise, use default orange color.
    var threshold = 90;
    var datatakes_completeness = format_response(anomaly['datatakes_completeness']);
    var completeness = 0;
    var allRecovered = true;
    for (var index = 0; index < datatakes_completeness.length; ++index) {
        try {
            for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'','\"')))) {
                var objValues = Object.values(value);
                completeness = timeline.calcDatatakeCompleteness(objValues);
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

    // Return the event instance
    return {
      id: anomaly['key'],
      group: category_id,
      start: start_time,
      end: end_time,
      className: cssClass,
      fullRecover: allRecovered
      // content: picture,
      // type: 'box'
    }
  }

  buildDetailsPanelContentFromAnomaly(anomaly) {

    // Build content to be displayed in the details panel
    var title = "";
    var category = anomaly["category"] == 'Platform' ? 'Satellite' : anomaly["category"];
    var item = anomaly["impactedSatellite"];

    // Until a full parsing of anomaly text is implemented, the start time is based
    // on the publication date, and the end time is set as 1 hour later
    var start_time = moment(anomaly['start'], 'DD/MM/YYYY HH:mm:ss').toDate();

    // Choose an appropriate picture
    var picture;
    if(category == 'Platform'){
        title = "Satellite / Instrument";
        if (item == 'Copernicus Sentinel-1A') {
            picture = '<img src="/static/assets/img/s-1a_warning.png" style="width: 36px; height: 36px;">';
        } else if (item == 'Copernicus Sentinel-2A' || item == 'Copernicus Sentinel-2B') {
            picture = '<img src="/static/assets/img/s-2a_warning.png" style="width: 36px; height: 36px;">';
        }  else if (item == 'Copernicus Sentinel-3A' || item == 'Copernicus Sentinel-3B') {
            picture = '<img src="/static/assets/img/s-3a_warning.png" style="width: 36px; height: 36px;">';
        }  else if (item == 'Copernicus Sentinel-5p') {
            picture = '<img src="/static/assets/img/s5p_warning.png" style="width: 36px; height: 36px;">';
        } else {
            picture = '<img src="/static/assets/img/maintenance.png" style="width: 36px; height: 36px;">';
        }
    } else if (category == 'Acquisition'){
        title = "Acquisition";
        picture = '<img src="/static/assets/img/maintenance.png" style="width: 36px; height: 36px;">';
    } else if (category == 'Production'){
        title = "Production";
        picture = '<img src="/static/assets/img/maintenance.png" style="width: 36px; height: 36px;">';
    } else if (category == 'Data access'){
        title = "Data Access";
        picture = '<img src="/static/assets/img/maintenance.png" style="width: 36px; height: 36px;">';
    } else {
        title = "Archive";
        picture = '<img src="/static/assets/img/maintenance.png" style="width: 36px; height: 36px;">';
    }

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
                var dtStatus = timeline.calcDatatakeStatus(anomaly, value);
                let hexaVal = value;
                if (value.includes('S1')) {
                    hexaVal = timeline.overrideS1DatatakesId(value)
                }
                detailsContent +=
                    '<li>' +
                        '<div style="display: flex">' +
                            '<a href="/data-takes.html?search=' + value + '" target="_blank">' + hexaVal + '</a>' +
                            '<div class="status-circle-dt-' + dtStatus + '"></div>' +
                        '</div>' +
                    '</li>';
            }
            if (index > 10) {
                detailsContent +=
                    '<li>' +
                        '<div style="display: flex">... (' + (dts.length - index).toString() + ' more)</div>' +
                    '</li>';
                dts.length = index + 1;
            }
        });
        detailsContent += '</ul></p><p></p></div>'
    } else {
        detailsContent += '</div>'
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
                    completeness = timeline.calcDatatakeCompleteness(objValues);
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

  filterEvents(filter) {

    // Clear the array hosting the filtered anomalies
    timeline.filteredEvents = new vis.DataSet();

    // If the filter is not empty, loop over the anomalies, and display the
    // anomalies matching the filter
    timeline.events.forEach(function(event) {
        if (filter) {
            if (timeline.details[event.id].toUpperCase().includes(filter.toUpperCase())) {
                timeline.filteredEvents.add(event);
            }
        } else {
            timeline.filteredEvents.add(event);
        }
    });

    // Update the timeline widget
    timeline.timelineInstance.setItems(timeline.filteredEvents);

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
                timeline.timelineInstance.moveTo(currDate);

                // Set the content of the panel details
                $('.timeline-event-details').append(calendar.details['day-' + anomaly['key']] +
                '</br><hr class="solid" style="background-color: grey">');
            }
        }
    }
  }
}

let timeline = new Timeline();