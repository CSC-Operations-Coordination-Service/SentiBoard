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

    // data-archive.html → NO availability (EXPECTED)
    console.info('[SM][SSR] Archive page detected — availability disabled');
    window.SSR_SERVICE_MONITORING_PAYLOAD = null;
})();


class ServiceMonitoring {

    constructor() {

        const ssr = window.SSR_SERVICE_MONITORING_PAYLOAD || {};
        this.availabilityMap = ssr.availability_map || {};
        this.interfaceStatusMap = ssr.interface_status_map || {};
    }

    init() {
        console.group('[SM][SSR][INIT]');

        const archive = window.SSR_ARCHIVE_PAYLOAD?.["prev-quarter"];

        if (archive?.availability_map) {
            this.availabilityMap = archive.availability_map;
            this.interfaceStatusMap = archive.interface_status_map || {};

            console.info(
                "[SM][SSR] availability_map loaded from ARCHIVE payload",
                this.availabilityMap
            );
        } else {
            console.warn(
                "[SM][SSR] availability_map missing in ARCHIVE payload"
            );
        }

        if (!Object.keys(this.availabilityMap).length) {
            console.warn('[SM][SSR][INIT] availabilityMap is EMPTY');
        } else {
            console.info('[SM][SSR][INIT] availabilityMap OK');
        }

        this.render();
        console.groupEnd();
    }


    render() {
        Object.entries(this.availabilityMap).forEach(([service, value]) => {
            const perc = value.toFixed(2) + '%';

            // Update UI labels and progress bars
            const barEl = document.getElementById(service.toLowerCase() + '-avail-bar');
            const percEl = document.getElementById(service.toLowerCase() + '-avail-perc');
            const interfacePercEl = document.getElementById(service.toLowerCase() + '-interface-avail-perc');

            if (barEl) barEl.style.width = perc;
            if (percEl) percEl.innerText = perc;
            if (interfacePercEl) interfacePercEl.innerText = perc;

            //console.log(`[SM][SSR] ${service} availability updated: ${perc}`);
        });
    }
    refreshAvailabilityStatus(newPayload) {
        if (newPayload) {
            this.availabilityMap = newPayload.availability_map || this.availabilityMap;
            this.interfaceStatusMap = newPayload.interface_status_map || this.interfaceStatusMap;
        }

        //console.group('[SM][refreshAvailabilityStatus]');
        this.render();
        console.groupEnd();
    }

    showDASUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('DAS');
    }

    showDHUSUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('DHUS');
    }

    showAcriUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('ACRI');
    }

    showCloudFerroUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('CLOUDFERRO');
    }

    showExpriviaUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('EXPRIVIA');
    }

    showWerumUnavailabilityEvents() {
        serviceMonitoring.showUnavailabilityEvents('WERUM');
    }

    showUnavailabilityEvents(service) {
        const events = this.interfaceStatusMap[service] || [];
        events.sort((a, b) => new Date(b.start) - new Date(a.start));

        let html = '<ul>';
        if (events.length === 0) {
            html += '<li>No events reported</li>';
        } else {
            events.forEach(e => { const start = new Date(e.start); const stop = new Date(e.stop); html += `<li>${start.toISOString()} - ${((stop - start) / 60000).toFixed(2)} min</li>`; });
        }
        html += '</ul>';

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

let serviceMonitoring = new ServiceMonitoring();