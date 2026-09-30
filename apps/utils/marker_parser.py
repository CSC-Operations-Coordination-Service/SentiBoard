"""Parser for inline artifact markers in chatbot responses.

Implements marker extraction, validation, and metadata parsing per
UI Integration Guide §2: Inline artifact markers.

Six marker types across five widget types:
- <tabular>: tables (§2.1)
- <temporal-plot>: time series (§2.2)
- <count-histogram>: bar charts (§2.3)
- <event-calendar>: calendar grids (§2.4)
- <kpi data_id="...">: artifact-backed KPI (§2.5)
- <kpi label="...">: direct/inline KPI (§2.5)
- LaTeX $$...$$ blocks and $...$ inline (§2.6)
"""

import re
import logging
from typing import NamedTuple, List, Dict, Any, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class MarkerType(Enum):
    """Supported marker widget types."""
    TABULAR = "tabular"
    TEMPORAL_PLOT = "temporal-plot"
    COUNT_HISTOGRAM = "count-histogram"
    EVENT_CALENDAR = "event-calendar"
    KPI = "kpi"


class Marker(NamedTuple):
    """Extracted marker with type and attributes."""
    type: MarkerType
    raw: str  # Original marker text (including <.../>)
    attributes: Dict[str, str]  # Parsed attributes
    line_number: int  # For error reporting


class LaTeXBlock(NamedTuple):
    """Extracted LaTeX block ($$..$$) or inline ($...$)."""
    kind: str  # "block" or "inline"
    raw: str  # Full text including delimiters
    content: str  # LaTeX source without delimiters
    line_number: int


# Validation regexes (per §2.7)
DATA_ID_PATTERN = re.compile(r"^artifact_[A-Za-z0-9]+$")
COLUMN_NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")

# Marker extraction regex (self-closing XML-like tags, one per line)
MARKER_PATTERN = re.compile(
    r"<(tabular|temporal-plot|count-histogram|event-calendar|kpi)"
    r"([^>]*?)"
    r"/\s*>",
    re.DOTALL
)

# Attribute extraction (handles quoted strings with spaces/special chars)
ATTR_PATTERN = re.compile(r'(\w+)="([^"]*)"')

# LaTeX block: $$ on own line
LATEX_BLOCK_PATTERN = re.compile(r"^\$\$\s*$", re.MULTILINE)

# LaTeX inline: $...$
LATEX_INLINE_PATTERN = re.compile(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)")


class MarkerParser:
    """Parser for chatbot response markers and LaTeX."""

    @staticmethod
    def extract_markers(text: str) -> Tuple[List[Marker], str]:
        """Extract all markers from response text.

        Returns:
            (markers, text_without_markers) - markers list and prose with markers stripped
        """
        markers = []
        lines = text.split("\n")
        output_lines = []
        line_num = 0

        for line in lines:
            line_num += 1
            match = MARKER_PATTERN.search(line)

            if match:
                tag_name = match.group(1)
                attrs_str = match.group(2)

                try:
                    marker = MarkerParser._parse_marker(
                        tag_name, attrs_str, match.group(0), line_num
                    )
                    if marker:
                        markers.append(marker)
                        # Skip this line (don't add to output)
                        continue
                except Exception as e:
                    logger.warning(f"Malformed marker at line {line_num}: {e}")
                    # Fail closed: skip this marker, keep surrounding prose
                    continue

            output_lines.append(line)

        cleaned_text = "\n".join(output_lines)
        return markers, cleaned_text

    @staticmethod
    def _parse_marker(
        tag_name: str,
        attrs_str: str,
        raw_marker: str,
        line_num: int
    ) -> Optional[Marker]:
        """Parse a single marker tag.

        Args:
            tag_name: Marker type name
            attrs_str: Attribute substring (between tag name and />)
            raw_marker: Full marker text
            line_num: Line number in response (for error reporting)

        Returns:
            Marker if valid, None if malformed

        Raises:
            ValueError: If marker is structurally invalid
        """
        marker_type = MarkerType(tag_name)
        attrs = MarkerParser._parse_attributes(attrs_str)

        # Validate required attributes per marker type
        MarkerParser._validate_marker(marker_type, attrs)

        return Marker(
            type=marker_type,
            raw=raw_marker,
            attributes=attrs,
            line_number=line_num
        )

    @staticmethod
    def _parse_attributes(attrs_str: str) -> Dict[str, str]:
        """Extract key="value" attributes from attribute string."""
        attrs = {}
        for match in ATTR_PATTERN.finditer(attrs_str):
            key, value = match.groups()
            attrs[key] = value
        return attrs

    @staticmethod
    def _validate_marker(marker_type: MarkerType, attrs: Dict[str, str]):
        """Validate marker attributes per UI Integration Guide §2.1-2.5.

        Raises:
            ValueError: If required attributes missing or malformed
        """
        if marker_type == MarkerType.TABULAR:
            if "data_id" not in attrs:
                raise ValueError("tabular: missing required data_id")
            MarkerParser._validate_data_id(attrs["data_id"])
            if "sort_column" in attrs:
                MarkerParser._validate_column_name(attrs["sort_column"])
            if "sort_order" in attrs and attrs["sort_order"] not in ("asc", "desc"):
                raise ValueError("tabular: sort_order must be 'asc' or 'desc'")

        elif marker_type == MarkerType.TEMPORAL_PLOT:
            if "data_id" not in attrs or "date_column" not in attrs or "numeric_column" not in attrs:
                raise ValueError("temporal-plot: missing required data_id, date_column, or numeric_column")
            MarkerParser._validate_data_id(attrs["data_id"])
            MarkerParser._validate_column_name(attrs["date_column"])
            MarkerParser._validate_column_name(attrs["numeric_column"])
            if "categorical_column" in attrs:
                MarkerParser._validate_column_name(attrs["categorical_column"])

        elif marker_type == MarkerType.COUNT_HISTOGRAM:
            if "data_id" not in attrs or "category_column" not in attrs or "count_column" not in attrs:
                raise ValueError("count-histogram: missing required data_id, category_column, or count_column")
            MarkerParser._validate_data_id(attrs["data_id"])
            MarkerParser._validate_column_name(attrs["category_column"])
            MarkerParser._validate_column_name(attrs["count_column"])
            if "date_column" in attrs:
                MarkerParser._validate_column_name(attrs["date_column"])

        elif marker_type == MarkerType.EVENT_CALENDAR:
            if "data_id" not in attrs:
                raise ValueError("event-calendar: missing required data_id")
            MarkerParser._validate_data_id(attrs["data_id"])

        elif marker_type == MarkerType.KPI:
            # Two forms: artifact-backed (data_id) or direct (label + value)
            has_data_id = "data_id" in attrs
            has_label_value = "label" in attrs and "value" in attrs

            if not (has_data_id or has_label_value):
                raise ValueError("kpi: must have data_id OR (label + value)")

            if has_data_id:
                MarkerParser._validate_data_id(attrs["data_id"])

            if has_label_value:
                if "color" in attrs and attrs["color"] not in ("green", "orange", "red", "blue", "gray"):
                    raise ValueError(f"kpi: invalid color '{attrs['color']}'")

    @staticmethod
    def _validate_data_id(data_id: str):
        """Validate data_id format: artifact_[A-Za-z0-9]+"""
        if not DATA_ID_PATTERN.match(data_id):
            raise ValueError(f"Invalid data_id format: {data_id}")

    @staticmethod
    def _validate_column_name(col_name: str):
        """Validate column name format: ^[A-Za-z][A-Za-z0-9_]{0,63}$"""
        if not COLUMN_NAME_PATTERN.match(col_name):
            raise ValueError(f"Invalid column name: {col_name}")

    @staticmethod
    def extract_latex(text: str) -> Tuple[List[LaTeXBlock], str]:
        """Extract LaTeX blocks and inline math from text.

        Block math: $$ on own line
        Inline math: $...$

        Returns:
            (latex_blocks, text_ready_for_rendering)
        """
        latex_blocks = []
        lines = text.split("\n")
        output_lines = []
        i = 0

        while i < len(lines):
            line = lines[i]

            # Check for block math opening
            if LATEX_BLOCK_PATTERN.match(line):
                # Find closing $$
                i += 1
                block_lines = []
                while i < len(lines):
                    if LATEX_BLOCK_PATTERN.match(lines[i]):
                        # Found closing delimiter
                        block_content = "\n".join(block_lines)
                        latex_blocks.append(LaTeXBlock(
                            kind="block",
                            raw=f"$$\n{block_content}\n$$",
                            content=block_content,
                            line_number=len(output_lines)
                        ))
                        i += 1
                        break
                    block_lines.append(lines[i])
                    i += 1
            else:
                output_lines.append(line)
                i += 1

        text_output = "\n".join(output_lines)
        return latex_blocks, text_output


class MarkerExtractor:
    """Main entry point: extract all markers and LaTeX from response."""

    def __init__(self, response_text: str):
        """Parse and extract all markers from a chatbot response.

        Args:
            response_text: Full response string (may contain markers and LaTeX)
        """
        self.raw_response = response_text

        # Extract markers first (they appear on own lines)
        self.markers, text_after_markers = MarkerParser.extract_markers(response_text)

        # Then extract LaTeX
        self.latex_blocks, self.clean_prose = MarkerParser.extract_latex(text_after_markers)

        logger.debug(f"Extracted {len(self.markers)} markers, "
                    f"{len(self.latex_blocks)} LaTeX blocks")

    def get_artifacts_to_fetch(self) -> List[str]:
        """Return list of data_ids that need to be fetched."""
        artifact_ids = set()
        for marker in self.markers:
            if marker.type in (
                MarkerType.TABULAR,
                MarkerType.TEMPORAL_PLOT,
                MarkerType.COUNT_HISTOGRAM,
                MarkerType.EVENT_CALENDAR
            ):
                if "data_id" in marker.attributes:
                    artifact_ids.add(marker.attributes["data_id"])
            elif marker.type == MarkerType.KPI and "data_id" in marker.attributes:
                artifact_ids.add(marker.attributes["data_id"])

        return sorted(list(artifact_ids))
