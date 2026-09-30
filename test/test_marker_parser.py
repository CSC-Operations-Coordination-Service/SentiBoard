"""Unit tests for marker parser (apps/utils/marker_parser.py)."""

import pytest
from apps.utils.marker_parser import (
    MarkerParser,
    MarkerExtractor,
    MarkerType,
    Marker
)


class TestMarkerExtraction:
    """Test marker extraction from response text."""

    def test_extract_single_tabular_marker(self):
        text = """Here is a table:

<tabular data_id="artifact_abc123" title="Test Table" sort_column="date" sort_order="asc" />

End of table."""
        markers, clean = MarkerParser.extract_markers(text)

        assert len(markers) == 1
        assert markers[0].type == MarkerType.TABULAR
        assert markers[0].attributes['data_id'] == 'artifact_abc123'
        assert markers[0].attributes['title'] == 'Test Table'
        assert markers[0].attributes['sort_column'] == 'date'
        assert markers[0].attributes['sort_order'] == 'asc'

        # Marker line should be stripped from clean text
        assert '<tabular' not in clean
        assert 'Here is a table:' in clean
        assert 'End of table.' in clean

    def test_extract_multiple_markers(self):
        text = """First table:

<tabular data_id="artifact_001" />

Some text.

<temporal-plot data_id="artifact_002" date_column="date" numeric_column="value" />

More text."""
        markers, clean = MarkerParser.extract_markers(text)

        assert len(markers) == 2
        assert markers[0].type == MarkerType.TABULAR
        assert markers[1].type == MarkerType.TEMPORAL_PLOT

    def test_extract_malformed_marker_skipped(self):
        """Malformed markers should be logged and skipped (fail closed)."""
        text = """Text before.

<tabular data_id="invalid_format" />

Text after."""
        markers, clean = MarkerParser.extract_markers(text)

        # Malformed marker should be skipped, not added
        assert len(markers) == 0
        # But surrounding prose kept
        assert 'Text before.' in clean
        assert 'Text after.' in clean
        # And the marker line removed
        assert '<tabular' not in clean

    def test_direct_kpi_marker(self):
        text = '<kpi label="Completeness" value="94.2%" color="green" delta="+1.3pp" />'
        markers, _ = MarkerParser.extract_markers(text)

        assert len(markers) == 1
        assert markers[0].type == MarkerType.KPI
        assert markers[0].attributes['label'] == 'Completeness'
        assert markers[0].attributes['value'] == '94.2%'
        assert markers[0].attributes['color'] == 'green'
        assert markers[0].attributes['delta'] == '+1.3pp'


class TestMarkerValidation:
    """Test marker attribute validation."""

    def test_tabular_validation(self):
        """Tabular markers must have data_id."""
        with pytest.raises(ValueError, match='missing data_id'):
            MarkerParser._parse_marker('tabular', '', '<tabular />', 1)

        # Valid tabular
        marker = MarkerParser._parse_marker(
            'tabular',
            'data_id="artifact_001" title="T"',
            '<tabular data_id="artifact_001" title="T" />',
            1
        )
        assert marker is not None
        assert marker.attributes['data_id'] == 'artifact_001'

    def test_temporal_plot_validation(self):
        """Temporal plot requires data_id, date_column, numeric_column."""
        with pytest.raises(ValueError, match='missing required'):
            MarkerParser._parse_marker(
                'temporal-plot',
                'data_id="artifact_001"',  # Missing date/numeric cols
                '',
                1
            )

        # Valid temporal plot
        marker = MarkerParser._parse_marker(
            'temporal-plot',
            'data_id="artifact_001" date_column="date" numeric_column="value"',
            '',
            1
        )
        assert marker is not None

    def test_event_calendar_validation(self):
        """Event calendar requires data_id."""
        with pytest.raises(ValueError, match='missing data_id'):
            MarkerParser._parse_marker('event-calendar', '', '', 1)

    def test_kpi_validation_both_forms(self):
        """KPI requires either data_id OR (label + value)."""
        # Neither form should fail
        with pytest.raises(ValueError, match='must have data_id OR'):
            MarkerParser._parse_marker('kpi', '', '', 1)

        # Data-backed form
        marker1 = MarkerParser._parse_marker(
            'kpi',
            'data_id="artifact_001"',
            '',
            1
        )
        assert marker1 is not None

        # Direct form
        marker2 = MarkerParser._parse_marker(
            'kpi',
            'label="Test" value="100"',
            '',
            1
        )
        assert marker2 is not None

    def test_invalid_data_id_format(self):
        """Data IDs must match artifact_[A-Za-z0-9]+."""
        with pytest.raises(ValueError, match='Invalid data_id'):
            MarkerParser._validate_data_id('invalid_id')

        # Valid
        MarkerParser._validate_data_id('artifact_abc123')

    def test_invalid_column_name(self):
        """Column names must match [A-Za-z][A-Za-z0-9_]{0,63}."""
        with pytest.raises(ValueError, match='Invalid column name'):
            MarkerParser._validate_column_name('123invalid')

        with pytest.raises(ValueError, match='Invalid column name'):
            MarkerParser._validate_column_name('_invalid')

        # Valid
        MarkerParser._validate_column_name('valid_column_123')
        MarkerParser._validate_column_name('a')

    def test_kpi_color_validation(self):
        """Direct KPI colors must be green|orange|red|blue|gray."""
        with pytest.raises(ValueError, match='invalid color'):
            MarkerParser._parse_marker(
                'kpi',
                'label="Test" value="100" color="purple"',
                '',
                1
            )

        # Valid colors
        for color in ['green', 'orange', 'red', 'blue', 'gray']:
            marker = MarkerParser._parse_marker(
                'kpi',
                f'label="Test" value="100" color="{color}"',
                '',
                1
            )
            assert marker.attributes['color'] == color


class TestMarkerExtractor:
    """Test MarkerExtractor (main entry point)."""

    def test_extract_markers_and_latex(self):
        text = """Some completeness:

$$
\\frac{a}{b} = c
$$

And a table:

<tabular data_id="artifact_001" />

Inline math: $x^2$ in the text."""

        extractor = MarkerExtractor(text)

        # Should find 1 marker, 1 LaTeX block
        assert len(extractor.markers) == 1
        assert len(extractor.latex_blocks) == 1

        # Clean prose should not contain marker or LaTeX delimiters
        assert '<tabular' not in extractor.clean_prose
        assert '$$' not in extractor.clean_prose
        assert 'Some completeness:' in extractor.clean_prose
        assert 'Inline math:' in extractor.clean_prose

    def test_get_artifacts_to_fetch(self):
        """Should return unique list of data_ids needing fetch."""
        text = """
<tabular data_id="artifact_001" />
<temporal-plot data_id="artifact_002" date_column="d" numeric_column="v" />
<kpi data_id="artifact_001" />
<kpi label="Direct" value="100" />
"""
        extractor = MarkerExtractor(text)
        artifacts = extractor.get_artifacts_to_fetch()

        # Should be 2 unique artifacts (artifact_001 referenced twice)
        assert len(artifacts) == 2
        assert 'artifact_001' in artifacts
        assert 'artifact_002' in artifacts


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_response(self):
        markers, clean = MarkerParser.extract_markers('')
        assert len(markers) == 0
        assert clean == ''

    def test_marker_with_attributes_containing_spaces(self):
        """Attributes can contain spaces (within quotes)."""
        text = '<tabular data_id="artifact_001" title="My Table With Spaces" />'
        markers, _ = MarkerParser.extract_markers(text)

        assert len(markers) == 1
        assert markers[0].attributes['title'] == 'My Table With Spaces'

    def test_marker_with_special_chars_in_attributes(self):
        """Attributes can contain special characters."""
        text = '<tabular data_id="artifact_001" title="Table: 2024-01-01 (UTC)" />'
        markers, _ = MarkerParser.extract_markers(text)

        assert len(markers) == 1
        assert markers[0].attributes['title'] == 'Table: 2024-01-01 (UTC)'

    def test_multiple_tables_same_paragraph(self):
        """Multiple markers on different lines should both be extracted."""
        text = """<tabular data_id="artifact_001" />
<tabular data_id="artifact_002" />"""
        markers, _ = MarkerParser.extract_markers(text)

        assert len(markers) == 2

    def test_latex_block_extraction(self):
        """LaTeX blocks delimited by $$ on own lines."""
        text = """Text before.

$$
a = b
c = d
$$

Text after."""
        _, latex_blocks, clean = MarkerParser.extract_latex(text)

        # Should extract 1 LaTeX block
        assert len(latex_blocks) == 1
        assert latex_blocks[0].kind == 'block'
        assert 'a = b' in latex_blocks[0].content
        assert 'c = d' in latex_blocks[0].content

        # Clean text should not have $$
        assert '$$' not in clean

    def test_unknown_marker_type(self):
        """Unknown marker types should cause parse error."""
        with pytest.raises(ValueError):
            MarkerParser._parse_marker('unknown-type', '', '', 1)
