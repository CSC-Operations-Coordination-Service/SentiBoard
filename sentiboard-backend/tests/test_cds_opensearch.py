"""The OpenSearch reader of the cds-* indices (infrastructure/cds_opensearch.py): which indices
and queries it sends, and how it reads hits back. The client is a mock; nothing is written."""

from datetime import datetime, timedelta, timezone
from unittest import mock

from infrastructure import cds_opensearch
from infrastructure.cds_opensearch import OpenSearchCdsRepository, es_time

FROM = datetime(2026, 11, 16, tzinfo=timezone.utc)
TO = datetime(2026, 11, 18, tzinfo=timezone.utc)


def test_es_time():
    assert es_time(FROM) == "2026-11-16T00:00:00.000Z"
    assert es_time(datetime(2026, 11, 16, 1, 0, tzinfo=timezone(timedelta(hours=1)))) == \
        "2026-11-16T00:00:00.000Z"
    assert es_time(datetime(2026, 11, 16, 0, 0, 0, 123456)) == "2026-11-16T00:00:00.123Z"


def test_datatake_documents_query():
    hits = [{"_id": "S1A-1", "_source": {"satellite_unit": "S1A"}}]
    with mock.patch.object(cds_opensearch.helpers, "scan", return_value=iter(hits)) as scan:
        docs = list(OpenSearchCdsRepository(mock.sentinel.client).datatake_documents(
            FROM, TO, ["S1", "S2"], "S1A"))

    assert docs == [("S1A-1", {"satellite_unit": "S1A"})]
    (client,), kwargs = scan.call_args
    assert client is mock.sentinel.client
    assert kwargs["index"] == "cds-completeness-s1-*-dd-das,cds-completeness-s2-*-dd-das"
    assert kwargs["ignore_unavailable"] is True
    query = kwargs["query"]
    assert query["query"]["bool"]["filter"] == [
        {"range": {"observation_time_start": {"gte": "2026-11-16T00:00:00.000Z",
                                              "lt": "2026-11-18T00:00:00.000Z"}}},
        {"term": {"satellite_unit": "S1A"}},
    ]
    assert "*_local_percentage" in query["_source"]


def test_product_documents_query_without_satellite():
    hits = [{"_id": "x", "_source": {"datatake_id": "S3A_1"}}]
    with mock.patch.object(cds_opensearch.helpers, "scan", return_value=iter(hits)) as scan:
        docs = list(OpenSearchCdsRepository(mock.sentinel.client).product_documents(
            FROM, TO, ["S3", "S5"], None))

    assert docs == [{"datatake_id": "S3A_1"}]
    kwargs = scan.call_args.kwargs
    assert kwargs["index"] == (
        "cds-completeness-splitted-s3-*-dd-das,cds-completeness-splitted-s5-*-dd-das"
    )
    assert len(kwargs["query"]["query"]["bool"]["filter"]) == 1  # range only


def test_list_passes_query_and_mapping():
    client = mock.Mock()
    client.search.return_value = {"hits": {"hits": [
        {"_id": "p1", "_source": {"satellite_id": "S2A", "ground_station": "MTI",
                                  "downlink_start": "2026-11-16T10:00:00.000Z"}},
    ]}}

    passes = OpenSearchCdsRepository(client).list_passes(FROM, TO, "S2A", None, 10, 50)

    assert [(p.id, p.ground_station, p.downlink_start.hour) for p in passes] == [("p1", "MTI", 10)]
    kwargs = client.search.call_args.kwargs
    assert kwargs["index"] == "cds-cadip-acquisition-pass-status*"
    body = kwargs["body"]
    assert body["from"] == 10 and body["size"] == 50
    assert body["sort"][0] == {"downlink_start": "asc"}
    assert body["query"]["bool"]["filter"][1] == {"term": {"satellite_id": "S2A"}}
    assert len(body["query"]["bool"]["filter"]) == 2
