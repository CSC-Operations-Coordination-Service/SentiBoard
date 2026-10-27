"""Startup and probes: what happens when OpenSearch is down, and when it is wrong.

OpenSearch is never contacted: setup() and the connection factory are patched.
"""

from unittest import mock

import pytest
from fastapi.testclient import TestClient
from opensearchpy.exceptions import AuthorizationException
from opensearchpy.exceptions import ConnectionError as OpenSearchConnectionError
from opensearchpy.exceptions import SSLError

import main
from setup_indices import SetupError


def down():
    return OpenSearchConnectionError("N/A", "refused", Exception("refused"))


def started(setup_side_effect):
    """A TestClient that runs the lifespan with setup() patched."""
    patches = (
        mock.patch.object(main, "setup", side_effect=setup_side_effect),
        mock.patch.object(main.connections, "create_connection"),
        mock.patch.object(main, "SETUP_RETRY_SECONDS", 3600),
    )
    for p in patches:
        p.start()
    return TestClient(main.app), patches


def stop(patches):
    for p in patches:
        p.stop()


def test_startup_sets_indices_up():
    client, patches = started(None)
    try:
        with client:
            assert main.app.state.indices_ready is True
    finally:
        stop(patches)


def test_startup_survives_unreachable_opensearch():
    client, patches = started(down())
    try:
        with client:
            assert main.app.state.indices_ready is False
            # Liveness never depends on OpenSearch.
            assert client.get("/healthz").status_code == 200
            with mock.patch.object(main._health_client, "ping", return_value=False):
                assert client.get("/readyz").status_code == 503
    finally:
        stop(patches)


@pytest.mark.parametrize(
    "error",
    [
        AuthorizationException(403, "forbidden", {}),
        SSLError("N/A", "certificate verify failed", Exception("tls")),
        SetupError("news: plain index 'news' exists without mappings"),
    ],
    ids=["rejected", "tls", "conflicting-index"],
)
def test_startup_fails_on_anything_but_unreachable(error):
    client, patches = started(error)
    try:
        with pytest.raises(type(error)):
            with client:
                pass
    finally:
        stop(patches)


def test_unreachable_excludes_tls_errors():
    assert main.unreachable(down())
    assert not main.unreachable(SSLError("N/A", "tls", Exception("tls")))
    assert not main.unreachable(ValueError("x"))


def test_healthz_ignores_opensearch():
    client = TestClient(main.app)
    with mock.patch.object(main._health_client, "ping", side_effect=down()):
        assert client.get("/healthz").status_code == 200


def test_readyz_needs_opensearch_and_indices():
    client = TestClient(main.app)
    with mock.patch.object(main._health_client, "ping", return_value=True):
        main.app.state.indices_ready = True
        assert client.get("/readyz").status_code == 200
        main.app.state.indices_ready = False
        res = client.get("/readyz")
        assert res.status_code == 503
        assert "Indices" in res.json()["detail"]
    with mock.patch.object(main._health_client, "ping", return_value=False):
        main.app.state.indices_ready = True
        assert client.get("/readyz").status_code == 503
    main.app.state.indices_ready = False


def test_route_needing_opensearch_answers_503_json():
    @main.app.get("/_needs_opensearch")
    def needs_opensearch():
        raise down()

    res = TestClient(main.app).get("/_needs_opensearch")
    assert res.status_code == 503
    assert res.json() == {"detail": "OpenSearch unreachable"}
