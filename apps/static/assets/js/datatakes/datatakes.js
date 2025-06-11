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
        this.datatakesEventsMap = {};
        this.currentMission = "";
        this.currentSearchTerm = "";

        // Threshold used to state the completeness
        this.completeness_threshold = 90;

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

            // Add event listener for user selection
            time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));

            // Load datatakes for the selected period
            this.loadDatatakesInPeriod(time_period_sel.value);

            console.log("Datatakes initialized.");

        });
    }

    filterDatatakesOnPageLoad() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const searchFilter = urlParams.get('search');
        console.info("Search param:", searchFilter);

        if (searchFilter) {
            console.info('Accessing page with search filter: ' + searchFilter);
            // Filter the data by matching the 'id' containing searchFilter (case-insensitive)
            this.filteredDataTakes = this.mockDataTakes.filter(take =>
                take.id.toLowerCase().includes(searchFilter.toLowerCase())
            );

            // Populate data list with filtered results
            //this.populateDataList(false);

            // Manually update charts and title for first match
            /*if (this.filteredDataTakes.length > 0) {
                const first = this.filteredDataTakes[0];
                this.updateCharts(first);
                this.updateTitleAndDate(first.id);
            }*/

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
        this.loadDatatakesInPeriod(time_period_sel.value, true);
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

    loadDatatakesInPeriod(selected_time_period, shouldReapplyFilters = false) {
        console.info("Invoking events retrieval...");
        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
            this.successLoadAnomalies.bind(this), this.errorLoadAnomalies);
    
        console.info("Invoking Datatakes retrieval...");
    
        const urlMap = {
            day: '/api/worker/cds-datatakes/last-24h',
            week: '/api/worker/cds-datatakes/last-7d',
            month: '/api/worker/cds-datatakes/last-30d',
            'prev-quarter': '/api/worker/cds-datatakes/previous-quarter',
            default: '/api/worker/cds-datatakes/last-quarter'
        };
    
        const url = urlMap[selected_time_period] || urlMap.default;
    
        asyncAjaxCall(url, 'GET', {},
            (response) => {
                this.successLoadDatatakes(response);
    
                if (shouldReapplyFilters) {
                    const hasSearch = this.filterDatatakesOnPageLoad(); // apply search param
                    if (!hasSearch) {
                        this.filterSidebarItems(); // apply UI filters
                    }
                }
            },
            this.errorLoadDatatake
        );
    }

    successLoadAnomalies(response) {

        console.log('this inside successLoadAnomalies →', this);
        this.datatakesEventsMap = {};

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
        console.info("Number of records11-06: " + rows.length);

        const datatakes = rows.map(row => {
            const element = row['_source'];
            let sat_unit = element['satellite_unit'];
            if (sat_unit.includes('S1') || sat_unit.includes('S2')) {
                sat_unit += ` (${element['instrument_mode']})`;
            }
            let datatake_id = element['datatake_id'];
            if (sat_unit.includes('S1')) {
                datatake_id = this.overrideS1DatatakesId(datatake_id);
            }
            const sensing_start = moment(element['observation_time_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            const sensing_stop = moment(element['observation_time_stop'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();

            return {
                id: datatake_id,
                satellite: sat_unit,
                start: sensing_start,
                stop: sensing_stop,
                completenessStatus: element['completeness_status'],
                raw: element
            };
        });

        this.mockDataTakes = datatakes;
        this.displayedCount = 0;

        const hasSearchParam = this.filterDatatakesOnPageLoad(); //sets this.filteredDataTakes
        if (hasSearchParam) {
            const sel = document.getElementById('time-period-select');
            if (sel) sel.value = 'last-quarter';
        }

        this.populateDataList(false); //respects .filteredDataTakes if set

        const list = this.filteredDataTakes?.length ? this.filteredDataTakes : datatakes;

        if (list.length > 0) {
            this.handleInitialSelection(list[0]);
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

        console.log("filteredDataTakes", this.filteredDataTakes);
        console.log("mockDataTakes", this.mockDataTakes);
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

                this.updateCharts(take.id);

                // Call new method to update title and date
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

    async toggleInfoTable(passedId = null) {
        this.fromInfoIcon = true;

        const infoTable = document.getElementById("infoTableContainer");
        const paragraph = document.querySelector(".chart-container h4");
        if (!infoTable || !paragraph) {
            console.error("Info table container or paragraph not found!");
            return;
        }

        let selectedId = passedId;

        // fallback to chart header text if no ID was passed
        if (!selectedId && paragraph) {
            const fullText = paragraph.textContent.trim().replace(/_/g, "-");
            const parts = fullText.split("-");
            selectedId = parts.slice(0, 3).join("-");
        }

        console.log("Looking for datatake ID:", selectedId);

        if (!selectedId) {
            console.error("No valid datatake ID to use for info table.");
            return;
        }

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

        if (typeof linkKey !== "string") {
            console.warn("updateCharts: Expected string linkKey but got", typeof linkKey, linkKey);
            console.warn("linkKey value and type", linkKey, typeof linkKey);
            console.warn("linkKey as JSON:", JSON.stringify(linkKey, null, 2));

        }

        const normalizedLinkKey = typeof linkKey === "string"
            ? linkKey
            : (linkKey?.id || linkKey?.toString?.() || "").toString();

        if (!normalizedLinkKey) {
            console.warn("updateCharts: Could not derive a valid string linkKey from input", linkKey);
            return;
        }


        const relevantData = this.mockDataTakes.filter(dt =>
            (dt.id || "").toUpperCase().startsWith((normalizedLinkKey || "").toString().toUpperCase())
        );

        if (relevantData.length > 0) {
            console.log("DEBUG: Example matching datatake ID:", relevantData[0].id);
        } else {
            console.warn("DEBUG: No matching datatakes found for linkKey:", linkKey);
        }

        if (relevantData.length === 0) {
            console.warn(`No data found for platform: ${relevantData}`);
            return;
        }

        const colorMap = {
            PARTIAL: ['#bb8747', '#e6c9a0'],
            ACQUIRED: ['#4caf50', '#A5D6A7'],
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
            const raw = entry.raw?.completeness_status?.ACQ || {};
            const publicationType = raw.status?.toUpperCase() || "UNKNOWN";
            uniquePublicationTypes.add(publicationType);
            const percentage = parseFloat(raw.percentage) || 0;
            const remaining = Math.max(0, 100 - percentage);

            const [completeColor, missingColor] = colorMap[publicationType] || colorMap["UNKNOWN"];

            // Add "Complete" slice
            labels.push("Complete");
            series.push(parseFloat(percentage.toFixed(2)));
            colors.push(completeColor);
            console.log("percentage type", percentage);
            console.log("remaining color", remaining);

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
                    vertical: 5,
                    horizontal: 2
                },
                markers: {
                    width: 12,
                    height: 12,
                    offsetX: -12, // Fine-tune horizontal alignment
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
        //document.getElementById('tableSection').style.display = 'none';
        const tableSection = document.getElementById("tableSection");
        if (!tableSection) return;

        tableSection.style.transition = "opacity 0.5s ease-in-out";
        tableSection.style.opacity = "0";
        setTimeout(() => {
            tableSection.style.display = "none";
        }, 500);
    }

    hideInfoTable() {
        document.getElementById('infoTableContainer').style.display = 'none';
    }

    filterSidebarItems() {
        const selectedMission = document.getElementById("mission-select").value.toUpperCase();
        const searchQuery = document.getElementById("searchInput").value.toUpperCase();
        const acquisitionStatusFilter = document.getElementById("acqStatusFilter")?.value.toUpperCase();

        const searchTerms = searchQuery.split(/\s+/).map(s => s.trim()).filter(Boolean);

        try {
            this.filteredDataTakes = this.mockDataTakes.filter(take => {
                const id = (take.id || "").toUpperCase();
                const satellite = (take.satellite || take.raw?.satellite_unit || "").toUpperCase();
                const acqStatus = take.raw?.completeness_status?.ACQ?.status?.toUpperCase() || "UNKNOWN";
                const pubStatus = take.raw?.completeness_status?.PUB?.status?.toUpperCase() || "UNKNOWN";
                const overallStatus = take.completenessStatus ? JSON.stringify(take.completenessStatus).toUpperCase() : "";

                let acquisitionDateRaw = take.raw?.observation_time_start || take.start || "";
                let acquisitionDate = "";

                if (acquisitionDateRaw instanceof Date) {
                    acquisitionDate = acquisitionDateRaw.toISOString().split("T")[0].toUpperCase();
                } else if (typeof acquisitionDateRaw === "string") {
                    acquisitionDate = acquisitionDateRaw.includes("T")
                        ? acquisitionDateRaw.split("T")[0].toUpperCase()
                        : acquisitionDateRaw.toUpperCase();
                }
                const matchesMission = !selectedMission || id.startsWith(selectedMission);
                const matchesAcqStatus = !acquisitionStatusFilter || acqStatus === acquisitionStatusFilter;

                const matchesSearch = !searchTerms.length || searchTerms.every(term => {
                    const termMatch = id.includes(term) ||
                        satellite.includes(term) ||
                        acqStatus.includes(term) ||
                        pubStatus.includes(term) ||
                        overallStatus.includes(term) ||
                        acquisitionDate.includes(term);

                    if (!termMatch) {
                        console.debug(`Term "${term}" did NOT match this take`, {
                            id, satellite, acqStatus, pubStatus, acquisitionDate
                        });
                    } else {
                        console.debug(`Term "${term}" matched`, {
                            id, satellite, acquisitionDate
                        });
                    }
                    if (!acquisitionDate) {
                        console.debug("Skipping take with no date:", take.id);
                    }
                    return termMatch;
                });

                return matchesMission && matchesSearch && matchesAcqStatus;
            });

        } catch (err) {
            console.error("Error during filtering:", err);
        }

        this.displayedCount = 0; // reset count for pagination
        this.populateDataList(false); // re-render filtered list from scratch
        const first = this.filteredDataTakes?.[0];
        if (first) {
            this.handleInitialSelection(first); // updates charts, title, highlights, table
        } else {
            this.hideTable(); // hide table if nothing matches
        }
    }

    showTableSection(firstId) {
        const tableSection = document.getElementById("tableSection");
        if (!tableSection) return;

        const selectedData = this.mockDataTakes.find(item => item.id === firstId);
        if (!selectedData) return;

        this.renderTableWithoutPagination([selectedData], firstId);

        //tableSection.style.display = "block";
        tableSection.style.opacity = "0";
        setTimeout(() => {
            tableSection.style.transition = "opacity 0.5s ease-in-out";
            tableSection.style.opacity = "1";
        }, 50);
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

        // Apply search filter
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
                    acqStatus === "PARTIAL" ? "#bb8747" : "#818181";

            const publicationColor = pubStatus === "PUBLISHED" ? "#0aa41b" :
                pubStatus === "UNAVAILABLE" ? "#FF0000" :
                    pubStatus === "PARTIAL" ? "#bb8747" : "#818181";

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
            button.addEventListener("click", () => this.toggleInfoTable(row.id));


            tableBody.appendChild(tr);
        });
        console.log("render the table");

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

        // Clear internal state
        this.filteredDataTakes = []; // or null or undefined
        this.currentMission = "";
        this.currentSearchTerm = "";

        // Reset the URL (remove query params/hash)
        if (window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
        }

        //Reset sidebar highlights
        document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
        document.querySelectorAll(".container-border.selected").forEach(div => div.classList.remove("selected"));

        //Re-render full datalist
        this.displayedCount = 0;
        this.populateDataList(false);

        // Select the first item and load its data
        const first = this.mockDataTakes?.[0];
        if (first) {
            this.handleInitialSelection(first);
        }

        // Clear any open detail sections
        this.hideInfoTable?.();//side table of the pie chart
    }

    attachEventListeners() {
        const searchInput = document.getElementById("searchInput");
        const dataList = document.getElementById("dataList");
        const tableSection = document.getElementById("tableSection");
        const missionSelect = document.getElementById("mission-select");
        const resetBtn = document.getElementById("resetFilterButton");

        if (!dataList || !tableSection) {
            console.error("One or more DOM elements missing for setup.");
            return;
        }

        // Hide table by default
        tableSection.style.display = "none";

        // Filter list on input
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                this.currentSearchTerm = searchInput.value;
                this.filterSidebarItems();
            });
        }

        // Mission dropdown
        if (missionSelect) {
            missionSelect.addEventListener("change", () => {
                this.currentMission = missionSelect.value;
                if (missionSelect.value === "") {
                    this.currentSearchTerm = "";
                    searchInput.value = ""; // Reset search
                }
                this.filterSidebarItems();
                //this.hideTable();
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
            this.hideInfoTable();//side table of the pie chart
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

    handleInitialSelection(first) {
        this.updateCharts(first.id);
        this.updateTitleAndDate(first.id);
        this.renderTableWithoutPagination([first], first.id);
        const firstLink = [...document.querySelectorAll(".filter-link")]
            .find(link => link.textContent.trim() === first.id);
        if (firstLink) {
            firstLink.classList.add("active");
            const parentDiv = firstLink.closest(".container-border");
            if (parentDiv) parentDiv.classList.add("selected");
        }

        this.showTableSection(first.id);
    }

}

window.datatakes = new Datatakes(mockDataTakes, formatDataDetail);