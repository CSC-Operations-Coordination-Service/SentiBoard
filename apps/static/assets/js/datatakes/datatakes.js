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

    }

    init() {
        document.addEventListener("DOMContentLoaded", () => {
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
            ajaxCall(
                '/api/auth/quarter-authorized',
                'GET',
                {},
                this.quarterAuthorizedProcess,
                this.errorLoadAuthorized
            );

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
            this.loadDatatakesInPeriod(time_period_sel.value);

            console.log("Datatakes initialized.");

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

    successLoadDatatakes(response) {
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

        const currentList  = this.filteredDataTakes?.length ? this.filteredDataTakes : datatakes;

        if (currentList.length > 0) {
            const firstTake = currentList[0];
            this.updateTitleAndDate(firstTake.id);
            this.updateCharts(firstTake.id);
            // If you have a method to update the info table, call it here too
            if (this.updateInfoTable) {
                this.updateInfoTable(firstTake.id);
            }

            // Also update the UI selection highlight in the list
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
            if (!append && this.displayedCount === 0 && index === 0) {
                containerDiv.classList.add("selected");
                a.classList.add("selected");
            }

            a.addEventListener("click", e => e.preventDefault());

            containerDiv.addEventListener("click", () => {
                dataList.querySelectorAll(".container-border.selected").forEach(el => el.classList.remove("selected"));
                dataList.querySelectorAll("a.selected").forEach(el => el.classList.remove("selected"));

                containerDiv.classList.add("selected");
                a.classList.add("selected");

                this.updateCharts(take.id);
                this.updateTitleAndDate(take.id);
            });

            const status = take.completenessStatus?.ACQ?.status?.toLowerCase() || "unknown";
            const statusCircle = document.createElement("div");
            statusCircle.className = `status-circle-dt-${status}`;

            containerDiv.appendChild(a);
            containerDiv.appendChild(statusCircle);
            li.appendChild(containerDiv);
            fragment.appendChild(li);
        });

        if (!append && this.displayedCount === 0 && nextItems.length > 0) {
            this.handleInitialSelection(nextItems[0]);
        }

        dataList.appendChild(fragment);
        this.displayedCount += nextItems.length;

        const loadMoreBtn = document.getElementById("loadMoreBtn");
        loadMoreBtn.style.display = this.displayedCount >= data.length ? "none" : "block";
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

        // Call it once right away to apply initial sizing
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
            return;
        }

        const relevantData = this.mockDataTakes.filter(dt =>
            (dt.id || "").toUpperCase().startsWith((normalizedLinkKey || "").toString().toUpperCase())
        );

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
            UNKNOWN: ['#666666', '#999999']
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

            // Add "Missing" slice
            labels.push("Missing");
            series.push(parseFloat(remaining.toFixed(2)));
            colors.push(missingColor);
        });

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
                formatter: function (seriesName, opts) {
                    return `<div style="margin-left: 0;">${seriesName}</div>`;
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
        const tableSection = document.getElementById("tableSection");
        if (tableSection) {
            tableSection.style.display = "none";
        }
    }

    hideInfoTable() {
        document.getElementById('infoTableContainer').style.display = 'none';
    }

    filterSidebarItems() {
        const selectedMission = document.getElementById("mission-select").value.toUpperCase();
        const selectedSatellite = document.getElementById("satellite-select").value.toUpperCase();
        const searchQuery = document.getElementById("searchInput").value.toUpperCase();

        // Read and store from/to date values
        const fromInput = document.getElementById("from-date").value;
        const toInput = document.getElementById("to-date").value;

        this.fromDate = fromInput.value;
        this.toDate = toInput.value;

        const searchTerms = searchQuery.split(/\s+/).map(s => s.trim()).filter(Boolean);

        try {
            this.filteredDataTakes = this.mockDataTakes.filter(take => {
                const id = (take.id || "").toUpperCase();
                const satellite = (take.satellite || take.raw?.satellite_unit || "").toUpperCase();

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
                const matchesSatellite = !selectedSatellite || satellite.startsWith(selectedSatellite);

                const matchesSearch = !searchTerms.length || searchTerms.every(term => {
                    const termMatch = id.includes(term);

                    if (!acquisitionDate) {
                        console.debug("Skipping take with no date:", take.id);
                    }
                    return termMatch;
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

        const today = new Date();
        const maxDate = new Date(today);
        let fromDate = new Date(today);

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
                const dayOfMonth = fromDate.getDate();
                const targetMonth = fromDate.getMonth() - 3;
                fromDate.setMonth(targetMonth, 1);
                const lastDay = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0).getDate();
                fromDate.setDate(Math.min(dayOfMonth, lastDay));
                break;
            }
        }

        const format = (d) => d.toISOString().split("T")[0];

        const min = format(fromDate);
        const max = format(maxDate);

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


        dataList.addEventListener("click", (e) => {
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