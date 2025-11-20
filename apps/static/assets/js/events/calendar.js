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

        window.addEventListener("DOMContentLoaded", this.init.bind(this));

    }

    init() {
        // Hide the drop-down menu to select the time range
        $('#time-period-select-container').hide();
        $('#esa-logo-header').hide();


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
            'acquisition': 'fas fa-broadcast-tower',
            'calibration': 'fas fa-compass',
            'manoeuvre': '/static/assets/img/joystick.svg',
            'production': 'fas fa-cog',
            'satellite': 'fas fa-satellite-dish'
        };
        // Authorization check
        const anomalyDataEl = document.getElementById('anomalyData');
        this.anomaliesData = JSON.parse(anomalyDataEl.dataset.anomaliesByDate || '{}');
        this.datatakesData = JSON.parse(anomalyDataEl.dataset.datatakes || '[]');

        //console.log("Loaded anomalies:", this.anomaliesData.length);

        this.isAuthorized = anomalyDataEl?.dataset?.quarterAuthorized === 'true';

        this.buildAnomaliesByDate(this.anomaliesData);

        console.log("User authorized:", this.isAuthorized);
        //console.log("Loaded anomalies:", this.anomaliesData);

        this.addEventListeners();
    }

    navigateMonth(delta) {
        let newMonth = this.currentMonth + delta;
        let newYear = this.currentYear;

        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }

        this.currentMonth = newMonth;
        this.currentYear = newYear;

        const params = new URLSearchParams({ year: newYear, month: newMonth + 1 });
        history.replaceState(null, "", `?${params.toString()}`)

        const spinner = document.getElementById('spinnerOverlay');
        if (spinner) spinner.style.display = "flex";



        fetch(`/events_data?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                window.anomaliesByDate = data.anomalies_by_date || {};
                this.anomaliesByDate = data.anomalies_by_date || {};

                this.anomalies = Object.values(this.anomaliesByDate).flat();

                this.generateCalendar(this.currentMonth, this.currentYear);

            })
            .catch(err => console.error('Error fetching new month', err))
            .finally(() => {
                if (spinner) spinner.style.display = "none";
            });
    }

    buildAnomaliesByDate(anomaliesArray) {
        if (!anomaliesArray) return;

        //console.log("built anomaliesbydate:", Object.keys(anomaliesArray).length);
        //console.log("dates available", Object.keys(anomaliesArray).slice(0, 10));


        if (Array.isArray(anomaliesArray)) {
            this.anomaliesByDate = {}; // reset
            anomaliesArray.forEach((anomaly) => {
                const iso = anomaly.publicationDate || anomaly.publication_date || anomaly.occurence_date || anomaly.occurrence_date || anomaly.publication || anomaly.from;
                if (!iso) {
                    console.warn("Skipping anomaly without date:", anomaly);
                    return;
                }

                const dateKey = this.normalizeDateString(iso);
                if (!this.anomaliesByDate[dateKey]) this.anomaliesByDate[dateKey] = [];

                anomaly._isFullyRecover = anomaly.fullRecover === true

                if (!anomaly.category || anomaly.category.trim() === "") {
                    anomaly._category = "Unknown";
                } else if (anomaly.category === "Platform") {
                    anomaly._category = "Satellite"
                } else {
                    anomaly._category = anomaly.category;
                }
                this.anomaliesByDate[dateKey].push(anomaly);

            });

        } else {
            this.anomaliesByDate = anomaliesArray;
        }

        //console.log("anomaliesByDate built:", Object.keys(this.anomaliesByDate).length, "unique dates");
        this._anomaliesCount = Object.values(this.anomaliesByDate).reduce((s, arr) => s + arr.length, 0);
    }

    errorLoadAuthorized() {
        console.info('Guest user');
        this.loadEvents();
    }

    loadEvents(anomaliesData = []) {

        console.info(
            this.isAuthorized
                ? 'loading events up to the previous quarter (authorized)'
                : 'Loading events in the last quarter (guest)'
        );

        if (anomaliesData.length > 0) {
            this.successLoadAnomalies(anomaliesData);
        } else {
            console.warn("No anomalies data found for GuestUser");
            this.errorLoadAnomalies("No anomalies data");
        }
    }

    successLoadAnomalies(response) {
        var rows = Array.isArray(response) ? response : [];

        this.anomaliesData = rows;

        this.buildAnomaliesByDate(this.anomaliesData);

        const datatakeList = new Set();

        rows.forEach(anomaly => {
            if (anomaly.environment && datatakeList.has(anomaly.environment)) return;
            if (anomaly.environment) datatakeList.add(anomaly.environment);
            // Append the calendar event instance only if the event has an impact on datatakes
            const instance = this.buildEventInstanceFromAnomaly(anomaly);
            if (anomaly.fullRecover) instance.color = "#31ce36"; // green for full recovery{

            instance.category = anomaly.category || "Unknown";

            // Store the anomalies in the class member
            this.anomalies[anomaly.key || anomaly.id] = anomaly;

            // Append the event instance
            this.events.push(instance);

        });
        this.showDayEventsOnPageLoad();
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

    normalizeDateString(str) {
        if (!str) return null;

        let date;

        if (str instanceof Date && !isNaN(str)) {
            date = str;
        } else {
            const input = String(str).trim();
            const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);

            if (match) {
                const [, day, month, year, hour = '0', minute = '0', second = '0'] = match;
                date = new Date(
                    parseInt(year, 10),
                    parseInt(month, 10) - 1,
                    parseInt(day, 10),
                    parseInt(hour, 10),
                    parseInt(minute, 10),
                    parseInt(second, 10)
                );
            } else {
                date = new Date(input);
            }

            if (isNaN(date.getTime())) return null;
        }

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    }

    clearEventDetails() {
        this.lastSelectedDate = null;
        const eventDetails = document.getElementById('eventDetails');
        if (!eventDetails) return;
        eventDetails.innerHTML = `
            <h5 id="eventDetailsTitle">Event Details</h5>
            <p id="noEventMessage">Select a date to see event details.</p>
            <div id="eventDetailsContent"></div>
        `;
    }

    addEventListeners() {
        const missionSelect = document.getElementById('missionSelect');
        const eventTypeSelect = document.getElementById('eventTypeSelect');
        const searchInput = document.getElementById('eventSearchInput');
        const resetBtn = document.getElementById('resetFilters');

        const handleFilterChange = () => {
            this.selectedMission = missionSelect.value;
            this.selectedEventType = eventTypeSelect.value;
            this.searchTerm = searchInput.value.trim().toLowerCase();

            this.generateCalendar(this.currentMonth, this.currentYear);

            // If a date is already selected, refresh details for that date
            if (this.lastSelectedDate) {
                this.showEventDetails(this.lastSelectedDate);
            } else {
                const noEventMsg = document.getElementById('noEventMessage');
                if (noEventMsg) {
                    noEventMsg.textContent = 'Select a date to see event details.';
                    noEventMsg.style.display = 'block';
                }
            }
        };

        const debounceFilterChange = this.debounce(handleFilterChange, 300);

        missionSelect.addEventListener('change', (e) => {
            if (e.target.value === 'all') {
                searchInput.value = '';
                this.searchTerm = '';
                if (debounceFilterChange.cancel) debounceFilterChange.cancel();
                handleFilterChange();
            } else {
                handleFilterChange();
            }
        });

        eventTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'all') {
                searchInput.value = '';
                this.searchTerm = '';
                if (debounceFilterChange.cancel) debounceFilterChange.cancel();
                handleFilterChange();
            } else {
                handleFilterChange();
            }
        });

        searchInput.addEventListener('input', debounceFilterChange);

        resetBtn.addEventListener('click', () => {
            missionSelect.value = 'all';
            eventTypeSelect.value = 'all';
            searchInput.value = '';
            this.selectedMission = 'all';
            this.selectedEventType = 'all';
            this.searchTerm = '';
            this.lastSelectedDate = null;

            if (debounceFilterChange.cancel) debounceFilterChange.cancel();

            // Re-render calendar
            this.generateCalendar(this.currentMonth, this.currentYear);

            // Clear side panel
            const content = document.getElementById('eventDetailsContent');
            if (content) content.innerHTML = '';

            const noEventMessage = document.getElementById('noEventMessage');
            if (noEventMessage) {
                noEventMessage.textContent = 'Select a date to see event details.';
                noEventMessage.style.display = 'block';
            }

        });

        // Window resize adjustment
        window.addEventListener('resize', () => {
            this.adjustCalendarHeight();
            this.adjustLeftPanelHeight();
        });

        // Handle day click
        document.querySelectorAll('.calendar-day[data-date]').forEach(cell => {
            cell.addEventListener('click', () => {
                document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
                cell.classList.add('selected');
                const date = cell.getAttribute('data-date');
                this.lastSelectedDate = date;
                this.showEventDetails(date);
            });
        });
    }

    debounce(func, delay) {
        let timeout = null;
        const debounced = (...args) => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = null;
                func(...args);
            }, delay);
        };
        debounced.cancel = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        };
        return debounced;
    }

    getAppliedFilters() {
        return {
            mission: this.selectedMission,
            eventType: this.selectedEventType,
            searchText: this.searchTerm
        }
    }

    adjustCalendarHeight() {
        const calendarContainer = document.querySelector('.calendar-container');
        const eventDetails = document.getElementById('eventDetails');

        if (!calendarContainer || !eventDetails) return;

        eventDetails.style.minHeight = '';
        eventDetails.style.maxHeight = '';
        eventDetails.style.overflowY = '';

        if (window.innerWidth < 992) {
            return;
        }

        const height = calendarContainer.offsetHeight;
        eventDetails.style.overflowY = 'auto';
    }

    adjustLeftPanelHeight() {
        const calendarContainer = document.querySelector('.calendar-container');
        const leftPanel = document.querySelector('.left-panel .filter-panel');

        if (!calendarContainer || !leftPanel) return;

        // Reset height for smaller screens
        if (window.innerWidth < 992) {
            leftPanel.style.minHeight = 'auto';
            return;
        }

        const calendarHeight = calendarContainer.offsetHeight;
        leftPanel.style.minHeight = `${calendarHeight}px`;
    }

    buildEventInstanceFromAnomaly(anomaly) {
        // Ensure publicationDate is available
        let start_time = anomaly['publicationDate'] ? new Date(anomaly['publicationDate']) : new Date();
        let end_time = anomaly['end'] ? new Date(anomaly['end']) : new Date(start_time.getTime() + 1);

        let title = "Event(s)";
        let description = "";
        let color = "#273295"; // default blue
        let recovered = false;

        const impactedSat = anomaly["impactedSatellite"] || "N/A";
        description += `Impacted Satellite: ${impactedSat}. `;
        description += `Issue type: ${anomaly.category || "Unknown"}. `;

        // Full recovery logic
        let allRecovered = true;
        const threshold = 90;
        const dtCompletenessArray = Array.isArray(anomaly.datatakes_completeness)
            ? anomaly.datatakes_completeness
            : [];

        for (let dtObj of dtCompletenessArray) {
            try {
                const parsed = typeof dtObj === "string" ? JSON.parse(dtObj.replaceAll("'", '"')) : dtObj;
                for (const [_, val] of Object.entries(parsed)) {
                    const values = Object.values(val).filter(v => typeof v === "number");
                    const completeness = this.calcDatatakeCompleteness(values);
                    if (completeness < threshold) allRecovered = false;
                }
            } catch (e) {
                allRecovered = false;
            }
        }

        if (allRecovered) {
            color = "#31ce36"; // green
            recovered = true;
        }

        return {
            id: anomaly.key,
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
        if (!dtCompleteness || !dtCompleteness.length) return 0;
        const validValues = dtCompleteness.filter(v => typeof v === "number" && v >= 0);
        if (!validValues.length) return 0;
        const sum = validValues.reduce((a, b) => a + b, 0);
        return sum / validValues.length;
    }

    arrangeDatatakesList(anomaly, dtList) {
        const uniqueDtList = dtList.filter(
            (dt, idx, self) =>
                idx === self.findIndex(t => t.datatake_id === dt.datatake_id)
        );

        const validPrefixes = ["S1", "S2", "S3", "S5"];

        const content = uniqueDtList
            .filter(dt => dt?.datatake_id && validPrefixes.some(prefix => dt.datatake_id.startsWith(prefix)))
            .map(dt => {
                const { datatake_id, status, completeness } = dt;
                if (!status) {
                    return ''
                };

                const displayId = (datatake_id.includes("S1") && this.overrideS1DatatakesId)
                    ? this.overrideS1DatatakesId(datatake_id)
                    : datatake_id;

                return `
            <li style="margin: 2px 0; list-style: none;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <a href="/data-availability.html?search=${displayId}" target="_blank"
                        style="color: #aad; text-decoration: underline; font-weight:500;">
                        ${displayId}
                    </a>
                    <div class="status-circle-dt-${status}" title="${status}"></div>
                </div>
            </li>`;
            })
            .filter(html => html.trim() !== '')
            .join('');

        return content
            ? `<ul style="padding-left: 0; margin: 0;">${content}</ul>`
            : '<p>No valid datatakes</p>';
    }

    calcDatatakeStatus(anomaly, datatake_id) {
        const dtCompletenessArray = anomaly.datatakes_completeness || [];
        if (!dtCompletenessArray.length) return null;

        for (let dtObj of dtCompletenessArray) {
            try {
                // Normalize both string and object cases
                const parsed = typeof dtObj === "string"
                    ? JSON.parse(dtObj.replaceAll("'", '"'))
                    : dtObj;

                // Case 1: Old format -> {"S1C-35496": {"L0_":86.3,"L1_":0,"L2_":0}}
                for (const [key, val] of Object.entries(parsed)) {
                    if (key.trim().toUpperCase() === datatake_id.trim().toUpperCase()) {
                        const numericValues = Object.values(val).filter(v => typeof v === "number");
                        const completeness = this.calcDatatakeCompleteness(numericValues);

                        if (completeness >= 90) return 'ok';
                        if (completeness >= 10 && completeness < 90) return 'partial';
                        if (completeness < 10) return 'failed';
                    }
                }

                // Case 2: New format -> {datatakeID:"S1C-35496", L0_:86.3, L1_:0, L2_:0}
                if (
                    parsed.datatakeID &&
                    parsed.datatakeID.trim().toUpperCase() === datatake_id.trim().toUpperCase()
                ) {
                    const numericValues = [parsed.L0_, parsed.L1_, parsed.L2_]
                        .filter(v => typeof v === "number");
                    const completeness = this.calcDatatakeCompleteness(numericValues);

                    if (completeness >= 90) return 'ok';
                    if (completeness >= 10 && completeness < 90) return 'partial';
                    if (completeness < 10) return 'failed';
                }

            } catch (ex) {
                console.warn("Error parsing dt completeness", ex, dtObj);
                continue;
            }
        }

        return null;
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

            // Custom rule: if input starts with "sa", match category "platform"
            const satellitePrefixMatch = lowerSearch.startsWith("sa") && anomaly.category?.toLowerCase() === "platform";

            if (!matchesText && !satellitePrefixMatch) return false;
        }
        return true;
    }

    generateCalendar(month, year) {
        //console.log(`[generateCalendar] rendering ${month + 1}/${year}`);

        if (this.isGenerating) {
            console.warn('generateCalendar skipped: already generating');
            return;
        }

        this.isGenerating = true;
        document.getElementById('calendarLoadingSpinner').style.display = 'block';

        try {
            this.currentMonth = month;
            this.currentYear = year;
            const calendarGrid = document.getElementById('calendarGrid');
            const selectedMission = document.getElementById('missionSelect').value;
            const selectedEventType = document.getElementById('eventTypeSelect').value;
            const searchText = document.getElementById('eventSearchInput').value.trim().toLowerCase();
            const monthYear = document.getElementById('monthYear');

            calendarGrid.innerHTML = "";
            monthYear.textContent = `${this.monthNames[month]} ${year}`;

            const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Blank cells
            for (let i = 0; i < firstDay; i++) {
                calendarGrid.appendChild(document.createElement('div'));
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dayDiv = document.createElement('div');
                dayDiv.classList.add('calendar-day');

                const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                if (fullDate === this.normalizeDateString(this.today)) {
                    dayDiv.classList.add('today');
                }

                dayDiv.addEventListener('click', () => {
                    document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
                    dayDiv.classList.add('selected');
                    this.lastSelectedDate = fullDate;

                    this.showEventDetails(fullDate);
                });

                const allEventsForDay = this.anomaliesByDate?.[fullDate] || [];
                this.anomaliesData = Object.values(this.anomaliesByDate || {}).flat();

                const isFiltering = selectedMission !== 'all' || selectedEventType !== 'all' || searchText.length > 0;
                const filteredEvents = isFiltering
                    ? allEventsForDay.filter(event =>
                        this.filterEvent(event, selectedMission, selectedEventType, searchText))
                    : allEventsForDay;

                const eventTextContainer = document.createElement('div');
                eventTextContainer.classList.add('event-container');

                const addedTypes = new Set();
                filteredEvents.forEach(event => {
                    if (!event || !event.category) {
                        console.warn('Skipping event without category:', event);
                        return;
                    }

                    if (event.category === 'Archive' || event.category === 'Data access') {
                        return;
                    }
                    const category = event.category === "Platform" ? "Satellite" : event.category;

                    const mappedType = this.eventTypeMap[category] || category;
                    if (!mappedType) {
                        console.warn('Skipping event with Unmapped category:', category);
                        return;
                    }
                    const typeClass = `event-${mappedType.toLowerCase()}`;

                    if (!addedTypes.has(typeClass)) {
                        const iconValue = this.iconMap[mappedType.toLowerCase()] || 'fas fa-question-circle';
                        let iconElement;

                        // Check if it's an image path
                        if (iconValue.startsWith('/') || iconValue.endsWith('.png') || iconValue.endsWith('.jpg') || iconValue.endsWith('.svg')) {
                            iconElement = document.createElement('img');
                            iconElement.src = iconValue;

                            iconElement.classList.add('event-icon', 'image-icon', 'responsive-icon');
                            iconElement.style.marginBottom = '6px';
                            iconElement.onload = () => {
                                iconElement.style.visibility = 'visible';
                            };
                        } else {
                            iconElement = document.createElement('i');
                            iconElement.classList.add(...iconValue.split(' '), 'event-icon');
                        }

                        const eventLabel = document.createElement('div');
                        eventLabel.classList.add(typeClass);
                        eventLabel.appendChild(iconElement);

                        eventTextContainer.appendChild(eventLabel);
                        addedTypes.add(typeClass);
                    }
                });

                const daySpan = document.createElement('span');
                daySpan.textContent = day;
                dayDiv.appendChild(daySpan);
                if (eventTextContainer.hasChildNodes()) {
                    dayDiv.appendChild(eventTextContainer);
                }

                calendarGrid.appendChild(dayDiv);
            }

            if (this.lastSelectedDate) {
                const allDayDivs = document.querySelectorAll('.calendar-day');
                allDayDivs.forEach(div => {
                    const dayNumber = this.lastSelectedDate.split('-')[2];
                    if (div.querySelector('span')?.textContent === dayNumber) {
                        div.classList.add('selected');
                    }
                });
                this.showEventDetails(this.lastSelectedDate);
            }

            this.adjustCalendarHeight();
            this.adjustLeftPanelHeight();

        } catch (error) {
            console.error('Error in generateCalendar:', error);
        } finally {
            this.isGenerating = false;
            document.getElementById('calendarLoadingSpinner').style.display = 'none';
            this.checkNoEventsBeforeDateMsgDisplay();
        }
    }

    filterEvents({ date, mission, eventType, searchText }) {
        //console.log("filter called:", { date, mission, eventType, searchText });
        if (!date) return [];
        const targetDate = this.normalizeDateString(date);
        const events = (this.anomaliesByDate && this.anomaliesByDate[targetDate]) ? this.anomaliesByDate[targetDate] : [];

        const searchLower = (searchText || '').toLowerCase().trim();
        const missionMap = this.missionMap || {
            's1': ['S1A', 'S1C'],
            's2': ['S2A', 'S2B', 'S2C'],
            's3': ['S3A', 'S3B'],
            's5': ['S5P']
        };
        return events.filter(event => {
            if (['archive', 'data access', 'data-access'].includes((event.category || '').toLowerCase())) {
                return false;
            }

            if (mission && mission !== 'all') {
                const anomalyEnv = String(event.environment || '').toUpperCase();
                const sats = missionMap[mission.toLowerCase()] || [];
                const matches = sats.some(sat => anomalyEnv.includes(sat));
                if (!matches) return false;
            }

            if (eventType && eventType !== 'all') {
                const category = event.category === 'Platform' ? 'Satellite' : event.category;
                const matchesType = category.toLowerCase() === eventType.toLowerCase();
                if (category.toLowerCase() !== eventType.toLowerCase()) return false;
            }

            if (searchLower) {
                const matchesSearch =
                    (event.category?.toLowerCase().includes(searchLower)) ||
                    (event.environment?.toLowerCase().includes(searchLower)) ||
                    (event.title?.toLowerCase().includes(searchLower)) ||
                    (event.text?.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }

            return true;
        });
    }

    showEventDetails(date) {
        const { noEventMsg, content } = this.ensureEventDetailsElements();

        content.innerHTML = '';

        if (!date) {
            noEventMsg.style.display = 'block';
            noEventMsg.textContent = 'Select a date to see event details.';
            return;
        }

        const normalizedDate = this.normalizeDateString(date);

        const selectedMission = document.getElementById('missionSelect')?.value || 'all';
        const selectedEventType = document.getElementById('eventTypeSelect')?.value || 'all';
        const searchText = document.getElementById('eventSearchInput').value.trim().toLowerCase();

        const events = this.filterEvents({
            date: normalizedDate,
            mission: selectedMission,
            eventType: selectedEventType,
            searchText
        });
        if (!events.length) {
            noEventMsg.style.display = 'block';
            noEventMsg.textContent = `No events for ${normalizedDate}.`;
            return;
        }

        noEventMsg.style.display = 'none';

        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';

        events.forEach(event => {
            if (event.category === 'Archive' || event.category === 'Data access') {
                return;
            }

            const satellites = this.getSatellitesString(event.environment || '');
            const dataTakeCandidates = (event.environment || '')
                .split(";")
                .map(v => v.trim())
                .filter(v => /^S\d/.test(v));


            if (!satellites && dataTakeCandidates.length === 0) {
                return;
            }
            const listItem = document.createElement('li');
            listItem.style.marginBottom = '1em';
            listItem.style.padding = '10px';
            listItem.style.border = '1px solid #ccc';
            listItem.style.borderRadius = '5px';

            const category = event.category === "Platform" ? "Satellite" : event.category;
            const categoryKey = category.toLowerCase();
            const iconClass = this.iconMap[categoryKey] || 'fas fa-info-circle';
            const mappedType = this.eventTypeMap[categoryKey] || categoryKey;


            //const satellites = this.getSatellitesString(event.environment || '');
            console.log("[EVENT DEBUG]", event);

            const dtList = Array.isArray(event.datatakes_completeness)
                ? event.datatakes_completeness
                : [];

            console.log("[DATATAKES DEBUG]", event.id, dtList);

            /* const validDtList = dtList.filter(dt =>
                 dt.id.startsWith("S1") || dt.id.startsWith("S2") || dt.id.startsWith("S3") || dt.id.startsWith("S5")
             );*/

            const datatakeHtml = dtList
                ? `<div style="color: white; font-size: 14px;">
                        <p style="margin-bottom: 4px;">List of impacted datatakes:</p>
                        ${this.arrangeDatatakesList(event, dtList)}
                    </div>`
                : '';


            const isImage = iconClass.startsWith('/') || iconClass.endsWith('.png') || iconClass.endsWith('.jpg');
            const iconHTML = isImage
                ? `<img src="${iconClass}" class="legend-icon image-icon event-${mappedType}" style="width: 1.2rem; height: 1.2rem; vertical-align: middle;">`
                : `<i class="${iconClass} event-${mappedType}" style="font-size: 1.2rem"></i>`;

            listItem.innerHTML = `
                    <small>
                        <span class="icon-bg">${iconHTML}</span>
                        Occurrence date: ${this.parseDateString(event.publicationDate)}
                    </small><br>
                    <small>Impacted satellite(s): ${satellites}</small><br>
                    <small>Issue type: ${category}</small><br>
                    ${datatakeHtml}
                `;
            list.appendChild(listItem);
        });

        eventDetailsContent.appendChild(list);
    }

    getSatellitesString(envStr) {
        if (!envStr) return '';
        if (envStr.includes('Data access')) return 'All Sentinels';

        const sats = ['S1A', 'S1C', 'S2A', 'S2B', 'S2C', 'S3A', 'S3B', 'S5P'];
        return sats.filter(sat => envStr.includes(sat)).join(', ');
    }

    parseDateString(str) {
        if (!str) return "Unknown date";

        const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
        if (!match) return this.formatDateUTC(new Date(str));

        const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
        const utcDate = new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
        ));

        return this.formatDateUTC(utcDate);
    }

    formatDateUTC(date) {
        const day = String(date.getUTCDate()).padStart(2, '0');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');

        return `${day} ${month} ${year} ${hours}:${minutes}:${seconds} UTC`;
    }

    ensureEventDetailsElements() {
        let container = document.getElementById('eventDetails');
        if (!container) {
            container = document.createElement('div');
            container.id = 'eventDetails';
            container.className = 'event-details p-3';
            document.body.appendChild(container); // Or insert it where you want
        }

        let title = document.getElementById('eventDetailsTitle');
        if (!title) {
            title = document.createElement('h5');
            title.id = 'eventDetailsTitle';
            title.textContent = 'Event Details';
            container.appendChild(title);
        }

        let noEventMsg = document.getElementById('noEventMessage');
        if (!noEventMsg) {
            noEventMsg = document.createElement('p');
            noEventMsg.id = 'noEventMessage';
            noEventMsg.textContent = 'Select a date to see event details.';
            container.appendChild(noEventMsg);
        }

        let content = document.getElementById('eventDetailsContent');
        if (!content) {
            content = document.createElement('div');
            content.id = 'eventDetailsContent';
            container.appendChild(content);
        }

        return { container, title, noEventMsg, content };
    }

    showDayEventsOnPageLoad() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const showDayEvents = urlParams.get('showDayEvents');
        if (showDayEvents) {
            for (const [key, anomaly] of Object.entries(this.anomalies)) {

                // Parse showDayEvents and publicationDate as Date for comparison
                const parts = showDayEvents.split('/');
                const showDateStr = this.normalizeDateString(showDayEvents);
                const anomalyDateStr = this.normalizeDateString(anomaly.publicationDate);
                if (showDateStr && showDateStr === anomalyDateStr) {
                    this.showEventDetails(anomalyDateStr);
                }
            }
        }
        //this.generateCalendar(this.currentMonth, this.currentYear);
    }

}
const calendar = new CalendarWidget();
window.calendar = calendar; // make it accessible globally