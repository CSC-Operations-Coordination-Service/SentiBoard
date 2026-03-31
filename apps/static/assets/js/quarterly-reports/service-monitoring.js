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
/* service-monitoring.js */
(function bootstrapServiceMonitoringSSR() {
    const el =
        document.getElementById('publication-trend-ssr') ||
        document.getElementById('archive-ssr-payload');

    if (!el) {
        console.warn('[SM][SSR] No SSR payload found on page');
        return;
    }

    try {
        const raw = JSON.parse(el.textContent);
        window.SHARED_SSR_PAYLOAD = raw;

        // Keep your existing assignments for backward compatibility if needed
        if (raw.availability_map) {
            window.SSR_SERVICE_MONITORING_PAYLOAD = raw;
        } else {
            window.SSR_ARCHIVE_PAYLOAD = raw;
        }
    } catch (e) {
        console.error('[SM][SSR] Invalid JSON in SSR payload', e);
        return;
    }

})();


class ServiceMonitoring {

    constructor() {
        // Set of colors associated to service
        this.serviceColorMap = {
            'DAS': 'info',
            'DHUS': 'warning',
            'ACRI': 'primary',
            'CLOUDFERRO': 'secondary',
            'EXPRIVIA': 'success',
            'WERUM': 'warning'
        };

        this.archivePayload = window.SHARED_SSR_PAYLOAD ||
            window.SSR_ARCHIVE_PAYLOAD ||
            window.SSR_SERVICE_MONITORING_PAYLOAD || {};

        this.currentPeriod = null;
        this.availabilityMap = {};
        this.interfaceStatusMap = {};

        // Cache for the period-based view (Archive page)
        this.availabilityMapPerPeriod = {};
        this.interfaceStatusMapPerPeriod = {};
    }

    init() {
        //console.group('[SM][INIT]');

        // 1. HYDRATION: Convert strings to Dates for ALL periods in the payload
        const servicesList = ["ACRI", "CLOUDFERRO", "EXPRIVIA", "WERUM", "DAS", "DHUS"];

        Object.keys(this.archivePayload).forEach(periodKey => {
            const pData = this.archivePayload[periodKey];
            if (pData && pData.interface_status_map) {
                servicesList.forEach(s => {
                    const events = pData.interface_status_map[s];
                    if (Array.isArray(events)) {
                        events.forEach(ev => {
                            if (ev.start && typeof ev.start === 'string') ev.start = new Date(ev.start);
                            if (ev.stop && typeof ev.stop === 'string') ev.stop = new Date(ev.stop);
                        });
                    }
                });
            }
        });

        // 2. Logic to choose the starting period
        if (this.archivePayload.availability_map) {
            this.currentPeriod = 'default';
            this.availabilityMap = this.archivePayload.availability_map;
            this.interfaceStatusMap = this.archivePayload.interface_status_map || {};
            this.render();
        }
        else if (this.archivePayload['prev-quarter'] || this.archivePayload['24h']) {
            // This triggers the calculation logic below
            this.refreshAvailabilityStatus('prev-quarter');
        }

        //console.groupEnd();
    }


    render() {
        // Updated to include DAS and DHUS which appear in your HTML
        const services = ['ACRI', 'CLOUDFERRO', 'EXPRIVIA', 'WERUM', 'DAS', 'DHUS'];

        services.forEach(service => {
            const key = service.toLowerCase();
            const barEl = document.getElementById(`${key}-avail-bar`);
            const percEl = document.getElementById(`${key}-avail-perc`);
            const ifaceEl = document.getElementById(`${key}-interface-avail-perc`);

            let value = this.availabilityMap[service];
            if (typeof value !== 'number') value = 100;

            const perc = value.toFixed(2) + '%';
            if (barEl) barEl.style.width = perc;
            if (percEl) percEl.innerText = perc;
            if (ifaceEl) ifaceEl.innerText = perc;
        });
    }

    refreshAvailabilityStatus(periodKey) {
        console.info(`[SM][PERIOD] Switching to ${periodKey}`);
        this.currentPeriod = periodKey;

        const payload = this.archivePayload[periodKey] || {};
        this.availabilityMap = payload.availability_map || {};
        this.interfaceStatusMap = payload.interface_status_map || {};

        const legacyMap = {
            '24h': 'day',
            '7d': 'week',
            '30d': 'month',
            'prev-quarter': 'prev-quarter',
            'last-quarter': 'prev-quarter'
        };

        let legacyKey = legacyMap[periodKey] || periodKey;

        let dates;
        let isFallback = false;
        try {
            dates = new ObservationTimePeriod().getIntervalDates(legacyKey);
            this.start_date = dates[0];
            this.end_date = dates[1];
        } catch (e) {
            isFallback = true;
            if (payload.interval) {
                this.start_date = new Date(payload.interval.from);
                this.end_date = new Date(payload.interval.to);
            }
        }

        var periodDurationSec;
        if (isFallback) {
            if (periodKey === '7d') periodDurationSec = 7 * 24 * 60 * 60;
            else if (periodKey === '30d') periodDurationSec = 30 * 24 * 60 * 60;
            else if (periodKey === '24h') periodDurationSec = 24 * 60 * 60;
            else {
                periodDurationSec = (this.end_date.getTime() - this.start_date.getTime()) / 1000;
            }
        } else {
            periodDurationSec = (this.end_date.getTime() - this.start_date.getTime()) / 1000;
        }

        console.info(`[SM][MATH] Period: ${periodKey} | Duration: ${periodDurationSec}s`);

        this.render();

        var debugResults = [];
        const services = ['ACRI', 'CLOUDFERRO', 'EXPRIVIA', 'WERUM', 'DAS', 'DHUS'];

        services.forEach((key) => {
            var serviceUnavDurationSec = 0;
            const events = this.interfaceStatusMap[key] || [];

            events.forEach((item) => {
                if (item.start instanceof Date && item.stop instanceof Date) {
                    serviceUnavDurationSec += (item.stop.getTime() - item.start.getTime()) / 1000;
                }
            });

            // Use the standardized denominator we established earlier
            var serviceAvailabityPerc = (1 - serviceUnavDurationSec / periodDurationSec) * 100;
            var displayValue = serviceAvailabityPerc.toFixed(2) + '%';

            var id_base = key.toLowerCase();
            $(`#${id_base}-avail-perc`).text(displayValue);
            $(`#${id_base}-interface-avail-perc`).text(displayValue);
            $(`#${id_base}-avail-bar`).css({ "width": displayValue });

            debugResults.push({
                Service: key,
                'Status': 'Corrected (Single-Count)',
                'Downtime (s)': serviceUnavDurationSec.toFixed(1),
                'Final %': displayValue
            });
        });

    }

    showUnavailabilityEvents(service) {
        console.group(`[SM][CLICK] ${service}`);

        const activePeriod = this.currentPeriod || 'default';

        const periodEvents = this.interfaceStatusMapPerPeriod?.[activePeriod] || {};
        const events = Array.isArray(periodEvents[service]) ? periodEvents[service] : [];

        console.log('period:', this.currentPeriod);
        console.log('events:', events);

        console.groupEnd();

        // Sort newest first
        events.sort((a, b) => new Date(b.start) - new Date(a.start));

        const formatDate = (date) => {
            const d = new Date(date);
            const pad = (n) => n.toString().padStart(2, '0');

            // Use getUTCDate, getUTCMonth, getUTCFullYear, and getUTCHours
            return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
        };


        // Build HTML and clear old event list each time
        let html = '<ul>';
        if (events.length === 0) {
            html += `<li>No events for ${service} in selected period</li>`;
        } else {
            events.forEach(e => {
                const start = new Date(e.start);
                const stop = new Date(e.stop);
                const duration = ((stop - start) / 60000).toFixed(2);
                const desc = e.description || 'No description';
                html += `<li>Unavailability start: ${formatDate(start)}; duration [min]: ${duration}</li>`;
            });
        }
        html += '</ul>';

        // Show notification (old ones cleared automatically by $.notify)
        $.notify({
            title: `${service} Unavailability events`,
            message: html,
            icon: 'fa fa-bell'
        }, {
            type: this.serviceColorMap?.[service] || 'info',
            placement: { from: 'top', align: 'right' }
        });
    }


    // Optional helpers for each service
    showDASUnavailabilityEvents() { this.showUnavailabilityEvents('DAS'); }
    showDHUSUnavailabilityEvents() { this.showUnavailabilityEvents('DHUS'); }
    showAcriUnavailabilityEvents() { this.showUnavailabilityEvents('ACRI'); }
    showCloudFerroUnavailabilityEvents() { this.showUnavailabilityEvents('CLOUDFERRO'); }
    showExpriviaUnavailabilityEvents() { this.showUnavailabilityEvents('EXPRIVIA'); }
    showWerumUnavailabilityEvents() { this.showUnavailabilityEvents('WERUM'); }
}

window.serviceMonitoring = new ServiceMonitoring();
window.serviceMonitoring.init();
