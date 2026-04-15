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
        this.serverData = dataInput || {};

        this.mockDataTakes = Array.isArray(this.serverData.datatakes)
            ? this.serverData.datatakes
            : (Array.isArray(this.serverData.datatakes) ? this.serverData.datatakes : []);


        this.currentDataArray = [...this.mockDataTakes];
        // fullDataTakes now refers to the slice sent by the server to keep the UI snappy
        this.fullDataTakes = [...this.mockDataTakes];
        this.filteredDataTakes = [...this.fullDataTakes];

        this.anomalies = Array.isArray(dataInput.anomalies)
            ? dataInput.anomalies
            : [];

        this.quarterAuthorized = !!dataInput.quarter_authorized;
        this.selectedPeriod = dataInput.selected_period || "week";

        this.searchQuery = this.serverData.search_query || "";
        this.searchQueryClean = this.serverData.search_query_clean || "";
        this.generatedAt = this.serverData.generated_at || null;

        this.itemsPerPage = 10;
        this.rowsPerPage = 10;
        this.infoItemsPerPage = 10;
        this.displayedCount = 0;
        this.activeRequestsCount = 0; // Tracks concurrent async tasks
        this.spinnerVisible = false;

    }

    // --- Spinner-aware async wrapper ---
    async withSpinner(promiseFn) {
        try {
            this.activeRequestsCount++;
            this.showSpinner();
            return await promiseFn();
        } catch (err) {
            console.error(err);
            throw err;
        } finally {
            this.activeRequestsCount--;
            if (this.activeRequestsCount <= 0) this.hideSpinner();
        }
    }
    async init() {
        $('#ec-logo-header, #esa-logo-header').hide();
        this.activeRequestsCount = 0;
        this.showSpinner();

        try {
            // 1. Initial Setup
            this.setupPeriodSelector();

            const dataList = document.getElementById("dataList");
            if (dataList) {
                const items = dataList.querySelectorAll("li");
                // Attach the click listeners to the HTML elements Python rendered
                this.attachItemListeners(items);
            }
            else {
                console.error("[DATATAKES] Missing #dataList element");
                return;
            }
            this.attachItemListeners(dataList.querySelectorAll("li"));


            // We use the first item in the list to populate the dashboard view
            if (this.mockDataTakes.length > 0) {
                await this.renderTablePage(1);
                await this.initCharts();
            } else {
                console.warn("[DATATAKES] No items available to render charts.");
            }

            //console.log("[DATATAKES] Initialization complete");

        } catch (err) {
            console.error("[DATATAKES] Init error:", err);
        } finally {
            // Ensure spinner hides even if an error occurs
            setTimeout(() => this.hideSpinner(), 500);
        }
    }

    showSpinner() {
        if (!this.spinnerVisible) {
            $('#spinner').show();
            this.spinnerVisible = true;
        }
    }

    hideSpinner() {
        if (this.spinnerVisible && this.activeRequestsCount <= 0) {
            $('#spinner').hide();
            this.spinnerVisible = false;
        }
    }


    setupPeriodSelector() {
        const selector = document.getElementById('time-period-select');
        if (!selector) return;

        // Use backend-provided selectedPeriod, default to 'week'
        selector.value = this.selectedPeriod || 'week';

        selector.addEventListener('change', (e) => {
            const period = e.target.value;
            window.location = `/data-availability?period=${period}`;
        });
    }

    renderTablePage(page = 1) {
        this.showSpinner();
        try {
            if (!Array.isArray(this.currentDataArray)) {
                this.currentDataArray = [];
            }
            const tbody = document.getElementById('dataTableBody');
            if (!tbody) return;

            this.currentPage = page;
            const dataset = this.mockDataTakes || [];
            const start = (page - 1) * this.rowsPerPage;
            const current = dataset.slice(start, start + this.rowsPerPage);

            tbody.innerHTML = "";

            if (current.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">
                No datatakes available for the selected period.
            </td></tr>`;

                if (spinner) spinner.style.display = "none";
                return;
            }

            current.forEach(dt => {
                const rawStart = (dt.raw && dt.raw.observation_time_start) || dt.start_time;
                const rawStop = (dt.raw && dt.raw.observation_time_stop) || dt.stop_time;
                const row = document.createElement('tr');
                row.innerHTML = `
                <td>${dt.id}</td>
                <td>${dt.platform || 'N/A'}</td>
                <td>${this.formatDate(rawStart)}</td> 
                <td>${this.formatDate(rawStop)}</td>
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
        } finally {
            this.hideSpinner();
        }

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
        // If Python returned None, dateStr will be null or undefined
        if (!dateStr || dateStr === "None" || dateStr === "null") {
            return "N/A";
        }

        const d = new Date(dateStr);

        // Final safety check for invalid dates
        if (isNaN(d.getTime())) {
            return "N/A";
        }

        // Format as YYYY-MM-DD HH:mm (UTC)
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    }

    filterDatatakesOnPageLoad(cleanQuery = "") {
        if (!cleanQuery) return false;

        this.filteredDataTakes = this.fullDataTakes.filter(take =>
            take.id.toLowerCase().includes(cleanQuery.toLowerCase())
        );

        //console.log("[LOAD] filteredDataTakes after page load filter:", this.filteredDataTakes.map(t => t.id));
        return this.filteredDataTakes.length > 0;
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
        this.showSpinner();
        /*try {
            const dataList = document.getElementById("dataList");
            const loadMoreBtn = document.getElementById("loadMoreBtn");

            if (!dataList) return;

            const data = this.filteredDataTakes && this.filteredDataTakes.length
                ? this.filteredDataTakes
                : this.mockDataTakes;

            //console.log("[POPULATE] data used for sidebar:", data.map(t => t.id));

            if (!append) {
                dataList.innerHTML = "";
                this.displayedCount = 0;
            }

            if (data.length === 0) {
                const li = document.createElement("li");
                li.textContent = " ";
                li.style.color = "#aaa";
                if (loadMoreBtn) {
                    loadMoreBtn.style.display = "none"
                }
                return;
            }

            const nextItems = data.slice(this.displayedCount, this.displayedCount + this.itemsPerPage);
            const fragment = document.createDocumentFragment();

            nextItems.forEach(take => {
                const li = document.createElement("li");
                const containerDiv = document.createElement("div");
                containerDiv.className = "container-border";

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
            });

            dataList.appendChild(fragment);
            this.displayedCount += nextItems.length;

            if (loadMoreBtn) {
                loadMoreBtn.style.display = "block";
                loadMoreBtn.disabled = this.displayedCount >= data.length;
            }

            if (!append && nextItems.length > 0) {
                const first = dataList.querySelector(".container-border");
                const a = first?.querySelector("a.filter-link");
                if (first && a) this.handleItemClick(nextItems[0], first, a);
            }
        } finally {
            setTimeout(() => this.hideSpinner(), 0);
        }*/
    }

    attachItemListeners(listItems) {
        if (!listItems) return;

        listItems.forEach(li => {
            const containerDiv = li.querySelector(".container-border");
            const a = li.querySelector("a.filter-link");

            if (!containerDiv || !a) return;

            // 1. Get the ID from the link text
            const id = a.textContent.trim();

            // 2. Find the full data object ('take') from the available arrays
            const take =
                this.filteredDataTakes?.find(d => d.id === id) ||
                this.fullDataTakes?.find(d => d.id === id) ||
                this.mockDataTakes?.find(d => d.id === id);

            if (!take) {
                console.warn("[DATATAKES] could not find item in any list", id);
                return;
            }

            // 3. Re-attach the original handler that manages the border and visual state
            containerDiv.addEventListener("click", (e) => {
                e.preventDefault();
                this.handleItemClick(take, containerDiv, a);
            });
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

        const sourceList = this.filteredDataTakes?.length
            ? this.filteredDataTakes
            : this.fullDataTakes;

        this.renderTableWithoutPagination(sourceList, take.id);
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
        this.showSpinner();
        try {
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
                const datatakeLabel = document.getElementById("modalDatatakeId");
                if (datatakeLabel) {
                    datatakeLabel.textContent = selectedId;
                }
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
        } finally {
            setTimeout(() => this.hideSpinner(), 0);
        }

    }

    async renderInfoTable(dataInput, page = 1) {
        this.showSpinner();
        let dataArray = [];

        try {
            const tableBody = document.getElementById("modalInfoTableBody");
            const paginationControls = document.getElementById("modalPaginationControls");

            tableBody.innerHTML = "";
            paginationControls.innerHTML = "";

            const cleanDataInput = dataInput.split(" ")[0];
            let datatake = this.fullDataTakes.find(dt => dt.id === cleanDataInput);

            if (!datatake) {
                tableBody.innerHTML = `<tr><td colspan="2">Datatake not found</td></tr>`;
                return;
            }

            const mission = datatake.mission || cleanDataInput.substring(0, 2);
            const showTimeliness = ["S3", "S5", "S5P"].includes(mission);

            this.renderInfoTableHeader(showTimeliness);

            // Enrichment
            if ((!datatake.completeness_list || datatake.completeness_list.length === 0) && datatake.id) {
                try {
                    const formData = new FormData();
                    formData.append("datatake_id", cleanDataInput);
                    const response = await fetch("/data-availability/enrich", { method: "POST", body: formData });
                    if (response.ok) {
                        const enriched = await response.json();
                        Object.assign(datatake, enriched);
                        const idx = this.fullDataTakes.findIndex(dt => dt.id === cleanDataInput);
                        if (idx > -1) this.fullDataTakes[idx] = datatake;
                    }
                } catch (err) { console.error("Enrichment error:", err); }
            }

            let tempMap = new Map();

            const addToMap = (rawType, status, timeliness) => {
                if (!rawType) return;
                let cleanType = rawType.replace("_local_percentage", "");
                let finalTimeliness = timeliness && timeliness !== "-" ? timeliness : "";

                if (showTimeliness) {
                    const validCodes = ["NRTI", "OFFL", "NRT", "STC", "NTC", "NOMINAL", "NR", "ST", "NT", "AL"];
                    validCodes.forEach(code => {
                        const globalRegex = new RegExp(`(^|[-_])${code}([-_]|$)`, "gi");
                        if (globalRegex.test(cleanType)) {
                            if (!finalTimeliness || finalTimeliness === "-") {
                                finalTimeliness = code.toUpperCase();
                            }
                            cleanType = cleanType.replace(globalRegex, "$1$2");
                        }
                    });

                    if (mission === "S3") {
                        if (finalTimeliness === "NRT") finalTimeliness = "NR";
                        if (finalTimeliness === "STC") finalTimeliness = "ST";
                        if (finalTimeliness === "NTC") finalTimeliness = "NT";
                    } else if (mission === "S5" || mission === "S5P") {
                        if (finalTimeliness === "NRT") finalTimeliness = "NRTI";
                        if (finalTimeliness === "NTC") finalTimeliness = "OFFL";
                    }
                }

                cleanType = cleanType.replace(/[-_]+/g, "_").replace(/^_+|_+$/g, "");
                if (!finalTimeliness) finalTimeliness = "-";

                const key = showTimeliness ? `${cleanType}|${finalTimeliness}` : cleanType;
                if (!tempMap.has(key)) {
                    tempMap.set(key, { productType: cleanType, status: status, timeliness: finalTimeliness });
                }
            };

            if (datatake.completeness_list) {
                datatake.completeness_list.forEach(row => addToMap(row.productType, row.status, row.timeliness));
            }

            const allKeys = [...Object.keys(datatake), ...Object.keys(datatake.raw || {}), ...Object.keys(datatake.completeness || {})];
            allKeys.filter(k => k.endsWith("_local_percentage")).forEach(k => {
                const val = datatake[k] ?? datatake.raw?.[k] ?? datatake.completeness?.[k] ?? "-";
                addToMap(k, val, "-");
            });

            dataArray = Array.from(tempMap.values());

            if (mission === "S2") dataArray = dataArray.filter(item => item.productType.includes("MSI"));

            dataArray.sort((a, b) => {
                if (mission === "S1") {
                    const S1_ORDER = { "0": 1, "1": 2, "2": 3, "A": 4 };
                    const oa = S1_ORDER[this.extractS1ProductLevel(a.productType)] ?? 99;
                    const ob = S1_ORDER[this.extractS1ProductLevel(b.productType)] ?? 99;
                    if (oa !== ob) return oa - ob;
                }
                if (showTimeliness) {
                    const order = { "NR": 1, "NRTI": 1, "NRT": 1, "ST": 2, "STC": 2, "NT": 3, "OFFL": 3, "NTC": 3 };
                    const ta = order[a.timeliness] ?? 99;
                    const tb = order[b.timeliness] ?? 99;
                    if (ta !== tb) return ta - tb;
                }
                return a.productType.localeCompare(b.productType);
            });

            // --- PAGINATION CALCULATION ---
            this.currentPage = page;
            const totalItems = dataArray.length;
            const totalPages = Math.ceil(totalItems / this.infoItemsPerPage);
            const startIndex = (this.currentPage - 1) * this.infoItemsPerPage;
            const pageItems = dataArray.slice(startIndex, startIndex + this.infoItemsPerPage);

            // Render Table Rows
            pageItems.forEach(item => {
                const row = document.createElement("tr");
                if (showTimeliness) {
                    const td = document.createElement("td");
                    td.textContent = item.timeliness;
                    row.appendChild(td);
                }
                const pTd = document.createElement("td");
                pTd.textContent = item.productType;
                row.appendChild(pTd);

                const sTd = document.createElement("td");
                sTd.textContent = typeof item.status === 'number' ? item.status.toFixed(2) : item.status;
                row.appendChild(sTd);
                tableBody.appendChild(row);
            });

            // --- RENDER PAGINATION CONTROLS ---
            if (totalPages > 1) {
                const makeButton = (text, pageNum, disabled = false, active = false) => {
                    const btn = document.createElement("button");
                    btn.textContent = text;
                    btn.disabled = disabled;
                    btn.className = `pagination-btn ${active ? 'active' : ''}`;
                    btn.addEventListener("click", () => this.renderInfoTable(cleanDataInput, pageNum));
                    return btn;
                };

                paginationControls.appendChild(makeButton("« Prev", this.currentPage - 1, this.currentPage === 1));

                // Basic logic to show all page numbers
                for (let i = 1; i <= totalPages; i++) {
                    paginationControls.appendChild(makeButton(i, i, false, i === this.currentPage));
                }

                paginationControls.appendChild(makeButton("Next »", this.currentPage + 1, this.currentPage === totalPages));
            }

            // Header labels
            const headerKey = datatake.details?.key || datatake.id || "-";
            const headerTime = datatake.details?.timeliness || datatake.raw?.timeliness || "-";
            $('#datatake-details').empty().append(`
                <div class="form-group">
                    <label>Datatake ID: ${headerKey}</label>
                    <label style="margin-left: 20px;">Timeliness: ${headerTime}</label>
                </div>
            `);

        } finally {
            setTimeout(() => this.hideSpinner(), 0);
        }

        this.currentDataArray = dataArray;
        this.currentPage = page;

        //console.log("[INFO TABLE] Finished rendering table. Current page:", page, "Total items:", dataArray.length);
    }

    renderInfoTableHeader(showTimeliness) {
        const tableHead = document.querySelector(".custom-box-table-sm thead");
        if (!tableHead) return;

        tableHead.innerHTML = `
        <tr>
            ${showTimeliness ? "<th>Timeliness</th>" : ""}
            <th>Product type</th>
            <th>Status (%)</th>
        </tr>
    `;
    }

    extractS1ProductLevel(productType) {
        // Matches RAW__0A, RAW__1A, RAW__2A, RAW__A?, SLC__1A, etc.
        const match = productType.match(/__(\w)/);
        return match ? match[1] : null;
    }

    async initCharts() {
        // Use first datatake for initial charts
        if (!this.fullDataTakes.length) return;
        const first = this.fullDataTakes[0];
        // auto spinner for initial load
        await this.withSpinner(() => this.updateCharts("publication", first));
        await this.withSpinner(() => this.updateCharts("acquisition", first));
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

        const relevantData = this.fullDataTakes.filter(dt =>
            (dt.id || "").toUpperCase() === (normalizedLinkKey || "").toUpperCase() // Changed from startsWith to strict equality
        );

        //console.log("Raw data for", normalizedLinkKey, relevantData.map(dt => dt.raw));

        if (relevantData.length === 0) {
            console.warn(`No data found for key: ${normalizedLinkKey}`);
            return;
        }

        const entry = relevantData[0];
        //console.log(`[DEBUG] Chart Update for ${normalizedLinkKey}:`, entry.raw?.completeness_status);


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
            const percentage = pub.percentage !== undefined ? parseFloat(pub.percentage) : 0;
            //console.log(`[DEBUG] ${normalizedLinkKey} PUB Percentage:`, percentage);

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

    toUtcStringNoShift(localDateTime) {
        return localDateTime + ":00Z";
    }

    filterSidebarItems() {
        const selectedMission = document.getElementById("mission-select").value.toUpperCase();
        const selectedSatellite = document.getElementById("satellite-select").value.toUpperCase();
        const searchQuery = document.getElementById("searchInput").value.toUpperCase();

        // Read and store from/to date values
        const fromInput = document.getElementById("from-date")?.value;
        const toInput = document.getElementById("to-date")?.value;

        this.fromDate = fromInput ? new Date(fromInput) : null;
        this.toDate = toInput ? new Date(toInput) : null;

        const searchTerms = searchQuery.split(/\s+/).map(s => s.trim()).filter(Boolean);

        /* console.log("[FILTER] Selected mission:", selectedMission, "Satellite:", selectedSatellite, "Search terms:", searchTerms);
         console.log("[FILTER] filteredDataTakes after filter:", this.filteredDataTakes.map(t => t.id));*/
        try {
            this.filteredDataTakes = this.fullDataTakes.filter(take => {
                const id = (take.id || "").toUpperCase();
                const satellite = (take.satellite || take.raw?.satellite || take.raw?.satellite_unit || "").toUpperCase();

                let acquisitionDateStr = take.raw?.observation_time_start || take.start_time || take.start;
                if (!acquisitionDateStr) return false;

                const acquisitionDate = new Date(acquisitionDateStr);
                if (isNaN(acquisitionDate)) return false;

                const matchesMission = !selectedMission || id.startsWith(selectedMission);
                const matchesSatellite = !selectedSatellite || satellite.startsWith(selectedSatellite);
                const matchesSearch = !searchTerms.length || searchTerms.every(term => id.includes(term));
                const matchesDate = this.isWithinDateRange(acquisitionDate);
                return matchesMission && matchesSearch && matchesSatellite && matchesDate;
            });

            this.displayedCount = 0;

            const first = this.filteredDataTakes?.[0];
            if (first) {
                this.handleInitialSelection(first);
                this.renderTableWithoutPagination(this.filteredDataTakes, first.id);
                this.showTableSection();
            } else {
                this.hideTable();
                return;
            }

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

    isWithinDateRange(acquisitionDate) {
        if (!acquisitionDate) return false;

        const fromTime = this.fromDate ? this.fromDate.getTime() : null;
        const toTime = this.toDate ? this.toDate.getTime() : null;
        const dtTime = acquisitionDate.getTime();

        const reasons = [];
        if (fromTime && dtTime < fromTime) reasons.push(`start < from`);
        if (toTime && dtTime > toTime) reasons.push(`start > to`);

        if (reasons.length > 0) {
            //console.log(`[DATE-FILTER] Excluding datatake ${acquisitionDate.toISOString()}:`, reasons);
            return false;
        }

        return true;
    }

    getValidDate(row) {
        const rawValue = row.start_time ||
            row.observation_time_start ||
            (row.raw && row.raw.observation_time_start) ||
            (row.raw && row.raw.start_time);

        if (!rawValue) return "N/A";

        // Format the date strictly using UTC to avoid timezone shifts
        return moment.utc(rawValue).format('YYYY-MM-DD HH:mm');
    }

    getValidDateStop(row) {
        const rawValue = row.stop_time ||
            row.observation_time_stop ||
            (row.raw && row.raw.observation_time_stop) ||
            (row.raw && row.raw.stop_time);

        if (!rawValue) return "N/A";
        return moment.utc(rawValue).format('YYYY-MM-DD HH:mm');
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

        tableBody.innerHTML = "";
        tableSection.style.display = "block";

        const selectedData = dataset.find(item => item.id === selectedId);
        let data = selectedData ? [selectedData] : [];

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
            //tableSection.style.display = "none";
            return;
        }

        data.forEach(row => {
            const raw = row.raw || {};
            const completeness = raw.completeness_status || {};

            const acqStatus = completeness.ACQ?.status?.toUpperCase() || "UNKNOWN";
            const pubStatus = completeness.PUB?.status?.toUpperCase() || "UNKNOWN";

            const platform = row.satellite || raw.satellite_unit || "N/A";
            const startTime = this.getValidDate(row);
            const stopTime = this.getValidDateStop(row);
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
                <td data-label="Platform">${row.platform || (row.raw && row.raw.satellite_unit) || "N/A"}</td>
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
        //tableSection.style.display = "block";
    }

    updateTitleAndDate(selectedKey) {
        if (!selectedKey || !this.fullDataTakes?.length) {
            return;
        }


        // Find datatake
        const dataTake = this.fullDataTakes.find(item => item.id === selectedKey);

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
        console.log("[RESET] Starting resetFilters");

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

        //console.log("[RESET] filteredDataTakes after clear:", this.filteredDataTakes);

        if (!dataList) return;

        this.mockDataTakes = this.fullDataTakes.length ? this.fullDataTakes : this.ssrDataTakes;

        this.filteredDataTakes = [...this.mockDataTakes];

        //console.log("[RESET] mockDataTakes for reset:", this.mockDataTakes.map(t => t.id));

        dataList.innerHTML = "";

        this.populateDataList(false);

        const firstTake = this.mockDataTakes[0];
        if (firstTake) {
            //console.log("[RESET] selecting first datatake:", firstTake.id);
            requestAnimationFrame(() => {
                const firstContainer = dataList.querySelector(".container-border");
                const firstA = firstContainer?.querySelector("a.filter-link");
                //console.log("[RESET] firstContainer / firstA found:", !!firstContainer, !!firstA);
                if (firstContainer && firstA) {
                    this.handleItemClick(firstTake, firstContainer, firstA);
                }
            });
        }

        if (window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
        }

        this.hideInfoTable?.();

        document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
        document.querySelectorAll(".container-border").forEach(div => div.classList.remove("selected"));

        console.log("[RESET] done.");
    }

    applyAllFilters() {
        this.filterSidebarItems();
    }
    attachEventListeners() {
        const dataList = document.getElementById("dataList");
        const tableSection = document.getElementById("tableSection");
        const satelliteSelect = document.getElementById("satellite-select");
        const fromDate = document.getElementById("from-date");
        const toDate = document.getElementById("to-date");

        fromDate.addEventListener("change", () => this.applyAllFilters());
        toDate.addEventListener("change", () => this.applyAllFilters());


        if (!dataList || !tableSection) {
            console.error("One or more DOM elements missing for setup.");
            return;
        }

        if (satelliteSelect) {
            this.allSatelliteOptions = Array.from(satelliteSelect.options).map(opt => opt.cloneNode(true));
        }

        dataList.addEventListener("click", async (e) => {
            const containerDiv = e.target.closest(".container-border");
            if (!containerDiv) return;

            e.preventDefault();

            document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
            document.querySelectorAll(".container-border.selected").forEach(div => div.classList.remove("selected"));

            containerDiv.classList.add("selected");
            const targetLink = containerDiv.querySelector("a.filter-link");
            if (targetLink) targetLink.classList.add("active");

            const selectedKey = targetLink ? targetLink.textContent.trim() : null;
            if (!selectedKey) return;

            let itemData = this.fullDataTakes.find(t => t.id === selectedKey);

            if (itemData && itemData.is_lightweight) {
                showGlobalLoading(); // Show a small spinner over the charts

                try {
                    const formData = new FormData();
                    formData.append('datatake_id', selectedKey);

                    const response = await fetch('/data-availability/enrich', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `datatake_id=${encodeURIComponent(selectedKey)}`
                    });
                    const enrichedData = await response.json();

                    // Update our local data so we don't have to fetch it again
                    Object.assign(itemData, enrichedData);
                    itemData.is_lightweight = false;
                } catch (err) {
                    console.error("Failed to enrich datatake on click:", err);
                } finally {
                    hideGlobalLoading();
                }
            }

            this.updateTitleAndDate(selectedKey);

            // Render both donut charts asynchronously
            await Promise.all([
                this.updateCharts("publication", selectedKey),
                this.updateCharts("acquisition", selectedKey)
            ]);

            this.renderTableWithoutPagination(this.fullDataTakes, selectedKey);
            this.hideInfoTable();
        });
        const loadMoreBtn = document.getElementById("loadMoreBtn");
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener("click", () => {
                this.populateDataList(true);
            })
        }

        const closeBtn = document.getElementById("closeTableButton");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                this.hideTable();
            });
        }

    }


    async initializeDefaultView() {
        this.showSpinner();
        try {
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
        } finally {
            setTimeout(() => this.hideSpinner(), 0);
        }

    }

    async handleInitialSelection(first = null, dataset = this.filteredDataTakes) {
        this.showSpinner();
        try {
            if (!dataset || !dataset.length) {
                this.hideTable();
                return;
            }

            // Determine the first datatake to select
            const selectedTake = first || dataset[0];

            // Highlight sidebar
            document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
            document.querySelectorAll(".container-border").forEach(div => div.classList.remove("selected"));

            const sidebarLink = document.querySelector(`.filter-link[data-id="${selectedTake.id}"]`);
            if (sidebarLink) {
                sidebarLink.classList.add("active");
                const parentDiv = sidebarLink.closest(".container-border");
                if (parentDiv) parentDiv.classList.add("selected");
            }

            // Update title and date
            this.updateTitleAndDate(selectedTake.id);

            // Render charts
            try {
                await Promise.all([
                    this.updateCharts("publication", selectedTake.id),
                    this.updateCharts("acquisition", selectedTake.id),
                ]);
            } catch (err) {
                console.error("Chart update error:", err);
            }

            // Render table and show section
            this.renderTableWithoutPagination(dataset, selectedTake.id);
            this.showTableSection(selectedTake.id);
        } finally {
            setTimeout(() => this.hideSpinner(), 0);
        }

    }
}

window.datatakes = new Datatakes(mockDataTakes, formatDataDetail);
