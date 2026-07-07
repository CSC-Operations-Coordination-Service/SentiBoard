"""
Centralized Satellite Registry
===============================
Single source of truth for every satellite-level constant used across SentiBoard.

Usage:
    from apps.utils.satellite_registry import (
        SATELLITES,
        sat_ids,
        norad_id_map,
        ALLOWED_SATELLITES,
        SATELLITE_DISPLAY_NAMES,
        # ... any other derived lookup you need
    )

Adding a new satellite (e.g. S3C):
    1. Add one entry to the SATELLITES dict below.
    2. Everything else is derived automatically.
    3. If the satellite is not yet launched, set norad_id=None and active=False.
"""

from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Primary registry — edit ONLY here when satellites change
# ---------------------------------------------------------------------------
#
# Field reference:
#   mission              mission code ("S1", "S2", "S3", "S5")
#   display_name         full human-readable name
#   norad_id             NORAD catalogue number (None pre-launch)
#   instruments          list of instrument acronyms
#   color_rgba           CZML / CesiumJS marker RGBA
#   chart_color          hex color used by JS charts / legends
#   marker_image         CesiumJS billboard image path
#   ui_color_class       Bootstrap color class for space-segment cards
#   acqplan_div          ESA acquisition-plan page div id (None if no plan)
#   cds_key              lowercase key used to build CDS completeness indices
#   time_threshold_hours datatake gap-detection threshold for the mission
#   swath_width_km       orbit/datatake swath width in km (None if N/A)
#   tle_file             local fallback TLE filename (None if N/A)
#   data_cutoff          ISO date string; data before this is excluded (or None)
#   active               True if currently operational
#   has_acq_plan         True if the satellite has a published acquisition plan

SATELLITES = {
    # ── Sentinel-1 ──────────────────────────────────────────────────────────
    "S1A": {
        "mission": "S1",
        "display_name": "Copernicus Sentinel-1A",
        "norad_id": 39634,
        "instruments": ["SAR", "PDHT", "OCP", "EDDS"],
        "color_rgba": [72, 171, 247, 255],
        "chart_color": "#1d7af3",
        "marker_image": "static/assets/img/sentinel-1.png",
        "ui_color_class": "info",
        "acqplan_div": "sentinel-1a",
        "cds_key": "s1a",
        "time_threshold_hours": 8,
        "swath_width_km": None,
        "tle_file": None,
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": True,
    },
    "S1B": {
        "mission": "S1",
        "display_name": "Copernicus Sentinel-1B",
        "norad_id": 41456,
        "instruments": ["SAR", "PDHT", "OCP", "EDDS"],
        "color_rgba": [72, 171, 247, 255],
        "chart_color": "#3399ff",
        "marker_image": "static/assets/img/sentinel-1.png",
        "ui_color_class": "info",
        "acqplan_div": None,
        "cds_key": "s1b",
        "time_threshold_hours": 8,
        "swath_width_km": None,
        "tle_file": None,
        "data_cutoff": None,
        "active": False,           # decommissioned
        "has_acq_plan": False,
    },
    "S1C": {
        "mission": "S1",
        "display_name": "Copernicus Sentinel-1C",
        "norad_id": 62261,
        "instruments": ["SAR", "PDHT", "OCP", "EDDS"],
        "color_rgba": [72, 171, 247, 255],
        "chart_color": "#41aade",
        "marker_image": "static/assets/img/sentinel-1.png",
        "ui_color_class": "info",
        "acqplan_div": "sentinel-1c",
        "cds_key": "s1c",
        "time_threshold_hours": 8,
        "swath_width_km": None,
        "tle_file": None,
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": True,
    },
    "S1D": {
        "mission": "S1",
        "display_name": "Copernicus Sentinel-1D",
        "norad_id": 66315,
        "instruments": ["SAR", "PDHT", "OCP", "EDDS"],
        "color_rgba": [72, 171, 247, 255],
        "chart_color": "#49c6df",
        "marker_image": "static/assets/img/sentinel-1.png",
        "ui_color_class": "info",
        "acqplan_div": "sentinel-1d",
        "cds_key": "s1d",
        "time_threshold_hours": 8,
        "swath_width_km": None,
        "tle_file": None,
        "data_cutoff": "2026-04-17",  # operational cutoff
        "active": True,
        "has_acq_plan": True,
    },

    # ── Sentinel-2 ──────────────────────────────────────────────────────────
    "S2A": {
        "mission": "S2",
        "display_name": "Copernicus Sentinel-2A",
        "norad_id": 40697,
        "instruments": ["MSI", "MMFU", "OCP", "EDDS", "STR"],
        "color_rgba": [49, 206, 54, 255],
        "chart_color": "#59d05d",
        "marker_image": "static/assets/img/sentinel-2.png",
        "ui_color_class": "success",
        "acqplan_div": "sentinel-2a",
        "cds_key": "s2a",
        "time_threshold_hours": 10,
        "swath_width_km": None,
        "tle_file": None,
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": True,
    },
    "S2B": {
        "mission": "S2",
        "display_name": "Copernicus Sentinel-2B",
        "norad_id": 42063,
        "instruments": ["MSI", "MMFU", "OCP", "EDDS", "STR"],
        "color_rgba": [49, 206, 54, 255],
        "chart_color": "#3fae3e",
        "marker_image": "static/assets/img/sentinel-2.png",
        "ui_color_class": "success",
        "acqplan_div": "sentinel-2b",
        "cds_key": "s2b",
        "time_threshold_hours": 10,
        "swath_width_km": None,
        "tle_file": None,
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": True,
    },
    "S2C": {
        "mission": "S2",
        "display_name": "Copernicus Sentinel-2C",
        "norad_id": 60989,
        "instruments": ["MSI", "MMFU", "OCP", "EDDS", "STR"],
        "color_rgba": [49, 206, 54, 255],
        "chart_color": "#1cae5a",
        "marker_image": "static/assets/img/sentinel-2.png",
        "ui_color_class": "success",
        "acqplan_div": "sentinel-2c",
        "cds_key": "s2c",
        "time_threshold_hours": 10,
        "swath_width_km": None,
        "tle_file": None,
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": True,
    },

    # ── Sentinel-3 ──────────────────────────────────────────────────────────
    "S3A": {
        "mission": "S3",
        "display_name": "Copernicus Sentinel-3A",
        "norad_id": 41335,
        "instruments": ["OLCI", "SLSTR", "SRAL", "MWR", "EDDS"],
        "color_rgba": [255, 173, 70, 255],
        "chart_color": "#f3545d",
        "marker_image": "static/assets/img/sentinel-3.png",
        "ui_color_class": "warning",
        "acqplan_div": None,
        "cds_key": "s3a",
        "time_threshold_hours": 696,
        "swath_width_km": 1270,
        "tle_file": "S3A_20231012.tle",
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": False,
    },
    "S3B": {
        "mission": "S3",
        "display_name": "Copernicus Sentinel-3B",
        "norad_id": 43437,
        "instruments": ["OLCI", "SLSTR", "SRAL", "MWR", "EDDS"],
        "color_rgba": [255, 173, 70, 255],
        "chart_color": "#fdaf4b",
        "marker_image": "static/assets/img/sentinel-3.png",
        "ui_color_class": "warning",
        "acqplan_div": None,
        "cds_key": "s3b",
        "time_threshold_hours": 696,
        "swath_width_km": 1270,
        "tle_file": "S3B_20231017.tle",
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": False,
    },
    # S3C — not yet launched; norad_id / tle_file will be set post-launch.
    # Uncomment and set active=True (plus norad_id) when SentiBoard onboards S3C.
    # "S3C": {
    #     "mission": "S3",
    #     "display_name": "Copernicus Sentinel-3C",
    #     "norad_id": None,
    #     "instruments": ["OLCI", "SLSTR", "SRAL", "MWR", "EDDS"],
    #     "color_rgba": [255, 173, 70, 255],
    #     "chart_color": "#c8df45",
    #     "marker_image": "static/assets/img/sentinel-3.png",
    #     "ui_color_class": "warning",
    #     "acqplan_div": None,
    #     "cds_key": "s3c",
    #     "time_threshold_hours": 696,
    #     "swath_width_km": 1270,
    #     "tle_file": None,
    #     "data_cutoff": None,
    #     "active": False,
    #     "has_acq_plan": False,
    # },

    # ── Sentinel-5P ─────────────────────────────────────────────────────────
    "S5P": {
        "mission": "S5",
        "display_name": "Copernicus Sentinel-5P",
        "norad_id": 42969,
        "instruments": ["TROPOMI", "EDDS"],
        "color_rgba": [104, 97, 206, 255],
        "chart_color": "#8f00ff",
        "marker_image": "static/assets/img/sentinel-5p.png",
        "ui_color_class": "secondary",
        "acqplan_div": None,
        "cds_key": "s5p",
        "time_threshold_hours": 48,
        "swath_width_km": 2600,
        "tle_file": "S5P_20231017.tle",
        "data_cutoff": None,
        "active": True,
        "has_acq_plan": False,
    },
}


# ---------------------------------------------------------------------------
# Derived lookups — everything below is auto-generated from SATELLITES
# ---------------------------------------------------------------------------

# Mission display order used wherever satellites are grouped for the UI.
MISSION_ORDER = ["S1", "S2", "S3", "S5"]


def _active():
    """Return satellite IDs where active=True."""
    return [s for s, v in SATELLITES.items() if v["active"]]


def _all_ids():
    """Return all satellite IDs (active + inactive)."""
    return list(SATELLITES.keys())


def ids_for_mission(mission, active_only=True):
    """Return the satellite IDs belonging to a mission (e.g. "S1")."""
    return [
        s
        for s, v in SATELLITES.items()
        if v["mission"] == mission and (not active_only or v["active"])
    ]


# ── acquisitionassets.py replacements ───────────────────────────────────────

sat_ids = _active()
"""Active satellite IDs used by the orbit loader and general iteration."""

norad_id_map = {
    s: v["norad_id"]
    for s, v in SATELLITES.items()
    if v["norad_id"] is not None       # safe for pre-launch satellites
}
"""NORAD catalogue numbers — excludes satellites without a TLE (e.g. S3C)."""

color_map = {s: v["color_rgba"] for s, v in SATELLITES.items()}
"""CZML / CesiumJS RGBA color per satellite."""

marker_map = {s: v["marker_image"] for s, v in SATELLITES.items()}
"""CesiumJS billboard image path per satellite."""

chart_color_map = {s: v["chart_color"] for s, v in SATELLITES.items()}
"""Hex chart/legend color per satellite (JS get_satellite_colors equivalent)."""


# ── orbit ingestion replacements ────────────────────────────────────────────

local_tle_files = {
    s: v["tle_file"]
    for s, v in SATELLITES.items()
    if v.get("tle_file")
}
"""Local fallback TLE filenames per satellite."""

swaths = {
    s: v["swath_width_km"]
    for s, v in SATELLITES.items()
    if v.get("swath_width_km") is not None
}
"""Orbit/datatake swath widths (km) per satellite."""


# ── datatakes.py replacements ──────────────────────────────────────────────

satellites_mission_map = {s: v["mission"] for s, v in SATELLITES.items()}
"""Map every satellite ID (including inactive) to its mission code."""

mission_time_thresholds = {}
for _s, _v in SATELLITES.items():
    mission_time_thresholds.setdefault(_v["mission"], _v["time_threshold_hours"])
"""Hours threshold per mission used in datatake gap detection."""

CDS_MISSIONS = {}
for _s, _v in SATELLITES.items():
    if _v["active"]:
        CDS_MISSIONS.setdefault(_v["mission"].lower(), []).append(_v["cds_key"])
"""CDS index-building map: {"s1": ["s1a", "s1c", "s1d"], ...}"""


# ── acquisitions_utils.py replacement ──────────────────────────────────────

SATELLITE_INFO = {
    s: (v["display_name"], v["instruments"])
    for s, v in SATELLITES.items()
    if v["active"]
}
"""(display_name, instruments) tuples for the space-segment page."""


# ── routes.py replacements ─────────────────────────────────────────────────

ALLOWED_SATELLITES = set(_active())
"""Set of satellite IDs accepted by the home / data-availability filters."""

SATELLITE_DISPLAY_NAMES = {
    s: v["display_name"]
    for s, v in SATELLITES.items()
    if v["active"]
}
"""Human-readable names for UI labels and anomaly banners."""

space_segment_colors = {
    s: v["ui_color_class"]
    for s, v in SATELLITES.items()
    if v["active"]
}
"""Bootstrap color class per satellite for the space-segment cards."""


# ── data_cutoff (used by SATELLITE_DATA_CUTOFFS in acquisitions_utils) ─────

def _parse_cutoff(value):
    """Parse an ISO ``YYYY-MM-DD`` cutoff string into a tz-aware datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)


SATELLITE_DATA_CUTOFFS = {
    s: _parse_cutoff(v["data_cutoff"])
    for s, v in SATELLITES.items()
    if v["data_cutoff"] is not None
}
"""Operational cutoff datetimes (tz-aware): data before this is excluded."""


# ── config JSON replacements ──────────────────────────────────────────────

def get_mission_satellites(active_only=True):
    """
    Build the mission_satellites dict that used to live in config-*.json.

    Returns e.g. {"S1": ["S1A", "S1B", "S1C", "S1D"], "S2": [...], ...}

    When active_only=True, inactive satellites are excluded — use this for
    acq_plans_mission_satellites and any UI-facing list.
    """
    result = {}
    for s, v in SATELLITES.items():
        if active_only and not v["active"]:
            continue
        result.setdefault(v["mission"], []).append(s)
    return result


def get_acqplan_div_map():
    """
    Build the acqplan_div mapping for the acquisition-plans scraper.

    Returns e.g. {"S1": {"S1A": "sentinel-1a", "S1C": "sentinel-1c", ...}, ...}
    Only includes satellites with a non-None acqplan_div.
    """
    result = {}
    for s, v in SATELLITES.items():
        if v["active"] and v.get("acqplan_div"):
            result.setdefault(v["mission"], {})[s] = v["acqplan_div"]
    return result


# ── JS / Jinja helpers ─────────────────────────────────────────────────────

def get_satellites_by_mission(active_only=True):
    """
    Ordered dict of mission → [sat_ids] for Jinja template loops
    (replaces hardcoded <option> tags in data-availability.html).

    Returns e.g. OrderedDict([("S1", ["S1A","S1C","S1D"]), ("S2", [...]), ...])
    """
    from collections import OrderedDict

    grouped = {}
    for s, v in SATELLITES.items():
        if active_only and not v["active"]:
            continue
        grouped.setdefault(v["mission"], []).append(s)

    return OrderedDict((m, grouped[m]) for m in MISSION_ORDER if m in grouped)


def get_ground_station_label(datatake_id):
    """
    JS getGroundStation() equivalent — returns a mission label from a datatake ID.

    >>> get_ground_station_label("S1A_IW_20240601")
    'Sentinel 1'
    """
    for s, v in SATELLITES.items():
        if s in datatake_id:
            mission_number = v["mission"][1:]       # "1", "2", "3", "5"
            if v["mission"] == "S5":
                return "Sentinel 5P"
            return f"Sentinel {mission_number}"
    return "Sentinel"


def to_js_registry(active_only=False):
    """
    Serialize satellites as a JSON-safe payload for injection into a Jinja
    <script> block (window.SATELLITE_DATA) or an /api/satellites endpoint.

    Includes ALL satellites by default so JS can colour historical (e.g. S1B)
    and pre-launch (e.g. S3C) data; filter on the ``active`` flag in JS when a
    UI list should only show operational satellites.

    Shape:
        {
          "satellites": { "S1A": {mission, displayName, label, colorClass,
                                  chartColor, noradId, active, hasAcqPlan}, ... },
          "byMission":  { "S1": ["S1A","S1C","S1D"], ... },   # active only
          "active":     ["S1A", "S1C", ...],
        }
    """
    satellites = {
        s: {
            "mission": v["mission"],
            "displayName": v["display_name"],
            # short label e.g. "Sentinel-1A" used by acquisition-plans.js
            "label": v["display_name"].replace("Copernicus ", ""),
            "colorClass": v["ui_color_class"],
            "chartColor": v["chart_color"],
            "noradId": v["norad_id"],
            "active": v["active"],
            "hasAcqPlan": v["has_acq_plan"],
        }
        for s, v in SATELLITES.items()
        if v["active"] or not active_only
    }
    return {
        "satellites": satellites,
        "byMission": {m: sats for m, sats in get_satellites_by_mission().items()},
        "active": _active(),
    }
