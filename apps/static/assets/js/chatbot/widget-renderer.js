/**
 * Widget renderer for chatbot artifacts.
 * Renders HTML for: tables, temporal plots, histograms, calendars, KPIs, LaTeX.
 */

const WidgetRenderer = (() => {
  function renderTable(artifact, markerAttrs) {
    const { columns, rows, title, description } = artifact;
    const sortCol = markerAttrs.sort_column;
    const sortOrder = markerAttrs.sort_order || 'asc';

    let html = '<div class="widget-table">';
    if (title) html += `<h6 class="widget-title">${escapeHtml(title)}</h6>`;
    if (description) html += `<p class="widget-description">${escapeHtml(description)}</p>`;

    html += '<table class="table table-striped table-hover table-sm">';
    html += '<thead class="table-light"><tr>';
    columns.forEach(col => {
      const isSorted = col === sortCol;
      const indicator = isSorted ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : '';
      html += `<th>${escapeHtml(col)}${indicator}</th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        const value = row[col];
        html += `<td>${formatCellValue(value)}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function renderTemporalPlot(artifact, markerAttrs) {
    const { temporal_rows: rows, aggregation, title } = artifact;
    const aggMeta = aggregation?.temporal_plot || {};
    const dateCol = aggMeta.date_column;
    const numCol = aggMeta.numeric_column;
    const catCol = aggMeta.categorical_column;

    if (!rows || !dateCol || !numCol) {
      return '<div class="alert alert-warning alert-sm">Invalid temporal plot data</div>';
    }

    const containerId = `plot-${Math.random().toString(36).substr(2, 9)}`;
    let traces = [];

    if (catCol) {
      const grouped = {};
      rows.forEach(row => {
        const category = row[catCol];
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(row);
      });
      Object.entries(grouped).forEach(([category, categoryRows]) => {
        traces.push({
          x: categoryRows.map(r => r[dateCol]),
          y: categoryRows.map(r => r[numCol]),
          name: category,
          type: 'scatter',
          mode: 'lines'
        });
      });
    } else {
      traces.push({
        x: rows.map(r => r[dateCol]),
        y: rows.map(r => r[numCol]),
        type: 'scatter',
        mode: 'lines'
      });
    }

    const layout = {
      title: title || 'Temporal Plot',
      xaxis: { title: dateCol },
      yaxis: { title: numCol },
      responsive: true,
      margin: { l: 60, r: 40, t: 40, b: 40 },
      paper_bgcolor: '#f8f9fa',
      plot_bgcolor: '#ffffff',
      height: 300
    };

    let html = `<div class="widget-plot" id="${containerId}"></div>`;
    html += `<script>
      (function() {
        if (window.Plotly) {
          const data = ${JSON.stringify(traces)};
          const layout = ${JSON.stringify(layout)};
          Plotly.newPlot('${containerId}', data, layout, { responsive: true });
        }
      })();
    </script>`;
    return html;
  }

  function renderCountHistogram(artifact, markerAttrs) {
    const { temporal_rows: rows, aggregation, title } = artifact;
    const aggMeta = aggregation?.count_histogram || {};
    const catCol = aggMeta.category_column;
    const countCol = aggMeta.count_column;

    if (!rows || !catCol || !countCol) {
      return '<div class="alert alert-warning alert-sm">Invalid histogram data</div>';
    }

    const containerId = `histogram-${Math.random().toString(36).substr(2, 9)}`;
    const trace = {
      x: rows.map(r => r[catCol]),
      y: rows.map(r => r[countCol]),
      type: 'bar'
    };

    const layout = {
      title: title || 'Count Histogram',
      xaxis: { title: catCol },
      yaxis: { title: countCol },
      responsive: true,
      margin: { l: 60, r: 40, t: 40, b: 60 },
      paper_bgcolor: '#f8f9fa',
      plot_bgcolor: '#ffffff',
      height: 300
    };

    let html = `<div class="widget-histogram" id="${containerId}"></div>`;
    html += `<script>
      (function() {
        if (window.Plotly) {
          const data = [${JSON.stringify(trace)}];
          const layout = ${JSON.stringify(layout)};
          Plotly.newPlot('${containerId}', data, layout, { responsive: true });
        }
      })();
    </script>`;
    return html;
  }

  function renderEventCalendar(artifact, markerAttrs) {
    const { events, title, description } = artifact;

    if (!events || events.length === 0) {
      return '<div class="alert alert-info alert-sm">No events</div>';
    }

    let html = '<div class="widget-calendar">';
    if (title) html += `<h6 class="widget-title">${escapeHtml(title)}</h6>`;
    if (description) html += `<p class="widget-description">${escapeHtml(description)}</p>`;

    const byDate = {};
    events.forEach(event => {
      const date = event.date || 'unknown';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(event);
    });

    html += '<div class="event-list">';
    Object.entries(byDate).forEach(([date, dateEvents]) => {
      html += `<div class="event-group"><strong>${escapeHtml(date)}</strong><ul>`;
      dateEvents.forEach(event => {
        html += '<li>';
        if (event.title) html += `<strong>${escapeHtml(event.title)}</strong>: `;
        if (event.description) html += escapeHtml(event.description);
        html += '</li>';
      });
      html += '</ul></div>';
    });
    html += '</div></div>';
    return html;
  }

  function renderDirectKPI(markerAttrs) {
    const { label, value, color = 'blue', delta } = markerAttrs;
    const colorClass = { 'green': 'success', 'orange': 'warning', 'red': 'danger', 'blue': 'info', 'gray': 'secondary' }[color] || 'secondary';

    let html = `<div class="widget-kpi"><div class="card border-${colorClass} bg-light"><div class="card-body">`;
    html += `<h6 class="card-title text-${colorClass}">${escapeHtml(label)}</h6>`;
    html += `<div class="display-6 text-${colorClass}">${escapeHtml(value)}</div>`;
    if (delta) {
      const deltaClass = delta.startsWith('-') ? 'text-danger' : 'text-success';
      html += `<small class="${deltaClass}">Change: ${escapeHtml(delta)}</small>`;
    }
    html += `</div></div></div>`;
    return html;
  }

  function renderLaTeX(content, kind) {
    const id = `latex-${Math.random().toString(36).substr(2, 9)}`;
    const className = kind === 'block' ? 'latex-block' : 'latex-inline';

    let html = kind === 'block'
      ? `<div class="${className}" id="${id}"></div>`
      : `<span class="${className}" id="${id}"></span>`;

    html += `<script>
      try {
        if (window.katex) {
          katex.render(${JSON.stringify(content)}, document.getElementById('${id}'), {
            throwOnError: false,
            displayMode: ${kind === 'block' ? 'true' : 'false'}
          });
        }
      } catch (e) {
        console.error('KaTeX render error:', e);
      }
    </script>`;

    return html;
  }

  function formatCellValue(value) {
    if (value === null || value === undefined) {
      return '<em class="text-muted">—</em>';
    }
    if (typeof value === 'object') {
      return escapeHtml(JSON.stringify(value));
    }
    return escapeHtml(String(value));
  }

  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  return {
    renderTable,
    renderTemporalPlot,
    renderCountHistogram,
    renderEventCalendar,
    renderDirectKPI,
    renderLaTeX
  };
})();
