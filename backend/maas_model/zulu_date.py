"""Date field used by generated MAAS documents."""

from opensearchpy import Date


class ZuluDate(Date):
    """Thin wrapper around the OpenSearch date field."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("format", "strict_date_optional_time||epoch_millis")
        super().__init__(*args, **kwargs)