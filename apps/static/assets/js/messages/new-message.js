console.log('[NewMessage] Script loaded.');

/* ═══════════════════════════════════════════════════════════════════════
   NEWS EDITOR  (newMessages.html)
   ═══════════════════════════════════════════════════════════════════════ */

const NewsEditor = (() => {

    const TEMPLATES = {
        one_anomaly: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations are impacted from date {SD} on estimated UTC {ST}. '
                + 'Analysis is ongoing. We apologise for the inconveniences the issue is causing.',
            needsEnd: false, needsSentinel: true
        },
        one_resolved: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations were impacted from date {SD} on UTC {ST}. Operations '
                + 'return to nominal date {ED} on UTC {ET}.',
            needsEnd: true, needsSentinel: true
        },
        multi_anomaly: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations are impacted from date {SD} on estimated UTC {ST}. '
                + 'Analysis is ongoing. We apologise for the inconveniences the issue is causing.',
            needsEnd: false, needsSentinel: true, needsMulti: true
        },
        multi_resolved: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations were impacted from date {SD} on UTC {ST}. Operations '
                + 'return to nominal date {ED} on UTC {ET}.',
            needsEnd: true, needsSentinel: true, needsMulti: true
        },
        cdse_anomaly: {
            title: 'Copernicus CDSE operation impacts',
            text: 'CDSE data access operations are impacted from {SD} on UTC {ST}. Analysis is '
                + 'ongoing. We apologise for the inconveniences the issue is causing.',
            needsEnd: false, needsSentinel: false
        },
        cdse_resolved: {
            title: 'Copernicus CDSE operation impacts',
            text: 'CDSE data access operations were impacted from date {SD} on UTC {ST}. Operations '
                + 'return to nominal date {ED} on UTC {ET}.',
            needsEnd: true, needsSentinel: false
        },
        sentiboard_tech: {
            title: 'SentiBoard technical issues',
            text: 'SentiBoard is experiencing technical issues. Please notice that the Data '
                + 'availability and Events on date {SD} on UTC {ST} for Sentinel-{X} is providing '
                + 'wrong information. We are analysing the issue, and we apologise for the inconvenience.',
            needsEnd: false, needsSentinel: true
        }
    };

    const TYPE_CFG = {
        warning: { faClass: 'fa fa-exclamation-circle', color: '#ffc107', label: 'Anomaly / New', msgType: 'warning' },
        info: { faClass: 'fa fa-info-circle', color: '#17a2b8', label: 'Info', msgType: 'info' },
        success: { faClass: 'fa fa-check-circle', color: '#28a745', label: 'Resolved', msgType: 'success' },
        danger: { faClass: 'fa fa-exclamation-triangle', color: '#dc3545', label: 'Disaster', msgType: 'danger' },
    };

    const STATUS_TO_TYPE = {
        new: 'warning',
        resolved: 'success',
        disaster: 'danger',
    };

    // Tracks whether the user has actively chosen a template.
    // false → leave existing title/text alone (DB content in edit mode)
    // true  → template text is appended below the user's own content
    let _templateActive = false;

    // The user's own title/text captured at the moment a template is first
    // applied. The rendered template is always appended AFTER this base, so
    // changing the dates re-renders only the template part and never wipes
    // what the user already wrote.
    let _baseTitle = '';
    let _baseText = '';

    function $id(id) { return document.getElementById(id); }

    function setStatus(status) {
        _applyType(STATUS_TO_TYPE[status] || 'warning');
    }

    function setFromMessageType(msgType) {
        _applyType((msgType || 'warning').toLowerCase());
    }

    function _applyType(msgType) {
        const cfg = TYPE_CFG[msgType] || TYPE_CFG.warning;

        const iconEl = $id('ne-flag-icon');
        if (iconEl) {
            iconEl.className = cfg.faClass;
            iconEl.parentElement.style.color = cfg.color;
        }

        const badge = $id('ne-status-badge');
        if (badge) {
            badge.textContent = cfg.label;
            badge.style.borderColor = cfg.color;
            badge.style.color = cfg.color;
        }

        const hdnMsgType = $id('hdn-messageType');
        if (hdnMsgType) hdnMsgType.value = cfg.msgType;
    }

    function applyTemplate() {
        const sel = ($id('ne-template-select') || {}).value || '';
        if (!sel) return;

        // ── Clear option ────────────────────────────────────────────────
        if (sel === '__clear__') {
            // User explicitly stopped using a template → hand text back to them
            _templateActive = false;
            _baseTitle = '';
            _baseText = '';

            const selectEl = $id('ne-template-select');
            const tplFields = $id('ne-tpl-fields');
            const endDateGrp = $id('ne-end-date-group');
            const sentGrp = $id('ne-sentinel-group');
            const startDt = $id('ne-start-dt');
            const endDt = $id('ne-end-dt');
            const si = $id('ne-sentinel-id');
            const sm = $id('ne-sentinel-multi-id');
            const sentSingle = $id('ne-sentinel-single');
            const sentMulti = $id('ne-sentinel-multi');

            if (selectEl) selectEl.value = '';
            if (tplFields) tplFields.style.display = 'none';
            if (endDateGrp) endDateGrp.style.display = 'none';
            if (sentGrp) sentGrp.style.display = 'none';
            if (startDt) startDt.value = '';
            if (endDt) endDt.value = '';
            if (si) si.value = '';
            if (sm) Array.from(sm.options).forEach(o => o.selected = false);
            if (sentSingle) sentSingle.style.display = '';
            if (sentMulti) sentMulti.style.display = 'none';

            // Only clear title/text when NOT editing
            const inEditMode = (typeof IS_EDIT !== 'undefined') && IS_EDIT;
            if (!inEditMode) {
                const titleEl = $id('title');
                const textEl = $id('text');
                if (titleEl) titleEl.value = '';
                if (textEl) textEl.value = '';
            }
            return;
        }

        // ── Normal template ─────────────────────────────────────────────
        const tpl = TEMPLATES[sel];
        if (!tpl) return;

        // First time a template is picked, remember whatever the user
        // already had so we can append the template below it (and re-append
        // cleanly whenever the dates change). Switching directly between two
        // templates keeps the same base.
        if (!_templateActive) {
            _baseTitle = ($id('title') || {}).value || '';
            _baseText = ($id('text') || {}).value || '';
            _templateActive = true;
        }

        const tplFields = $id('ne-tpl-fields');
        const endDateGrp = $id('ne-end-date-group');
        const sentGrp = $id('ne-sentinel-group');
        const sentSingle = $id('ne-sentinel-single');
        const sentMulti = $id('ne-sentinel-multi');

        if (tplFields) tplFields.style.display = '';
        if (endDateGrp) endDateGrp.style.display = tpl.needsEnd ? '' : 'none';
        if (sentGrp) sentGrp.style.display = tpl.needsSentinel ? '' : 'none';

        if (tpl.needsSentinel) {
            const isMulti = tpl.needsMulti || false;
            if (sentSingle) sentSingle.style.display = isMulti ? 'none' : '';
            if (sentMulti) sentMulti.style.display = isMulti ? '' : 'none';
            // Reset selectors on template switch
            const si = $id('ne-sentinel-id');
            const sm = $id('ne-sentinel-multi-id');
            if (si) si.value = '';
            if (sm) Array.from(sm.options).forEach(o => o.selected = false);
        }

        _fillDates(tpl);
    }

    function fillDates() {
        const sel = ($id('ne-template-select') || {}).value || '';
        _fillDates(TEMPLATES[sel]);
    }

    function _fillDates(tpl) {
        if (!tpl) return;

        // Parse datetime-local values into date + time parts
        const startVal = ($id('ne-start-dt') || {}).value || '';
        const [sd, st] = startVal ? startVal.split('T') : ['XX-XX-XX', 'XX:XX'];
        const endVal = ($id('ne-end-dt') || {}).value || '';
        const [ed, et] = endVal ? endVal.split('T') : ['XX-XX-XX', 'XX:XX'];

        let sentinel = 'XX';
        if (tpl.needsSentinel) {
            if (tpl.needsMulti) {
                const sm = $id('ne-sentinel-multi-id');
                if (sm) {
                    const selected = Array.from(sm.selectedOptions).map(o => o.value);
                    sentinel = selected.length ? selected.join('/') : 'XX';
                }
            } else {
                const si = $id('ne-sentinel-id');
                sentinel = (si && si.value) ? si.value : 'XX';
            }
        }

        const title = tpl.title.replace(/\{X\}/g, sentinel);
        const text = tpl.text
            .replace(/\{SD\}/g, sd || 'XX-XX-XX')
            .replace(/\{ST\}/g, st || 'XX:XX')
            .replace(/\{ED\}/g, ed || 'XX-XX-XX')
            .replace(/\{ET\}/g, et || 'XX:XX')
            .replace(/\{X\}/g, sentinel);

        const titleEl = $id('title');
        const textEl = $id('text');

        // Only write to the fields when a template is actively in use.
        //
        //   create mode → first template pick sets _templateActive = true, so
        //                 everything fills and keeps updating with the dates.
        //   edit mode   → _templateActive starts false, so the DB text is left
        //                 untouched on load. As soon as the user picks a template
        //                 it becomes true, and from then on changing the date
        //                 fields DOES update the text.
        //   clear       → sets it back to false, handing editing to the user.
        if (!_templateActive) return;

        // TITLE: only fill when there is no existing title (create mode).
        // In edit mode the user's title is left completely untouched.
        if (titleEl && !_baseTitle) {
            titleEl.value = title;
        }

        // TEXT: append the rendered template AFTER the user's own content.
        // If the base is empty (create mode) this is just the template.
        const sep = '\n\n';
        if (textEl) {
            textEl.value = _baseText ? (_baseText + sep + text) : text;
        }
    }

    function init() {
        if (!$id('new-message-form')) return;
        const initialType = (typeof INITIAL_MESSAGE_TYPE !== 'undefined')
            ? INITIAL_MESSAGE_TYPE : 'warning';
        setFromMessageType(initialType);
        console.log('[NewsEditor] Initialised. messageType:', initialType);
    }

    return { setStatus, applyTemplate, fillDates, init };
})();


/* ═══════════════════════════════════════════════════════════════════════
   NEWS MESSAGES LIST  (SSR — renderNews used only if called directly)
   ═══════════════════════════════════════════════════════════════════════ */

class NewsMessages {
    constructor(containerId, paginationId, pageSize = 6) {
        this.$container = $(`#${containerId}`);
        this.$pagination = $(`#${paginationId}`);
        this.pageSize = pageSize;
        this.currentMessages = [];

        this._initCollapseIcons();
        $('#time-period-select-container').hide();
    }

    _initCollapseIcons() {
        this.$container.on('show.bs.collapse', '.collapse', (e) => {
            $(e.target).prev('.card-header').find('.toggle-icon')
                .removeClass('fa-chevron-down').addClass('fa-chevron-up');
        });
        this.$container.on('hide.bs.collapse', '.collapse', (e) => {
            $(e.target).prev('.card-header').find('.toggle-icon')
                .removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });
    }

    getBorderColor(messageType) {
        switch ((messageType || '').toLowerCase()) {
            case 'success': return '#28a745';
            case 'info': return '#17a2b8';
            case 'warning': return '#ffc107';
            case 'danger': return '#dc3545';
            default: return '#006B7C';
        }
    }

    getIcon(messageType) {
        switch ((messageType || '').toLowerCase()) {
            case 'success': return 'fa-check-circle';
            case 'info': return 'fa-info-circle';
            case 'warning': return 'fa-exclamation-circle';
            case 'danger': return 'fa-exclamation-triangle';
            default: return 'fa-bullhorn';
        }
    }

    renderNews(messages) {
        this.currentMessages = messages;
        this.$container.empty();

        if (!messages.length) {
            this.$container.html('<p class="text-white text-center">No news available.</p>');
            return;
        }

        const allowedRoles = ['admin', 'ecuser', 'esauser'];
        const showIcons = allowedRoles.includes(window.currentUserRole);

        messages.forEach((msg, index) => {
            const icon = this.getIcon(msg.messageType);
            const borderColor = this.getBorderColor(msg.messageType);
            const collapseId = `msg-details-${index}`;
            const headingId = `heading-${index}`;

            const editDeleteHtml = showIcons ? `
                <a href="/admin/message?id=${encodeURIComponent(msg.id)}&next=${encodeURIComponent(window.location.pathname)}"
                   class="text-white mr-3" title="Edit">
                  <i class="fa fa-pen edit-icon" style="font-size:1.2rem; cursor:pointer;"></i>
                </a>
                <button class="btn btn-link text-white delete-btn p-0 mr-3"
                        data-id="${msg.id}" data-title="${msg.title || ''}"
                        title="Delete" type="button">
                  <i class="fa fa-trash delete-icon" style="font-size:1.2rem; cursor:pointer; color:white !important;"></i>
                </button>` : '';

            const cardHtml = `
            <div class="col-12">
              <div class="card card-admin text-white" style="background-color:#006B7C;">
                <div class="card-header d-flex justify-content-between align-items-center" id="${headingId}">
                  <div class="d-flex align-items-center">
                    <div style="font-size:1.8rem; color:${borderColor}; margin-right:1.2rem;">
                      <i class="fa ${icon}"></i>
                    </div>
                    <div style="font-size:1.05rem;">
                      ${msg.title ? `<strong>${msg.title}</strong>` : ''}
                    </div>
                  </div>
                  <div class="d-flex align-items-center">
                    ${editDeleteHtml}
                    <i class="fa fa-chevron-down toggle-icon" style="font-size:1.2rem; cursor:pointer;"
                       data-toggle="collapse" data-target="#${collapseId}"
                       aria-controls="${collapseId}" aria-expanded="false"></i>
                  </div>
                </div>
                <div id="${collapseId}" class="collapse" aria-labelledby="${headingId}">
                  <div class="card-body" style="color:#eee;">
                    <p>${msg.text}</p>
                    ${msg.link ? `<a href="${msg.link}" target="_blank" class="read-more">Read more</a>` : ''}
                    <br><small>Published: ${this.formatDateUTC(msg.publicationDate)}</small>
                  </div>
                </div>
              </div>
            </div>`;

            this.$container.append(cardHtml);
        });
    }

    formatDateUTC(utcString) {
        if (!utcString) return 'N/A';
        try {
            let isoString = utcString;
            const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}(:\d{2})?)$/;
            const match = utcString.match(ddmmyyyy);
            if (match) {
                isoString = `${match[3]}-${match[2]}-${match[1]}T${match[4]}Z`;
            }
            const dateUtc = new Date(isoString);
            const dateRome = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'UTC',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }).format(dateUtc);
            return dateRome.replace(',', '');
        } catch (e) {
            console.error('[DateFormat] Error:', e, utcString);
            return utcString;
        }
    }
}


/* ═══════════════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════════ */

$(document).ready(() => {
    NewsEditor.init();

    new NewsMessages('news-card-container', 'pagination-controls');

    $('#news-card-container').on('click', '.delete-btn', function (e) {
        e.stopPropagation();
        const messageId = $(this).data('id');
        const messageTitle = $(this).data('title');
        if (!messageId) { console.error('[DELETE] Missing data-id'); return; }
        $('#delete-message-title').text(messageTitle);
        $('#deleteMessageForm input[name="id"]').val(messageId);
        $('#deleteConfirmModal').modal('show');
    });

    const form = document.getElementById('new-message-form');
    if (form) {
        form.addEventListener('submit', () => console.log('[NewMessage] Submitting'));
    }
});
