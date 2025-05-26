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

// Data for the mock Data Availability
const mockDataTakes = [
    { id: "S1A-474954", platform: "S1A (WV)", start: "2025-04-08T08:58:31.762Z", stop: "2025-04-08T09:12:11.993Z", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
    { id: "S1A-474952", platform: "S1A (IW)", start: "2025-04-11T07:00:25.928Z", stop: "2025-04-11T07:03:50.986Z", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
    { id: "S1A-474708", platform: "S1A (IW)", start: "2025-02-20T09:23:50.400Z", stop: "2025-02-20T09:28:53.810Z", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
    { id: "S1A-474977", platform: "S1A (IW)", start: "2025-05-05T09:30:28.181Z", stop: "2025-05-05T09:34:22.533Z", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
    { id: "S1A-474970", platform: "S1A (IW)", start: "2025-06-12T09:38:44.730Z", stop: "2025-06-12T09:42:47.800Z", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
    { id: "S1C-118281", platform: "S1C (AIS)", start: "2025-04-11T07:25:43.172Z", stop: "2025-04-11T07:27:44.537Z", acquisition: "PARTIAL", publication: "PARTIAL (61.2%)" },
    { id: "S1C-118282", platform: "S1C (AIS)", start: "2025-01-18T09:46:12.361Z", stop: "2025-01-18T09:54:01.064Z", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (0.0%)" },
    { id: "S1C-118582", platform: "S1C (AIS)", start: "2025-03-10T10:00:31.527Z", stop: "2025-03-10T10:01:59.792Z", acquisition: "ACQUIRED", publication: "PUBLISHED (94.4%)" },
    { id: "S1C-118590", platform: "S1C (AIS)", start: "2025-03-10T10:09:37.667Z", stop: "2025-03-10T10:15:58.309Z", acquisition: "PROCESSING", publication: "PROCESSING (9.7%)" },
    { id: "S2A-51195-4", platform: "S2A (NOBS)", start: "2025-05-22T10:40:56.019Z", stop: "2025-05-22T10:41:29.118Z", acquisition: "ACQUIRED", publication: "PUBLISHED (97.9%)" },
    { id: "S2A-51195-2", platform: "S2A (VIC)", start: "2025-07-01T10:42:01.009Z", stop: "2025-07-01T10:46:24.655Z", acquisition: "PROCESSING", publication: "PROCESSING (20.8%)" },
    { id: "S2A-474708-1", platform: "S2A (NOBS)", start: "2025-04-18T08:08:19.047Z", stop: "2025-04-18T08:08:37.087Z", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
    { id: "S2B-475497-2", platform: "S2B (VIC)", start: "2025-04-19T18:03:50.570Z", stop: "2025-04-19T18:06:29.322Z", acquisition: "PARTIAL", publication: "PARTIAL (69.0%)" },
    { id: "S2B-42289-1", platform: "S2B (NOBS)", start: "2025-04-11T08:06:00.468Z", stop: "2025-04-11T08:40:13.420Z", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
    { id: "S2C-3120-1", platform: "S2C (NOBS)", start: "2025-04-11T07:16:42.459Z", stop: "2025-04-11T07:47:29.755Z", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
    { id: "S2B-42290-1", platform: "S2B (VIC)", start: "2025-04-18T02:55:19.030Z", stop: "2025-04-18T03:20:12.742Z", acquisition: "ACQUIRED", publication: "PUBLISHED (98.9%)" },
    { id: "S2C-3123-1", platform: "S2C (NOBS)", start: "2025-04-17T16:23:38.086Z", stop: "2025-04-17T16:24:46.638Z", acquisition: "ACQUIRED", publication: "PUBLISHED (95.3%)" },
    { id: "S2C-42288-2", platform: "S2C (NOBS)", start: "2025-04-11T08:56:20.355Z", stop: "2025-04-11T09:27:18.475Z", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
    { id: "S3A-20250413144656047681", platform: "S3A", start: "2025-04-11T06:52:40.099Z", stop: "2025-04-11T08:29:40.099Z", acquisition: "ACQUIRED", publication: "PUBLISHED (94.4%)" },
    { id: "S3A-20250413094701047678", platform: "S3A", start: "2025-04-18T05:32:20.802Z", stop: "2025-04-18T05:52:21.290Z", acquisition: "PROCESSING", publication: "PROCESSING (19.8%)" },
    { id: "S3B-20250413054523036282", platform: "S3B", start: "2025-04-17T15:23:36.540Z", stop: "2025-04-17T17:00:36.540Z", acquisition: "ACQUIRED", publication: "PROCESSING (59.4%)" },
    { id: "S3A-20250413062435047676", platform: "S3A", start: "2025-04-17T16:02:29.494Z", stop: "2025-04-17T17:39:29.494Z", acquisition: "ACQUIRED", publication: "PROCESSING (50.4%)" },
    { id: "S5P-38645", platform: "S5P", start: "2025-04-17T22:18:05.000Z", stop: "2025-04-17T23:55:05.000Z", acquisition: "ACQUIRED", publication: "PROCESSING (70.8%)" },
    { id: "S5P-38630", platform: "S5P", start: "2025-04-11T05:34:10.000Z", stop: "2025-04-11T07:11:10.000Z", acquisition: "ACQUIRED", publication: "PUBLISHED (97.9%)" },
    { id: "S5P-38648", platform: "S5P", start: "2025-04-13T21:51:30.000Z", stop: "2025-04-13T23:28:30.000Z", acquisition: "ACQUIRED", publication: "PUBLISHED (91.7%)" },
];

const formatDataDetail = [
    {
        name: "S1A", acquisition: "ACQUIRED", data: [{ productType: "IW_ETA__AX", status: 0.00 }, { productType: "IW_GRDH_1A", status: 100.00 }, { productType: "IW_GRDH_1S", status: 100.00 }, { productType: "IW_OCN__2A", status: 100.00 }, { productType: "IW_OCN__2S", status, status: 100.00 }, { productType: "IW_RAW__0A", status, status: 100.00 }, { productType: "IW_RAW__0C", status, status: 100.00 }, { productType: "IW_RAW__0N", status: 100.00 }, { productType: "IW_RAW__0S", status: 100.00 }, { productType: "IW_SLC__1A", status: 100.00 }
        ]
    },
    {
        name: "S1A", acquisition: "PROCESSING", data: [{ productType: "IW_ETA__AX", status: 0.00 }, { productType: "IW_GRDH_1A", status: 0.00 }, { productType: "IW_GRDH_1S", status: 0.00 }, { productType: "IW_OCN__2A", status: 0.00 }, { productType: "IW_OCN__2S", status, status: 100.00 }, { productType: "IW_RAW__0A", status, status: 0.00 }, { productType: "IW_RAW__0C", status, status: 0.00 }, { productType: "IW_RAW__0N", status: 0.00 }, { productType: "IW_RAW__0S", status: 0.00 }, { productType: "IW_SLC__1A", status: 0.00 }
        ]
    },
    {
        name: "S1C", acquisition: "ACQUIRED", data: [{ productType: "WV_ETA__AX", status: 0.00 }, { productType: "WV_OCN__2A", status: 99.98 }, { productType: "WV_OCN__2S", status: 99.98 }, { productType: "WV_RAW__0A", status: 100.00 }, { productType: "WV_RAW__0C", status: 100.00 }, { productType: "WV_RAW__0N", status: 100.00 }, { productType: "WV_RAW__0S", status: 100.00 }, { productType: "WV_SLC__1A", status: 100.00 }, { productType: "WV_SLC__1S", status: 100.00 }
        ]
    },
    {
        name: "S1C", acquisition: "PARTIAL", data: [{ productType: "IW_GRDH_1A", status: 0.00 }, { productType: "IW_GRDH_1S", status: 0.00 }, { productType: "IW_OCN__2A", status: 0.00 }, { productType: "IW_OCN__2S", status: 0.00 }, { productType: "IW_RAW__0A", status: 100.00 }, { productType: "IW_RAW__0C", status: 100.00 }, { productType: "IW_RAW__0N", status: 100.00 }, { productType: "IW_RAW__0S", status: 94.31 }, { productType: "IW_SLC__1A", status: 0.00 }, { productType: "IW_SLC__1S", status: 0.00 }
        ]
    },
    {
        name: "S2A", acquisition: "PLANNED", data: [{ productType: "L0_", status: "24.98" }, { productType: "L1A", status: 0.00 }, { productType: "MSI_L0__DS", status: 26.88 }, { productType: "MSI_L0__GR", status: 23.08 }, { productType: "MSI_L1A_DS", status: 0.00 }, { productType: "MSI_L1A_GR", status: 0.00 }
        ]
    },
    {
        name: "S2A", acquisition: "PROCESSING", data: [{ productType: "L0_", status: 100.00 }, { productType: "L1B", status: 100.00 }, { productType: "L1C", status: 100.00 }, { productType: "L2A", status: "59.32" }, { productType: "MSI_L0__DS", status: 100.00 }, { productType: "MSI_L0__GR", status: 100.00 }, { productType: "MSI_L1B_DS", status: 100.00 }, { productType: "MSI_L1B_GR", status: 100.00 }, { productType: "MSI_L1C_DS", status: 100.00 }, { productType: "MSI_L1C_TC", status: 100.00 }
        ]
    },
    {
        name: "S2B", acquisition: "PLANNED", data: [{ productType: "L0_", status: 0.00 }, { productType: "L1B", status: 0.00 }, { productType: "L1C", status: 0.00 }, { productType: "L2A", status: 0.00 }, { productType: "MSI_L0__DS", status: 0.00 }, { productType: "MSI_L0__GR", status: 0.00 }, { productType: "MSI_L1B_DS", status: 0.00 }, { productType: "MSI_L1B_GR", status: 0.00 }, { productType: "MSI_L1C_DS", status: 0.00 }, { productType: "MSI_L2A_DS", status: 0.00, }
        ]
    },
    {
        name: "S2A", acquisition: "UNAVAILABLE", data: [{ productType: "L0_", status: 0.00 }, { productType: "L1B", status: 0.00 }, { productType: "L1C", status: 0.00 }, { productType: "L2A", status: 0.00 }, { productType: "MSI_L0__DS", status: 0.00 }, { productType: "MSI_L0__GR", status: 0.00 }, { productType: "MSI_L1B_DS", status: 0.00 }, { productType: "MSI_L1B_GR", status: 0.00 }, { productType: "MSI_L1C_DS", status: 0.00 }, { productType: "MSI_L2A_DS", status: 0.00, }
        ]
    },
    {
        name: "S3A", acquisition: "PROCESSING", data: [{ productType: "SL_2_FRP___#NT", status: 0.00 }, { productType: "SL_2_LST___#NR", status: 100.00 }, { productType: "SL_2_LST___#NT", status: 0.00 }, { productType: "SR_0_SRA___#NR", status: 100.00 }, { productType: "SR_0_SRA___#ST", status: 0.00 }, { productType: "SR_1_LAN_RD#NR", status: 100.00 }, { productType: "SR_1_LAN_RD#NT", status: 0.00 }, { productType: "SR_1_LAN_RD#ST", status: 0.00 }, { productType: "SR_1_SRA_A_#NR", status: 100.00 }, { productType: "SR_1_SRA_A_#NT", status: 0.00, }
        ]
    },
    {
        name: "S3B", acquisition: "ACQUIRED", data: [{ productType: "DO_0_DOP___#NR", status: 100.00 }, { productType: "DO_0_NAV___#AL", status: 100.00 }, { productType: "GN_0_GNS___#NR", status: 100.00 }, { productType: "MW_0_MWR___#NR", status: 100.00 }, { productType: "MW_1_CAL___#NR", status: 100.00 }, { productType: "MW_1_MWR___#NR", status: 100.00 }, { productType: "MW_1_MWR___#NT", status: 0.00 }, { productType: "MW_1_MWR___#ST", status: 100.00 }, { productType: "OL_0_EFR___#NR", status: 100.00 }, { productType: "OL_1_EFR___#NR", status: 100.00 }]
    },
    {
        name: "S5P", acquisition: "ACQUIRED", data: [{ productType: "OFFL_L1B_RA_BD1", status: 100.00 }, { productType: "OFFL_L1B_RA_BD2", status: 100.00 }, { productType: "OFFL_L1B_RA_BD3", status: 100.00 }, { productType: "OFFL_L1B_RA_BD4", status: 100.00 }, { productType: "OFFL_L1B_RA_BD5", status: 100.00 }, { productType: "OFFL_L1B_RA_BD6", status: 100.00 }, { productType: "OFFL_L1B_RA_BD7", status: 100.00 }, { productType: "OFFL_L1B_RA_BD8", status: 100.00, productType: "OFFL_L2__AER_AI", status: 0.00 }, { productType: "OFFL_L2__AER_LH", status: 0.00, }]
    }
];

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

        this.bindEvents();
    }

    init() {
        document.addEventListener("DOMContentLoaded", () => {
            this.populateDataList();
            this.attachEventListeners();
            this.setDefaultView();
            console.log("Datatakes initialized.");
        });
    }

    bindEvents() {
        document.getElementById("infoButton").addEventListener("click", () => this.toggleInfoTable());
    }

    getGroundStation(id) {
        if (id.includes("S1A") || id.includes("S1C")) return "Sentinel 1";
        if (id.includes("S2A") || id.includes("S2B")) return "Sentinel 2";
        if (id.includes("S3")) return "Sentinel 3";
        if (id.includes("S5P")) return "Sentinel 5P";
        return "Sentinel";
    }

    populateDataList() {
        const dataList = document.getElementById("dataList");
        dataList.innerHTML = "";

        this.mockDataTakes.forEach(take => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = "#";
            a.className = "filter-link";
            a.dataset.filterType = "groundStation";
            a.dataset.filterValue = this.getGroundStation(take.id);
            a.textContent = take.id;
            li.appendChild(a);
            dataList.appendChild(li);
        });
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

    toggleInfoTable() {
        const infoTable = document.getElementById("infoTableContainer");
        const paragraph = document.querySelector(".chart-container h4");
        if (!infoTable || !paragraph) {
            console.error("Info table container or paragraph not found!");
            return;
        }

        let fullText = paragraph.textContent.trim().replace(/_/g, "-");
        const parts = fullText.split("-");
        const selectedId = parts[0] + "-" + parts[1];

        const matchingItem = this.mockDataTakes.find(item => item.id.includes(selectedId));
        if (!matchingItem) {
            console.warn("No matching item found in mockDataTakes.");
            return;
        }

        const acquisitionName = matchingItem.acquisition;
        const platformName = matchingItem.platform.split('(')[0].trim().toLowerCase();

        const filteredData = this.formatDataDetail.filter(item => {
            const itemName = item.name ? item.name.toString().toLowerCase() : "";
            return itemName === platformName && item.acquisition?.toLowerCase() === acquisitionName.toLowerCase();
        });

        this.renderInfoTable(filteredData);

        if (infoTable.style.display === "none" || infoTable.style.display === "") {
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
    }

    renderInfoTable(dataArray, page = 1) {
        const tableBody = document.getElementById("infoTableBody");
        const paginationControls = document.getElementById("paginationControls");
        tableBody.innerHTML = "";
        paginationControls.innerHTML = "";

        if (!dataArray || dataArray.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 2;
            cell.textContent = "No data available.";
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        const flattenedData = dataArray.flatMap(item => item.data);
        this.currentDataArray = dataArray;
        const totalItems = flattenedData.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        this.currentPage = page;

        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const pageItems = flattenedData.slice(startIndex, endIndex);

        pageItems.forEach(platform => {
            const row = document.createElement("tr");

            const productTypeCell = document.createElement("td");
            productTypeCell.textContent = platform.productType || "-";

            const statusCell = document.createElement("td");
            statusCell.textContent = platform.status ?? "-";

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

    extractPercentage(str) {
        const match = str.match(/\(([\d.]+)%\)/);
        return match ? parseFloat(match[1]) : 0;
    }

    updateCharts(linkKey) {
        const donutChartContainer = document.querySelector("#missionDonutChart");
        if (!donutChartContainer) {
            console.error("missionDonutChart container not found!");
            return;
        }

        const relevantData = this.mockDataTakes.filter(dt => dt.id.startsWith(linkKey));
        if (relevantData.length === 0) {
            console.warn(`No data found for platform: ${linkKey}`);
            return;
        }

        const colorMap = {
            PARTIAL: ['#FFD700', '#FFF8DC'],
            PUBLISHED: ['#4caf50', '#A5D6A7'],
            UNAVAILABLE: ['#FF0000', '#FF9999'],
            PLANNED: ['#9e9e9e', '#E0E0E0'],
            PROCESSING: ['#9e9e9e', '#E0E0E0']
        };

        const series = [];
        const labels = [];
        const colors = [];

        relevantData.forEach(entry => {
            const type = entry.publication?.split(" ")[0] || "UNKNOWN";
            const percentage = this.extractPercentage(entry.publication || "");
            const remaining = Math.max(0, 100 - percentage);

            labels.push(`Complete`);
            series.push(parseFloat(percentage.toFixed(2)));
            colors.push((colorMap[type] || colorMap["UNKNOWN"])[0]);

            labels.push(`Missing`);
            series.push(parseFloat(remaining.toFixed(2)));
            colors.push((colorMap[type] || colorMap["UNKNOWN"])[1]);
        });

        if (this.donutChartInstance) this.donutChartInstance.destroy();

        const options = {
            chart: { type: 'donut', height: 350, toolbar: { show: false } },
            series,
            labels,
            tooltip: { y: { formatter: val => `${val.toFixed(2)}%` } },
            colors,
            states: { hover: { filter: { type: 'darken', value: 0.15 } } },
            legend: {
                show: true,
                position: 'right',
                horizontalAlign: 'left',
                labels: { colors: '#FFFFFF' }
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
                                    const totalPercent = series
                                        .filter((_, i) => i % 2 === 0)
                                        .reduce((sum, val) => sum + val, 0);
                                    const avg = totalPercent / (series.length / 2);
                                    return `${avg.toFixed(1)}%`;
                                }
                            }
                        }
                    }
                }
            }
        };

        this.donutChartInstance = new ApexCharts(donutChartContainer, options);
        this.donutChartInstance.render();
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
        const links = document.querySelectorAll("#dataList li");

        links.forEach((li) => {
            const text = li.textContent.toUpperCase().trim();
            const matchesMission = !selectedMission || text.startsWith(selectedMission);
            const matchesSearch = searchQuery.split(/\s+/).every(q => text.includes(q));

            if (matchesMission && matchesSearch) {
                li.style.display = "";
            } else {
                li.style.display = "none";
            }
        });
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
            return;
        }

        let data = [selectedData];
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.id.toLowerCase().includes(query) ||
                item.platform.toLowerCase().includes(query)
            );
        }

        data.forEach(row => {
            const acquisitionStatus = row.acquisition?.toUpperCase() || "";
            const publicationStatus = row.publication?.toUpperCase() || "";

            const acquisitionColor = acquisitionStatus.includes("ACQUIRED") ? "#0aa41b" :
                acquisitionStatus.includes("UNAVAILABLE") ? "#FF0000" :
                    acquisitionStatus.includes("PARTIAL") ? "#FFD700" : "#818181";

            const publicationColor = publicationStatus.includes("PUBLISHED") ? "#0aa41b" :
                publicationStatus.includes("UNAVAILABLE") ? "#FF0000" :
                    publicationStatus.includes("PARTIAL") ? "#FFD700" : "#818181";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.id}</td>
                <td>${row.platform}</td>
                <td>${row.start}</td>
                <td>${row.stop}</td>
                <td><span style="color:${acquisitionColor}">${row.acquisition}</span></td>
                <td><span style="color:${publicationColor}">${row.publication}</span></td>
                <td>
                    <button type="button" style="color: #8c90a0" class="btn-link" data-toggle="modal"
                        data-target="#showDatatakeDetailsModal"
                        onclick="datatakes.showDatatakeDetails('${row.id}')">
                        <i class="la flaticon-search-1"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        tableSection.style.display = "block";
    }

    updateTitleAndDate(selectedKey) {
        const titleElement = document.querySelector(".chart-container h4.text-left");
        const dateElement = document.querySelector(".chart-container p.text-left");

        if (!titleElement || !dateElement) {
            console.error("Title or date element not found!");
            return;
        }

        const dataTake = this.mockDataTakes.find(item => item.id === selectedKey);
        if (dataTake) {
            const startDate = new Date(dataTake.start).toISOString().replace("T", " ").slice(0, 19);
            titleElement.childNodes[0].nodeValue = `${dataTake.id}`;
            dateElement.textContent = `${startDate}`;
        }
    }

    resetFilters() {
        document.getElementById("mission-select").value = "";
        document.getElementById("searchInput").value = "";
        const items = document.querySelectorAll("#dataList li");
        let firstVisibleLink = null;

        // Make all items visible
        items.forEach(item => {
            item.style.display = "";
        });
        // Remove 'active' from all filter-link anchors
        document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));

        // Find the first visible .filter-link inside <li>
        for (const item of items) {
            if (item.style.display !== "none") {
                const link = item.querySelector(".filter-link");
                if (link) {
                    firstVisibleLink = link;
                    break;
                }
            }
        }

        // Highlight and update using the first visible link
        if (firstVisibleLink) {
            firstVisibleLink.classList.add("active");
            const selectedKey = firstVisibleLink.textContent.trim();

            this.updateCharts(selectedKey);
            this.renderTableWithoutPagination(mockDataTakes, selectedKey);
            this.updateTitleAndDate(selectedKey);
        } else {
            console.warn("No visible item found after resetting filters.");
        }

        this.hideTable(); // Hide the table when filters are reset

    }

    attachEventListeners() {
        const searchInput = document.getElementById("searchInput");
        const dataList = document.getElementById("dataList");
        const infoButton = document.getElementById("infoButton");
        const tableSection = document.getElementById("tableSection");
        const missionSelect = document.getElementById("mission-select");
        const resetBtn = document.getElementById("resetFilterButton");

        if (!dataList || !infoButton || !tableSection) {
            console.error("One or more DOM elements missing for setup.");
            return;
        }

        // Hide table by default
        tableSection.style.display = "none";

        // Toggle table section (if logic needed)
        infoButton.addEventListener("click", () => {
            tableSection.style.display = tableSection.style.display === "none" ? "block" : "none";
        });

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

        // Sidebar link click handling
        dataList.addEventListener("click", (e) => {
            const target = e.target.closest("a.filter-link");
            if (!target) return;

            e.preventDefault();

            // Remove active classes
            document.querySelectorAll(".filter-link").forEach(link => link.classList.remove("active"));
            target.classList.add("active");

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