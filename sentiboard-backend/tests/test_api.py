"""Smoke tests: the app imports, routes are wired and /health reflects OpenSearch.

No OpenSearch is needed: TestClient is used without `with`, so the lifespan (which creates
indices) does not run, and the health client is patched.
"""

from unittest import mock

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_ok():
    with mock.patch.object(main._health_client, "ping", return_value=True):
        res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_unavailable_when_opensearch_down():
    with mock.patch.object(main._health_client, "ping", return_value=False):
        res = client.get("/health")
    assert res.status_code == 503


def test_resource_routes_are_registered():
    # Through the OpenAPI schema: included routers are nested, not listed in app.routes.
    paths = client.get("/openapi.json").json()["paths"]
    for prefix in ("/anomaly", "/instantmessage", "/news", "/processor"):
        assert any(p.startswith(prefix) for p in paths), prefix
