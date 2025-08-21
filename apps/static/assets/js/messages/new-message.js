console.log('[NewMessage] Script loaded.');

class NewsMessages {
    constructor(containerId, paginationId, pageSize = 6) {
        this.$container = $(`#${containerId}`);
        this.$pagination = $(`#${paginationId}`);
        this.pageSize = pageSize;
        this.currentPage = 1;
        this.totalPages = 1;

        this.initEventHandlers();
    }

    initEventHandlers() {
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

        // Pagination click handler
        this.$pagination.on('click', '.page-link', (e) => {
            e.preventDefault();
            const targetPage = parseInt($(e.currentTarget).data('page'));
            if (targetPage && targetPage !== this.currentPage) {
                this.currentPage = targetPage;
                this.loadMessages();
            }
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

            let deleteTargetMessage = null;
            this.$container.find('.delete-icon').on('click', (e) => {
                e.stopPropagation();
                const cardIndex = $(e.currentTarget).closest('.col-12').index();
                const message = this.currentMessages[cardIndex];
                if (!message) return;
                deleteTargetMessage = message;
                $('#delete-message-title').text(message.title);
                $('#deleteConfirmModal').modal('show');
            });

            $('#confirmDeleteBtn').off('click').on('click', () => {
                if (!deleteTargetMessage) return;

                fetch('/api/instant-messages/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: deleteTargetMessage.id }),
                })
                    .then(res => res.json())
                    .then(data => {
                        $('#deleteConfirmModal').modal('hide');
                        if (data.error) {
                            showAlert('danger', 'Error: ' + data.error);
                        } else {
                            showAlert('success', 'News post deleted successfully.');
                            this.loadMessages(); // refresh list
                        }
                    })
                    .catch(err => {
                        $('#deleteConfirmModal').modal('hide');
                        console.error('Delete failed:', err);
                        showAlert('danger', 'Delete failed');
                    });
            });
        }
    }


    renderPaginationControls(current, total) {
        this.$pagination.empty();

        for (let i = 1; i <= total; i++) {
            this.$pagination.append(`
        <li class="page-item ${i === current ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `);
        }
    }

    loadMessages() {
        $.getJSON(`/api/instant-messages/all?page=${this.currentPage}&pageSize=${this.pageSize}`)
            .done((data) => {
                const messages = data.messages || [];
                this.currentMessages = messages;
                const totalItems = data.total || 0;
                this.totalPages = Math.ceil(totalItems / this.pageSize);

                this.renderNews(messages);
                this.renderPaginationControls(this.currentPage, this.totalPages);
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                this.$container.html('<p class="text-danger text-center">Failed to load news.</p>');
                console.error('Error fetching news:', textStatus, errorThrown);
            });
    }


}

function showAlert(type, message, duration = 4000) {
    const alertId = 'alert-' + Date.now(); // unique ID
    const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show mt-3" role="alert">
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;
    $('#alert-container').html(alertHtml);

    // Auto-dismiss after 'duration' ms (default: 4 seconds)
    setTimeout(() => {
        $(`#${alertId}`).fadeOut(300, function () {
            $(this).remove();
        });
    }, duration);
}


function showBootstrapAlert(message, type = 'success', timeout = 3000) {
    const alertPlaceholder = document.getElementById('alert-placeholder');
    if (!alertPlaceholder) return;

    // Create alert div
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
    `;

    // Clear any existing alerts
    alertPlaceholder.innerHTML = '';
    alertPlaceholder.appendChild(alertDiv);

    // Auto-dismiss after timeout (optional)
    setTimeout(() => {
        $(alertDiv).alert('close');
    }, timeout);
}


$(document).ready(() => {
    const news = new NewsMessages('news-card-container', 'pagination-controls');
    news.loadMessages();


    console.log('[NewMessage] Script loaded.');

    const form = document.getElementById('new-message-form');
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        console.log('[NewMessage] Edit mode. Fetching data...');
        $.getJSON(`/api/instant-messages/get?id=${encodeURIComponent(id)}`)
            .done((msg) => {
                $('#messageId').val(msg.id);
                $('#title').val(msg.title);
                $('#text').val(msg.text);
                $('#link').val(msg.link);
                $('#messageType').val(msg.messageType);
                $('#publicationDate').val(msg.publicationDate);  // formatted as yyyy-mm-dd
            })
            .fail((jqXHR) => {
                console.error('[NewMessage] Failed to fetch message:', jqXHR.responseText);
                alert('Failed to load message for editing.');
            });
    }

    if (form) {
        const isEdit = !!id;  // Determine if we're editing
        const endpoint = isEdit
            ? '/api/instant-messages/update'
            : '/api/instant-messages/add';

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            console.log('[NewMessage] Form submit intercepted.');

            const payload = {
                id: isEdit ? id : undefined,
                title: form.title.value.trim(),
                text: form.text.value.trim(),
                link: form.link.value.trim(),
                messageType: form.messageType.value,
                publicationDate: form.publicationDate.value.trim()
            };

            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        showBootstrapAlert('Error: ' + data.error, 'danger', 5000);
                    } else {
                        showBootstrapAlert(isEdit ? 'Message updated successfully!' : 'Message added successfully!', 'success', 3000);
                        setTimeout(() => {
                            window.location.href = '/newsList.html';
                        }, 1000);
                    }
                })
                .catch(err => {
                    console.error('[NewMessage] Submit error:', err);
                    showBootstrapAlert('Submission failed.', 'danger', 5000);
                });
        });
    }
});
