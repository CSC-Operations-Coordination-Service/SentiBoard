/**
 * Client-side marker extraction and parsing.
 * Implements UI Integration Guide §2: Extract markers from response text.
 */

const MarkerParser = (() => {
  const DATA_ID_PATTERN = /^artifact_[A-Za-z0-9]+$/;
  const COLUMN_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const MARKER_REGEX = /<(tabular|temporal-plot|count-histogram|event-calendar|kpi)([^>]*?)\/\s*>/g;
  const ATTR_REGEX = /(\w+)="([^"]*)"/g;

  function extractMarkers(text) {
    const markers = [];
    const lines = text.split('\n');
    const outputLines = [];

    lines.forEach((line, lineNum) => {
      const match = MARKER_REGEX.exec(line);
      MARKER_REGEX.lastIndex = 0;

      if (match) {
        const tagName = match[1];
        const attrsStr = match[2];
        const rawMarker = match[0];

        try {
          const marker = parseMarker(tagName, attrsStr, rawMarker, lineNum + 1);
          if (marker) {
            markers.push(marker);
            return;
          }
        } catch (e) {
          console.warn(`Malformed marker at line ${lineNum + 1}:`, e.message);
          return;
        }
      }

      outputLines.push(line);
    });

    const cleanText = outputLines.join('\n');
    return { markers, cleanText };
  }

  function parseMarker(tagName, attrsStr, rawMarker, lineNum) {
    const attrs = {};
    let match;

    while ((match = ATTR_REGEX.exec(attrsStr)) !== null) {
      attrs[match[1]] = match[2];
    }

    validateMarker(tagName, attrs);

    return {
      type: tagName,
      raw: rawMarker,
      attributes: attrs,
      lineNumber: lineNum
    };
  }

  function validateMarker(markerType, attrs) {
    switch (markerType) {
      case 'tabular':
        if (!attrs.data_id) throw new Error('tabular: missing data_id');
        validateDataId(attrs.data_id);
        if (attrs.sort_column) validateColumnName(attrs.sort_column);
        if (attrs.sort_order && !['asc', 'desc'].includes(attrs.sort_order)) {
          throw new Error('sort_order must be "asc" or "desc"');
        }
        break;

      case 'temporal-plot':
        if (!attrs.data_id || !attrs.date_column || !attrs.numeric_column) {
          throw new Error('missing required attributes');
        }
        validateDataId(attrs.data_id);
        validateColumnName(attrs.date_column);
        validateColumnName(attrs.numeric_column);
        if (attrs.categorical_column) validateColumnName(attrs.categorical_column);
        break;

      case 'count-histogram':
        if (!attrs.data_id || !attrs.category_column || !attrs.count_column) {
          throw new Error('missing required attributes');
        }
        validateDataId(attrs.data_id);
        validateColumnName(attrs.category_column);
        validateColumnName(attrs.count_column);
        if (attrs.date_column) validateColumnName(attrs.date_column);
        break;

      case 'event-calendar':
        if (!attrs.data_id) throw new Error('event-calendar: missing data_id');
        validateDataId(attrs.data_id);
        break;

      case 'kpi':
        const hasDataId = !!attrs.data_id;
        const hasLabelValue = !!attrs.label && !!attrs.value;
        if (!hasDataId && !hasLabelValue) {
          throw new Error('must have data_id OR (label + value)');
        }
        if (hasDataId) validateDataId(attrs.data_id);
        if (hasLabelValue && attrs.color) {
          const validColors = ['green', 'orange', 'red', 'blue', 'gray'];
          if (!validColors.includes(attrs.color)) {
            throw new Error(`invalid color "${attrs.color}"`);
          }
        }
        break;
    }
  }

  function validateDataId(dataId) {
    if (!DATA_ID_PATTERN.test(dataId)) {
      throw new Error(`Invalid data_id: ${dataId}`);
    }
  }

  function validateColumnName(colName) {
    if (!COLUMN_NAME_PATTERN.test(colName)) {
      throw new Error(`Invalid column name: ${colName}`);
    }
  }

  function getArtifactsToFetch(markers) {
    const artifactIds = new Set();
    markers.forEach(marker => {
      if (['tabular', 'temporal-plot', 'count-histogram', 'event-calendar'].includes(marker.type)) {
        if (marker.attributes.data_id) {
          artifactIds.add(marker.attributes.data_id);
        }
      } else if (marker.type === 'kpi' && marker.attributes.data_id) {
        artifactIds.add(marker.attributes.data_id);
      }
    });
    return Array.from(artifactIds).sort();
  }

  return {
    extractMarkers,
    getArtifactsToFetch,
    MarkerType: {
      TABULAR: 'tabular',
      TEMPORAL_PLOT: 'temporal-plot',
      COUNT_HISTOGRAM: 'count-histogram',
      EVENT_CALENDAR: 'event-calendar',
      KPI: 'kpi'
    }
  };
})();
