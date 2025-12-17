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
