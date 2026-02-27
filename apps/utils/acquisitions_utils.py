from __future__ import annotations

import json
import time
import calendar
from flask import Response, current_app
from collections import defaultdict
from datetime import date, datetime as dt, timezone, timedelta
from flask_login import current_user
from apps import flask_cache
from dateutil.parser import isoparse
from dateutil.relativedelta import relativedelta
import datetime
import apps.cache.modules.interface_monitoring as interface_monitoring_cache


STATIONS = ["svalbard", "inuvik", "matera", "maspalomas", "neustrelitz"]

STATION_MAP = {
    "SGS": "svalbard",  # Svalbard Ground Station
    "MTI": "matera",  # Matera
    "MPS": "maspalomas",  # Maspalomas
    "NSG": "neustrelitz",  # Neustrelitz
    "INS": "inuvik",  # Inuvik
}

SATELLITE_INFO = {
    "S1A": ("Copernicus Sentinel-1A", ["SAR", "PDHT", "OCP", "EDDS"]),
    "S1C": ("Copernicus Sentinel-1C", ["SAR", "PDHT", "OCP", "EDDS"]),
    "S2A": ("Copernicus Sentinel-2A", ["MSI", "MMFU", "OCP", "EDDS", "STR"]),
    "S2B": ("Copernicus Sentinel-2B", ["MSI", "MMFU", "OCP", "EDDS", "STR"]),
    "S2C": ("Copernicus Sentinel-2C", ["MSI", "MMFU", "OCP", "EDDS", "STR"]),
    "S3A": ("Copernicus Sentinel-3A", ["OLCI", "SLSTR", "SRAL", "MWR", "EDDS"]),
    "S3B": ("Copernicus Sentinel-3B", ["OLCI", "SLSTR", "SRAL", "MWR", "EDDS"]),
    "S5P": ("Copernicus Sentinel-5P", ["TROPOMI", "EDDS"]),
}

SERVICES = [
    "ACRI",
    "CLOUDFERRO",
    "DAS",
    "DHUS",
    "EXPRIVIA",
    "WERUM",
]


def build_acquisition_payload(acquisitions, edrs_acquisitions, period_id=""):
    payload = {
        "meta": {
            "schema": "acquisition-service@1.0",
            "period_id": period_id,
        },
        "global": {
            "planned": 0,
            "successful": 0,
            "successful_percentage": 0.0,
            "fail_sat": 0,
            "fail_acq": 0,
            "fail_other": 0,
        },
        "stations": {
            st: {
                "planned": 0,
                "successful": 0,
                "passes": 0,
                "passes_percentage": 0.0,
            }
            for st in STATIONS
        },
        "downlink_passes": defaultdict(lambda: defaultdict(list)),
        "downlink_anomalies": defaultdict(
            lambda: defaultdict(lambda: {"acq": [], "sat": [], "other": []})
        ),
        "edrs": {
            "planned": 0,
            "successful": 0,
            "passes": 0,
            "percentage": 0.0,
            "passes_percentage": 0.0,
        },
    }

    # ---- Acquisitions ----
    for row in acquisitions:
        src = row.get("_source", {})
        payload["global"]["planned"] += 1

        station = normalize_station(src.get("ground_station"))

        satellite = src.get("satellite_id")

        if not station or not satellite:
            current_app.logger.warning(
                "Dropped acquisition row: ground_station=%s satellite=%s",
                station,
                satellite,
            )
            continue

        ok = (
            src.get("antenna_status") is True
            and src.get("delivery_push_status") is True
            and src.get("front_end_status") is True
        )

        if ok:
            payload["global"]["successful"] += 1
        else:
            origin = (src.get("cams_origin") or "").lower()
            if "sat" in origin:
                payload["global"]["fail_sat"] += 1
            elif "acquis" in origin:
                payload["global"]["fail_acq"] += 1
            else:
                payload["global"]["fail_other"] += 1

        if not station or not satellite:
            continue

        payload["stations"][station]["planned"] += 1

        payload["downlink_passes"][station][satellite].append(src)

        if not ok:
            origin = (src.get("cams_origin") or "").lower()
            if "sat" in origin:
                payload["downlink_anomalies"][station][satellite]["sat"].append(src)
            elif "acquis" in origin:
                payload["downlink_anomalies"][station][satellite]["acq"].append(src)
            else:
                payload["downlink_anomalies"][station][satellite]["other"].append(src)
        else:
            payload["stations"][station]["successful"] += 1

    # ---- Finalize station stats ----
    for st, data in payload["stations"].items():
        data["passes"] = data["successful"]
        data["passes_percentage"] = (
            round(100 * data["successful"] / data["planned"], 1)
            if data["planned"] > 0
            else 0.0
        )

    # ---- Global percentage ----
    payload["global"] = compute_global_from_downlinks(payload)

    # ---- EDRS ----
    payload["edrs"]["planned"] = len(edrs_acquisitions)
    payload["edrs"]["successful"] = sum(
        1 for r in edrs_acquisitions if r.get("_source", {}).get("total_status") == "OK"
    )
    payload["edrs"]["percentage"] = (
        round(100 * payload["edrs"]["successful"] / payload["edrs"]["planned"], 1)
        if payload["edrs"]["planned"] > 0
        else 0.0
    )

    payload["edrs"]["passes"] = payload["edrs"]["successful"]
    payload["edrs"]["passes_percentage"] = payload["edrs"]["percentage"]

    return payload


def _cache_to_list(value):
    """
    Normalize cached acquisitions for SSR.
    Accepts Response | list | None
    Returns list
    """
    if value is None:
        return []

    if isinstance(value, Response):
        try:
            return json.loads(value.get_data(as_text=True))
        except Exception:
            return []

    if isinstance(value, list):
        return value

    return []


def build_downlink_passes(acquisitions):
    """
    Build:
    downlink_passes[station][satellite] = [raw_pass, ...]
    """
    passes = defaultdict(lambda: defaultdict(list))

    for row in acquisitions:
        src = row.get("_source", {})

        station = (src.get("ground_station") or "").lower()
        satellite = src.get("satellite_id")

        if not station or not satellite:
            continue

        passes[station][satellite].append(src)

    return passes


def build_downlink_anomalies(acquisitions):
    """
    Build:
    downlink_anomalies[station][satellite] = {
        acq: [],
        sat: [],
        other: []
    }
    """
    anomalies = defaultdict(
        lambda: defaultdict(lambda: {"acq": [], "sat": [], "other": []})
    )

    for row in acquisitions:
        src = row.get("_source", {})

        station = (src.get("ground_station") or "").lower()
        satellite = src.get("satellite_id")

        if not station or not satellite:
            continue

        ok = (
            src.get("antenna_status") == "OK"
            and src.get("delivery_push_status") == "OK"
            and src.get("front_end_status") == "OK"
        )

        if ok:
            continue

        origin = (src.get("cams_origin") or "").lower()

        if "sat" in origin:
            anomalies[station][satellite]["sat"].append(src)
        elif "acquis" in origin:
            anomalies[station][satellite]["acq"].append(src)
        else:
            anomalies[station][satellite]["other"].append(src)

    return anomalies


def normalize_station(raw_station: str | None) -> str | None:
    if not raw_station:
        return None

    raw = raw_station.upper()

    for token, station in STATION_MAP.items():
        if token in raw:
            return station

    return None


def compute_global_from_downlinks(payload):
    ok = sat = acq = other = tot = 0

    for station, sats in payload["downlink_passes"].items():
        for satellite, passes in sats.items():
            n_passes = len(passes)
            tot += n_passes

            anomalies = payload["downlink_anomalies"][station][satellite]

            acq_fail = len(anomalies["acq"])
            sat_fail = len(anomalies["sat"])
            oth_fail = len(anomalies["other"])

            acq += acq_fail
            sat += sat_fail
            other += oth_fail

            ok += n_passes - (acq_fail + sat_fail + oth_fail)

    return {
        "planned": tot,
        "successful": ok,
        "successful_percentage": round(100 * ok / tot, 2) if tot else 0.0,
        "fail_sat": sat,
        "fail_sat_percentage": round(100 * sat / tot, 2) if tot else 0.0,
        "fail_acq": acq,
        "fail_acq_percentage": round(100 * acq / tot, 2) if tot else 0.0,
        "fail_other": other,
        "fail_other_percentage": round(100 * other / tot, 2) if tot else 0.0,
    }


def is_quarter_authorized():
    return current_user.is_authenticated and current_user.role in ("admin", "esauser")


def previous_quarter_label(today=None):
    today = today or date.today()
    q = (today.month - 1) // 3
    year = today.year

    if q == 0:
        q = 4
        year -= 1

    start_month = (q - 1) * 3 + 1
    end_month = start_month + 2

    start = date(year, start_month, 1)
    end = date(year, end_month, 1)

    return f"{start.strftime('%b')} – {end.strftime('%b %Y')}"


def build_space_segment_ssr(datatakes, unavailability, period_start, period_end):

    # group records
    dt_by_sat = {}
    for d in datatakes:
        sat = (d.get("satellite_unit") or d.get("platform") or "").upper()
        if sat:
            dt_by_sat.setdefault(sat, []).append(d)

    unavail_by_sat = {}
    for u in unavailability:
        sat = (u.get("satellite_unit") or u.get("satellite") or "").upper()
        if sat:
            unavail_by_sat.setdefault(sat, []).append(u)

    satellites = {}

    for sat, (fullname, instruments_list) in SATELLITE_INFO.items():

        if sat == "S1B":
            continue

        inst_data = compute_availability_single_sat(
            dt_by_sat.get(sat, []),
            unavail_by_sat.get(sat, []),
            period_start,
            period_end,
            instruments_list,
        )

        success = round(sum(i["availability"] for i in inst_data) / len(inst_data), 2)

        satellites[sat] = {
            "satellite": sat,
            "fullname": fullname,
            "success": success,  # <--- matches JS naming
            "class": classify_satellite(success),
            "datatakes": dt_by_sat.get(sat, []),
            "unavailability": unavail_by_sat.get(sat, []),
            "instruments": inst_data,
        }

    return satellites


def compute_availability_single_sat(
    datatakes, unavailabilities, start, end, instruments
):
    total_seconds = (end - start).total_seconds()
    if total_seconds <= 0:
        return [{"name": i, "availability": 100.0} for i in instruments]

    availability = {inst: 100.0 for inst in instruments}

    for ev in unavailabilities:
        item = (ev.get("subsystem") or ev.get("instrument") or "").upper()
        satellite = (ev.get("satellite_unit") or ev.get("satellite") or "").upper()
        comment = (ev.get("comment") or "").upper()

        duration_raw = ev.get("unavailability_duration", 0)
        if duration_raw:
            duration_sec = duration_raw / 1_000_000
        else:
            try:
                duration_sec = (
                    dt.fromisoformat(ev["end_time"].replace("Z", ""))
                    - dt.fromisoformat(ev["start_time"].replace("Z", ""))
                ).total_seconds()
            except:
                duration_sec = 0

        if duration_sec <= 0:
            continue

        impact = (duration_sec / total_seconds) * 100

        if item in availability:
            availability[item] -= impact

        elif item in ("STR-1", "STR-2") and "STR" in availability:
            availability["STR"] -= impact

        elif satellite == "S5P" and "TROPOMI" in availability:
            availability["TROPOMI"] -= impact

        elif satellite in ("S3A", "S3B"):
            for inst in ["OLCI", "SLSTR", "SRAL", "MWR"]:
                if inst in availability and inst in comment:
                    availability[inst] -= impact

    display_name_map = {
        "STR-1": "STAR TRACKER",
        "STR-2": "STAR TRACKER",
        "STR": "STAR TRACKER",
    }  # map star trackers
    ui_availability = []

    for inst, val in availability.items():
        ui_name = display_name_map.get(inst, inst)
        if ui_name == "EDDS":
            continue
        ui_availability.append(
            {"name": ui_name, "availability": max(0, min(100, round(val, 2)))}
        )

    grouped = {}
    for entry in ui_availability:
        grouped[entry["name"]] = grouped.get(entry["name"], 0) + entry["availability"]

    ui_availability = [
        {"name": k, "availability": min(100, v)} for k, v in grouped.items()
    ]

    return ui_availability


def classify_satellite(pct):
    if pct >= 99:
        return "success"
    if pct >= 95:
        return "warning"
    return "danger"


def build_sensing_statistics(datatakes, completeness_threshold=0.99):
    data = {}
    totSensing = 0.0
    failedSensingAcq = 0.0
    failedSensingSat = 0.0
    failedSensingOther = 0.0
    categorizedAnomalies = {"sat_events": {}, "acq_events": {}, "other_events": {}}

    for d in datatakes:
        # Compute sensing hours
        if d.get("l0_sensing_duration"):
            hours = d["l0_sensing_duration"] / 3_600_000_000
        else:
            hours = (
                d["observation_time_stop"] - d["observation_time_start"]
            ).total_seconds() / 3600

        totSensing += hours

        # Compute completeness
        if d.get("last_attached_ticket") and d.get("cams_origin"):
            compl = recalc_completeness(d) / 100
            ticket = d.get("last_attached_ticket")
            origin = d.get("cams_origin", "")
            date = d["observation_time_start"].date().isoformat()
            description = d.get("cams_description", "")

            if origin.find("Acquis") != -1 and compl < completeness_threshold:
                lost = hours * (1 - compl)
                failedSensingAcq += lost
                categorizedAnomalies["acq_events"][ticket] = {
                    "reference": ticket,
                    "type": origin,
                    "description": description,
                    "date": date,
                }

            elif (
                origin.find("CAM") != -1 or origin.find("Sat") != -1
            ) and compl < completeness_threshold:
                lost = hours * (1 - compl)
                failedSensingSat += lost
                categorizedAnomalies["sat_events"][ticket] = {
                    "reference": ticket,
                    "type": origin,
                    "description": description,
                    "date": date,
                }

            elif compl < completeness_threshold:
                lost = hours * (1 - compl)
                failedSensingOther += lost
                categorizedAnomalies["other_events"][ticket] = {
                    "reference": ticket,
                    "type": origin,
                    "description": description,
                    "date": date,
                }

    successfulSensing = totSensing - (
        failedSensingAcq + failedSensingSat + failedSensingOther
    )

    def js_percent(val):
        return round((val / totSensing) * 100, 2) if totSensing else 0

    data[f"Successful sensing: {js_percent(successfulSensing)}%"] = round(
        successfulSensing, 2
    )
    data[
        f"Sensing failed due to Acquisition issues: {js_percent(failedSensingAcq)}%"
    ] = round(failedSensingAcq, 2)
    data[f"Sensing failed due to Satellite issues: {js_percent(failedSensingSat)}%"] = (
        round(failedSensingSat, 2)
    )
    data[f"Sensing failed due to Other issues: {js_percent(failedSensingOther)}%"] = (
        round(failedSensingOther, 2)
    )

    # Include anomalies for reference
    data["categorizedAnomalies"] = categorizedAnomalies

    return data


def recalc_completeness(datatake: dict) -> float:

    for key in ("L0_", "L1_", "L2_"):
        value = datatake.get(key)
        if value is not None:
            try:
                return float(value)
            except (TypeError, ValueError):
                pass

    return 0.0


def compute_availability(datatake_by_sat, unavail_by_sat, start, end):
    """Calculate availability % per instrument per sat based on downtime overlap."""
    results = {}

    for sat, instr_events in unavail_by_sat.items():
        results.setdefault(sat, {})
        total_period = (end - start).total_seconds()

        downtime = {}

        for ev in instr_events:
            inst = ev.get("instrument")
            if inst is None:
                continue

            ev_start = ev.get("start") or start
            ev_end = ev.get("end") or end

            overlap = (
                max(0, (min(ev_end, end) - max(ev_start, start)).total_seconds())
                if isinstance(ev_start, dt)
                else 0
            )
            downtime[inst] = downtime.get(inst, 0) + overlap

        for inst, dt in downtime.items():
            results[sat][inst] = max(0, 100 - (dt / total_period * 100))

    return results


def empty_result(instruments):
    return {
        "percent": {"success": 0.0, "downtime": 100.0},
        "instruments": [{"name": i, "availability": 0.0} for i in instruments],
    }


def safe_stats(sensing_stats, sat):
    stats = sensing_stats.get(sat) or {}
    percent = stats.get("percent") or {}

    # ensure keys exist so Jinja will never crash
    return {
        "success": percent.get("success", 0),
        "satellite": percent.get("satellite", 0),
        "acquisition": percent.get("acquisition", 0),
        "other": percent.get("other", 0),
    }


def safe_serialize(obj):
    """
    Recursively convert any Jinja Undefined to None.
    """
    if isinstance(obj, list):
        return [safe_serialize(x) for x in obj]
    elif isinstance(obj, dict):
        return {k: safe_serialize(v) for k, v in obj.items()}
    # Convert Jinja2 Undefined to None
    elif "Undefined" in str(type(obj)):
        return None
    return obj


def filter_by_period(datatakes, start, end):
    out = []

    for d in datatakes:
        t_raw = d.get("observation_time_start")
        if not t_raw:
            continue

        try:
            # Handle ISO strings like "2025-10-14T03:21:44.123Z"
            t = dt.fromisoformat(t_raw.replace("Z", "")).replace(tzinfo=timezone.utc)
        except Exception:
            # Skip malformed timestamps safely
            continue

        if start <= t <= end:
            out.append(d)

    return out


def normalize_cached_json(obj, *, default=None):
    """
    Page-level normalizer.
    Converts Flask Response -> dict
    Leaves dict/list untouched
    Never raises
    """
    if obj is None:
        return default

    # Flask Response
    if hasattr(obj, "get_json"):
        try:
            return obj.get_json(silent=True) or default
        except Exception:
            return default

    # Already JSON-compatible
    if isinstance(obj, (dict, list)):
        return obj

    return default


def getIntervalDates(period_type: str):
    # Use timezone-aware UTC now
    now = dt.now(timezone.utc)
    end_date = now.replace(minute=0, second=0, microsecond=0)
    start_date = end_date

    if period_type == "day":
        # Last 24 hours → start at 00:00 today
        start_date = end_date - timedelta(days=1)

    elif period_type == "week":
        # Last 7 days → start at 00:00 6 days ago (7 days total)
        start_date = end_date - timedelta(days=7)

    elif period_type == "month":
        # Last 30 days → start at 00:00 29 days ago (30 days total)
        start_date = end_date - timedelta(days=30)

    elif period_type in ("last-3-months", "prev-quarter"):
        # Last 3 months rolling → 90 days
        start_date = end_date - timedelta(days=90)

    return start_date, end_date


def parse_utc(dt_str: str):
    return datetime.datetime.fromisoformat(dt_str.replace("Z", "+00:00"))


def resolve_period(
    *,
    request_args: dict,
    param_name: str = "time-period-select",
    default: str = "prev-quarter",
    logger=None,
):
    """
    Resolves UI period into an effective backend period.

    Returns:
        ui_period (str): what the user selected (for dropdown / hydration)
        effective_period (str): what backend logic must use
    """

    PERIOD_ALIAS = {
        # UX aliases
        "last-3-months": "prev-quarter",
    }

    ui_period = request_args.get(param_name, default)
    effective_period = PERIOD_ALIAS.get(ui_period, ui_period)

    if logger:
        logger.info(
            "[PERIOD RESOLVE] ui_period=%s effective_period=%s alias=%s",
            ui_period,
            effective_period,
            ui_period != effective_period,
        )

    return ui_period, effective_period


def resolve_period_dates(period_key):
    """
    Returns (start_datetime, end_datetime) in UTC
    """

    end = dt.now(timezone.utc)

    if period_key in ("24h", "day"):
        start = end - timedelta(hours=24)

    elif period_key in ("7d", "week"):
        start = end - timedelta(days=7)

    elif period_key in ("30d", "month"):
        start = end - timedelta(days=30)

    elif period_key == "prev-quarter":
        # previous full quarter
        month = ((end.month - 1) // 3) * 3 + 1
        current_q_start = dt(end.year, month, 1)

        prev_q_end = current_q_start - timedelta(seconds=1)
        prev_q_start = prev_q_end - relativedelta(months=3)
        prev_q_start = prev_q_start.replace(day=1, hour=0, minute=0, second=0)

        start = prev_q_start
        end = prev_q_end

    elif period_key == "lifetime":
        # system lifetime start
        start = dt(2000, 1, 1, tzinfo=timezone.utc)

    else:
        raise ValueError(f"Unknown period_key: {period_key}")

    return start, end


def load_cached_interface_events(period_key):
    events = {}

    for service in SERVICES:
        if period_key == "prev-quarter":
            cache_key = (
                interface_monitoring_cache.interface_monitoring_cache_key.format(
                    "previous", "quarter", service
                )
            )
        else:
            cache_key = (
                interface_monitoring_cache.interface_monitoring_cache_key.format(
                    "last", period_key, service
                )
            )

        resp = flask_cache.get(cache_key)
        rows = json.loads(resp.get_data(as_text=True)) if resp else []

        events[service] = rows

    return events


def compute_availability_from_cached_events(period_key, start, end):
    events = load_cached_interface_events(period_key)
    duration = (end - start).total_seconds()

    availability_map = {}
    interface_status_map = {}

    for service, rows in events.items():
        unavail = 0

        for r in rows:
            s = dt.fromisoformat(
                r["_source"]["status_time_start"].replace("Z", "+00:00")
            )
            e = dt.fromisoformat(
                r["_source"]["status_time_stop"].replace("Z", "+00:00")
            )
            unavail += (e - s).total_seconds()

        availability_map[service] = round((1 - unavail / duration) * 100, 2)

        interface_status_map[service] = rows

    return availability_map, interface_status_map
