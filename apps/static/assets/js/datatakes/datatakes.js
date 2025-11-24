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
    constructor(dataInput = {}) {
        // Always keep SSR block + global full list
        this.serverData = dataInput || {};
        this.fullDataTakes = Array.isArray(window.initialDatatakes) && window.initialDatatakes.length
            ? window.initialDatatakes
            : Array.isArray(this.serverData.datatakes)
                ? this.serverData.datatakes
                : [];

        this.filteredDataTakes = [...this.fullDataTakes];
        this.mockDataTakes = [...this.fullDataTakes];

        this.anomalies = Array.isArray(dataInput.anomalies)
            ? dataInput.anomalies
            : [];


        this.quarterAuthorized = !!dataInput.quarter_authorized;
        this.selectedPeriod = dataInput.selected_period || "week";
        this.generatedAt = this.serverData.generated_at || null;

        this.itemsPerPage = 5;
        this.infoItemsPerPage = 10;
        this.displayedCount = 0;

        console.groupCollapsed("%c[DATATAKES] Initialization", "color:#8bc34a;font-weight:bold");
        console.log("Loaded via SSR:", {
            datatakesCount: this.mockDataTakes.length,
            anomaliesCount: this.anomalies.length,
            quarterAuthorized: this.quarterAuthorized,
            selectedPeriod: this.selectedPeriod,
            generatedAt: this.generatedAt
        });
        console.groupEnd();
        console.log("[datatakes init]", {
            serverdata: this.serverData,
            fullDataTakes: this.fullDataTakes.length
        })
    }


    init() {
        $('#ec-logo-header, #esa-logo-header').hide();

        this.setupPeriodSelector?.();

        const dataList = document.getElementById("dataList");
        const loadMoreBtn = document.getElementById("loadMoreBtn");
        if (!dataList) return console.error("[DATATAKES] Missing #dataList element");

        // Determine how many SSR items are already visible
        this.displayedCount = dataList.querySelectorAll("li").length || 0;
        // Attach event listeners to SSR items
        this.attachItemListeners(dataList.querySelectorAll("li"));

        // Render the rest of the page if SSR < first page
        if (this.displayedCount < this.itemsPerPage) {
            this.populateDataList(true);
        }

        // Bind Load More once
        if (loadMoreBtn && !loadMoreBtn.dataset.bound) {
            loadMoreBtn.dataset.bound = "true";
            loadMoreBtn.addEventListener("click", () => this.populateDataList(true));
        }

        this.renderTablePage?.(1);
        this.initCharts?.();
        this.attachEventListeners();

        console.log("[DATATAKES] Initialization complete");
    }

    setupPeriodSelector() {
        const selector = document.getElementById('time-period-select');
        if (!selector) return;

        selector.value = this.selectedPeriod || 'week';

        selector.addEventListener('change', (e) => {
            const period = e.target.value;
            // Just reload the page with the new period as query param
            window.location = `/data-availability?period=${period}`;
        });
    }

    renderTablePage(page = 1) {
        if (!Array.isArray(this.currentDataArray)) {
            this.currentDataArray = [];
        }
        const tbody = document.getElementById('dataTableBody');
        if (!tbody) return;

        this.currentPage = page;
        const dataset = this.filteredDataTakes || this.currentDataArray;
        const start = (page - 1) * this.rowsPerPage;
        const end = start + this.rowsPerPage;
        const current = this.currentDataArray.slice(start, end);

        tbody.innerHTML = "";

        if (current.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">
                No datatakes available for the selected period.
            </td></tr>`;
            return;
        }

        current.forEach(dt => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dt.id}</td>
                <td>${dt.platform || 'N/A'}</td>
                <td>${this.formatDate(dt.start_time)}</td>
                <td>${this.formatDate(dt.stop_time)}</td>
                <td><span class="status-circle status-${(dt.acquisition_status || '').toLowerCase()}"></span>
                    ${dt.acquisition_status || 'N/A'}
                </td>
                <td><span class="status-circle status-${(dt.publication_status || '').toLowerCase()}"></span>
                    ${dt.publication_status || 'N/A'}
                    ${dt.publication_percent ? `(${dt.publication_percent}%)` : ""}
                </td>
                <td>
                    <button class="btn btn-outline-info btn-sm"
                            data-datatake-id="${dt.id}"
                            data-toggle="modal"
                            data-target="#showDatatakeDetailsModal">
                        Details
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        this.renderPaginationControls();
    }

    renderPaginationControls() {
        const pagination = document.getElementById("tablePagination");
        if (!pagination) return;

        const totalPages = Math.ceil(this.mockDataTakes.length / this.rowsPerPage);
        pagination.innerHTML = "";

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("button");
            btn.textContent = i;
            btn.classList.add("btn", "btn-sm", "btn-outline-light", "mx-1");
            if (i === this.currentPage) btn.classList.add("active");

            btn.addEventListener("click", () => {
                this.currentPage = i;
                this.renderTablePage(i);
            });

            pagination.appendChild(btn);
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return isNaN(d) ? "N/A" : d.toISOString().replace("T", " ").split(".")[0];
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
        const loadMoreBtn = document.getElementById("loadMoreBtn");
        const searchInput = document.getElementById("searchInput");
        const inputWidth = searchInput?.offsetWidth || 300;

        if (!dataList) return;

        const data = this.filteredDataTakes && this.filteredDataTakes.length
            ? this.filteredDataTakes
            : this.mockDataTakes;

        if (data.length === 0) {
            const li = document.createElement("li");
            li.textContent = " ";
            li.style.color = "#aaa";
            dataList.appendChild(li);
            if (loadMoreBtn) loadMoreBtn.style.display = "none";
            return;
        }

        this.itemsPerPage = 5;

        if (!append) {
            dataList.innerHTML = "";
            this.displayedCount = 0;
        }

        const nextItems = data.slice(this.displayedCount, this.displayedCount + this.itemsPerPage);
        const fragment = document.createDocumentFragment();

        nextItems.forEach(take => {
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

            a.addEventListener("click", e => e.preventDefault());


            const status = (take.acquisition_status || "unknown").toLowerCase();
            const statusCircle = document.createElement("div");
            statusCircle.className = `status-circle-dt-${status}`;

            containerDiv.appendChild(a);
            containerDiv.appendChild(statusCircle);
            li.appendChild(containerDiv);
            fragment.appendChild(li);

            containerDiv.addEventListener("click", () => {
                this.handleItemClick(take, containerDiv, a);
            });


        });

        dataList.appendChild(fragment);
        this.displayedCount += nextItems.length;

        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.displayedCount >= data.length ? "none" : "block";
        }

        if (!append && nextItems.length > 0) {
            const first = dataList.querySelector(".container-border");
            const a = first?.querySelector("a.filter-link");
            if (first && a) this.handleItemClick(nextItems[0], first, a);
        }

    }

    attachItemListeners(listItems) {
        if (!listItems) return;

        listItems.forEach(li => {
            const containerDiv = li.querySelector(".container-border");
            const a = li.querySelector("a.filter-link");
            if (!containerDiv || !a) return;

            const id = a.textContent.trim();
            const take = this.mockDataTakes.find(d => d.id === id);
            if (!take) return;

            containerDiv.addEventListener("click", () => this.handleItemClick(take, containerDiv, a));
        });
    }

    handleItemClick(take, containerDiv, a) {
        const dataList = document.getElementById("dataList");
        if (!dataList) return;

        // Deselect previous
        dataList.querySelectorAll(".container-border.selected").forEach(el => el.classList.remove("selected"));
        dataList.querySelectorAll("a.selected").forEach(el => el.classList.remove("selected"));

        // Select new
        containerDiv.classList.add("selected");
        a.classList.add("selected");

        const container = document.querySelector(".datatakes-container");
        if (!container) return;

        this.updateTitleAndDate?.(take.id);
        (async () => {
            try {
                await Promise.all([
                    this.updateCharts?.("publication", take.id),
                    this.updateCharts?.("acquisition", take.id),
                ]);
            } catch (err) {
                console.error("[DATATAKES] Chart update error:", err);
            }
        })();

        if (typeof this.renderTableWithoutPagination === "function") {
            this.renderTableWithoutPagination(this.mockDataTakes, take.id);
        } else {
            console.warn("[DATATAKES] renderTableWithoutPagination function not available");
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

        // Find datatake from SSR list
        const datatake = this.mockDataTakes.find(dt => dt.id === dataInput);
        if (!datatake) {
            tableBody.innerHTML = `<tr><td colspan="2">Datatake not found</td></tr>`;
            return;
        }


        let dataArray = datatake.completeness_list;

        if (!dataArray) {
            const completeness = datatake.completeness || {};
            dataArray = Object.keys(completeness)
                .filter(k => k.endsWith("_local_percentage"))
                .map(k => ({
                    productType: k.replace("_local_percentage", ""),
                    status: completeness[k],
                }));
        }

        console.log("datatake id input:", dataInput);
        console.log("full datatake object:", datatake);
        console.log("completeness list:", datatake?.completeness_list);

        const key =
            datatake.details?.key ||
            datatake.id ||
            "-";

        const timeliness =
            datatake.details?.timeliness ||
            datatake.raw?.timeliness ||
            datatake.raw?.timeliness_status ||
            "-";

        $('#datatake-details').empty().append(`
            <div class="form-group">
                <label>Datatake ID: ${key}</label>
                <label style="margin-left: 20px;">Timeliness: ${timeliness}</label>
            </div>
        `);


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
                btn.addEventListener("click", () => this.renderInfoTable(dataInput, pageNum));
                return btn;
            };

            paginationControls.appendChild(createButton("« Prev", this.currentPage - 1, this.currentPage === 1));
            for (let i = 1; i <= totalPages; i++) {
                paginationControls.appendChild(createButton(i, i, false, i === this.currentPage));
            }
            paginationControls.appendChild(createButton("Next »", this.currentPage + 1, this.currentPage === totalPages));
        }
    }

    initCharts() {
        // Use first datatake for initial charts
        if (!this.mockDataTakes.length) return;
        const first = this.mockDataTakes[0];
        this.updateCharts("publication", first);
        this.updateCharts("acquisition", first);
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
            chart: { type: 'donut', height: 350, toolbar: { show: false }, offsetX: 0, offsetY: 0 },
            title: {
                text: type === "publication" ? "Publication" : "Acquisition",
                align: 'center',
                style: {
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                },
                offsetY: 0,
            },
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
                floating: true,
                position: 'right',
                horizontalAlign: 'center',
                labels: { colors: '#FFFFFF' },
                formatter: seriesName => `<div style="margin-left: 0;">${seriesName}</div>`
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '70%',
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
                        height: 300,
                        width: '100%',
                    },
                    legend: {
                        show: true,
                        floating: false,
                        position: 'bottom',
                        horizontalAlign: 'center',
                        labels: { colors: '#FFFFFF' },
                        itemMargin: { vertical: 2, horizontal: 6 },
                        fontSize: '12px',
                    },
                    plotOptions: {
                        pie: {
                            donut: { size: '60%' }
                        }
                    },
                    title: {
                        offsetY: 0
                    },
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
            this.filteredDataTakes = this.fullDataTakes.filter((take, index) => {
                const id = (take.id || "").toUpperCase();
                const satellite = (take.satellite || take.raw?.satellite || take.raw?.satellite_unit || "").toUpperCase();

                let acquisitionDateRaw = take.raw?.observation_time_start || take.start || "";
                let acquisitionDate = (new Date(acquisitionDateRaw)).toISOString();

                if (acquisitionDateRaw instanceof Date) {
                    acquisitionDate = acquisitionDateRaw.toISOString();
                } else if (typeof acquisitionDateRaw === "string") {
                    acquisitionDate = new Date(acquisitionDateRaw).toISOString();
                }
                const matchesMission = !selectedMission || id.startsWith(selectedMission);
                const matchesSatellite = !selectedSatellite || satellite.startsWith(selectedSatellite);

                const matchesSearch = !searchTerms.length || searchTerms.every(term => id.includes(term));

                return matchesMission && matchesSearch && matchesSatellite && this.isWithinDateRange(acquisitionDate);
            });

        } catch (err) {
            console.error("Error during filtering:", err);
        }

        this.renderSidebarList();

        this.displayedCount = 0;

        this.populateDataList(false);
        const first = this.filteredDataTakes?.[0];
        if (first) {
            this.handleInitialSelection(first);
            this.renderTableWithoutPagination(this.filteredDataTakes, first.id);
        } else {
            this.hideTable();
        }
    }

    renderSidebarList() {
        const ul = document.getElementById("dataList");
        if (!ul) return;

        ul.innerHTML = "";

        if (!this.filteredDataTakes || !this.filteredDataTakes.length) {
            ul.innerHTML = "<li><em>No datatakes found</em></li>";
            return;
        }

        this.filteredDataTakes.forEach((dt, i) => {
            const status = (dt.acquisition_status || "unknown").toLowerCase();

            const li = document.createElement("li");
            li.innerHTML = `
            <div class="container-border ${i === 0 ? "selected" : ""}"
                style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;cursor:pointer;">
                <a href="#" class="filter-link ${i === 0 ? "selected" : ""}"
                    onclick="event.preventDefault();"
                    data-id="${dt.id}">
                    ${dt.id}
                </a>
                <div class="status-circle-dt-${status}"></div>
            </div>
        `;

            // Re-attach click listener
            this.attachItemListeners([li]);

            ul.appendChild(li);
        });
    }

    filterSatellitesByMission(mission, satelliteSelect) {
        satelliteSelect.innerHTML = "";
        const allOption = this.allSatelliteOptions.find(opt => opt.value === "");
        if (allOption) satelliteSelect.appendChild(allOption.cloneNode(true));


        // Filter based on mission
        const filtered = mission
            ? this.allSatelliteOptions.filter(opt => opt.value.toUpperCase().startsWith(mission.toUpperCase()))
            : this.allSatelliteOptions.filter(opt => opt.value !== ""); // All except "All Satellites"

        filtered.forEach(opt => satelliteSelect.appendChild(opt.cloneNode(true)));

        // Reset selection
        satelliteSelect.value = "";
        satelliteSelect.disabled = mission === "S5"; // Keep S5 disabled if needed
    }

    isWithinDateRange(dateString) {
        if (!dateString) return true;
        const date = new Date(dateString).getTime();
        const from = this.fromDate ? new Date(this.fromDate).getTime() : null;
        const to = this.toDate ? new Date(this.toDate).getTime() : null;

        if (from !== null && date < from) return false;
        if (to !== null && date > to) return false;

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
            const startTime = row.start_time ? moment(row.start_time).format('YYYY-MM-DD HH:mm') : "N/A";
            const stopTime = row.stop_time ? moment(row.stop_time).format('YYYY-MM-DD HH:mm') : "N/A";

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
        if (!selectedKey || !this.mockDataTakes?.length) {
            return;
        }

        // Find datatake
        const dataTake = this.mockDataTakes.find(item => item.id === selectedKey);

        if (!dataTake) {
            console.warn(`Datatake not found for key: ${selectedKey}`);
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

        const rawStart = dataTake.start_time || null;
        let startDate = "N/A";
        if (rawStart) {
            const d = new Date(rawStart);
            if (!isNaN(d)) {
                startDate = d.toISOString().replace("T", " ").slice(0, 19);
            }
        }

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
        const dataList = document.getElementById("dataList");

        if (missionSelect) missionSelect.value = "";
        if (satelliteSelect) {
            satelliteSelect.innerHTML = ""
            this.allSatelliteOptions.forEach(opt =>
                satelliteSelect.appendChild(opt.cloneNode(true))
            );
            satelliteSelect.value = "";
            satelliteSelect.disabled = false;
        }

        if (searchInput) searchInput.value = "";
        if (fromDateInput) fromDateInput.value = "";
        if (toDateInput) toDateInput.value = "";



        // Clear internal state
        this.filteredDataTakes = [];
        this.fromDate = null;
        this.toDate = null;
        this.currentMission = "";
        this.currentSearchTerm = "";

        this.displayedCount = 0;

        dataList.innerHTML = "";
        this.mockDataTakes = this.fullDataTakes.length ? this.fullDataTakes : this.ssrDataTakes;

        this.populateDataList(false);

        document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
        document.querySelectorAll(".container-border").forEach(div => div.classList.remove("selected"));

        this.preselectedTake = this.mockDataTakes[0];
        this.populateDataList(false);

        //const firsTake = this.mockDataTakes[0];
        //if (firsTake) {
        const firsContainer = dataList.querySelector(".container-border");
        const firstA = firsContainer?.querySelector("a.filter-link");
        if (firsContainer && firstA) {
            this.handleItemClick(this.preselectedTake, firsContainer, firstA);
        }
        //}


        if (window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
        }

        this.hideInfoTable?.();
        console.log("[RESET] done.");
    }

    attachEventListeners() {
        const searchInput = document.getElementById("searchInput");
        const dataList = document.getElementById("dataList");
        const tableSection = document.getElementById("tableSection");
        const missionSelect = document.getElementById("mission-select");
        const resetBtn = document.getElementById("resetFilterButton");
        const satelliteSelect = document.getElementById("satellite-select");


        this.allSatelliteOptions = Array.from(satelliteSelect.options).map(opt => opt.cloneNode(true));

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
                const selectedMission = missionSelect.value.toUpperCase();
                this.currentMission = selectedMission;

                // Reset search input if mission reset
                if (selectedMission === "") {
                    this.currentSearchTerm = "";
                    searchInput.value = "";
                }

                this.filterSatellitesByMission(selectedMission, satelliteSelect);
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

                    /*const filtered = allSatelliteOptions.filter(opt => opt.value.startsWith(selectedMission));
                    filtered.forEach(opt => satelliteSelect.appendChild(opt));
                    satelliteSelect.value = "";*/
                    this.filterSatellitesByMission(selectedMission, satelliteSelect);
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

    async initializeDefaultView() {
        const sidebarItems = document.querySelectorAll(".filter-link");
        if (!sidebarItems.length) return;

        const firstLink = sidebarItems[0];
        firstLink.classList.add("active");

        const parentDiv = firstLink.closest(".container-border");
        if (parentDiv) parentDiv.classList.add("selected");

        const firstKey = firstLink.textContent.trim();
        const firstDataTake = this.mockDataTakes.find(dt => dt.id === firstKey);
        if (!firstDataTake) {
            console.warn("First datatake not found in mockDataTakes");
            return;
        }

        // Update title/date
        this.updateTitleAndDate(firstDataTake.id);

        // Update charts
        await Promise.all([
            this.updateCharts("publication", firstDataTake.id),
            this.updateCharts("acquisition", firstDataTake.id)
        ]);

        // Populate info table
        this.renderTableWithoutPagination([firstDataTake], firstDataTake.id);

        // Show table section
        this.showTableSection(firstDataTake.id);
    }

    async handleInitialSelection(first) {
        const sidebarItems = document.querySelectorAll(".filter-link");

        if (!sidebarItems || sidebarItems.length === 0) {
            if (retryCount < 5) { // retry up to 5 times
                console.warn("Sidebar not ready, retrying setDefaultView...");
                return;
            }
        }

        const firstLink = sidebarItems[0];
        const defaultKey = firstLink.textContent.trim();

        if (!defaultKey) {
            console.warn("Sidebar first link has no valid text, cannot update title/date.");
            return;
        }

        firstLink.classList.add("active");
        if (!first) return;
        const parentDiv = firstLink.closest(".container-border");
        if (parentDiv) parentDiv.classList.add("selected");

        const firstDataTake = this.mockDataTakes.find(dt => dt.id === defaultKey);
        if (!firstDataTake) {
            console.warn("first datatakes not found in mockDataTakes");
            return;
        }
        this.updateTitleAndDate(firstDataTake.id);

        // Ensure the DOM elements are ready

        try {
            await Promise.all([
                this.updateCharts("publication", firstDataTake.id),
                this.updateCharts("acquisition", firstDataTake.id)
            ]);
        } catch (err) {
            console.error("Error rendering charts for initial selection:", err);
        }

        this.renderTableWithoutPagination([firstDataTake], firstDataTake.id);

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