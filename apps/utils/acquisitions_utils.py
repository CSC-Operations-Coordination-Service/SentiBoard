import json
from flask import Response, current_app
from collections import defaultdict
from datetime import date
from flask_login import current_user

STATIONS = ["svalbard", "inuvik", "matera", "maspalomas", "neustrelitz"]

STATION_MAP = {
    "SGS": "svalbard",  # Svalbard Ground Station
    "MTI": "matera",  # Matera
    "MPS": "maspalomas",  # Maspalomas
    "NSG": "neustrelitz",  # Neustrelitz
    "INS": "inuvik",  # Inuvik
}


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


def build_space_segment_payload(unavailability, datatakes):
    satellites = {
        "S1A": {"name": "Copernicus Sentinel-1A", "class": "info"},
        "S1C": {"name": "Copernicus Sentinel-1C", "class": "info"},
        "S2A": {"name": "Copernicus Sentinel-2A", "class": "success"},
        "S2B": {"name": "Copernicus Sentinel-2B", "class": "success"},
        "S2C": {"name": "Copernicus Sentinel-2C", "class": "success"},
        "S3A": {"name": "Copernicus Sentinel-3A", "class": "warning"},
        "S3B": {"name": "Copernicus Sentinel-3B", "class": "warning"},
        "S5P": {"name": "Copernicus Sentinel-5P", "class": "secondary"},
    }

    result = {}

    for sat, meta in satellites.items():
        sat_datatakes = datatakes.get(sat, [])

        # ── Satellite base structure
        result[sat] = {
            "label": meta["name"],
            "class": meta["class"],
            "overall": unavailability.get(sat, {}).get("overall", 100),
            "instruments": [
                {"name": instr, "availability": round(value, 2)}
                for instr, value in unavailability.get(sat, {})
                .get("instruments", {})
                .items()
            ],
            "impacted_datatakes": [
                {
                    "id": dt.get("datatake_id"),
                    "date": dt.get("observation_time_start").date().isoformat(),
                    "issue_type": dt.get("cams_origin", "Unknown"),
                    "issue_link": dt.get("last_attached_ticket", ""),
                    "completeness": recalc_completeness(dt),
                    "actions": build_actions_html(dt.get("datatake_id")),
                }
                for dt in sat_datatakes
                if dt.get("last_attached_ticket")
            ],
            # ── Add sensing statistics even if empty
            "sensing": build_sensing_statistics(sat_datatakes),
        }

    return result


def build_sensing_statistics(datatakes):
    total = success = sat = acq = other = 0.0
    anomalies = {"satellite": [], "acquisition": [], "other": []}

    for dt in datatakes:
        hours = (
            dt.get("l0_sensing_duration", 0) / 3_600_000_000
            if dt.get("l0_sensing_duration")
            else (
                dt["observation_time_stop"] - dt["observation_time_start"]
            ).total_seconds()
            / 3600
        )
        total += hours

        compl = recalc_completeness(dt) / 100 if dt.get("last_attached_ticket") else 1

        if compl >= 0.9999:
            success += hours
        else:
            lost = hours * (1 - compl)
            origin = dt.get("cams_origin", "")

            if "Acquis" in origin:
                acq += lost
                anomalies["acquisition"].append(...)
            elif "CAM" in origin or "Sat" in origin:
                sat += lost
                anomalies["satellite"].append(...)
            else:
                other += lost
                anomalies["other"].append(...)

    success = total - (sat + acq + other)

    return {
        "hours": {
            "total": round(total, 2),
            "success": round(success, 2),
            "satellite": round(sat, 2),
            "acquisition": round(acq, 2),
            "other": round(other, 2),
        },
        "percent": {
            "success": round(success / total * 100, 2) if total else 0,
            "satellite": round(sat / total * 100, 2) if total else 0,
            "acquisition": round(acq / total * 100, 2) if total else 0,
            "other": round(other / total * 100, 2) if total else 0,
        },
        "pie": [
            {"label": "Successful sensing", "value": round(success, 2)},
            {"label": "Satellite issues", "value": round(sat, 2)},
            {"label": "Acquisition issues", "value": round(acq, 2)},
            {"label": "Other issues", "value": round(other, 2)},
        ],
        "anomalies": anomalies,
    }


def recalc_completeness(datatake: dict) -> float:
    """
    Recalculate acquisition completeness using the same logic as the JS client.

    Priority:
    1. L0_
    2. L1_
    3. L2_
    4. default 0.0

    Returns:
        float: completeness percentage (0–100)
    """

    for key in ("L0_", "L1_", "L2_"):
        value = datatake.get(key)
        if value is not None:
            try:
                return float(value)
            except (TypeError, ValueError):
                pass

    return 0.0


def build_actions_html(datatake_id: str) -> str:
    clean_id = datatake_id.split("(")[0].strip()
    return (
        '<button type="button" '
        'class="btn-link" '
        'style="color:#8c90a0" '
        'data-toggle="modal" '
        'data-target="#showDatatakeDetailsModal" '
        f"onclick=\"showDatatakeDetails('{clean_id}')\">"
        '<i class="la flaticon-search-1"></i>'
        "</button>"
    )


def normalize_unavailability(unavailability):
    """
    Convert unavailability from list → dict keyed by satellite.
    """
    if isinstance(unavailability, list):
        return {
            item.get("satellite"): item
            for item in unavailability
            if isinstance(item, dict) and "satellite" in item
        }

    return unavailability or {}


def normalize_datatakes(datatakes):
    """
    Convert datatakes from list → dict keyed by satellite.
    """
    result = {}

    if isinstance(datatakes, list):
        for dt in datatakes:
            if not isinstance(dt, dict):
                continue

            sat = dt.get("satellite")
            if not sat:
                continue

            result.setdefault(sat, []).append(dt)

        return result

    # already normalized or empty
    return datatakes or {}
