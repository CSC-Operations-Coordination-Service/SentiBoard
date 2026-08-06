"""Base document classes used by generated MAAS models."""

from __future__ import annotations

from typing import Any

from opensearchpy import Document, Field, Keyword

from maas_model.zulu_date import ZuluDate


class MAASDocument(Document):
    """Minimal base document with partition-aware index naming."""

    _PARTITION_FIELD: str | list[str] = ""
    _PARTITION_FIELD_FORMAT: str = "%Y"

    class Index:
        """Default index metadata for generated documents."""

        name = ""

    @property
    def partition_field_value(self) -> Any:
        """Return the configured partition field value or values."""

        if not self._PARTITION_FIELD:
            return None

        if isinstance(self._PARTITION_FIELD, str):
            return getattr(self, self._PARTITION_FIELD, None)

        if isinstance(self._PARTITION_FIELD, list):
            return {
                field_name: getattr(self, field_name, None)
                for field_name in self._PARTITION_FIELD
            }

        raise TypeError(f"Unsupported partition field type: {type(self._PARTITION_FIELD)!r}")

    @property
    def has_partition_field_value(self) -> bool:
        """Tell whether all configured partition values are present."""

        if not self._PARTITION_FIELD:
            return True

        if isinstance(self._PARTITION_FIELD, str):
            return getattr(self, self._PARTITION_FIELD, None) is not None

        if isinstance(self._PARTITION_FIELD, list):
            return all(getattr(self, field_name, None) is not None for field_name in self._PARTITION_FIELD)

        raise TypeError(f"Unsupported partition field type: {type(self._PARTITION_FIELD)!r}")

    @property
    def partition_index_name(self) -> str:
        """Build the target index name from the configured partition metadata."""

        index_name = self.Index.name
        if not self._PARTITION_FIELD:
            return index_name

        partition_values = self.partition_field_value
        template_string = self._PARTITION_FIELD_FORMAT

        if not isinstance(partition_values, dict):
            template_string = f"{{{self._PARTITION_FIELD}:{self._PARTITION_FIELD_FORMAT}}}"
            partition_values = {self._PARTITION_FIELD: partition_values}

        normalized_values = {
            key: value.lower() if isinstance(value, str) else value
            for key, value in partition_values.items()
        }
        return f"{index_name}-{template_string.format(**normalized_values)}"


class MAASRawDocument(MAASDocument):
    """Base class for raw ingested documents."""

    _PARTITION_FIELD = "ingestionTime"

    reportName: Field = Keyword()
    reportFolder: Field = Keyword()
    ingestionTime: Field = ZuluDate()