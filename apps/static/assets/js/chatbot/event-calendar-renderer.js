/**
 * Event Calendar Renderer
 * Renders event-calendar markers with full schema support
 */

const EventCalendarRenderer = (() => {
  let idCounter = 0; // Module-level counter for unique IDs per instance

  /**
   * Generate unique ID for event element
   */
  function generateEventId() {
    return `event_${++idCounter}`;
  }

  /**
   * Render event calendar from artifact data
   * @param {Object} data - EventCalendarDataResponse from API
   * @returns {string} HTML
   */
  function render(data) {
    if (!data || !data.events) {
      return '<div class="alert alert-warning">No events available</div>';
    }

    // Group events by date
    const grouped = groupEventsByDate(data.events);

    // Create tabbed interface: Calendar vs List view
    const tabsHtml = `
      <div class="event-calendar-tabs">
        <nav class="nav nav-tabs" role="tablist">
          <button class="nav-link active" id="calendar-view-tab" data-bs-toggle="tab"
                  data-bs-target="#calendar-view" role="tab">Calendar</button>
          <button class="nav-link" id="list-view-tab" data-bs-toggle="tab"
                  data-bs-target="#list-view" role="tab">List</button>
        </nav>

        <div class="tab-content">
          <div class="tab-pane fade show active" id="calendar-view">
            ${renderCalendarView(grouped)}
          </div>
          <div class="tab-pane fade" id="list-view">
            ${renderListView(grouped)}
          </div>
        </div>
      </div>
    `;

    return tabsHtml;
  }

  /**
   * Group events by date (with undated events in special group)
   */
  function groupEventsByDate(events) {
    const byDate = {};
    const undated = [];

    events.forEach(event => {
      if (!event.occurred_at) {
        undated.push(event);
      } else {
        const date = event.occurred_at.split('T')[0]; // YYYY-MM-DD
        if (!byDate[date]) {
          byDate[date] = [];
        }
        byDate[date].push(event);
      }
    });

    return { byDate, undated };
  }

  /**
   * Render calendar grid view
   */
  function renderCalendarView(grouped) {
    const { byDate, undated } = grouped;
    const dateArray = Object.keys(byDate).sort().reverse(); // Most recent first

    let html = '<div class="event-calendar-grid">';

    // Render dated events
    dateArray.forEach(date => {
      html += `<div class="event-day-group">`;
      html += `<h6 class="event-day-title">${formatDate(date)}</h6>`;
      html += `<div class="event-list">`;
      byDate[date].forEach(event => {
        html += renderEventCard(event);
      });
      html += `</div></div>`;
    });

    // Render undated events in separate group
    if (undated.length > 0) {
      html += `<div class="event-day-group undated">`;
      html += `<h6 class="event-day-title">No Date</h6>`;
      html += `<div class="event-list">`;
      undated.forEach(event => {
        html += renderEventCard(event);
      });
      html += `</div></div>`;
    }

    html += '</div>';
    return html;
  }

  /**
   * Render list view (grouped by day, chronological)
   */
  function renderListView(grouped) {
    const { byDate, undated } = grouped;
    const dateArray = Object.keys(byDate).sort();

    let html = '<div class="event-list-view">';

    dateArray.forEach(date => {
      html += `<div class="event-list-day">`;
      html += `<h5 class="event-list-day-title">${formatDate(date)} (${byDate[date].length})</h5>`;
      html += `<ul class="event-items">`;
      byDate[date].forEach(event => {
        html += renderEventListItem(event);
      });
      html += `</ul></div>`;
    });

    if (undated.length > 0) {
      html += `<div class="event-list-day undated">`;
      html += `<h5 class="event-list-day-title">No Date (${undated.length})</h5>`;
      html += `<ul class="event-items">`;
      undated.forEach(event => {
        html += renderEventListItem(event);
      });
      html += `</ul></div>`;
    }

    html += '</div>';
    return html;
  }

  /**
   * Render event card (compact format for grid)
   */
  function renderEventCard(event) {
    const criticality = event.criticality || 'Routine';
    const criticalityClass = getCriticalityClass(criticality);
    const id = generateEventId();

    let html = `<div class="event-card ${criticalityClass}">`;

    // Header: ticket key + title + status badge
    html += `<div class="event-header">`;
    html += `<strong>${escapeHtml(event.key)}</strong>`;
    if (event.status) {
      html += ` <span class="badge bg-secondary">${escapeHtml(event.status)}</span>`;
    }
    html += `</div>`;

    // Title
    html += `<div class="event-title">${escapeHtml(event.title)}</div>`;

    // Criticality and affected systems
    html += `<div class="event-meta">`;
    if (criticality !== 'Routine') {
      html += `<span class="badge" style="background-color:${getCriticalityColor(criticality)}">${escapeHtml(criticality)}</span>`;
    }
    if (event.affected_systems && event.affected_systems.length > 0) {
      html += ` <span class="badge bg-info">${event.affected_systems.join(', ')}</span>`;
    }
    html += `</div>`;

    // Description (collapsible if long)
    if (event.description) {
      const isLong = event.description.length > 120;
      if (isLong) {
        html += `<div class="event-description-collapsible">`;
        html += `<button class="btn btn-sm btn-link" data-bs-toggle="collapse"
                        data-bs-target="#${id}-desc" aria-expanded="false">
                  Show details
                </button>`;
        html += `<div class="collapse" id="${id}-desc">`;
        html += `<p class="event-description">${escapeHtml(event.description)}</p>`;
        html += `</div></div>`;
      } else {
        html += `<p class="event-description">${escapeHtml(event.description)}</p>`;
      }
    }

    // Datatakes
    if (event.datatake_ids && event.datatake_ids.length > 0) {
      html += `<div class="event-datatakes">`;
      html += `<small><strong>Affected:</strong> ${event.datatake_ids.join(', ')}</small>`;
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  /**
   * Render event as list item
   */
  function renderEventListItem(event) {
    const criticality = event.criticality || 'Routine';
    const criticalityClass = getCriticalityClass(criticality);

    let html = `<li class="event-item ${criticalityClass}">`;
    html += `<strong>${escapeHtml(event.key)}</strong>: ${escapeHtml(event.title)}`;

    if (event.status) {
      html += ` <span class="badge bg-secondary">${escapeHtml(event.status)}</span>`;
    }

    if (criticality !== 'Routine') {
      html += ` <span class="badge" style="background-color:${getCriticalityColor(criticality)}">${escapeHtml(criticality)}</span>`;
    }

    if (event.affected_systems && event.affected_systems.length > 0) {
      html += `<br><small>Systems: ${event.affected_systems.join(', ')}</small>`;
    }

    if (event.datatake_ids && event.datatake_ids.length > 0) {
      html += `<br><small>Datatakes: ${event.datatake_ids.join(', ')}</small>`;
    }

    html += `</li>`;
    return html;
  }

  /**
   * Get CSS class for criticality level
   */
  function getCriticalityClass(criticality) {
    if (!criticality) return 'criticality-routine';
    const lower = criticality.toLowerCase();
    if (lower === 'blocking') return 'criticality-blocking';
    if (lower === 'critical') return 'criticality-critical';
    return 'criticality-routine';
  }

  /**
   * Get color for criticality level
   */
  function getCriticalityColor(criticality) {
    if (!criticality) return '#6c757d'; // gray
    const lower = criticality.toLowerCase();
    if (lower === 'blocking') return '#dc3545'; // red
    if (lower === 'critical') return '#fd7e14'; // orange
    return '#6c757d'; // gray (routine)
  }

  /**
   * Format date string for display
   */
  function formatDate(dateStr) {
    try {
      const date = new Date(dateStr + 'T00:00:00Z');
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch {
      return dateStr;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  return { render };
})();
