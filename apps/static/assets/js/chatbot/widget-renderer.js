/**
 * Widget renderer for chatbot artifacts.
 * Returns {html, mount} objects to avoid inline scripts.
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
      const displayCol = col.replace(/_/g, ' ');
      html += `<th>${escapeHtml(displayCol)}${indicator}</th>`;
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
    return { html, mount: null };
  }

  function renderTemporalPlot(artifact, markerAttrs) {
    const { temporal_rows: rows, aggregation, title } = artifact;
    const aggMeta = aggregation?.temporal_plot || {};
    const dateCol = aggMeta.date_column;
    const numCol = aggMeta.numeric_column;
    const catCol = aggMeta.categorical_column;

    if (!rows || !dateCol || !numCol) {
      return {
        html: '<div class="alert alert-warning alert-sm">Invalid temporal plot data</div>',
        mount: null
      };
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

    const html = `<div class="widget-plot" id="${containerId}"></div>`;
    const mount = (el) => {
      if (window.Plotly) {
        const plotEl = el.querySelector(`#${containerId}`);
        if (plotEl) {
          Plotly.newPlot(plotEl, traces, layout, { responsive: true });
          window.addEventListener('resize', () => {
            Plotly.Plots.resize(plotEl);
          });
        }
      }
    };

    return { html, mount };
  }

  function renderCountHistogram(artifact, markerAttrs) {
    const { temporal_rows: rows, aggregation, title } = artifact;
    const aggMeta = aggregation?.count_histogram || {};
    const dateCol = aggMeta.date_column;
    const catCol = aggMeta.category_column;
    const countCol = aggMeta.count_column;

    if (!rows || !catCol || !countCol) {
      return {
        html: '<div class="alert alert-warning alert-sm">Invalid histogram data</div>',
        mount: null
      };
    }

    const containerId = `hist-${Math.random().toString(36).substr(2, 9)}`;
    let traces = [];

    const grouped = {};
    rows.forEach(row => {
      const category = row[catCol];
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(row);
    });

    Object.entries(grouped).forEach(([category, categoryRows]) => {
      traces.push({
        x: dateCol ? categoryRows.map(r => r[dateCol]) : categoryRows.map((_, i) => i),
        y: categoryRows.map(r => r[countCol]),
        name: category,
        type: 'bar'
      });
    });

    const layout = {
      title: title || 'Count Histogram',
      xaxis: { title: dateCol || 'Category' },
      yaxis: { title: countCol },
      barmode: 'group',
      responsive: true,
      margin: { l: 60, r: 40, t: 40, b: 40 },
      paper_bgcolor: '#f8f9fa',
      plot_bgcolor: '#ffffff',
      height: 300
    };

    const html = `<div class="widget-histogram" id="${containerId}"></div>`;
    const mount = (el) => {
      if (window.Plotly) {
        const histEl = el.querySelector(`#${containerId}`);
        if (histEl) {
          Plotly.newPlot(histEl, traces, layout, { responsive: true });
          window.addEventListener('resize', () => {
            Plotly.Plots.resize(histEl);
          });
        }
      }
    };

    return { html, mount };
  }

  function renderEventCalendar(artifact, markerAttrs) {
    if (!artifact || !artifact.events) {
      return {
        html: '<div class="alert alert-info alert-sm">No events</div>',
        mount: null
      };
    }

    let html = '<div class="widget-calendar">';
    if (artifact.title) html += `<h6 class="widget-title">${escapeHtml(artifact.title)}</h6>`;
    if (artifact.description) html += `<p class="widget-description">${escapeHtml(artifact.description)}</p>`;

    // Use the EventCalendarRenderer for full schema support
    html += EventCalendarRenderer.render(artifact);
    html += '</div>';

    return { html, mount: null };
  }

  function renderDirectKPI(attrs) {
    const { label, value, color, delta } = attrs;
    const bgColor = color === 'green' ? '#d4edda' :
                    color === 'orange' ? '#fff3cd' :
                    color === 'red' ? '#f8d7da' :
                    color === 'blue' ? '#d1ecf1' :
                    '#e2e3e5';
    const textColor = color === 'green' ? '#155724' :
                      color === 'orange' ? '#856404' :
                      color === 'red' ? '#721c24' :
                      color === 'blue' ? '#0c5460' :
                      '#383d41';

    let html = `<div class="kpi-card" style="background-color:${bgColor};color:${textColor};">`;
    html += `<div class="kpi-label">${escapeHtml(label)}</div>`;
    html += `<div class="kpi-value">${escapeHtml(value)}</div>`;
    if (delta) {
      html += `<div class="kpi-delta">${escapeHtml(delta)}</div>`;
    }
    html += '</div>';

    return { html, mount: null };
  }

  function renderLaTeX(content, kind) {
    const isBlock = kind === 'block';
    if (isBlock) {
      return `<div class="latex-block" data-latex="${escapeHtml(content)}"></div>`;
    } else {
      return `<span class="latex-inline" data-latex="${escapeHtml(content)}"></span>`;
    }
  }

  function formatCellValue(value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return value.toString();
      return value.toFixed(2);
    }
    return escapeHtml(String(value));
  }

  function escapeHtml(str) {
    if (!str) return '';
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
