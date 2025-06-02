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

const mockDataTakes = [];

const formatDataDetail = [];


class Datatakes {
    constructor(mockDataTakes, formatDataDetail) {
        this.mockDataTakes = mockDataTakes;
        this.formatDataDetail = formatDataDetail;
        this.currentPage = 1;
        this.rowsPerPage = 10;
        this.currentInfoPage = 1;
        this.itemsPerPage = 7;
        this.currentDataArray = [];
        this.donutChartInstance = null;
        this.resizeListenerAttached = false;
        //this.bindEvents();
    }

    init() {
        document.addEventListener("DOMContentLoaded", () => {
            // Hide EC and Copernicus logos from header
            $('#copernicus-logo-header').hide();
            $('#ec-logo-header').hide();
            $('#esa-logo-header').hide();

            /*limit the diplay data takes*/
            this.displayedCount = 0;
            this.itemsPerPage = 10;


            // Populate the data list and set default view
            this.populateDataList(false);
            this.attachEventListeners();
            this.setDefaultView();


            // Retrieve the user profile to determine quarter authorization
            ajaxCall(
                '/api/auth/quarter-authorized',
                'GET',
                {},
                this.quarterAuthorizedProcess,
                this.errorLoadAuthorized
            );

            // Retrieve the time select combo box instance
            const time_period_sel = document.getElementById('time-period-select');

            // Apply filtering on page load
            if (this.filterDatatakesOnPageLoad()) {
                // If filtered, set some UI state, like time period select
                const time_period_sel = document.getElementById('time-period-select');
                if (time_period_sel) time_period_sel.value = 'last-quarter';
            } else {
                // No search filter, load default data
                const time_period_sel = document.getElementById('time-period-select');
                if (time_period_sel) time_period_sel.value = 'week';
                this.populateDataList(false);
            }

            // Add event listener for user selection
            time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));

            // Load datatakes for the selected period
            this.loadDatatakesInPeriod(time_period_sel.value);

            console.log("Datatakes initialized.");

        });
    }

    /*bindEvents() {
        document.getElementById("infoButton").addEventListener("click", () => this.toggleInfoTable());
    }*/

    filterDatatakesOnPageLoad() {
        var queryString = window.location.search;
        var urlParams = new URLSearchParams(queryString);
        var searchFilter = urlParams.get('search');
        if (searchFilter) {
            console.info('Accessing page with search filter: ' + searchFilter);
            // Filter the data by matching the 'id' containing searchFilter (case-insensitive)
            this.filteredDataTakes = this.mockDataTakes.filter(take =>
                take.id.toLowerCase().includes(searchFilter.toLowerCase())
            );

            // Populate data list with filtered results
            this.populateDataList(false);

            return true;
        } else {
            // No filter - reset filteredDataTakes so populate uses full list
            this.filteredDataTakes = null;
            return false;
        }
    }

    on_timeperiod_change() {
        var time_period_sel = document.getElementById('time-period-select')
        console.log("Time period changed to " + time_period_sel.value)
        this.loadDatatakesInPeriod(time_period_sel.value);
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
        for (var i = 0; i < rows.length; ++i) {

            // Auxiliary variables
            var anomaly = rows[i];
            var datatakes_completeness = format_response(anomaly["datatakes_completeness"]);
            for (var index = 0; index < datatakes_completeness.length; ++index) {
                try {
                    for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'', '\"')))) {
                        var datatake_id = Object.values(value)[0];
                        var completeness = this.calcDatatakeCompleteness(Object.values(value));
                        if (completeness < this.completeness_threshold) {
                            this.datatakesEventsMap[datatake_id] = anomaly;
                        }
                    }
                } catch (ex) {
                    console.warn("Error ", ex);
                    console.warn('An error occurred, while parsing the product level count string: ' +
                        datatakes_completeness[index].replaceAll('\'', '\"'));
                }
            }
        }
        return;
    }

    errorLoadAnomalies(response) {
        console.error(response);
    }

    successLoadDatatakes(response) {
        const rows = format_response(response);
        console.info('Datatakes successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Prepare the datatake list
        const datatakes = [];

        for (const row of rows) {
            const element = row['_source'];

            // Build satellite unit name (e.g., "S1A (IW)")
            let sat_unit = element['satellite_unit'];
            if (sat_unit.includes('S1') || sat_unit.includes('S2')) {
                sat_unit += ` (${element['instrument_mode']})`;
            }

            // Generate the datatake key (convert S1A IDs if needed)
            let datatake_id = element['datatake_id'];
            if (sat_unit.includes('S1')) {
                datatake_id = this.overrideS1DatatakesId(datatake_id);
            }

            // Parse sensing time range
            const sensing_start = moment(element['observation_time_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            const sensing_stop = moment(element['observation_time_stop'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();

            // Push to list 
            datatakes.push({
                id: datatake_id,
                satellite: sat_unit,
                start: sensing_start,
                stop: sensing_stop,
                completenessStatus: element['completeness_status'],
                raw: element
            });
        }

        // Save the processed datatakes to the instance variable used by populateDataList
        this.mockDataTakes = datatakes;

        // Reset pagination count before repopulating
        this.displayedCount = 0;

        // Populate the UI list
        this.populateDataList(false);
        // If at least one datatake exists, update title and render
        if (datatakes.length > 0) {
            const first = datatakes[0];

            // Call your new method to update title and date
            this.updateTitleAndDate(datatakes.id);

            //Extract linkKey from datatake ID and update the chart
            this.updateCharts(first);
        }

    }

    errorLoadDatatake(response) {
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
        //allMissionData.push.apply(allMissionData, this.datatakeRows);

        // Empty the table and reload rows
        /*if (this.dataTakeTable) {
            this.dataTakeTable.clear().rows.add(allMissionData).draw();
        }*/
    }

    getGroundStation(id) {
        if (id.includes("S1A") || id.includes("S1C")) return "Sentinel 1";
        if (id.includes("S2A") || id.includes("S2B")) return "Sentinel 2";
        if (id.includes("S3")) return "Sentinel 3";
        if (id.includes("S5P")) return "Sentinel 5P";
        return "Sentinel";
    }

    populateDataList(append = false) {
        const dataList = document.getElementById("dataList");
        const data = this.filteredDataTakes?.length ? this.filteredDataTakes : this.mockDataTakes;

        if (!append) {
            dataList.innerHTML = "";
            this.displayedCount = 0;
        }

        const nextItems = data.slice(this.displayedCount, this.displayedCount + this.itemsPerPage);

        if (nextItems.length === 0 && !append) {
            const li = document.createElement("li");
            li.textContent = "No results found";
            li.style.color = "#aaa";
            dataList.appendChild(li);
            document.getElementById("loadMoreBtn").style.display = "none";
            return;
        }


        nextItems.forEach((take, index) => {
            const li = document.createElement("li");

            const containerDiv = document.createElement("div");
            containerDiv.classList.add('container-border');

            containerDiv.style.display = "inline-flex";
            containerDiv.style.alignItems = "center";
            containerDiv.style.gap = "8px";
            containerDiv.style.cursor = "pointer";
            const a = document.createElement("a");
            a.href = "#";
            a.className = "filter-link";
            a.dataset.filterType = "groundStation";
            a.dataset.filterValue = this.getGroundStation(take.id);
            a.textContent = take.id;
            // Only preselect the very first item on a fresh load
            if (!append && this.displayedCount === 0 && index === 0) {
                containerDiv.classList.add('selected');
                a.classList.add('selected');
            }

            // Prevent <a> default click behavior to avoid jumping
            a.addEventListener('click', e => e.preventDefault());

            // Add click event to update chart
            containerDiv.addEventListener('click', () => {
                dataList.querySelectorAll('.container-border.selected').forEach(el => el.classList.remove('selected'));
                containerDiv.classList.add('selected');

                dataList.querySelectorAll('a.selected').forEach(el => el.classList.remove('selected'));
                a.classList.add('selected');

                this.updateCharts(take);

                // Call your new method to update title and date
                this.updateTitleAndDate(take.id);
            });

            // Add status circle
            const statusCircle = document.createElement("div");
            const status = take.completenessStatus?.ACQ?.status?.toLowerCase() || "unknown";
            statusCircle.className = `status-circle-dt-${status}`;

            containerDiv.appendChild(a);
            containerDiv.appendChild(statusCircle);
            li.appendChild(containerDiv);
            dataList.appendChild(li);
        });

        this.displayedCount += nextItems.length;

        const loadMoreBtn = document.getElementById("loadMoreBtn");
        if (this.displayedCount >= data.length) {
            loadMoreBtn.style.display = "none";
        } else {
            loadMoreBtn.style.display = "block";
        }

        if (!append && nextItems.length > 0) {
            const firstLink = dataList.querySelector('a');
            if (firstLink) firstLink.click();
        }
    }

    toggleTableSection() {
        const tableSection = document.getElementById("tableSection");
        const activeLink = document.querySelector(".filter-link.active");

        if (!tableSection || !activeLink) {
            console.error("Table section or active sidebar link not found!");
            return;
        }

        const selectedKey = activeLink.textContent.trim();
        if (tableSection.style.display === "none" || tableSection.style.display === "") {
            tableSection.style.display = "block";
            tableSection.style.opacity = "0";
            setTimeout(() => {
                tableSection.style.transition = "opacity 0.5s ease-in-out";
                tableSection.style.opacity = "1";
            }, 50);

            const selectedData = this.mockDataTakes.find(item => item.id === selectedKey);
            if (selectedData) {
                this.renderTableWithoutPagination([selectedData], selectedKey);
            }
        } else {
            tableSection.style.transition = "opacity 0.5s ease-in-out";
            tableSection.style.opacity = "0";
            setTimeout(() => {
                tableSection.style.display = "none";
            }, 500);
        }
    }

    async toggleInfoTable() {
        this.fromInfoIcon = true;

        const infoTable = document.getElementById("infoTableContainer");
        const paragraph = document.querySelector(".chart-container h4");
        if (!infoTable || !paragraph) {
            console.error("Info table container or paragraph not found!");
            return;
        }

        let fullText = paragraph.textContent.trim().replace(/_/g, "-");
        const parts = fullText.split("-");
        const selectedId = parts.slice(0, 3).join("-");

        console.log("Looking for datatake ID:", selectedId);

        try {
            await this.renderInfoTable(selectedId);

            const shouldShow = infoTable.style.display === "none" || infoTable.style.display === "";
            if (shouldShow) {
                infoTable.style.display = "block";
                infoTable.style.opacity = "0";
                setTimeout(() => {
                    infoTable.style.transition = "opacity 0.3s ease-in-out";
                    infoTable.style.opacity = "1";
                }, 50);
            } else {
                infoTable.style.transition = "opacity 0.3s ease-in-out";
                infoTable.style.opacity = "0";
                setTimeout(() => {
                    infoTable.style.display = "none";
                }, 300);
            }
        } catch (err) {
            console.error("Failed to render info table for datatake:", selectedId, err);
        } finally {
            this.fromInfoIcon = false;
        }
    }

    async renderInfoTable(dataInput, page = 1) {
        const tableBody = document.getElementById("infoTableBody");
        const paginationControls = document.getElementById("paginationControls");
        tableBody.innerHTML = "";
        paginationControls.innerHTML = "";

        let dataArray = [];

        // If a string (datatake ID) is passed, fetch details first
        if (typeof dataInput === "string") {
            const datatake_id = dataInput.split('(')[0].trim();
            $('#datatake-details').empty().html(`
                <div class="spinner">
                    <div class="bounce1"></div>
                    <div class="bounce2"></div>
                    <div class="bounce3"></div>
                </div>`);

            try {
                const response = await fetch(`/api/worker/cds-datatake/${datatake_id}`);
                if (!response.ok) throw new Error("Failed to fetch datatake details");
                const json = await response.json();
                const datatake = format_response(json)[0];

                // Format data from API to match table structure
                for (let key of Object.keys(datatake)) {
                    if (key.includes('local_percentage')) {
                        dataArray.push({
                            productType: key.replace('_local_percentage', ''),
                            status: datatake[key].toFixed(2)
                        });
                    }
                }

                $('#datatake-details').empty().append(`
                    <div class="form-group">
                        <label>Datatake ID: ${datatake.key}</label>
                        <label style="margin-left: 20px;">Timeliness: ${datatake.timeliness}</label>
                    </div>
                `);
            } catch (err) {
                $('#datatake-details').append(`
                    <div class="form-group">
                        <label>An error occurred while retrieving the datatake details</label>
                    </div>
                `);
                console.error(err);
                return;
            }
        } else {
            dataArray = dataInput;
        }

        // Proceed with rendering the table
        if (!dataArray || dataArray.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 2;
            cell.textContent = "No data available.";
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        this.currentDataArray = dataArray;
        const totalItems = dataArray.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        this.currentPage = page;

        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const pageItems = dataArray.slice(startIndex, endIndex);

        pageItems.forEach(item => {
            const row = document.createElement("tr");

            const productTypeCell = document.createElement("td");
            productTypeCell.textContent = item.productType || "-";

            const statusCell = document.createElement("td");
            statusCell.textContent = item.status ?? "-";

            row.appendChild(productTypeCell);
            row.appendChild(statusCell);
            tableBody.appendChild(row);
        });

        if (totalPages > 1) {
            const createButton = (text, pageNum, disabled = false, isActive = false) => {
                const btn = document.createElement("button");
                btn.textContent = text;
                btn.disabled = disabled;
                btn.classList.add("pagination-btn");
                if (isActive) btn.classList.add("active");
                btn.addEventListener("click", () => this.renderInfoTable(this.currentDataArray, pageNum));
                return btn;
            };

            paginationControls.appendChild(createButton("« Prev", this.currentPage - 1, this.currentPage === 1));
            for (let i = 1; i <= totalPages; i++) {
                paginationControls.appendChild(createButton(i, i, false, i === this.currentPage));
            }
            paginationControls.appendChild(createButton("Next »", this.currentPage + 1, this.currentPage === totalPages));
        }
    }

    updateCharts(linkKey) {
        const donutChartContainer = document.querySelector("#missionDonutChart");
        if (!donutChartContainer) {
            console.error("missionDonutChart container not found!");
            return;
        }

        const relevantData = this.mockDataTakes.filter(dt => dt.id.startsWith(linkKey));
        if (relevantData.length === 0) {
            console.warn(`No data found for platform: ${relevantData}`);
            return;
        }

        const colorMap = {
            PARTIAL: ['#FFD700', '#FFF8DC'],
            PUBLISHED: ['#4caf50', '#A5D6A7'],
            UNAVAILABLE: ['#FF0000', '#FF9999'],
            PLANNED: ['#9e9e9e', '#E0E0E0'],
            PROCESSING: ['#9e9e9e', '#E0E0E0'],
            UNKNOWN: ['#666666', '#999999'] // Fallback for unknown publication types
        };


        const series = [];
        const labels = [];
        const colors = [];
        // Collect and inspect unique publication types
        const uniquePublicationTypes = new Set();

        const pubValues = new Set();
        relevantData.forEach(entry => {
            const pubVal = entry.raw;
            pubValues.add(pubVal);
        });
        console.log("Unique raw.publication values from backend:", Array.from(pubValues));


        relevantData.forEach(entry => {
            const raw = entry.raw?.completeness_status?.PUB || {};
            const publicationType = raw.status?.toUpperCase() || "UNKNOWN";
            uniquePublicationTypes.add(publicationType);
            const percentage = parseFloat(raw.percentage) || 0;
            const remaining = Math.max(0, 100 - percentage);

            const [completeColor, missingColor] = colorMap[publicationType] || colorMap["UNKNOWN"];

            // Add "Complete" slice
            labels.push("Complete");
            series.push(parseFloat(percentage.toFixed(2)));
            colors.push(completeColor);

            // Add "Missing" slice
            labels.push("Missing");
            series.push(parseFloat(remaining.toFixed(2)));
            colors.push(missingColor);
        });

        console.log(" Unique publication types found in data:", Array.from(uniquePublicationTypes));

        // Destroy existing chart before rendering a new one
        if (this.donutChartInstance) {
            this.donutChartInstance.destroy();
        }

        // Chart configuration
        const options = {
            chart: { type: 'donut', height: 350, toolbar: { show: false } },
            series,
            labels,
            colors,
            tooltip: {
                y: {
                    formatter: val => `${val.toFixed(2)}%`
                }
            },
            states: {
                hover: {
                    filter: {
                        type: 'darken',
                        value: 0.15
                    }
                }
            },
            legend: {
                show: true,
                position: 'right',
                horizontalAlign: 'left',
                labels: { colors: '#FFFFFF' },
                itemMargin: {
                    vertical: 7
                },
                markers: {
                    width: 12,
                    height: 12,
                    offsetX: -5, // Fine-tune horizontal alignment
                    offsetY: 0
                },
                formatter: function (seriesName, opts) {
                    return `<div style="margin-left: 0px;">${seriesName}</div>`; // Add horizontal space between marker and text
                }
            },
            plotOptions: {
                pie: {
                    donut: {
                        labels: {
                            show: true,
                            name: { color: '#FFFFFF' },
                            value: { color: '#FFFFFF' },
                            total: {
                                show: true,
                                label: 'Completion',
                                color: '#FFFFFF',
                                formatter: () => {
                                    const total = series.filter((_, i) => i % 2 === 0).reduce((acc, val) => acc + val, 0);
                                    const avg = total / (series.length / 2);
                                    return `${avg.toFixed(1)}%`;
                                }
                            }
                        }
                    }
                }
            },
            responsive: [{
                breakpoint: 768,
                options: {
                    chart: {
                        height: 300
                    },
                    legend: {
                        position: 'bottom',
                        horizontalAlign: 'center'
                    }
                }
            }]
        };

        this.donutChartInstance = new ApexCharts(donutChartContainer, options);
        this.donutChartInstance.render();
        // Ensure responsive resizing
        window.addEventListener("resize", () => {
            if (this.donutChartInstance?.resize) {
                this.donutChartInstance.resize();
            }
        });
        this.resizeListenerAttached = true;
    }

    hideTable() {
        document.getElementById('tableSection').style.display = 'none';
    }

    hideInfoTable() {
        document.getElementById('infoTableContainer').style.display = 'none';
    }

    filterSidebarItems() {
        const selectedMission = document.getElementById("mission-select").value.toUpperCase();
        const searchQuery = document.getElementById("searchInput").value.toUpperCase();
        const acquisitionStatusFilter = document.getElementById("acqStatusFilter")?.value.toUpperCase();

        this.filteredDataTakes = this.mockDataTakes.filter(take => {
            const id = take.id.toUpperCase();
            const satellite = (take.satellite || take.raw?.satellite_unit || "").toUpperCase();
            const acqStatus = take.raw?.completeness_status?.ACQ?.status?.toUpperCase() || "UNKNOWN";
            const pubStatus = take.raw?.completeness_status?.PUB?.status?.toUpperCase() || "UNKNOWN";
            const overallStatus = take.completenessStatus ? JSON.stringify(take.completenessStatus).toUpperCase() : "";

            const matchesMission = !selectedMission || id.startsWith(selectedMission);
            const matchesSearch = !searchQuery || searchQuery.split(/\s+/).every(q =>
                id.includes(q) ||
                satellite.includes(q) ||
                acqStatus.includes(q) ||
                pubStatus.includes(q) ||
                overallStatus.includes(q)
            );

            const matchesAcqStatus = !acquisitionStatusFilter || acqStatus === acquisitionStatusFilter;

            return matchesMission && matchesSearch && matchesAcqStatus;
        });

        this.displayedCount = 0; // reset count for pagination
        this.populateDataList(false); // re-render filtered list from scratch
    }

    renderTableWithoutPagination(dataset, selectedId = '', searchQuery = '') {
        const tableBody = document.getElementById("dataTableBody");
        const tableSection = document.getElementById("tableSection");

        if (!tableSection || !tableBody) {
            console.error("Table section or body not found in the DOM!");
            return;
        }

        tableSection.style.display = "none";
        tableBody.innerHTML = "";

        // Find the selected data entry
        const selectedData = dataset.find(item => item.id === selectedId);
        if (!selectedData) {
            console.warn(`No data found for: ${selectedId}`);
            return;
        }

        let data = [selectedData];


        // Apply optional search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.id.toLowerCase().includes(query) ||
                item.satellite.toLowerCase().includes(query)
            );
        }

        // Render each row
        data.forEach(row => {
            const raw = row.raw || {};
            const completeness = raw.completeness_status || {};

            const acqStatus = completeness.ACQ?.status?.toUpperCase() || "UNKNOWN";
            const pubStatus = completeness.PUB?.status?.toUpperCase() || "UNKNOWN";

            const platform = row.satellite || raw.satellite_unit || "N/A";
            const startTime = row.start ? moment(row.start).format('YYYY-MM-DD HH:mm') : "N/A";
            const stopTime = row.stop ? moment(row.stop).format('YYYY-MM-DD HH:mm') : "N/A";

            // Status colors
            const acquisitionColor = acqStatus === "ACQUIRED" ? "#0aa41b" :
                acqStatus === "UNAVAILABLE" ? "#FF0000" :
                    acqStatus === "PARTIAL" ? "#FFD700" : "#818181";

            const publicationColor = pubStatus === "PUBLISHED" ? "#0aa41b" :
                pubStatus === "UNAVAILABLE" ? "#FF0000" :
                    pubStatus === "PARTIAL" ? "#FFD700" : "#818181";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.id}</td>
                <td>${platform}</td>
                <td>${startTime}</td>
                <td>${stopTime}</td>
                <td><span class="status-badge" style="background-color:${acquisitionColor}">${acqStatus}</span></td>
                <td><span class="status-badge" style="background-color:${publicationColor}">${pubStatus}</span></td>
                <td>
                    <button type="button" class="btn-link view-btn">
                        View Details
                    </button>
                </td>
            `;

            // Attach the event listener to the icon button
            const button = tr.querySelector("button");
            button.addEventListener("click", () => this.toggleInfoTable());

            tableBody.appendChild(tr);
        });

        tableSection.style.display = "block";
    }

    updateTitleAndDate(selectedKey) {
        const titleSpan = document.querySelector(".chart-container h4 .title-text");
        const dateElement = document.querySelector(".chart-container p.text-left");

        if (!titleSpan || !dateElement) {
            console.error("Title span or date element not found!");
            return;
        }

        const dataTake = this.mockDataTakes.find(item => item.id === selectedKey);
        if (dataTake) {
            const startDate = new Date(dataTake.start).toISOString().replace("T", " ").slice(0, 19);
            titleSpan.textContent = `${dataTake.id}`;
            dateElement.textContent = `${startDate}`;
        }
    }

    resetFilters() {
        // Reset filter form inputs
        const missionSelect = document.getElementById("mission-select");
        const searchInput = document.getElementById("searchInput");
        const acqStatusFilter = document.getElementById("acqStatusFilter");

        if (missionSelect) missionSelect.value = "";
        if (searchInput) searchInput.value = "";
        if (acqStatusFilter) acqStatusFilter.value = "";
        // Ensure internal state is cleared
        this.filteredDataTakes = []; // or null or undefined


        // Re-run filtering logic which will default to mockDataTakes
        this.filterSidebarItems();

        // Hide table, as expected
        this.hideTable();
    }

    attachEventListeners() {
        const searchInput = document.getElementById("searchInput");
        const dataList = document.getElementById("dataList");
        //const infoButton = document.getElementById("infoButton");
        const tableSection = document.getElementById("tableSection");
        const missionSelect = document.getElementById("mission-select");
        const resetBtn = document.getElementById("resetFilterButton");

        //if (!dataList || !infoButton || !tableSection) {
        if (!dataList || !tableSection) {
            console.error("One or more DOM elements missing for setup.");
            return;
        }

        // Hide table by default
        tableSection.style.display = "none";

        // Toggle table section (if logic needed)
        /*infoButton.addEventListener("click", () => {
            tableSection.style.display = tableSection.style.display === "none" ? "block" : "none";
        });*/

        // Filter list on input
        if (searchInput) {
            searchInput.addEventListener("input", () => this.filterSidebarItems());
        }

        // Mission dropdown
        if (missionSelect) {
            missionSelect.addEventListener("change", () => {
                if (missionSelect.value === "") {
                    searchInput.value = ""; // Reset search
                }
                this.filterSidebarItems();
                this.hideTable();
            });
        }

        const closeBtn = document.getElementById("closeTableButton");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                this.hideTable();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => this.resetFilters());
        }

        // Load More Button 
        document.getElementById("loadMoreBtn").addEventListener("click", () => {
            this.populateDataList(true); // append = true
        });


        // Sidebar link click handling
        dataList.addEventListener("click", (e) => {
            const target = e.target.closest("a.filter-link");
            if (!target) return;

            e.preventDefault();

            // Remove active class from all links
            document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
            target.classList.add("active");

            // Remove selected class from all container divs
            document.querySelectorAll(".container-border.selected").forEach(div => div.classList.remove("selected"));

            // Add selected class to the clicked link's container div
            const containerDiv = target.closest('.container-border');
            if (containerDiv) {
                containerDiv.classList.add("selected");
            }

            const selectedKey = target.textContent.trim();
            this.updateCharts(selectedKey);
            this.renderTableWithoutPagination(this.mockDataTakes, selectedKey);
            this.updateTitleAndDate(selectedKey);
            this.hideInfoTable();
        });
    }

    setDefaultView() {
        const sidebarItems = document.querySelectorAll(".filter-link");
        const firstLink = sidebarItems[0];

        if (!firstLink) {
            console.warn("No sidebar items found.");
            return;
        }

        firstLink.classList.add("active");

        const defaultKey = firstLink.textContent.trim();
        this.updateTitleAndDate(defaultKey);
        this.updateCharts(defaultKey);
    }
}

window.datatakes = new Datatakes(mockDataTakes, formatDataDetail);