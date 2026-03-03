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

    let raw;
    try {
        raw = JSON.parse(el.textContent);
    } catch (e) {
        console.error('[SM][SSR] Invalid JSON in SSR payload', e);
        return;
    }

    // data-access.html → availability exists
    if (raw.availability_map) {
        window.SSR_SERVICE_MONITORING_PAYLOAD = raw;
        console.info('[SM][SSR] Using access-page availability payload');
        return;
    }

    window.SSR_ARCHIVE_PAYLOAD = raw;
    //console.info('[SM][SSR] Using archive-page payload for availability', Object.keys(raw));
})();


class ServiceMonitoring {

    constructor() {
        this.archivePayload = window.SSR_ARCHIVE_PAYLOAD || {};

        this.currentPeriod = null;

        this.availabilityMap = {};
        this.interfaceStatusMap = {};
    }

    init() {
        console.group('[SM][INIT]');

        if (!this.archivePayload || !Object.keys(this.archivePayload).length) {
            console.error('[SM][INIT] archivePayload is EMPTY');
            console.groupEnd();
            return;
        }

        // One canonical entry point
        this.refreshAvailabilityStatus('prev-quarter');

        console.groupEnd();
    }


    render() {
        const services = ['ACRI', 'CLOUDFERRO', 'EXPRIVIA', 'WERUM'];

        services.forEach(service => {
            const key = service.toLowerCase();

            const barEl = document.getElementById(`${key}-avail-bar`);
            const percEl = document.getElementById(`${key}-avail-perc`);
            const ifaceEl = document.getElementById(`${key}-interface-avail-perc`);

            // Default when no data
            let value = this.availabilityMap[service];
            if (typeof value !== 'number') {
                value = 100;
            }

            const perc = value.toFixed(2) + '%';

            if (barEl) barEl.style.width = perc;
            if (percEl) percEl.innerText = perc;
            if (ifaceEl) ifaceEl.innerText = perc;
        });
    }

    refreshAvailabilityStatus(periodKey) {
        console.group(`[SM][PERIOD] Switching to ${periodKey}`);

        if (!periodKey) {
            console.error('[SM][PERIOD] Missing periodKey for refresh');
            console.groupEnd();
            return;
        }

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

        console.log('availabilityMap:', this.availabilityMap);
        console.log('interfaceStatusMap:', this.interfaceStatusMap);

        console.groupEnd();

        // Render UI and ensure previous event displays are cleared
        this.render();
    }

    showUnavailabilityEvents(service) {
        console.group(`[SM][CLICK] ${service}`);

        const periodEvents = this.interfaceStatusMapPerPeriod?.[this.currentPeriod] || {};
        const events = Array.isArray(periodEvents[service]) ? periodEvents[service] : [];

        console.log('period:', this.currentPeriod);
        console.log('events:', events);

        console.groupEnd();

        // Sort newest first
        events.sort((a, b) => new Date(b.start) - new Date(a.start));

        // Build HTML and clear old event list each time
        let html = '<ul>';
        if (events.length === 0) {
            html += `<li>No events for ${service} in selected period</li>`;
        } else {
            events.forEach(e => {
                const start = new Date(e.start);
                const stop = new Date(e.stop);
                const desc = e.description || 'No description';
                html += `<li>${start.toISOString()} - ${((stop - start) / 60000).toFixed(2)} min — ${desc}</li>`;
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
    normalizeInterfaceMap() {
        const services = ['ACRI', 'CLOUDFERRO', 'EXPRIVIA', 'WERUM'];

        services.forEach(svc => {
            if (!Array.isArray(this.interfaceStatusMap[svc])) {
                this.interfaceStatusMap[svc] = [];
            }
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
