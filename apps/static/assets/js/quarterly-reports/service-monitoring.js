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

(function () {
    const el = document.getElementById('publication-trend-ssr');
    if (!el) {
        console.error('[SM][SSR] Missing SSR payload element');
        return;
    }

    window.SSR_SERVICE_MONITORING_PAYLOAD = JSON.parse(el.textContent);

    console.group('[SM][SSR]');
    console.log('Period:', window.SSR_SERVICE_MONITORING_PAYLOAD.period_type);
    console.log('Start:', window.SSR_SERVICE_MONITORING_PAYLOAD.start_date);
    console.log('End:', window.SSR_SERVICE_MONITORING_PAYLOAD.end_date);
    console.log(
        'Services:',
        Object.keys(window.SSR_SERVICE_MONITORING_PAYLOAD.interface_status_map || {})
    );
    console.groupEnd();
})();

class ServiceMonitoring {

    constructor() {

        const ssr = window.SSR_SERVICE_MONITORING_PAYLOAD || {};
        this.availabilityMap = ssr.availability_map || {};
        this.interfaceStatusMap = ssr.interface_status_map || {};
    }

    init() {
        console.log(
            '[SM][SSR][DEBUG] Raw availability payload:',
            JSON.stringify(this.availabilityMap, null, 2)
        );

        if (!Object.keys(this.availabilityMap).length) {
            console.warn('[SM][SSR] Availability map is EMPTY — check SSR backend');
        }

        // Render immediately to update UI percentages & bars
        this.render();
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

            console.log(`[SM][SSR] ${service} availability updated: ${perc}`);
        });
    }
    refreshAvailabilityStatus(newPayload) {
        if (newPayload) {
            this.availabilityMap = newPayload.availability_map || this.availabilityMap;
            this.interfaceStatusMap = newPayload.interface_status_map || this.interfaceStatusMap;
        }

        console.group('[SM][refreshAvailabilityStatus]');
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
        events.sort((a, b) => b.start - a.start);

        let html = '<ul>';
        if (events.length === 0) {
            html += '<li>No events reported</li>';
        } else {
            events.forEach(e => {
                html += `<li>${e.start.toISOString()} - ${((e.stop - e.start) / 60000).toFixed(2)} min</li>`;
            });
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