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

        this.today = new Date();
        this.today.setHours(0, 0, 0, 0); // Normalize time for comparison

        this.currentMonth = this.today.getMonth();
        this.currentYear = this.today.getFullYear();

        this.startEventsDate = new Date(this.today); // Start of events = today
        this.startEventsDate.setHours(0, 0, 0, 0);

        this.noEventsBeforeDateMsgDisplayed = false;
        this.isGenerating = false;

        this.init();
    }

    init() {
        // Hide the drop-down menu to select the time range
        $('#time-period-select-container').hide();
        
        this.selectedMission = 'all';
        this.selectedEventType = 'all';
        this.searchTerm = '';
        this.missionMap = {
            's1': ['S1A', 'S1C'],
            's2': ['S2A', 'S2B', 'S2C'],
            's3': ['S3A', 'S3B'],
            's5': ['S5P']
        };

        this.eventTypeMap = {
            'Acquisition': 'acquisition',
            'calibration': 'calibration',
            'Data access': 'data-access',
            'Manoeuvre': 'manoeuvre',
            'Production': 'production',
            'Satellite': 'satellite'
        };

        this.iconMap = {
            'acquisition': 'fas fa-database',
            'calibration': 'fas fa-compass',
            'manoeuvre': 'fas fa-wrench',
            'production': 'fas fa-cogs',
            'satellite': 'fas fa-rss'
        };

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

        // Set startEventsDate to the beginning of the previous quarter
        const quarter = getPreviousQuarter(this.startEventsDate);
        this.startEventsDate.setFullYear(quarter.year); // Use setFullYear instead of deprecated setYear
        this.startEventsDate.setMonth((quarter.quarter - 1) * 3, 1); // Month is zero-indexed


        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
            this.succesLoadAnomalies.bind(this),
            this.errorLoadAnomalies.bind(this)
        );
    }

    loadEventsGuestUser() {
        console.info('Loading events in the last quarter...');
        this.startEventsDate.setMonth(this.startEventsDate.getMonth() - 3);
        this.startEventsDate.setHours(0, 0, 0, 0);
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

            }
        }

        // Now generate the calendar AFTER loading events
        console.log("sucess anomalies prev click:", this.currentMonth, this.currentYear);
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
        if (this.listenersAttached) return; // Prevent duplicate attachments
        this.listenersAttached = true;
        console.log("addEventListeners called");

        const clearEventDetails = () => {
            this.lastSelectedDate = null;
            document.getElementById('eventDetails').innerHTML = '';
        };

        const onFilterChange = (getter) => {
            clearEventDetails();
            getter();
            this.generateCalendar(this.currentMonth, this.currentYear);
        };

        const debounce = (func, delay) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), delay);
            };
        };

        // Filter dropdowns
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

        document.getElementById('eventSearchInput').addEventListener('input', debounce(() => {
            onFilterChange(() => {
                this.searchTerm = document.getElementById('eventSearchInput').value.toLowerCase();
            });
        }, 300));

        document.getElementById('prevMonth').addEventListener('click', debounce(() => {
            console.log("Before prev click:", this.currentMonth, this.currentYear);

            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }

            console.log("After prev click:", this.currentMonth, this.currentYear);
            this.generateCalendar(this.currentMonth, this.currentYear);
            /*this.checkNoEventsBeforeDateMsgDisplay();*/
        }, 300));

        document.getElementById('nextMonth').addEventListener('click', debounce(() => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.generateCalendar(this.currentMonth, this.currentYear);
        }, 300));

        // Reset filters
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

        // Window resize adjustment
        window.addEventListener('resize', () => this.adjustCalendarHeight());
    }



    adjustCalendarHeight() {
        const container = document.querySelector('.calendar-container');
        container.style.height = 'auto';
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

    checkNoEventsBeforeDateMsgDisplay() {
        const displayedDate = new Date(this.currentYear, this.currentMonth, 1);
        displayedDate.setHours(0, 0, 0, 0);

        const now = new Date();
        const thresholdDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        thresholdDate.setHours(0, 0, 0, 0);

        const calendarDays = document.querySelectorAll('.calendar-day');
        const eventIcons = document.querySelectorAll('.calendar-day .event-container');

        const noVisibleEvents = calendarDays.length > 0 && eventIcons.length === 0;

        if (displayedDate < thresholdDate && noVisibleEvents) {
            if (!this.noEventsBeforeDateMsgDisplayed) {
                const content = {
                    title: 'Dashboard Events Viewer',
                    message: `This view is intended to show only the most recent events.<br>No events are displayed before <b>${thresholdDate.toLocaleDateString()}</b>`,
                    icon: 'fa fa-calendar'
                };

                $.notify(content, {
                    type: 'info',
                    placement: {
                        from: 'top',
                        align: 'center'
                    },
                    offset: { y: 150, x: 150 },  // added x for left margin
                    template: `
                        <div data-notify="container" class="col-xs-11 col-sm-4 alert alert-{0}" role="alert"
                            style="border: 2px solid #31708f; border-radius: 10px; background-color: #d9edf7; color: #31708f;
                                   box-shadow: 0 0 10px rgba(0,0,0,0.1); padding: 20px; font-size: 16px; position: relative;">
                            
                            <button type="button" aria-hidden="true" class="close" data-notify="dismiss"
                                style="position: absolute; top: 10px; right: 15px; font-size: 22px; line-height: 20px; cursor: pointer; background: none; border: none; color: #31708f;">
                                &times;
                            </button>
    
                            <span data-notify="icon" class="{3}" style="margin-right: 10px; font-size: 22px;"></span>
                            <span data-notify="title" style="font-size: 18px; font-weight: bold;">{1}</span><br>
                            <span data-notify="message" style="font-size: 16px;">{2}</span>
                        </div>
                    `,
                    time: 1000,
                    delay: 0
                });

                this.noEventsBeforeDateMsgDisplayed = true;
            }
        } else {
            this.noEventsBeforeDateMsgDisplayed = false;
        }
    }

    filterEvent(anomaly, selectedMission, selectedEventType, searchText) {
        // Mission filter
        if (selectedMission !== 'all') {
            const missionKey = selectedMission.toLowerCase();
            const satellites = this.missionMap[missionKey] || [];
            const anomalyEnv = anomaly.environment?.toUpperCase() || '';
            if (!satellites.some(sat => anomalyEnv.includes(sat))) return false;
        }

        // Event type filter
        if (selectedEventType !== 'all') {
            const category = anomaly.category === "Platform" ? "Satellite" : anomaly.category;
            if (category.toLowerCase() !== selectedEventType.toLowerCase()) return false;
        }

        // Text search filter
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            const matchesText = [
                anomaly.text,
                anomaly.category,
                anomaly.impactedItem,
                anomaly.impactedSatellite
            ].some(field => field?.toLowerCase().includes(lowerSearch));
            if (!matchesText) return false;
        }

        return true;
    }

    generateCalendar(month, year) {
        if (this.isGenerating) {
            console.warn('generateCalendar skipped: already generating');
            return;
        }

        this.isGenerating = true;
        document.getElementById('calendarLoadingSpinner').style.display = 'block';

        try {

            console.log(`Generating calendar for: ${month + 1}/${year}`);
            this.currentMonth = month;
            this.currentYear = year;
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
                    // Scroll to event detail section
                    const detailsSection = document.getElementById('eventDetails');
                    if (detailsSection) {
                        detailsSection.scrollIntoView({ behavior: 'smooth' });
                    }
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
                    ? allEventsForDay.filter(event => this.filterEvent(event, selectedMission, selectedEventType, searchText))
                    : allEventsForDay;
                /*if (fullDate === '2025-03-27') {
                    console.log("Filtered Events for May 27:", filteredEvents);
                }*/
                // Step 4: Render events
                const eventTextContainer = document.createElement('div');
                eventTextContainer.classList.add('event-container');

                console.log("Events shown on this day:", filteredEvents.length);
                const addedTypes = new Set();
                filteredEvents.forEach(event => {
                    let category = event.category === "Platform" ? "Satellite" : event.category;
                    const mappedType = this.eventTypeMap[category] || category;
                    const typeClass = `event-${mappedType.toLowerCase()}`;
                    if (!addedTypes.has(typeClass)) {
                        const eventLabel = document.createElement('div');
                        //eventLabel.classList.add('event-label', typeClass);
                        eventLabel.classList.add(typeClass);

                        // Use your icon map (with full FA class string like 'fas fa-rocket')
                        const iconClass = this.iconMap[mappedType.toLowerCase()] || 'fas fa-question-circle';

                        // Create <i> tag for the icon
                        const iconElement = document.createElement('i');
                        iconElement.classList.add(...iconClass.split(' '), 'event-icon'); // split to apply both 'fas' and 'fa-*'

                        eventLabel.appendChild(iconElement);

                        eventTextContainer.appendChild(eventLabel);
                        addedTypes.add(typeClass);
                    }
                });

                // Step 5: Add day and events to calendar
                const daySpan = document.createElement('span');
                daySpan.textContent = day;
                dayDiv.appendChild(daySpan);
                calendarGrid.appendChild(dayDiv);

                if (eventTextContainer.hasChildNodes()) {
                    dayDiv.appendChild(eventTextContainer);
                }
            }

            console.log(`Generating calendar for: ${month + 1}/${year}`);
            this.adjustCalendarHeight();

        } catch (error) {
            console.error('Error in generateCalendar:', error);
        } finally {
            this.isGenerating = false;
            document.getElementById('calendarLoadingSpinner').style.display = 'none';
            this.checkNoEventsBeforeDateMsgDisplay();
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

            const searchLower = searchText.toLowerCase();
            const matchesSearch =
                (event.category?.toLowerCase().includes(searchLower)) ||
                (event.environment?.toLowerCase().includes(searchLower)) ||
                (event.title?.toLowerCase().includes(searchLower)) ||
                (event.text?.toLowerCase().includes(searchLower));

            if (searchText && !matchesSearch) return false;

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
const calendar = new CalendarWidget();
window.calendar = calendar; // make it accessible globally