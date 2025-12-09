console.log('[NewMessage] Script loaded.');

class NewsMessages {
    constructor(containerId, paginationId, pageSize = 6) {
        this.$container = $(`#${containerId}`);
        this.$pagination = $(`#${paginationId}`);
        this.pageSize = pageSize;

        this.initEventHandlers();
    }

    initEventHandlers() {
        $('#time-period-select-container').hide();
        // Toggle chevron icon when collapse is shown or hidden
        this.$container.on('show.bs.collapse', '.collapse', (e) => {
            const $collapse = $(e.target);
            $collapse.prev('.card-header').find('.toggle-icon')
                .removeClass('fa-chevron-down')
                .addClass('fa-chevron-up');
        });

        this.$container.on('hide.bs.collapse', '.collapse', (e) => {
            const $collapse = $(e.target);
            $collapse.prev('.card-header').find('.toggle-icon')
                .removeClass('fa-chevron-up')
                .addClass('fa-chevron-down');
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
        this.$container.empty();

        if (!messages.length) {
            this.$container.html('<p class="text-white text-center">No news available.</p>');
            return;
        }

        // Define allowed roles for showing edit/delete icons
        const allowedRoles = ['admin', 'ecuser', 'esauser'];
        const showIcons = allowedRoles.includes(window.currentUserRole);

        messages.forEach((msg, index) => {
            const icon = this.getIcon(msg.messageType);
            const borderColor = this.getBorderColor(msg.messageType);
            const collapseId = `msg-details-${index}`;
            const headingId = `heading-${index}`;

            const editDeleteIconsHtml = showIcons
                ? `
            <i class="fa fa-pen edit-icon mr-3" style="font-size: 1.2rem; cursor: pointer;" title="Edit"></i>
            <i class="fa fa-trash delete-icon mr-3" style="font-size: 1.2rem; cursor: pointer;" title="Delete"></i>
          `
                : '';

            const cardHtml = `
      <div class="col-12">
        <div class="card card-admin text-white" style="background-color: #006B7C;">
          <div class="card-header d-flex justify-content-between align-items-center" id="${headingId}">
            <div class="d-flex align-items-center">
              <div style="font-size: 1.8rem; color: ${borderColor}; margin-right: 1.2rem;">
                <i class="fa ${icon}"></i>
              </div>
              <div style="font-size: 1.05rem;">
                ${msg.title ? `<strong>${msg.title}</strong><br>` : ''}
              </div>
            </div>
            <div class="d-flex align-items-center">
              ${editDeleteIconsHtml}
              <i class="fa fa-chevron-down toggle-icon" style="font-size: 1.2rem; cursor: pointer;"
             data-toggle="collapse" data-target="#${collapseId}" aria-controls="${collapseId}" aria-expanded="false"></i>
            </div>
          </div>
          <div id="${collapseId}" class="collapse" aria-labelledby="${headingId}">
            <div class="card-body" style="color: #eee;">
              <p>${msg.text}</p>
              ${msg.link ? `<a href="${msg.link}" target="_blank" class="read-more">Read more</a>` : ''}
              <br><small>Published: ${msg.publicationDate ? msg.publicationDate.substring(0, 10) : 'N/A'}</small>
            </div>
          </div>
        </div>
      </div>
    `;

            this.$container.append(cardHtml);
        });

        // Attach event handlers only if icons are visible
        if (showIcons) {
            this.$container.find('.edit-icon').on('click', (e) => {
                e.stopPropagation(); // prevent collapse toggle
                const cardIndex = $(e.currentTarget).closest('.col-12').index();
                const message = this.currentMessages[cardIndex];
                if (!message) return;
                window.location.href = `/admin/message?id=${encodeURIComponent(message.id)}&next=${encodeURIComponent(window.location.pathname)}`;
            });
        }
    }
}

$(document).ready(() => {
    new NewsMessages('news-card-container', 'pagination-controls');
    //console.log('[NewMessage] Script loaded.');

    //console.log('[SSR DELETE] Script loaded');

    $('#news-card-container').on('click', '.delete-btn', function (e) {
        e.stopPropagation();

        const messageId = $(this).data('id');
        const messageTitle = $(this).data('title');

        /*console.log('[SSR DELETE] Clicked:', {
            id: messageId,
            title: messageTitle
        });*/

        if (!messageId) {
            console.error('[SSR DELETE] Missing data-id on button');
            return;
        }

        $('#delete-message-title').text(messageTitle);
        $('#deleteMessageForm input[name="id"]').val(messageId);

        $('#deleteConfirmModal').modal('show');
    });

    const form = document.getElementById('new-message-form');

    if (form) {
        //console.log('[NewMessage] SSR EDIT MODE - native submit enabled');

        form.addEventListener('submit', function () {
            console.log('[NewMessage] Submitting');
        });

    }

});
