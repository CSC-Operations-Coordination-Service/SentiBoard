"""Datatake completeness and status rules (domain/datatake.py), no I/O.

Expected values pin the legacy results of `apps/elastic/modules/datatakes.py`
(branch support/sentiboard-2026-10-09): they were cross-checked by running the legacy functions on
the same inputs.
"""

from datetime import datetime, timedelta, timezone

import pytest

from domain import datatake as dt

UTC = timezone.utc
STOP = datetime(2026, 11, 16, 10, 0, tzinfo=UTC)


def at(hours_after_stop: float) -> datetime:
    return STOP + timedelta(hours=hours_after_stop)


# ── helpers ─────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "unit, mission",
    [("S1A", "S1"), ("S2C", "S2"), ("S3B", "S3"), ("S5P", "S5"), ("X1A", None), ("", None),
     (None, None), ("S", None)],
)
def test_mission_of(unit, mission):
    assert dt.mission_of(unit) == mission


@pytest.mark.parametrize(
    "value, expected",
    [
        ("2026-11-16T10:00:00.000Z", STOP),
        ("2026-11-16T10:00:00Z", STOP),
        ("2026-11-16T10:00:00", STOP),
        ("2026-11-16T11:00:00+01:00", STOP),
        (1794823200000, STOP),
        (None, None),
        ("", None),
        ("not a date", None),
    ],
)
def test_parse_time(value, expected):
    assert dt.parse_time(value) == expected


# ── product levels ──────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "product_type, level",
    [
        ("IW_RAW__0S", "L0"), ("EW_RAW__0C", "L0"), ("IW_RAW__0A", "L0"), ("IW_RAW__0N", "L0"),
        ("IW_SLC__1S", "L1"), ("IW_GRDH_1S", "L1"), ("IW_GRDH_1A", "L1"),
        ("IW_OCN__2S", "L2"), ("WV_OCN__2A", "L2"),
        ("AUX_SOMETHING", None),
    ],
)
def test_s1_product_level(product_type, level):
    assert dt.s1_product_level(product_type) == level


@pytest.mark.parametrize(
    "product_type, level",
    [
        ("MSI_L0__DS", "L0"), ("MSI_L0__GR", "L0"),
        ("MSI_L1A_DS", "L1"), ("MSI_L1B_GR", "L1"), ("MSI_L1C_TL", "L1"),
        ("MSI_L2A_TL", "L2"),
        ("AUX_FOO", None),
    ],
)
def test_s2_product_level(product_type, level):
    assert dt.s2_product_level(product_type) == level


def test_s2_aggregates_are_recognised():
    assert dt.is_s2_aggregate("L0_")
    assert dt.is_s2_aggregate("L1C_")
    assert not dt.is_s2_aggregate("MSI_L1C_TL")


@pytest.mark.parametrize(
    "mission, product_level, level",
    [
        ("S3", "L0_", "L0"), ("S3", "L1_", "L1"), ("S3", "L2_", "L2"),
        ("S5", "L0_", "L0"), ("S5", "L1B", "L1"), ("S5", "L2_", "L2"),
        ("S5", "L1_", None),  # S5 L1 is L1B only
        ("S3", None, None), ("S1", "L0_", None),
    ],
)
def test_splitted_product_level(mission, product_level, level):
    assert dt.splitted_product_level(mission, product_level) == level


# ── completeness ────────────────────────────────────────────────────────────────────────────


def test_level_completeness_means_per_level_and_skips_unknown():
    products = [
        dt.Product("a", "L0", 100.0),
        dt.Product("b", "L0", 50.0),
        dt.Product("c", "L1", 80.0),
        dt.Product("d", None, 0.0),  # no level: not counted
        dt.Product("e", "L2", None),  # no percentage: not counted
    ]
    assert dt.level_completeness(products) == {"L0": 75.0, "L1": 80.0}


# ── status ──────────────────────────────────────────────────────────────────────────────────


def status(completeness, hours_after_stop, mission="S1"):
    result = dt.completeness_status(completeness, mission, STOP, at(hours_after_stop))
    return (result.acquisition.status, round(result.acquisition.percentage, 4),
            result.publication.status, round(result.publication.percentage, 4))


def test_status_planned_until_sensing_stops():
    assert status({"L0": 100.0}, 0) == ("PLANNED", 0, "PLANNED", 0)
    assert status({"L0": 100.0}, -1) == ("PLANNED", 0, "PLANNED", 0)


def test_status_within_processing_window():
    # S1: 8 h. ACQ = L0, PUB = mean of levels; > 90 completes.
    assert status({"L0": 100.0, "L1": 80.0}, 1) == ("ACQUIRED", 100.0, "PROCESSING", 90.0)
    assert status({"L0": 100.0, "L1": 100.0}, 7.9) == ("ACQUIRED", 100.0, "PUBLISHED", 100.0)
    assert status({"L0": 50.0}, 1) == ("PROCESSING", 50.0, "PROCESSING", 50.0)


def test_status_acq_is_raised_to_pub():
    # L0 lower than the mean: ACQ takes the PUB value.
    assert status({"L0": 60.0, "L1": 100.0, "L2": 100.0}, 1) == (
        "PROCESSING", 86.6667, "PROCESSING", 86.6667
    )


def test_status_acq_falls_back_to_first_level_present():
    # S5P sometimes has no L0.
    assert status({"L1": 95.0, "L2": 85.0}, 100, mission="S5") == (
        "ACQUIRED", 95.0, "PUBLISHED", 90.0
    )


def test_status_delayed_window():
    # S1: between 8 h and 9.6 h, PUB below 90 -> DELAYED.
    assert status({"L0": 95.0, "L1": 50.0}, 9) == ("ACQUIRED", 95.0, "DELAYED", 72.5)
    assert status({"L0": 50.0}, 9) == ("DELAYED", 50.0, "DELAYED", 50.0)
    # PUB at 90 exactly is not "below": falls through to the final rules.
    assert status({"L0": 90.0}, 9) == ("ACQUIRED", 90.0, "PUBLISHED", 90.0)


def test_status_final():
    assert status({"L0": 100.0, "L1": 100.0}, 24) == ("ACQUIRED", 100.0, "PUBLISHED", 100.0)
    assert status({"L0": 90.0, "L1": 50.0}, 24) == ("ACQUIRED", 90.0, "PARTIAL", 70.0)
    assert status({"L0": 10.0}, 24) == ("PARTIAL", 10.0, "PARTIAL", 10.0)
    assert status({"L0": 9.99}, 24) == ("UNAVAILABLE", 9.99, "UNAVAILABLE", 9.99)
    assert status({}, 24) == ("UNAVAILABLE", 0, "UNAVAILABLE", 0)


@pytest.mark.parametrize("mission, hours", [("S2", 10), ("S3", 696), ("S5", 48)])
def test_status_threshold_per_mission(mission, hours):
    assert status({"L0": 50.0}, hours - 0.1, mission)[2] == "PROCESSING"
    assert status({"L0": 50.0}, hours + 0.1, mission)[2] == "DELAYED"
    assert status({"L0": 50.0}, hours * 1.2 + 0.1, mission)[2] == "PARTIAL"


def test_status_unknown_without_mission_or_stop():
    assert dt.completeness_status({"L0": 100.0}, None, STOP, at(1)) is None
    assert dt.completeness_status({"L0": 100.0}, "S1", None, at(1)) is None


# ── S1/S2 documents ─────────────────────────────────────────────────────────────────────────


def test_s1_datatake_from_completeness_document():
    source = {
        "datatake_id": "414433",
        "satellite_unit": "S1A",
        "observation_time_start": "2026-11-16T09:58:00.000Z",
        "observation_time_stop": "2026-11-16T10:00:00.000Z",
        "instrument_mode": "IW",
        "polarization": "DV",
        "absolute_orbit": "61234",
        "IW_RAW__0S_local_percentage": 100,
        "IW_SLC__1S_local_percentage": 100,
        "IW_GRDH_1S_local_percentage": 80,
        "IW_OCN__2S_local_percentage": 50,
        "cams_tickets": ["GSANOM-1"],
    }
    d = dt.datatake_from_completeness_document("S1A-414433", source, at(24))
    assert d.id == "S1A-414433"
    assert d.datatake_id == "414433"
    assert d.mission == "S1"
    assert d.observation_time_stop == STOP
    assert [p.product_type for p in d.products] == [
        "IW_GRDH_1S", "IW_OCN__2S", "IW_RAW__0S", "IW_SLC__1S"
    ]
    assert d.completeness == {"L0": 100.0, "L1": 90.0, "L2": 50.0}
    assert d.completeness_status.acquisition == dt.StatusValue("ACQUIRED", 100.0)
    assert d.completeness_status.publication == dt.StatusValue("PARTIAL", 80.0)
    assert d.cams_tickets == ("GSANOM-1",)


def test_s2_document_skips_aggregates_and_reads_mission_from_id():
    source = {
        "observation_time_start": "2026-11-16T09:50:00Z",
        "observation_time_stop": "2026-11-16T10:00:00Z",
        "MSI_L0__DS_local_percentage": 100,
        "MSI_L1C_TL_local_percentage": 90,
        "MSI_L2A_TL_local_percentage": 70,
        "L1C__local_percentage": 1,  # aggregate: not a product
    }
    d = dt.datatake_from_completeness_document("S2B-123", source, at(24))
    assert d.mission == "S2"
    assert {p.product_type for p in d.products} == {"MSI_L0__DS", "MSI_L1C_TL", "MSI_L2A_TL"}
    assert d.completeness == {"L0": 100.0, "L1": 90.0, "L2": 70.0}
    assert d.completeness_status.publication.status == "PARTIAL"


# ── S3/S5 product documents ─────────────────────────────────────────────────────────────────


def product(dt_id, ptype, level, pct, start, stop, **extra):
    return {
        "datatake_id": dt_id, "product_type": ptype, "product_level": level,
        "percentage": pct, "observation_time_start": start, "observation_time_stop": stop,
        **extra,
    }


def test_group_by_datatake_keeps_order_and_drops_orphans():
    a1, b1, a2 = {"datatake_id": "A"}, {"datatake_id": "B"}, {"datatake_id": "A"}
    groups = dt.group_by_datatake([a1, b1, {"x": 1}, a2])
    assert groups == {"A": [a1, a2], "B": [b1]}


def test_observation_window_widens_skips_and_caps():
    products = [
        product("d", "S3A_OL_0_EFR___", "L0_", 100, "2026-11-16T09:00:00Z", "2026-11-16T09:10:00Z"),
        product("d", "S3A_OL_1_EFR___", "L1_", 100, "2026-11-16T08:55:00Z", "2026-11-16T09:20:00Z"),
        # skipped type (NAV): does not widen
        product("d", "S3A_AX_NAV_AX_", "L0_", 100, "2026-11-16T07:00:00Z", "2026-11-16T12:00:00Z"),
    ]
    start, stop = dt.observation_window(products)
    assert start == datetime(2026, 11, 16, 8, 55, tzinfo=UTC)
    assert stop == datetime(2026, 11, 16, 9, 20, tzinfo=UTC)

    products.append(
        product("d", "S3A_SL_1_RBT___", "L1_", 100, "2026-11-16T09:00:00Z", "2026-11-16T11:00:00Z")
    )
    start, stop = dt.observation_window(products)
    assert stop - start == timedelta(minutes=97)


def test_s3_datatake_from_products():
    products = [
        product("S3A_20261116T085500_0123", "OL_0_EFR___", "L0_", 100,
                "2026-11-16T09:00:00Z", "2026-11-16T10:00:00Z", absolute_orbit="50000"),
        product("S3A_20261116T085500_0123", "OL_1_EFR___", "L1_", 80,
                "2026-11-16T09:00:00Z", "2026-11-16T10:00:00Z", cams_tickets=["T1"]),
        product("S3A_20261116T085500_0123", "OL_2_LFR___", "L2_", None,
                "2026-11-16T09:00:00Z", "2026-11-16T10:00:00Z", cams_tickets=["T2"]),
    ]
    d = dt.datatake_from_product_documents("S3A_20261116T085500_0123", products, at(800))
    assert d.satellite_unit == "S3A"
    assert d.mission == "S3"
    assert d.instrument_mode == "EFR"  # legacy: product_type[5:8]
    assert d.absolute_orbit == "50000"
    assert d.completeness == {"L0": 100.0, "L1": 80.0}
    assert d.completeness_status.publication == dt.StatusValue("PUBLISHED", 90.0)
    assert d.cams_tickets == ("T2",)  # last product wins


def test_s5_datatake_uses_l1b():
    products = [
        product("S5P_1", "S5P_L1B_RA_BD1", "L1B", 100, "2026-11-16T09:00:00Z", "2026-11-16T10:00:00Z"),
        product("S5P_1", "S5P_L2__NO2___", "L2_", 50, "2026-11-16T09:00:00Z", "2026-11-16T10:00:00Z"),
    ]
    d = dt.datatake_from_product_documents("S5P_1", products, at(1))
    assert d.mission == "S5"
    assert d.completeness == {"L1": 100.0, "L2": 50.0}
    assert d.completeness_status.acquisition.status == "ACQUIRED"


def test_sort_key_puts_unknown_start_first():
    early = dt.datatake_from_completeness_document(
        "S1A-2", {"observation_time_start": "2026-11-16T09:00:00Z"}, at(1))
    unknown = dt.datatake_from_completeness_document("S1A-1", {}, at(1))
    assert sorted([early, unknown], key=dt.sort_key) == [unknown, early]
