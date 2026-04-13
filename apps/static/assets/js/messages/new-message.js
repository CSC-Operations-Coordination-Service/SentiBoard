console.log('[NewMessage] Script loaded.');

/* ═══════════════════════════════════════════════════════════════════════
   NEWS EDITOR  (newMessages.html)
   ═══════════════════════════════════════════════════════════════════════ */

const NewsEditor = (() => {

    const TEMPLATES = {
        one_anomaly: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations are impacted from date {SD} on estimated UTC {ST}. '
                + 'Analysis is ongoing. The impact will be available on the Sentinel Operations '
                + 'Dashboard Events Page on the next Nominal Working Day. We apologise for the '
                + 'inconveniences the issue is causing.',
            needsEnd: false, needsSentinel: true
        },
        one_resolved: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations were impacted from date {SD} on UTC {ST}. Operations '
                + 'return to nominal date {ED} on UTC {ET}. The impact will be available on the '
                + 'Sentinel Operations Dashboard Events Page on the next Nominal Working Day.',
            needsEnd: true, needsSentinel: true
        },
        multi_anomaly: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations are impacted from date {SD} on estimated UTC {ST}. '
                + 'Analysis is ongoing. The impact will be available on the Sentinel Operations '
                + 'Dashboard Events Page on the next Nominal Working Day. We apologise for the '
                + 'inconveniences the issue is causing.',
            needsEnd: false, needsSentinel: true
        },
        multi_resolved: {
            title: 'Copernicus Sentinel-{X} operation impacts',
            text: 'Sentinel {X} operations were impacted from date {SD} on UTC {ST}. Operations '
                + 'return to nominal date {ED} on UTC {ET}. The impact will be available on the '
                + 'Sentinel Operations Dashboard Events Page on the next Nominal Working Day.',
            needsEnd: true, needsSentinel: true
        },
        cdse_anomaly: {
            title: 'Copernicus CDSE operation impacts',
            text: 'CDSE data access operations are impacted from {SD} on UTC {ST}. Analysis is '
                + 'ongoing. The impact will be available on the Sentinel Operations Dashboard '
                + 'Events Page on the next Nominal Working Day. We apologise for the inconveniences '
                + 'the issue is causing.',
            needsEnd: false, needsSentinel: false
        },
        cdse_resolved: {
            title: 'Copernicus CDSE operation impacts',
            text: 'CDSE data access operations were impacted from date {SD} on UTC {ST}. Operations '
                + 'return to nominal date {ED} on UTC {ET}. The impact will be available on the '
                + 'Sentinel Operations Dashboard Events Page on the next Nominal Working Day.',
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

    // ── messageType → preview icon config ─────────────────────────────────
    // fa icon class and colour match EXACTLY what newsList.html renders,
    // so the editor preview shows what the list will look like after save.
    //
    //  messageType  │  fa icon                    │  colour   │  label
    //  ─────────────┼─────────────────────────────┼───────────┼──────────────
    //  warning      │  fa-exclamation-circle       │  #ffc107  │  Anomaly/New
    //  info         │  fa-info-circle              │  #17a2b8  │  Info
    //  success      │  fa-check-circle             │  #28a745  │  Resolved
    //  danger       │  fa-exclamation-triangle     │  #dc3545  │  Disaster
    const TYPE_CFG = {
        warning: { faClass: 'fa fa-exclamation-circle', color: '#ffc107', label: 'Anomaly / New', msgType: 'warning' },
        info: { faClass: 'fa fa-info-circle', color: '#17a2b8', label: 'Info', msgType: 'info' },
        success: { faClass: 'fa fa-check-circle', color: '#28a745', label: 'Resolved', msgType: 'success' },
        danger: { faClass: 'fa fa-exclamation-triangle', color: '#dc3545', label: 'Disaster', msgType: 'danger' },
    };

    // Status button name → messageType stored in DB
    const STATUS_TO_TYPE = {
        new: 'warning',
        resolved: 'success',
        disaster: 'danger',
    };

    function $id(id) { return document.getElementById(id); }

    // ── Update the preview icon, label badge, and hidden form field ────────
    function setStatus(status) {
        const msgType = STATUS_TO_TYPE[status] || 'warning';
        _applyType(msgType);
    }

    // Called on init with the raw messageType string from the DB
    function setFromMessageType(msgType) {
        _applyType((msgType || 'warning').toLowerCase());
    }

    function _applyType(msgType) {
        const cfg = TYPE_CFG[msgType] || TYPE_CFG.warning;

        // Update preview icon — change fa class and colour
        const iconEl = $id('ne-flag-icon');
        if (iconEl) {
            iconEl.className = cfg.faClass;
            iconEl.parentElement.style.color = cfg.color;
        }

        // Update label badge
        const badge = $id('ne-status-badge');
        if (badge) {
            badge.textContent = cfg.label;
            // Keep badge colour in sync with icon colour
            badge.style.borderColor = cfg.color;
            badge.style.color = cfg.color;
        }

        // Update the hidden field that gets submitted with the form
        const hdnMsgType = $id('hdn-messageType');
        if (hdnMsgType) hdnMsgType.value = cfg.msgType;
    }

    function applyTemplate() {
        const sel = ($id('ne-template-select') || {}).value || '';
        if (!sel) return;

        const tpl = TEMPLATES[sel];
        if (!tpl) return;

        const tplFields = $id('ne-tpl-fields');
        const endDateGrp = $id('ne-end-date-group');
        const endTimeGrp = $id('ne-end-time-group');
        const sentGrp = $id('ne-sentinel-group');

        if (tplFields) tplFields.style.display = '';
        if (endDateGrp) endDateGrp.style.display = tpl.needsEnd ? '' : 'none';
        if (endTimeGrp) endTimeGrp.style.display = tpl.needsEnd ? '' : 'none';
        if (sentGrp) sentGrp.style.display = tpl.needsSentinel ? '' : 'none';

        _fillDates(tpl);
    }

    function fillDates() {
        const sel = ($id('ne-template-select') || {}).value || '';
        _fillDates(TEMPLATES[sel]);
    }

    function _fillDates(tpl) {
        if (!tpl) return;

        const sd = ($id('ne-start-date') || {}).value || 'XX-XX-XX';
        const st = ($id('ne-start-time') || {}).value || 'XX:XX';
        const ed = ($id('ne-end-date') || {}).value || 'XX-XX-XX';
        const et = ($id('ne-end-time') || {}).value || 'XX:XX';

        let sentinel = 'XX';
        if (tpl.needsSentinel) {
            const si = $id('ne-sentinel-id');
            sentinel = (si && si.value) ? si.value : 'XX';
        }

        const title = tpl.title.replace(/\{X\}/g, sentinel);
        const text = tpl.text
            .replace(/\{SD\}/g, sd)
            .replace(/\{ST\}/g, st)
            .replace(/\{ED\}/g, ed)
            .replace(/\{ET\}/g, et)
            .replace(/\{X\}/g, sentinel);

        const titleEl = $id('title');
        const textEl = $id('text');
        if (titleEl) titleEl.value = title;
        if (textEl) textEl.value = text;
    }

    function init() {
        if (!$id('new-message-form')) return;

        // Set the preview icon to match the existing messageType (edit mode)
        // or default to 'warning' for a new message.
        const initialType = (typeof INITIAL_MESSAGE_TYPE !== 'undefined')
            ? INITIAL_MESSAGE_TYPE
            : 'warning';

        setFromMessageType(initialType);
        console.log('[NewsEditor] Initialised. messageType:', initialType);
    }

    return { setStatus, applyTemplate, fillDates, init };
})();


/* ═══════════════════════════════════════════════════════════════════════
   NEWS MESSAGES LIST  (SSR — renderNews only used if called directly)
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

    // Same icon/colour logic as newsList.html Jinja maps
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
                    <br><small>Published: ${this.formatDateRome(msg.publicationDate)}</small>
                  </div>
                </div>
              </div>
            </div>`;

            this.$container.append(cardHtml);
        });
    }

    formatDateRome(utcString) {
        if (!utcString) return 'N/A';
        try {
            const dateUtc = new Date(utcString);
            const dateRome = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Rome',
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
