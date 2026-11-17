"""API tests for the MAAS-CDS read routes: /datatake/, /acquisition-pass/, /orbit/.

No OpenSearch and no network: the ports are replaced through `app.dependency_overrides`.
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import main
from domain.acquisition_pass import pass_from_document
from domain.orbit import parse_tle
from domain.ports import OrbitsUnavailable
from interface import dependencies

S1A = (
    "SENTINEL-1A\n"
    "1 39634U 14016A   26321.17087910  .00000593  00000+0  13269-3 0  9994\n"
    "2 39634  98.1586 326.2825 0001348  88.0012 272.1343 14.60165340672330\n"
)
NOW = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
WINDOW = {"date_from": "2026-11-16T00:00:00Z", "date_to": "2026-11-18T00:00:00Z"}


class FakeDatatakeSource:
    def __init__(self):
        self.calls = []

    def datatake_documents(self, date_from, date_to, missions, satellite):
        self.calls.append(("documents", date_from, date_to, tuple(missions), satellite))
        yield "S1A-2", {
            "satellite_unit": "S1A",
            "observation_time_start": "2026-11-16T10:00:00Z",
            "observation_time_stop": "2026-11-16T10:02:00Z",
            "instrument_mode": "IW",
            "IW_RAW__0S_local_percentage": 100,
            "IW_SLC__1S_local_percentage": 100,
        }
        yield "S1A-1", {
            "satellite_unit": "S1A",
            "observation_time_start": "2026-11-16T08:00:00Z",
            "observation_time_stop": "2026-11-16T08:02:00Z",
            "IW_RAW__0S_local_percentage": 0,
        }

    def product_documents(self, date_from, date_to, missions, satellite):
        self.calls.append(("products", date_from, date_to, tuple(missions), satellite))
        for level, pct in (("L0_", 100), ("L1_", 50)):
            yield {
                "datatake_id": "S3A_X", "product_type": f"S3A_OL_{level[1]}_EFR___",
                "product_level": level, "percentage": pct,
                "observation_time_start": "2026-11-16T09:00:00Z",
                "observation_time_stop": "2026-11-16T09:40:00Z",
            }


class FakePassRepository:
    def __init__(self):
        self.calls = []

    def list_passes(self, date_from, date_to, satellite, ground_station, offset, limit):
        self.calls.append((date_from, date_to, satellite, ground_station, offset, limit))
        return [pass_from_document("p1", {
            "satellite_id": "S1A", "ground_station": "SGS", "downlink_orbit": 61234,
            "downlink_start": "2026-11-16T10:30:00Z", "downlink_stop": "2026-11-16T10:40:00Z",
            "downlink_status": True, "fer_data": 0.0, "cams_tickets": "T1",
        })]


class FakeOrbits:
    def __init__(self, fail=False):
        self.fail = fail

    def orbits(self):
        if self.fail:
            raise OrbitsUnavailable("down")
        return parse_tle(S1A)


@pytest.fixture
def client():
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def override(dependency, value):
    main.app.dependency_overrides[dependency] = lambda: value


def test_routes_are_in_the_contract(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert {"/datatake/", "/acquisition-pass/", "/orbit/"} <= set(paths)


def test_list_datatakes(client):
    fake = FakeDatatakeSource()
    override(dependencies.datatake_source, fake)
    override(dependencies.utc_now, NOW)

    res = client.get("/datatake/", params=WINDOW)

    assert res.status_code == 200
    body = res.json()
    assert [d["id"] for d in body] == ["S1A-1", "S3A_X", "S1A-2"]  # by observation start
    s1 = body[2]
    assert s1["mission"] == "S1"
    assert s1["observation_time_start"] == "2026-11-16T10:00:00Z"
    assert s1["completeness"] == {"L0": 100.0, "L1": 100.0, "L2": None}
    assert s1["completeness_status"] == {
        "acquisition": {"status": "ACQUIRED", "percentage": 100.0},
        "publication": {"status": "PUBLISHED", "percentage": 100.0},
    }
    assert {p["product_type"]: p["product_level"] for p in s1["products"]} == {
        "IW_RAW__0S": "L0", "IW_SLC__1S": "L1"
    }
    assert body[0]["completeness_status"]["publication"]["status"] == "UNAVAILABLE"
    s3 = body[1]
    assert s3["completeness"] == {"L0": 100.0, "L1": 50.0, "L2": None}
    # S3 threshold is 696 h: still processing a day later.
    assert s3["completeness_status"]["publication"]["status"] == "PROCESSING"

    kinds = [c[0] for c in fake.calls]
    assert kinds == ["documents", "products"]
    assert fake.calls[0][1] == datetime(2026, 11, 16, tzinfo=timezone.utc)
    assert fake.calls[0][3] == ("S1", "S2")
    assert fake.calls[1][3] == ("S3", "S5")


def test_list_datatakes_mission_satellite_and_paging(client):
    fake = FakeDatatakeSource()
    override(dependencies.datatake_source, fake)
    override(dependencies.utc_now, NOW)

    res = client.get(
        "/datatake/",
        params={**WINDOW, "mission": ["S1"], "satellite": "S1A", "offset": 1, "limit": 1},
    )

    assert res.status_code == 200
    assert [d["id"] for d in res.json()] == ["S1A-2"]
    assert fake.calls == [("documents", fake.calls[0][1], fake.calls[0][2], ("S1",), "S1A")]


def test_naive_dates_are_utc(client):
    fake = FakeDatatakeSource()
    override(dependencies.datatake_source, fake)
    override(dependencies.utc_now, NOW)
    client.get("/datatake/", params={"date_from": "2026-11-16T00:00:00",
                                     "date_to": "2026-11-17T00:00:00", "mission": "S3"})
    assert fake.calls[0][1] == datetime(2026, 11, 16, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "params",
    [
        {"date_from": "2026-11-17T00:00:00Z", "date_to": "2026-11-16T00:00:00Z"},
        {"date_from": "2026-11-16T00:00:00Z", "date_to": "2026-11-16T00:00:00Z"},
        {"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-03-01T00:00:00Z"},
        {"date_from": "2026-11-16T00:00:00Z"},
        {**WINDOW, "mission": "S4"},
        {**WINDOW, "limit": 1001},
    ],
)
def test_list_datatakes_rejects_bad_queries(client, params):
    override(dependencies.datatake_source, FakeDatatakeSource())
    assert client.get("/datatake/", params=params).status_code == 422


def test_list_acquisition_passes(client):
    fake = FakePassRepository()
    override(dependencies.acquisition_pass_repository, fake)

    res = client.get("/acquisition-pass/",
                     params={**WINDOW, "satellite": "S1A", "ground_station": "SGS", "limit": 5})

    assert res.status_code == 200
    (item,) = res.json()
    assert item["id"] == "p1"
    assert item["ground_station"] == "SGS"
    assert item["downlink_orbit"] == "61234"
    assert item["downlink_start"] == "2026-11-16T10:30:00Z"
    assert item["downlink_status"] is True
    assert item["cams_tickets"] == ["T1"]
    assert fake.calls[0][2:] == ("S1A", "SGS", 0, 5)


def test_list_acquisition_passes_rejects_a_wide_window(client):
    override(dependencies.acquisition_pass_repository, FakePassRepository())
    res = client.get("/acquisition-pass/",
                     params={"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-06-01T00:00:00Z"})
    assert res.status_code == 422


def test_list_orbits(client):
    override(dependencies.orbit_source, FakeOrbits())
    res = client.get("/orbit/")
    assert res.status_code == 200
    (orbit,) = res.json()
    assert orbit["satellite_unit"] == "S1A"
    assert orbit["norad_id"] == "39634"
    assert orbit["line1"].startswith("1 39634U")
    assert orbit["epoch"].startswith("2026-11-17T")


def test_list_orbits_unavailable(client):
    override(dependencies.orbit_source, FakeOrbits(fail=True))
    res = client.get("/orbit/")
    assert res.status_code == 503
    assert res.json() == {"detail": "Orbit data unavailable"}
