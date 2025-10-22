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
        this.infoItemsPerPage = 10;
        this.currentDataArray = [];
        this.donutChartInstance = null;
        this.resizeListenerAttached = false;
        this.datatakesEventsMap = {};
        this.currentMission = "";
        this.currentSatellite = "";
        this.currentSearchTerm = "";
        this.fromDate = "";
        this.toDate = "";

        // Threshold used to state the completeness
        this.completeness_threshold = 90;
        this.activeRequestsCount = 0;  // count of ongoing requests

    }

    init() {
        document.addEventListener("DOMContentLoaded", () => {
            console.log("Initializing Datatakes SSR version...");

            this.quarterAuthorizedProcess = window.quarter_authorized || false;
            this.anomalies = window.anomaliesData || [];
            this.datatakes = window.datatakesData || [];

            // Hide EC and Copernicus logos from header
            $('#ec-logo-header').hide();
            $('#esa-logo-header').hide();

            /*limit the diplay data takes*/
            this.displayedCount = 0;
            this.itemsPerPage = 10;

            // Populate the data list and set default view
            this.populateDataList(false);
            this.setupResizeObserver();
            this.attachEventListeners();
            this.setDefaultView();


            // Retrieve the user profile to determine quarter authorization
            /*ajaxCall(
                '/api/auth/quarter-authorized',
                'GET',
                {},
                this.quarterAuthorizedProcess,
                this.errorLoadAuthorized
            );*/

            // Retrieve the time select combo box instance
            const time_period_sel = document.getElementById('time-period-select');

            // Check if search parameter exists in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const hasSearch = urlParams.has('search');

            // Set time period based on presence of search
            time_period_sel.value = hasSearch ? 'prev-quarter' : 'week';
            // Trigger the change handler manually
            this.on_timeperiod_change({ target: time_period_sel });

            // Add event listener for user selection
            time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));

            // Load datatakes for the selected period
            //this.loadDatatakesInPeriod(time_period_sel.value);

            console.log("Datatakes initialized (API mode).");

        });
    }


    filterDatatakesOnPageLoad() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const searchFilter = urlParams.get('search');

        if (searchFilter) {
            this.filteredDataTakes = this.mockDataTakes.filter(take =>
                take.id.toLowerCase().includes(searchFilter.toLowerCase())
            );

            return true;
        } else {
            this.filteredDataTakes = null;
            return false;
        }
    }

    on_timeperiod_change() {
        const time_period_sel = document.getElementById('time-period-select');
        const selected = time_period_sel.value;
        console.log("Time period changed to " + selected);

        //Set the calendar inputs based on selected period
        this.setDateRangeLimits(selected);

        this.loadDatatakesInPeriod(selected, true);
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
        // Reset counters and flags
        this.completedRequestsCount = 0;
        this.hasServerError = false;
        this.pendingDatatakes = null;
        this.activeRequestsCount = 0;

        // Show spinner immediately
        this.showSpinner();

        // Function to track requests and manage spinner
        const finishRequest = (wasSuccessful) => {
            this.completedRequestsCount++;

            // If this request succeeded, clear server error
            if (wasSuccessful) {
                this.hasServerError = false;
            }

            // Only hide spinner when both requests have succeeded at least once
            if (this.completedRequestsCount >= 2 && !this.hasServerError) {
                this.hideSpinner();

                // Update charts and table
                if (this.pendingDatatakes?.length > 0) {
                    const firstTake = this.pendingDatatakes[0];
                    this.updateTitleAndDate(firstTake.id);
                    // Render both charts asynchronously
                    (async () => {
                        try {
                            await Promise.all([
                                this.updateCharts("publication", firstTake.id),
                                this.updateCharts("acquisition", firstTake.id)
                            ]);
                        } catch (err) {
                            console.error("Error rendering charts:", err);
                        }
                    })();

                    /*if (this.updateInfoTable) {
                        this.updateInfoTable(firstTake.id);
                    }*/
                }
            }
        };

        // Events anomalies request
        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
            (response) => {
                this.successLoadAnomalies(response);
                finishRequest(true); // mark success
            },
            (response) => {
                console.error("Anomalies load error", response);
                if (response?.status === 500) this.hasServerError = true;
                finishRequest(false); // mark failure
            }
        );

        // Datatakes request
        const urlMap = {
            day: '/api/worker/cds-datatakes/last-24h',
            week: '/api/worker/cds-datatakes/last-7d',
            month: '/api/worker/cds-datatakes/last-30d',
            'prev-quarter': '/api/worker/cds-datatakes/previous-quarter',
            default: '/api/worker/cds-datatakes/last-quarter'
        };

        const url = urlMap[selected_time_period] || urlMap.default;

        asyncAjaxCall(url, 'GET', {},
            async (response) => {
                await this.successLoadDatatakes(response);
                this.pendingDatatakes = response; // store for chart update later

                if (shouldReapplyFilters) {
                    const hasSearch = this.filterDatatakesOnPageLoad(); // apply search param
                    if (!hasSearch) {
                        this.filterSidebarItems(); // apply UI filters
                    }
                }
                if (this.mockDataTakes?.length > 0) {
                    this.setDefaultView();
                } else {
                    console.warn("mockDataTakes empty — skipping setDefaultView()");
                }

                finishRequest(true); // mark success
            },
            (response) => {
                console.error("Datatakes load error", response);
                if (response?.status === 500) this.hasServerError = true;
                finishRequest(false); // mark failure
            }
        );
    }

    successLoadAnomalies(response) {
        console.log("Anomalies successfully retrieved");
        this.datatakesEventsMap = {};
        const rows = format_response(response);

        for (const anomaly of rows) {
            const rawCompleteness = format_response(anomaly["datatakes_completeness"]);
            for (const raw of rawCompleteness) {
                let fixedStr;
                try {
                    fixedStr = raw.replaceAll("'", '"');
                    const completenessMap = JSON.parse(fixedStr);

                    for (const [_, value] of Object.entries(completenessMap)) {
                        const datatakeId = Object.values(value)[0];
                        const completeness = this.calcDatatakeCompleteness(Object.values(value));

                        if (completeness < this.completeness_threshold) {
                            this.datatakesEventsMap[datatakeId] = anomaly;
                        }
                    }
                } catch (ex) {
                    console.warn("Error parsing datatake completeness:", ex);
                    console.warn("Failed string:", fixedStr || raw);
                    continue;
                }
            }
        }
    }

    errorLoadAnomalies(response) {
        console.error(response);
    }

    async successLoadDatatakes(response) {
        const rows = format_response(response);
        console.info('Datatakes successfully retrieved');


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

        this.mockDataTakes = datatakes.sort((a, b) => {
            const timeA = Date.parse(a.raw?.observation_time_start || "");
            const timeB = Date.parse(b.raw?.observation_time_start || "");

            if (!isNaN(timeA) && !isNaN(timeB)) return timeA - timeB;
            if (!isNaN(timeA)) return -1;
            if (!isNaN(timeB)) return 1;
            return (a.raw?.datatake_id || "").localeCompare(b.raw?.datatake_id || "");
        });

        this.displayedCount = 0;

        const hasSearchParam = this.filterDatatakesOnPageLoad(); //sets this.filteredDataTakes
        if (hasSearchParam) {
            const sel = document.getElementById('time-period-select');
            if (sel) sel.value = 'last-quarter';
        }

        this.populateDataList(false);
        this.setDefaultView();

        const currentList = this.filteredDataTakes?.length ? this.filteredDataTakes : datatakes;

        if (currentList.length > 0) {
            const firstTake = currentList[0];

            this.updateTitleAndDate(firstTake.id);

            try {
                await Promise.all([
                    this.updateCharts("publication", firstTake.id),
                    this.updateCharts("acquisition", firstTake.id)
                ]);
            } catch (err) {
                console.error("Error rendering charts:", err);
            }

            /*if (this.updateInfoTable) {
                this.updateInfoTable(firstTake.id);
            }*/
            if (hasSearchParam && this.filteredDataTakes?.length) {
                const tableSection = document.getElementById("tableSection");
                if (tableSection) {
                    tableSection.style.display = "block";
                    tableSection.style.opacity = "1";
                }
                if (typeof this.renderTableWithoutPagination === "function") {
                    this.renderTableWithoutPagination(this.filteredDataTakes, this.filteredDataTakes[0].id);
                }else { 
                    console.warn("renderTableWithoutPagination function not found, skipping table render.");
                }
            }


            const dataList = document.getElementById("dataList");
            if (dataList) {
                dataList.querySelectorAll(".container-border.selected").forEach(el => el.classList.remove("selected"));
                dataList.querySelectorAll("a.selected").forEach(el => el.classList.remove("selected"));

                const selectedContainer = [...dataList.querySelectorAll("li div.container-border")]
                    .find(div => div.querySelector("a")?.textContent === firstTake.id);
                if (selectedContainer) {
                    selectedContainer.classList.add("selected");
                    selectedContainer.querySelector("a")?.classList.add("selected");
                }
            }
        }
    }

    errorLoadDatatake(response) {
        console.error(response)
        if (response && response.status === 500) {
            console.warn("Server error 500 - spinner will hide and error shown");
            this.hideSpinner();
        } else {
            this.hideSpinner();
        }
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

    getGroundStation(id) {
        if (id.includes("S1A") || id.includes("S1C")) return "Sentinel 1";
        if (id.includes("S2A") || id.includes("S2B")) return "Sentinel 2";
        if (id.includes("S3")) return "Sentinel 3";
        if (id.includes("S5P")) return "Sentinel 5P";
        return "Sentinel";
    }

    populateDataList(append = false) {
        const dataList = document.getElementById("dataList");
        const searchInput = document.getElementById("searchInput");
        const inputWidth = searchInput?.offsetWidth || 300;
        const data = this.filteredDataTakes?.length ? this.filteredDataTakes : this.mockDataTakes;

        if (!dataList) return;

        const validData = data.filter(take => {
            const valid = take?.raw?.observation_time_start && take?.raw?.datatake_id;
            if (!valid) console.warn("Skipping invalid take:", take);
            return valid;
        });

        const sortedData = validData;

        if (!append) {
            dataList.innerHTML = "";
            this.displayedCount = 0;
        }

        const nextItems = sortedData.slice(this.displayedCount, this.displayedCount + this.itemsPerPage);

        if (!append && nextItems.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No results found";
            li.style.color = "#aaa";
            dataList.appendChild(li);
            document.getElementById("loadMoreBtn").style.display = "none";
            return;
        }

        const fragment = document.createDocumentFragment();

        nextItems.forEach((take, index) => {
            const li = document.createElement("li");

            const containerDiv = document.createElement("div");
            containerDiv.className = "container-border";
            Object.assign(containerDiv.style, {
                width: `${inputWidth}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.75rem",
                boxSizing: "border-box",
                cursor: "pointer"
            });

            const a = document.createElement("a");
            a.href = "#";
            a.className = "filter-link";
            a.dataset.filterType = "groundStation";
            a.dataset.filterValue = this.getGroundStation(take.id);
            a.textContent = take.id;

            // Preselect the first item on a full load
            /*if (!append && this.displayedCount === 0 && index === 0) {
                containerDiv.classList.add("selected");
                a.classList.add("selected");
            }*/

            a.addEventListener("click", e => e.preventDefault());

            containerDiv.addEventListener("click", () => {
                dataList.querySelectorAll(".container-border.selected").forEach(el => el.classList.remove("selected"));
                dataList.querySelectorAll("a.selected").forEach(el => el.classList.remove("selected"));

                containerDiv.classList.add("selected");
                a.classList.add("selected");

                if (document.querySelector(".datatakes-container")) {
                    this.updateTitleAndDate(take.id);

                    // Render both charts asynchronously
                    (async () => {
                        try {
                            await Promise.all([
                                this.updateCharts("publication", take.id),
                                this.updateCharts("acquisition", take.id)
                            ]);
                        } catch (err) {
                            console.error("Error rendering charts:", err);
                        }
                    })();
                } else {
                    console.warn("Datatakes container not found, skipping chart/title update.");
                }
            });

            const status = take.completenessStatus?.ACQ?.status?.toLowerCase() || "unknown";
            const statusCircle = document.createElement("div");
            statusCircle.className = `status-circle-dt-${status}`;

            containerDiv.appendChild(a);
            containerDiv.appendChild(statusCircle);
            li.appendChild(containerDiv);
            fragment.appendChild(li);
        });

        dataList.appendChild(fragment);
        this.displayedCount += nextItems.length;

        const loadMoreBtn = document.getElementById("loadMoreBtn");
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.displayedCount >= sortedData.length ? "none" : "block";
        }

        if (!append && this.displayedCount === 0 && nextItems.length > 0) {
            this.handleInitialSelection(nextItems[0]);
        }

    }

    setupResizeObserver() {
        const searchInput = document.getElementById("searchInput");
        const updateContainerWidths = () => {
            const inputWidth = searchInput?.offsetWidth || 300;
            document.querySelectorAll(".container-border").forEach(div => {
                div.style.width = `${inputWidth}px`;
            });
        };

        if (searchInput) {
            const resizeObserver = new ResizeObserver(() => {
                updateContainerWidths();
            });
            resizeObserver.observe(searchInput);
        }

        window.addEventListener("resize", updateContainerWidths);

        updateContainerWidths();
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

        const modalEl = document.getElementById("completenessTableModal");
        const paragraph = document.querySelector(".datatakes-container h4");

        if (!modalEl || !paragraph) {
            console.error("Modal container or paragraph not found!");
            return;
        }

        let selectedId = passedId;

        // fallback to chart header text if no ID was passed
        if (!selectedId && paragraph) {
            const fullText = paragraph.textContent.trim().replace(/_/g, "-");
            const parts = fullText.split("-");
            selectedId = parts.slice(0, 3).join("-");
        }

        if (!selectedId) {
            console.error("No valid datatake ID to use for info table.");
            return;
        }

        console.log("Looking for datatake ID:", selectedId);

        const $modal = $('#completenessTableModal');

        // Ensure this is attached only once
        $modal.off('hide.bs.modal').on('hide.bs.modal', function () {
            // Remove focus from anything inside the modal before hiding
            document.activeElement.blur();
        });

        try {
            await this.renderInfoTable(selectedId);

            // Show the modal
            $modal.modal('show');

            // Ensure scroll reset
            $modal.find('.modal-body').scrollTop(0);

        } catch (err) {
            console.error("Failed to render info table for datatake:", selectedId, err);
        } finally {
            this.fromInfoIcon = false;
        }
    }

    async renderInfoTable(dataInput, page = 1) {
        const tableBody = document.getElementById("modalInfoTableBody");
        const paginationControls = document.getElementById("modalPaginationControls");
        tableBody.innerHTML = "";
        paginationControls.innerHTML = "";

        let dataArray = [];

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
        const totalPages = Math.ceil(totalItems / this.infoItemsPerPage);
        this.currentPage = page;

        const startIndex = (page - 1) * this.infoItemsPerPage;
        const endIndex = Math.min(startIndex + this.infoItemsPerPage, totalItems);
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

    updateCharts(type, linkKey) {
        // Select the right container & chart instance name
        const chartMap = {
            publication: {
                id: "#publicationDonutChart",
                instanceKey: "publicationChartInstance"
            },
            acquisition: {
                id: "#acquisitionDonutChart",
                instanceKey: "acquisitionChartInstance"
            }
        };

        const chartConfig = chartMap[type];
        if (!chartConfig) {
            console.error(`Unknown chart type: ${type}`);
            return;
        }

        const donutChartContainer = document.querySelector(chartConfig.id);
        if (!donutChartContainer) {
            console.error(`${chartConfig.id} container not found!`);
            return;
        }

        // Normalize linkKey and find relevant data
        const normalizedLinkKey = typeof linkKey === "string"
            ? linkKey
            : (linkKey?.id || linkKey?.toString?.() || "").toString();

        if (!normalizedLinkKey) return;

        const relevantData = this.mockDataTakes.filter(dt =>
            (dt.id || "").toUpperCase().startsWith((normalizedLinkKey || "").toString().toUpperCase())
        );

        //console.log("Raw data for", normalizedLinkKey, relevantData.map(dt => dt.raw));

        if (relevantData.length === 0) {
            console.warn(`No data found for key: ${normalizedLinkKey}`);
            return;
        }

        // Shared color map
        const colorMap = {
            PUBLISHED: ['#0aa41b', '#A5D6A7'],
            PARTIAL: ['#bb8747', '#e6c9a0'],
            UNAVAILABLE: ['#FF0000', '#FF9999'],
            ACQUIRED: ['#0aa41b', '#A5D6A7'],
            PLANNED: ['#9e9e9e', '#E0E0E0'],
            PROCESSING: ['#9e9e9e', '#E0E0E0'],
            UNKNOWN: ['#666666', '#999999']
        };

        // Build series depending on chart type
        let series = [];
        let labels = [];
        let colors = [];
        let avgPercentage = 0;

        if (type === "publication") {
            const entry = relevantData[0];
            const pub = entry.raw?.completeness_status?.PUB || {};
            const percentage = parseFloat(pub.percentage) || 0;
            const status = pub.status?.toUpperCase() || "UNKNOWN";
            const remaining = Math.max(0, 100 - percentage);
            const [completeColor, missingColor] = colorMap[status] || colorMap["UNKNOWN"];

            series = [percentage, remaining];
            labels = ["Published", "Missing"];
            colors = [completeColor, missingColor];
            avgPercentage = percentage;
        }
        else if (type === "acquisition") {
            const entry = relevantData[0];
            const acq = entry.raw?.completeness_status?.ACQ || {};
            const percentage = parseFloat(acq.percentage) || 0;
            const status = acq.status?.toUpperCase() || "UNKNOWN";
            const remaining = Math.max(0, 100 - percentage);
            const [completeColor, missingColor] = colorMap[status] || colorMap["UNKNOWN"];

            series = [percentage, remaining];
            labels = ["Acquired", "Missing"];
            colors = [completeColor, missingColor];
            avgPercentage = percentage;
        }

        // Destroy existing instance if any
        if (this[chartConfig.instanceKey]) {
            this[chartConfig.instanceKey].destroy();
        }

        // Chart configuration
        const options = {
            chart: { type: 'donut', height: 350, toolbar: { show: false } },
            series,
            labels,
            colors,
            tooltip: {
                y: {
                    formatter: function (val) {
                        return val.toFixed(2) + '%';
                    }
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
                horizontalAlign: 'center',
                labels: { colors: '#FFFFFF' },
                itemMargin: {
                    vertical: 4,
                    horizontal: 4
                },
                markers: {
                    width: 12,
                    height: 12,
                    offsetX: -6,
                    offsetY: 0
                },
                formatter: seriesName => `<div style="margin-left: 0;">${seriesName}</div>`
            },
            plotOptions: {
                pie: {
                    donut: {
                        labels: {
                            show: true,
                            name: { color: '#FFFFFF' },
                            value: {
                                color: '#FFFFFF',
                                formatter: function (val) {
                                    const numberVal = parseFloat(val);
                                    return numberVal.toFixed(2) + '%';
                                }
                            },
                            total: {
                                show: true,
                                label: 'Completeness',
                                color: '#FFFFFF',
                                formatter: function (w) {
                                    const totalVal = parseFloat(w.globals.series[0]) || 0;
                                    return totalVal.toFixed(2) + '%';
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

        // Render new chart
        this[chartConfig.instanceKey] = new ApexCharts(donutChartContainer, options);
        this[chartConfig.instanceKey].render();

        // Ensure responsive resizing
        window.addEventListener("resize", () => {
            if (this[chartConfig.instanceKey]?.resize) {
                this[chartConfig.instanceKey].resize();
            }
        });
        this.resizeListenerAttached = true;
    }

    hideTable() {
        const tableSection = document.getElementById("tableSection");
        if (tableSection) {
            tableSection.style.display = "none";
        }
    }

    hideInfoTable() {
        
        $('#completenessTableModal').modal('hide');
    }

    filterSidebarItems() {
        const selectedMission = document.getElementById("mission-select").value.toUpperCase();
        const selectedSatellite = document.getElementById("satellite-select").value.toUpperCase();
        const searchQuery = document.getElementById("searchInput").value.toUpperCase();

        // Read and store from/to date values

        this.fromDate = document.getElementById("from-date").value;;
        this.toDate = document.getElementById("to-date").value;;

        const searchTerms = searchQuery.split(/\s+/).map(s => s.trim()).filter(Boolean);

        try {
            this.filteredDataTakes = this.mockDataTakes.filter(take => {
                const id = (take.id || "").toUpperCase();
                const satellite = (take.satellite || take.raw?.satellite_unit || "").toUpperCase();

                let acquisitionDateRaw = take.raw?.observation_time_start || take.start || "";
                let acquisitionDate = "";

                if (acquisitionDateRaw instanceof Date) {
                    acquisitionDate = acquisitionDateRaw.toISOString();
                } else if (typeof acquisitionDateRaw === "string") {
                    acquisitionDate = new Date(acquisitionDateRaw).toISOString();
                }
                const matchesMission = !selectedMission || id.startsWith(selectedMission);
                const matchesSatellite = !selectedSatellite || satellite.startsWith(selectedSatellite);

                const matchesSearch = !searchTerms.length || searchTerms.every(term => {
                    return id.includes(term);
                });

                return matchesMission && matchesSearch && matchesSatellite && this.isWithinDateRange(acquisitionDate);
            });

        } catch (err) {
            console.error("Error during filtering:", err);
        }

        this.displayedCount = 0;
        this.populateDataList(false);
        const first = this.filteredDataTakes?.[0];
        if (first) {
            this.handleInitialSelection(first);
        } else {
            this.hideTable();
        }
    }

    isWithinDateRange(dateString) {
        if (!dateString) return true;
        const date = new Date(dateString);
        const from = this.fromDate ? new Date(this.fromDate) : null;
        const to = this.toDate ? new Date(this.toDate) : null;

        if (from && date < from) return false;
        if (to && date > to) return false;

        return true;
    }

    setDateRangeLimits(period) {
        const fromInput = document.getElementById("from-date");
        const toInput = document.getElementById("to-date");
        if (!fromInput || !toInput) return;

        const urlParams = new URLSearchParams(window.location.search);
        const hasSearch = urlParams.has('search');

        // Skip setting values if search is present
        if (hasSearch) {
            console.log("[Date Range Limits] Skipping setting date inputs due to search param.");
            return;
        }

        const now = new Date();
        const maxDate = new Date(now);
        let fromDate = new Date(now);

        switch (period) {
            case 'day':
                fromDate.setDate(fromDate.getDate() - 1);
                break;
            case 'week':
                fromDate.setDate(fromDate.getDate() - 7);
                break;
            case 'month':
                fromDate.setMonth(fromDate.getMonth() - 1);
                break;
            case 'last-quarter':
            case 'default': {
                const day = fromDate.getDate();
                fromDate.setMonth(fromDate.getMonth() - 3, 1);
                const lastDay = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0).getDate();
                fromDate.setDate(Math.min(day, lastDay));
                break;
            }
        }

        const formatDateTimeLocal = (d) => {
            const pad = (n) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const min = formatDateTimeLocal(fromDate);
        const max = formatDateTimeLocal(maxDate);

        fromInput.min = min;
        fromInput.max = max;
        toInput.min = min;
        toInput.max = max;

        if (fromInput.value && (fromInput.value < min || fromInput.value > max)) {
            fromInput.value = '';
        }
        if (toInput.value && (toInput.value < min || toInput.value > max)) {
            toInput.value = '';
        }

        console.log(`[Date Range Limits] Period: ${period}, Min: ${min}, Max: ${max}`);
    }


    showTableSection(firstId) {
        const tableSection = document.getElementById("tableSection");
        if (!tableSection) return;

        const selectedData = this.mockDataTakes.find(item => item.id === firstId);
        if (!selectedData) return;

        this.renderTableWithoutPagination([selectedData], firstId);

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

        const selectedData = dataset.find(item => item.id === selectedId);
        if (!selectedData) {
            console.warn(`No data found for: ${selectedId}`);
            tableBody.innerHTML = "";
            tableSection.style.display = "none";
            return;
        }
        //console.log("completeness_status", selectedData.raw.completeness_status);

        let data = [selectedData];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.id.toLowerCase().includes(query) ||
                item.satellite.toLowerCase().includes(query)
            );
        }

        if (data.length === 0) {
            console.warn("No data matched the search query.");

            tableBody.innerHTML = "";
            tableSection.style.display = "none";
            return;
        }

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
                <td data-label="Data Take ID">${row.id}</td>
                <td data-label="Platform">${platform}</td>
                <td data-label="Start Date">${startTime}</td>
                <td data-label="Stop Date">${stopTime}</td>
                <td data-label="Acquisition"><span class="status-badge" style="background-color:${acquisitionColor}">${acqStatus}</span></td>
                <td data-label="Publication"><span class="status-badge" style="background-color:${publicationColor}">${pubStatus}</span></td>
                <td data-label="Actions">
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
        tableSection.style.display = "block";
    }

    updateTitleAndDate(selectedKey) {
        if (!selectedKey) {
            return;
        }

        if (!this.mockDataTakes || this.mockDataTakes.length === 0) {
            console.warn("mockDataTakes is empty or not loaded yet.");
            return;
        }

        // Find datatake
        const dataTake = this.mockDataTakes.find(item => item.id === selectedKey);

        if (!dataTake) {
            console.warn(`Datatake not found for key: ${selectedKey}`);
            console.log("Available datatake IDs:", this.mockDataTakes.map(item => item.id));
            return;
        }


        const container = document.querySelector(".datatakes-container");
        if (!container) {
            console.error("Datatakes container not found!");
            return;
        }
        const titleSpan = container.querySelector("h4 .title-text");
        const dateElement = container.querySelector("p.text-left");

        if (!titleSpan || !dateElement) {
            console.error("Title span or date element not found!");
            return;
        }

        const startDate = new Date(dataTake.start)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19);

        titleSpan.textContent = `${dataTake.id}`;
        dateElement.textContent = `${startDate}`;
    }

    resetFilters() {
        // Reset filter form inputs
        const missionSelect = document.getElementById("mission-select");
        const satelliteSelect = document.getElementById("satellite-select");
        const searchInput = document.getElementById("searchInput");
        const fromDateInput = document.getElementById("from-date");
        const toDateInput = document.getElementById("to-date");

        if (missionSelect) missionSelect.value = "";
        if (satelliteSelect) satelliteSelect.value = "";
        if (searchInput) searchInput.value = "";
        if (fromDateInput) fromDateInput.value = "";
        if (toDateInput) toDateInput.value = "";

        // Clear internal state
        this.filteredDataTakes = [];
        this.currentMission = "";
        this.currentSearchTerm = "";

        if (window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
        }

        document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
        document.querySelectorAll(".container-border.selected").forEach(div => div.classList.remove("selected"));

        this.displayedCount = 0;
        this.populateDataList(false);


        this.hideInfoTable?.();
    }

    attachEventListeners() {
        const searchInput = document.getElementById("searchInput");
        const dataList = document.getElementById("dataList");
        const tableSection = document.getElementById("tableSection");
        const missionSelect = document.getElementById("mission-select");
        const resetBtn = document.getElementById("resetFilterButton");
        const satelliteSelect = document.getElementById("satellite-select");
        const allSatelliteOptions = Array.from(satelliteSelect.options).slice(1);


        if (!dataList || !tableSection) {
            console.error("One or more DOM elements missing for setup.");
            return;
        }

        tableSection.style.display = "none";

        if (searchInput) {
            searchInput.addEventListener("input", () => {
                this.currentSearchTerm = searchInput.value;
                this.filterSidebarItems();
            });
        }

        if (missionSelect && satelliteSelect) {
            missionSelect.addEventListener("change", () => {
                const selectedMission = missionSelect.value;
                this.currentMission = selectedMission;

                // Reset search input if mission reset
                if (selectedMission === "") {
                    this.currentSearchTerm = "";
                    searchInput.value = "";
                }

                // Enable satellite select unless it's Sentinel 5P
                if (selectedMission === "S5") {
                    satelliteSelect.disabled = true;
                    satelliteSelect.value = "";
                } else {
                    satelliteSelect.disabled = false;

                    // Restore all then filter
                    satelliteSelect.innerHTML = `
                        <option value="">All Satellites</option>
                    `;

                    const filtered = allSatelliteOptions.filter(opt => opt.value.startsWith(selectedMission));
                    filtered.forEach(opt => satelliteSelect.appendChild(opt));

                    /*if (filtered.length > 0) {
                        satelliteSelect.value = filtered[0].value;
                    } else {*/
                    satelliteSelect.value = "";
                    //}
                }

                this.filterSidebarItems();
                this.hideInfoTable();
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
            this.populateDataList(true);
        });


        dataList.addEventListener("click", async (e) => {
            const target = e.target.closest("a.filter-link");
            if (!target) return;

            e.preventDefault();

            document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
            target.classList.add("active");

            document.querySelectorAll(".container-border.selected").forEach(div => div.classList.remove("selected"));

            const containerDiv = target.closest('.container-border');
            if (containerDiv) {
                containerDiv.classList.add("selected");
            }

            const selectedKey = target.textContent.trim();
            this.updateTitleAndDate(selectedKey);

            // Render both donut charts asynchronously
            try {
                await Promise.all([
                    this.updateCharts("publication", selectedKey),
                    this.updateCharts("acquisition", selectedKey)
                ]);
            } catch (err) {
                console.error("Error rendering charts:", err);
            }
            this.renderTableWithoutPagination(this.mockDataTakes, selectedKey);
            this.hideInfoTable();
        });
    }

    async setDefaultView(retryCount = 0) {
        const sidebarItems = document.querySelectorAll(".filter-link");

        if (sidebarItems.length === 0) {
            if (retryCount < 5) { // retry up to 5 times
                console.warn("Sidebar not ready, retrying setDefaultView...");
                setTimeout(() => this.setDefaultView(retryCount + 1), 200);
            } else {
                console.error("Sidebar items not found after retries.");
            }
            return;
        }

        const firstLink = sidebarItems[0];
        const defaultKey = firstLink.textContent.trim();

        if (!defaultKey) {
            console.warn("Sidebar first link has no valid text, cannot update title/date.");
            return;
        }

        if (!firstLink) {
            console.warn("No sidebar items found.");
            return;
        }

        firstLink.classList.add("active");


        // Safely update title and charts once the DOM is ready
        if (document.querySelector(".datatakes-container")) {
            this.updateTitleAndDate(defaultKey);

            (async () => {
                try {
                    await Promise.all([
                        this.updateCharts("publication", defaultKey),
                        this.updateCharts("acquisition", defaultKey)
                    ]);
                } catch (err) {
                    console.error("Error rendering initial charts:", err);
                }
            })();
        } else {
            console.warn("Datatakes container not found, skipping chart update.");
        }
    }

    handleInitialSelection(first) {
        if (!first) return;

        // Ensure the DOM elements are ready
        if (document.querySelector(".datatakes-container")) {
            this.updateTitleAndDate(first.id);

            (async () => {
                try {
                    await Promise.all([
                        this.updateCharts("publication", first.id),
                        this.updateCharts("acquisition", first.id)
                    ]);
                } catch (err) {
                    console.error("Error rendering charts for initial selection:", err);
                }
            })();
        } else {
            console.warn("Datatakes container not found for initial selection.");
        }

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

    showSpinner() {
        const spinner = document.getElementById('spinner');
        console.log("Active requests count before showSpinner:", this.activeRequestsCount);
        if (spinner && this.activeRequestsCount === 0) {
            console.log("Showing spinner...");
            spinner.classList.add('active');
        }
        this.activeRequestsCount++;
    }

    hideSpinner() {
        if (this.activeRequestsCount > 0) this.activeRequestsCount--;
        if (this.activeRequestsCount === 0) {
            const spinner = document.getElementById('spinner');
            if (spinner) {
                console.log("Hiding spinner...");
                spinner.classList.remove('active');
            }
        }
    }
}

window.datatakes = new Datatakes(mockDataTakes, formatDataDetail);