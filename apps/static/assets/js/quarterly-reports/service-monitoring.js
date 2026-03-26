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
        if (this.archivePayload.availability_map) {
            console.info('[SM][INIT] Detected Flat Payload (Data Access)');
            this.currentPeriod = 'default'; // Set a dummy period so event lookup works
            this.availabilityMap = this.archivePayload.availability_map;
            this.interfaceStatusMap = this.archivePayload.interface_status_map || {};

            // Map it to our period cache so showUnavailabilityEvents can find it
            this.availabilityMapPerPeriod['default'] = this.availabilityMap;
            this.interfaceStatusMapPerPeriod['default'] = this.interfaceStatusMap;

            this.render();
        }
        // Case B: Archive Page (Nested structure)
        else if (this.archivePayload['prev-quarter'] || this.archivePayload['24h']) {
            console.info('[SM][INIT] Detected Period-based Payload (Archive)');
            this.refreshAvailabilityStatus('prev-quarter');
        }
        else {
            console.error('[SM][INIT] Payload is empty or format unknown');
        }

        console.groupEnd();
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

        // Ensure per-period caches exist
        if (!this.availabilityMapPerPeriod) this.availabilityMapPerPeriod = {};
        if (!this.interfaceStatusMapPerPeriod) this.interfaceStatusMapPerPeriod = {};

        // Get payload for the period, fallback to empty
        const payload = this.archivePayload[periodKey] || {};

        // Update per-period maps
        this.availabilityMapPerPeriod[periodKey] = payload.availability_map || {};
        this.interfaceStatusMapPerPeriod[periodKey] = payload.interface_status_map || {};

        // Normalize interface map: ensure each service has an array
        const services = ['ACRI', 'CLOUDFERRO', 'EXPRIVIA', 'WERUM', 'DAS', 'DHUS'];
        services.forEach(svc => {
            if (!Array.isArray(this.interfaceStatusMapPerPeriod[periodKey][svc])) {
                this.interfaceStatusMapPerPeriod[periodKey][svc] = [];
            }
        });

        // Activate current maps
        this.availabilityMap = this.availabilityMapPerPeriod[periodKey];
        this.interfaceStatusMap = this.interfaceStatusMapPerPeriod[periodKey];


        // Render UI and ensure previous event displays are cleared
        this.render();
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
