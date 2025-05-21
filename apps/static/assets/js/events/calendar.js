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

class CalendarWidget {
    constructor() {
        // DOM Elements
        this.calendarBody = document.getElementById("calendarBody");
        this.monthButton = document.getElementById("monthButton");
        this.yearButton = document.getElementById("yearButton");
        this.monthOptions = document.getElementById("monthOptions");
        this.yearOptions = document.getElementById("yearOptions");
        this.prevMonthButton = document.getElementById("prevMonth");
        this.nextMonthButton = document.getElementById("nextMonth");

        this.calendarGrid = document.getElementById("calendarGrid");
        this.monthYear = document.getElementById("monthYear");
        this.eventSearchInput = document.getElementById("eventSearchInput");
        this.missionSelect = document.getElementById("missionSelect");
        this.eventTypeSelect = document.getElementById("eventTypeSelect");

        this.today = new Date();
        this.currentMonth = this.today.getMonth();
        this.currentYear = this.today.getFullYear();
        this.lastSelectedDate = null;
        this.debounceTimer = null;

        this.events = [];
        this.anomalies = {};
        this.details = {};

        this.monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        this.init();
    }

    init() {

        this.selectedMission = 'all';
        this.selectedEventType = 'all';
        this.searchTerm = '';

        ajaxCall('/api/auth/quarter-authorized', 'GET', {},
            this.quarterAuthorizedProcess.bind(this),
            this.errorLoadAuthorized.bind(this)
        );

        this.addEventListeners();
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            this.loadEventsECUser();
        } else {
            this.loadEventsGuestUser();
        }
    }

    errorLoadAuthorized(response) {
        console.error('Authorization error', response);
    }

    loadEventsECUser() {
        console.info('Loading events up to the previous quarter...');
        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
            this.succesLoadAnomalies.bind(this),
            this.errorLoadAnomalies.bind(this)
        );
    }

    loadEventsGuestUser() {
        console.info('Loading events in the last quarter...');
        asyncAjaxCall('/api/events/anomalies/last-quarter', 'GET', {},
            this.succesLoadAnomalies.bind(this),
            this.errorLoadAnomalies.bind(this)
        );
    }

    succesLoadAnomalies(response) {
        var rows = format_response(response);
        console.info('Events loaded. Num of events: ' + rows.length);

        var datatakeList = [];

        for (let i = 0; i < rows.length; ++i) {
            let anomaly = rows[i];
            if (datatakeList.includes(anomaly['environment'])) {
                continue;
            } else {
                datatakeList.push(anomaly['environment']);
            }
            // Append the calendar event instance only if the event has an impact on datatakes (not fully recovered)
            let instance = this.buildEventInstanceFromAnomaly(anomaly);
            if (!instance.fullRecover) {

                // Store the anomalies in the class member
                this.anomalies[anomaly['key']] = anomaly;

                // Append the event instance
                this.events.push(instance);

                // Append event details in the details panel
                //this.details['day-' + anomaly['key']] = this.buildDetailsPanelContentFromAnomaly(anomaly);
            }
        }

        // Now generate the calendar AFTER loading events
        this.generateCalendar(this.currentMonth, this.currentYear);

    }

    errorLoadAnomalies(response) {
        console.error('Anomalies loading error', response);
    }

    formatDate(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }


    addEventListeners() {
        const clearEventDetails = () => {
            this.lastSelectedDate = null;
            document.getElementById('eventDetails').innerHTML = '';
        };

        const onFilterChange = (getter) => {
            clearEventDetails();
            getter();
            this.generateCalendar(this.currentMonth, this.currentYear);
        };

        document.getElementById('missionSelect').addEventListener('change', () => {
            onFilterChange(() => {
                this.selectedMission = document.getElementById('missionSelect').value;
            });
        });

        document.getElementById('eventTypeSelect').addEventListener('change', () => {
            onFilterChange(() => {
                this.selectedEventType = document.getElementById('eventTypeSelect').value;
            });
        });

        document.getElementById('eventSearchInput').addEventListener('input', () => {
            onFilterChange(() => {
                this.searchTerm = document.getElementById('eventSearchInput').value.toLowerCase();
            });
        });

        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.generateCalendar(this.currentMonth, this.currentYear);
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.generateCalendar(this.currentMonth, this.currentYear);
        });

        document.getElementById('resetFilters').addEventListener('click', () => {
            this.selectedMission = 'all';
            this.selectedEventType = 'all';
            this.searchTerm = '';
            this.lastSelectedDate = null;

            document.getElementById('missionSelect').value = 'all';
            document.getElementById('eventTypeSelect').value = 'all';
            document.getElementById('eventSearchInput').value = '';
            document.getElementById('eventDetails').innerHTML = '';

            this.generateCalendar(this.currentMonth, this.currentYear);
        });

        window.addEventListener('resize', () => this.adjustCalendarHeight());
    }


    adjustCalendarHeight() {
        const container = document.querySelector('.calendar-container');
        container.style.height = window.innerWidth < 768 ? '500px' : '700px';
    }

    buildEventInstanceFromAnomaly(anomaly) {

        // Build the event instance from the anomaly.
        var start_time = moment(anomaly['publicationDate'], 'DD/MM/YYYY HH:mm:ss').toDate();
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
        description += anomaly["category"] === "Data access" ?
            "Impacted Satellite: All Sentinels " : "Impacted Satellite: " + item + '. ';

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
        } else;

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
                for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'', '\"')))) {
                    var objValues = Object.values(value);
                    completeness = this.calcDatatakeCompleteness(objValues);
                    if (completeness < threshold) {
                        allRecovered = false;
                    }
                }
            } catch (ex) {
                allRecovered = false;
            }
        }

        // Set the anomaly to green if and only if all impacted datatakes have been recovered
        if (allRecovered) {
            color = "#31ce36";
            recovered = true;
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

    calcDatatakeCompleteness(dtCompleteness) {
        var completeness = 0;
        var count = 0;
        for (var i = 1; i < dtCompleteness.length; ++i) {
            count++;
            completeness += dtCompleteness[i];
        }
        return (completeness / count);
    }

    arrangeDatatakesList(anomaly, dtList) {
        var content = '<div class="row col-md-12" style="list-style-type: none;">';
        dtList.forEach(function (value, index, array) {
            if (value) {
                var dtStatus = this.calcDatatakeStatus(anomaly, value);
                let hexaVal = value;
                if (value.includes('S1')) {
                    hexaVal = this.overrideS1DatatakesId(value)
                }
                content +=
                    '<li class="ml-5">' +
                    '<div style="display: flex">' +
                    '<a href="/data-takes.html?search=' + value + '" target="_blank">' + hexaVal + '</a>' +
                    '<div class="status-circle-dt-' + dtStatus + '"></div>' +
                    '</div>' +
                    '</li>';
            }
        }.bind(this));
        content += '</ul></div></p><p></p></div>';
        return content;
    }
    calcDatatakeStatus(anomaly, datatake_id) {

        // Return one possible value in range: "ok", "partial", "failed", "undef"
        let datatakes_completeness = format_response(anomaly.datatakes_completeness);
        var completeness = 0;
        for (var index = 0; index < datatakes_completeness.length; ++index) {
            try {
                for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'', '\"')))) {
                    var objValues = Object.values(value);
                    if (objValues[0] == datatake_id) {
                        completeness = this.calcDatatakeCompleteness(objValues);
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
                return 'undef';
            }
        }

        // If the datatake cannot be found, assume that the status is "undef"
        return 'undef';
    }
    overrideS1DatatakesId(datatake_id) {
        let num = datatake_id.trim().substring(4);
        let hexaNum = parseInt(num).toString(16);
        return (datatake_id + ' (' + hexaNum + ')');
    }

    generateCalendar(month = this.currentMonth, year = this.currentYear) {
        const calendarGrid = document.getElementById('calendarGrid');
        const selectedMission = document.getElementById('missionSelect').value;
        const selectedEventType = document.getElementById('eventTypeSelect').value;
        const searchText = document.getElementById('eventSearchInput').value.trim().toLowerCase();


        const monthYear = document.getElementById('monthYear');
        calendarGrid.innerHTML = "";
        monthYear.textContent = `${this.monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Blank cells for previous month
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');

            const fullDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            if (fullDate === formatDate(this.today)) {
                dayDiv.classList.add('today');
            }

            dayDiv.addEventListener('click', () => {
                document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
                dayDiv.classList.add('selected');
                this.lastSelectedDate = fullDate;
                this.showEventDetails(fullDate);
            });

            //  1. Collect events for this specific day
            const allEventsForDay = Object.values(this.anomalies).filter(anomaly => {
                const anomalyDate = anomaly.start?.split(' ')[0];
                if (!anomalyDate) return false;

                const normalizedDate = anomalyDate.replace(/\//g, '-').split('-').reverse().join('-'); // DD/MM/YYYY → YYYY-MM-DD
                return normalizedDate === fullDate;
            });

            // Check if filters are active
            const isFiltering = selectedMission !== 'all' || selectedEventType !== 'all' || (searchText && searchText.trim() !== '');

            // Apply filters only if needed
            const filteredEvents = isFiltering
                ? allEventsForDay.filter(anomaly => {
                    // Mission filter
                    if (selectedMission !== 'all') {
                        const missionMap = {
                          's1': ['S1A', 'S1C'],
                          's2': ['S2A', 'S2B', 'S2C'],
                          's3': ['S3A', 'S3B'],
                          's5': ['S5P']
                        };
                      
                        const selectedMissionKey = selectedMission.toLowerCase();
                        const matchingSatellites = missionMap[selectedMissionKey] || [];
                      
                        const anomalyEnv = anomaly.environment.toUpperCase();
                        const matches = matchingSatellites.some(sat => anomalyEnv.includes(sat));
                        if (!matches) return false;
                      }

                    // Event type filter
                    if (selectedEventType !== 'all') {
                        console.log("selectedEventType", selectedEventType);
                        var category = anomaly.category === "Platform" ? "Satellite" : anomaly.category;
                        console.log("category", category);
                        if (category.toLowerCase() !== selectedEventType.toLowerCase()) return false;
                    }

                    // Text search filter
                    if (searchText && searchText.trim() !== '') {
                        const lowerSearch = searchText.toLowerCase();
                        const matchesText =
                            anomaly.text?.toLowerCase().includes(lowerSearch) ||
                            anomaly.category?.toLowerCase().includes(lowerSearch) ||
                            anomaly.impactedItem?.toLowerCase().includes(lowerSearch) ||
                            anomaly.impactedSatellite?.toLowerCase().includes(lowerSearch);

                        if (!matchesText) return false;
                    }

                    return true;
                })
                : allEventsForDay;
                /*if (fullDate === '2025-03-27') {
                    console.log("Filtered Events for May 27:", filteredEvents);
                }*/
            // Step 4: Render events
            const eventTextContainer = document.createElement('div');
            eventTextContainer.classList.add('event-container');

            console.log("Events shown on this day:", filteredEvents.length);
            const eventTypeMap = {
                'Acquisition': 'acquisition',
                'calibration': 'calibration',
                'Data access': 'data-access',
                'Manoeuvre': 'manoeuvre',
                'Production': 'production',
                'Satellite': 'satellite'
            };

            if (filteredEvents.length > 0) {
                const addedTypes = new Set();
                filteredEvents.forEach(event => {
                    var category = event.category === "Platform" ? "Satellite" : event.category;
                    const mappedType = eventTypeMap[category] || category;

                    const typeClass = 'event-' + eventTypeMap[category];
                    console.log("mapped type", mappedType);
                    if (!addedTypes.has(typeClass)) {
                        const eventLabel = document.createElement('div');
                        eventLabel.classList.add('event-label', 'event-' + mappedType.toLowerCase());
                        console.log('event-' + mappedType.toLowerCase());
                        eventTextContainer.appendChild(eventLabel);
                        addedTypes.add(typeClass);
                    }
                });
            }

            // Step 5: Add day and events to calendar
            const daySpan = document.createElement('span');
            daySpan.textContent = day;
            dayDiv.appendChild(daySpan);
            calendarGrid.appendChild(dayDiv);

            if (eventTextContainer.hasChildNodes()) {
                dayDiv.appendChild(eventTextContainer);
            }
        }
    }

    getFilteredEvents(dateKey) {
        return this.events.filter(event => {
            const matchesDate = event.date === dateKey;
            const matchesMission = this.selectedMission === 'all' || event.mission === this.selectedMission;
            const matchesType = this.selectedEventType === 'all' || event.eventType === this.selectedEventType;
            const matchesSearch = this.searchTerm === '' || (event.description && event.description.toLowerCase().includes(this.searchTerm));
            return matchesDate && matchesMission && matchesType && matchesSearch;
        });
    }

    showEventDetails(date) {
        console.log("date", date);
        const eventDetailsDiv = document.getElementById('eventDetails');
        eventDetailsDiv.innerHTML = '';

        const selectedMission = document.getElementById('missionSelect').value;
        const selectedEventType = document.getElementById('eventTypeSelect').value;
        const searchText = document.getElementById('eventSearchInput').value.trim().toLowerCase();

        // Normalize input date to DD/MM/YYYY for comparison
        const normalizeDate = str => {
            if (!str) return null;

            // Parse DD/MM/YYYY HH:mm:ss
            const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
            if (match) {
                let [, day, month, year, hour = '00', minute = '00', second = '00'] = match;

                // Months are zero-based in JS Date
                const date = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second)
                );

                if (isNaN(date)) return null;

                // Format to YYYY-MM-DD in local time
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');

                return `${yyyy}-${mm}-${dd}`;
            }

            // Fallback to native parsing for ISO or others
            const d = new Date(str);
            if (isNaN(d)) return null;

            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');

            return `${yyyy}-${mm}-${dd}`;
        };
        const targetDate = normalizeDate(date);
        if (!targetDate) return;


        let events = Object.values(this.anomalies).filter(event => {
            const eventDate = normalizeDate(event.start || '');
            if (eventDate !== targetDate) return false;
            const env = String(event.environment || '').toLowerCase().trim(); // cast + normalize
            const mission = String(selectedMission || '').toLowerCase().trim();
            console.log("mission selected", mission);
            if (selectedMission !== 'all') {
                const missionMap = {
                  's1': ['S1A', 'S1C'],
                  's2': ['S2A', 'S2B', 'S2C'],
                  's3': ['S3A', 'S3B'],
                  's5': ['S5P']
                };
              
                const selectedMissionKey = selectedMission.toLowerCase();
                const matchingSatellites = missionMap[selectedMissionKey] || [];
              
                const anomalyEnv = event.environment.toUpperCase();
                const matches = matchingSatellites.some(sat => anomalyEnv.includes(sat));
                if (!matches) return false;
              }

            const category = event.category === "Platform" ? "Satellite" : event.category;
            if (selectedEventType !== 'all' && category.toLowerCase() !== selectedEventType) return false;

            const text = event.text?.toLowerCase() || '';
            if (searchText && !text.includes(searchText)) return false;

            return true;
        });

        if (events.length === 0) {
            eventDetailsDiv.innerHTML = `<p>No events for ${date}.</p>`;
            return;
        }

        const title = document.createElement('h3');
        title.textContent = `Events on ${date}`;
        eventDetailsDiv.appendChild(title);

        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';

        events.forEach(event => {
            const listItem = document.createElement('li');
            listItem.style.marginBottom = '1em';
            listItem.style.padding = '10px';
            listItem.style.border = '1px solid #ccc';
            listItem.style.borderRadius = '5px';
            // Override "platform" category with "satellite"
            var category = event.category === "Platform" ? "Satellite" : event.category;
            var item = "";
            if (event.category === "Data access") {
                item = "All Sentinels";
            } else {
                if (event.environment.includes('S1A')) {
                    item += "S1A, "
                }
                if (event.environment.includes('S1C')) {
                    item += "S1C, "
                }
                if (event.environment.includes('S2A')) {
                    item += "S2A, "
                }
                if (event.environment.includes('S2B')) {
                    item += "S2B, "
                }
                if (event.environment.includes('S2C')) {
                    item += "S2C, "
                }
                if (event.environment.includes('S3A')) {
                    item += "S3A, "
                }
                if (event.environment.includes('S3B')) {
                    item += "S3B, "
                }
                if (event.environment.includes('S5P')) {
                    item += "S5P, "
                }
                item = item.substring(0, item.length - 2);
            }

            let dtsHtml = '';
            if (event.environment) {
                const dts = event.environment.split(";");
                dtsHtml = `
                    <p style="color: white; font-size: 14px">
                    List of impacted datatakes:<br>
                    ${this.arrangeDatatakesList(event, dts)}
                    </p>`;
            }
            listItem.innerHTML = `
            <small>${event.title || 'No description available'}</small><br>
            <small>Occurrence date: ${event.start}</small><br>
            <small>Impacted satellite(s): ${item}</small><br>
            <small>Issue type: ${category}</small><br>
            <small>${event.text || event.key}</small><br>
            ${dtsHtml}
        `;
            list.appendChild(listItem);
        });

        eventDetailsDiv.appendChild(list);
    }
}
document.addEventListener("DOMContentLoaded", function () {
    const calendar = new CalendarWidget();
});