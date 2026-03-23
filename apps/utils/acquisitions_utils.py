# apps.utils.acquisitions_utils
from __future__ import annotations

import json
from flask import Response, current_app
from collections import defaultdict
from datetime import date, datetime as dt, timezone, timedelta
from flask_login import current_user
from dateutil.relativedelta import relativedelta
import datetime


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

    return f"{start.strftime('%b')} - {end.strftime('%b %Y')}"


def build_space_segment_ssr(datatakes, unavailability, period_start, period_end):
    # print(f"\n--- DEBUG START ---")
    # print(f"Total Datatakes Received: {len(datatakes)}")

    comment_lookup = {}

    for u in unavailability:
        comment_text = (
            u.get("cams_description")
            or u.get("comment")
            or u.get("description")
            or "No details available"
        )

        ids = [
            u.get("unavailability_reference"),
            u.get("key"),
            u.get("ticket_id"),
            u.get("issue_ticket"),
        ]

        for val in ids:
            if val:
                s = str(val).strip().upper()
                comment_lookup[s] = comment_text

                comment_lookup[s.replace("_", "-")] = comment_text
                comment_lookup[s.replace("-", "_")] = comment_text

    # Group datatakes by satellite
    dt_by_sat = {}
    for d in datatakes:
        sat = (d.get("satellite_unit") or d.get("platform") or "").upper()
        if sat:
            dt_by_sat.setdefault(sat, []).append(d)

    # Group unavailability by satellite (for instrument bars)
    unavail_by_sat = {}
    for u in unavailability:
        sat = (u.get("satellite_unit") or u.get("satellite") or "").upper()
        if sat:
            unavail_by_sat.setdefault(sat, []).append(u)

    satellites = {}
    JS_THRESHOLD = 0.9999

    for sat, (fullname, instruments_list) in SATELLITE_INFO.items():
        if sat == "S1B":
            continue

        table_datatakes = []
        totSensing = 0.0
        failedSensingAcq = 0.0
        failedSensingSat = 0.0
        failedSensingOther = 0.0

        categorized_events = {
            "sat_events": {},
            "acq_events": {},
            "other_events": {},
        }
        current_dt_list = dt_by_sat.get(sat, [])

        # LOG: How many records per satellite before we start
        # print(f"Checking {sat}: Found {len(current_dt_list)} raw records")

        for datatake in current_dt_list:
            origin = datatake.get("cams_origin") or ""

            compl_val = recalc_completeness(datatake)
            ticket = datatake.get("last_attached_ticket")

            if not ticket and compl_val == 0.0:
                compl_fraction = 1.0  # Treat as 100% for sensing stats
            else:
                compl_fraction = compl_val / 100.0

            if datatake.get("l0_sensing_duration"):
                hours = datatake["l0_sensing_duration"] / 3600000000.0
            else:
                try:
                    start_raw = datatake.get("observation_time_start")
                    stop_raw = datatake.get("observation_time_stop")

                    if start_raw and stop_raw:
                        dt_start = dt.fromisoformat(start_raw.replace("Z", "+00:00"))
                        dt_stop = dt.fromisoformat(stop_raw.replace("Z", "+00:00"))

                        hours = (dt_stop - dt_start).total_seconds() / 3600.0
                except:
                    hours = 0.0

            totSensing += hours
            # LOG: Capture any record that has a ticket or is not 100%
            # if ticket or compl_fraction < 1.0:
            #    print(
            #        f"  [{sat}] Record: {datatake.get('datatake_id', 'N/A')} | Hours: {hours:.4f} | Compl: {compl_val}% | Ticket: {ticket} | Origin: {origin}"
            #    )
            table_datatakes.append(datatake)

            if ticket and origin and compl_fraction < JS_THRESHOLD:
                if compl_fraction < JS_THRESHOLD:
                    lost_hrs = hours * (1.0 - compl_fraction)
                    clean_ticket = str(ticket).strip().upper()

                    found_comment = (
                        comment_lookup.get(clean_ticket)
                        or datatake.get("cams_description")
                        or datatake.get("description")
                    )

                    if not found_comment:
                        found_comment = (
                            datatake.get("cams_description")
                            or datatake.get("description")
                            or datatake.get("comment")
                        )

                    final_desc = (
                        found_comment
                        if found_comment
                        else f"Issue ticket: {clean_ticket}"
                    )

                    raw_origin = datatake.get("cams_origin") or ""
                    origin_str = raw_origin.upper()
                    desc_upper = final_desc.upper()

                    event_data = {
                        "date": (
                            datatake.get("observation_time_start") or "0000-00-00"
                        )[:10],
                        "description": final_desc,
                        "type": "Other",
                    }

                    # --- Categorization Logic ---
                    category_key = "other_events"
                    issue_type_label = "Other"

                    if "OCM" in desc_upper or any(
                        x in origin_str for x in ["SAT", "CAM", "INSTRUMENT"]
                    ):
                        failedSensingSat += lost_hrs
                        issue_type_label = "Satellite"
                        category_key = "sat_events"

                    # Acquisition Logic
                    elif any(
                        x in origin_str
                        for x in ["ACQUIS", "X-BAND", "ANTENNA", "GROUND"]
                    ) or any(x in desc_upper for x in ["FIBER", "NETWORK", "STATION"]):
                        failedSensingAcq += lost_hrs
                        issue_type_label = "Acquisition"
                        category_key = "acq_events"

                    # Other Logic
                    else:
                        failedSensingOther += lost_hrs
                        category_key = "other_events"
                        if "RFI" in desc_upper:
                            issue_type_label = "RFI"
                        elif "PRODUCTION" in desc_upper:
                            issue_type_label = "Production"
                        else:
                            issue_type_label = "Other"

                    display_label = raw_origin if raw_origin else issue_type_label
                    formatted_description = f"{display_label} issue. {final_desc}"

                    event_data = {
                        "date": (
                            datatake.get("observation_time_start") or "0000-00-00"
                        )[:10],
                        "description": formatted_description,  # Use the formatted version here
                        "type": display_label,
                    }

                categorized_events[category_key][clean_ticket] = event_data
            # elif ticket:
            # Log if a ticket exists but completeness is 100 (so it's ignored)
            # if compl_val >= 99.9:
            #    print(
            #        f"DEBUG [{sat}]: Ignoring Ticket {ticket} because completeness is {compl_val}%"
            #    )

        totSuccessSensing = totSensing - (
            failedSensingAcq + failedSensingSat + failedSensingOther
        )

        totSensing = round(totSensing, 2)

        if totSensing > 0:
            sensing_pct = float(f"{(totSuccessSensing / totSensing):.2f}") * 100

            # print(f"--- SENSING CALC [{sat}] ---")
            # print(f"  Raw Success: {totSuccessSensing}")
            # print(f"  Rounded Planned: {totSensing}")
            # print(f"  Final Pct: {sensing_pct}%")

        else:
            sensing_pct = 100.0

        # Instrument Availability (The bars)
        inst_data = compute_availability_single_sat(
            unavail_by_sat.get(sat, []),
            period_start,
            period_end,
            instruments_list,
            tot_planned_hrs=totSensing,
            tot_success_hrs=totSuccessSensing,
            sat_id=sat,
        )

        avg_inst_avail = (
            sum(i["availability"] for i in inst_data) / len(inst_data)
            if inst_data
            else 0.0
        )
        final_status_pct = min(sensing_pct, avg_inst_avail)

        satellites[sat] = {
            "satellite": sat,
            "fullname": fullname,
            "success": totSuccessSensing,
            "success_percentage": sensing_pct,
            "class": classify_satellite(final_status_pct),
            "unavailability": {
                "sat": failedSensingSat,
                "acq": failedSensingAcq,
                "other": failedSensingOther,
            },
            "instruments": inst_data,
            "datatakes": table_datatakes,
            "events": {
                k: sorted(list(v.values()), key=lambda x: x["date"])
                for k, v in categorized_events.items()
            },
        }

    return satellites


def compute_availability_single_sat(
    unavailabilities, start, end, instruments, tot_planned_hrs, tot_success_hrs, sat_id
):
    period_duration_sec = (end - start).total_seconds()
    if period_duration_sec <= 0:
        return [{"name": i, "availability": 100.0} for i in instruments]

    availability = {inst.upper(): 100.0 for inst in instruments}

    processed_refs = set()
    for ev in unavailabilities:
        ref = ev.get("unavailability_reference", "unknown")
        sub = (ev.get("subsystem") or ev.get("instrument") or "").upper()
        unique_key = f"{ref}_{sub}"

        if unique_key in processed_refs:
            continue
        processed_refs.add(unique_key)

        duration_raw = ev.get("unavailability_duration", 0)
        duration_sec = duration_raw / 1_000_000 if duration_raw else 0

        if not duration_sec:
            try:
                s_time = dt.fromisoformat(ev["start_time"].replace("Z", "+00:00"))
                e_time = dt.fromisoformat(ev["end_time"].replace("Z", "+00:00"))
                duration_sec = (e_time - s_time).total_seconds()
            except:
                duration_sec = 0

        impact_pct = (duration_sec / period_duration_sec) * 100
        comment = (ev.get("comment") or "").upper()
        satellite = sat_id.upper()

        if sub in availability:
            availability[sub] -= impact_pct

        # Star Tracker Mapping (STR-1/STR-2 -> STR)
        elif sub in ("STR-1", "STR-2") and "STR" in availability:
            availability["STR"] -= impact_pct

        # S5P TROPOMI Override
        elif satellite == "S5P" and "TROPOMI" in availability:
            availability["TROPOMI"] -= impact_pct

        # S3 Mission Instrument Logic (Looking into comments)
        elif satellite in ("S3A", "S3B"):
            for inst_name in ["OLCI", "SLSTR", "SRAL", "MWR"]:
                if inst_name in availability and inst_name in comment:
                    availability[inst_name] -= impact_pct

    # UI Formatting
    display_name_map = {
        "STR": "STAR TRACKER",
        "MSI": "MSI",
        "OLCI": "OLCI",
    }

    ui_results = []
    for inst in instruments:
        inst_up = inst.upper()

        if inst_up == "EDDS":
            continue

        val = availability.get(inst_up, 100.0)
        ui_results.append(
            {
                "name": display_name_map.get(inst_up, inst_up),
                "availability": max(0, min(100, round(val, 2))),
            }
        )

    return ui_results


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


def recalc_completeness(datatake):
    """
    Priority: Standard L-levels -> Cached Final Percentage.
    Handles None, empty strings, and '%' symbols.
    """
    priority_keys = [
        "L0_",
        "L1_",
        "L2_",
        "final_completeness_percentage",
        "L0",
        "L1",
        "L2",
    ]
    for key in priority_keys:
        val = datatake.get(key)
        if val is not None and val != "":
            try:
                if isinstance(val, str):
                    val = val.replace("%", "").strip()
                return float(val)
            except (ValueError, TypeError):
                continue
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

    elif period_key in ("prev-quarter", "prev-quarter-specific"):
        # previous full quarter
        month = ((end.month - 1) // 3) * 3 + 1
        current_q_start = dt(end.year, month, 1, tzinfo=timezone.utc)

        prev_q_end = current_q_start - timedelta(seconds=1)
        prev_q_start = prev_q_end - relativedelta(months=3)
        # prev_q_start = prev_q_start.replace(day=1, hour=0, minute=0, second=0)

        start = prev_q_start
        end = prev_q_end

    elif period_key == "lifetime":
        # system lifetime start
        start = dt(2000, 1, 1, tzinfo=timezone.utc)

    else:
        raise ValueError(f"Unknown period_key: {period_key}")

    return start, end


def build_interface_status_map(events):
    """
    Build a map:
        interface_name -> list of status events

    Input:
        events: list[dict]

    Output:
        dict[str, list[dict]]
    """
    interface_map = defaultdict(list)

    if not events:
        return {}

    for ev in events:
        src = ev.get("_source", {})
        interface = src.get("interface_name")
        if not interface:
            continue

        interface_map[interface].append(ev)

    return dict(interface_map)


def compute_availability_from_interface_map(interface_status_map, start, end):
    availability = {}

    total_seconds = (end - start).total_seconds()

    for iface, failures in interface_status_map.items():
        down = sum(f["duration"] for f in failures)
        availability[iface] = max(0.0, 100.0 * (1 - down / total_seconds))

    return availability


def normalize_interface_events(events):
    out = []
    for ev in events:
        src = ev.get("_source", {})
        out.append(
            {
                "start": src.get("status_time_start"),
                "stop": src.get("status_time_stop"),
                "duration": src.get("status_duration", 0),
            }
        )
    return out


def compute_availability_from_events(interface_status_map, period_start, period_end):
    total_period_seconds = (period_end - period_start).total_seconds()
    availability = {}

    for service, events in interface_status_map.items():
        down_seconds = 0.0

        for e in events:
            start = max(dt.fromisoformat(e["start"]), period_start)
            stop = min(dt.fromisoformat(e["stop"]), period_end)

            if stop > start:
                down_seconds += (stop - start).total_seconds()

        up_seconds = max(total_period_seconds - down_seconds, 0)
        availability[service] = round((up_seconds / total_period_seconds) * 100, 6)

    return availability
