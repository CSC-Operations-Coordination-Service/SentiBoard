import json
import ast
from datetime import datetime, timedelta, timezone
import logging
from apps.utils import date_utils
from dateutil.relativedelta import relativedelta
import logging
from apps.models.anomalies import Anomalies
import apps.cache.modules.datatakes as datatakes_cache
from jinja2 import Undefined
from flask import current_app
from apps import flask_cache


logger = logging.getLogger(__name__)


VALID_PREFIXES = ("S1", "S2", "S3", "S5P")
THRESHOLD_RECOVERED = 90.0
THRESHOLD_PARTIAL = 10.0


def to_utc(dt):
    """
    Convert a datetime or string to UTC datetime (aware).
    Returns a datetime object, not a string.
    """
    if isinstance(dt, str):
        try:
            if "/" in dt:
                dt = datetime.strptime(dt, "%d/%m/%Y %H:%M:%S")
            else:
                dt = datetime.fromisoformat(dt)
        except Exception:
            dt = datetime.now(timezone.utc)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt


def safe_get(val, default=""):
    if val is None or isinstance(val, Undefined):
        return default
    return val


def safe_value(val, default="N/A"):
    if isinstance(val, Undefined) or val is None:
        return default
    return val


def safe_json_value(v, default="N/A"):
    """Ensure v is JSON serializable, replacing Undefined or other non-serializables"""
    if v is None:
        return default
    try:
        json.dumps(v)
        return v
    except (TypeError, OverflowError):
        return str(v)


def replace_undefined(value):
    if isinstance(value, Undefined):
        return None

    if isinstance(value, dict):
        return {key: replace_undefined(val) for key, val in value.items()}

    if isinstance(value, list):
        return [replace_undefined(item) for item in value]

    if isinstance(value, tuple):
        return tuple(replace_undefined(item) for item in value)

    if isinstance(value, set):
        return {replace_undefined(item) for item in value}

    return value


def datatake_sort_key(dt):
    """
    Sort order:
    1. ACQUIRED first
    2. Other statuses (PROCESSING, DELAYED, PARTIAL, UNAVAILABLE)
    3. PLANNED last
    Inside each group → oldest (lowest timestamp) first (ASCENDING order)
    Full datetime considered (hours, minutes, seconds)
    """
    status = (dt.get("acquisition_status") or "").upper()

    # Status priority
    if status == "ACQUIRED":
        status_priority = 0
    elif status == "PLANNED":
        status_priority = 2
    else:
        status_priority = 1

    # --- Timestamp (ascending, full datetime) ---
    start_time = dt.get("start_time")
    if start_time:
        try:
            # Use fromisoformat or parse with fallback
            ts = datetime.fromisoformat(start_time).timestamp()
        except Exception:
            try:
                ts = datetime.strptime(start_time, "%Y-%m-%dT%H:%M:%S").timestamp()
            except Exception:
                ts = float("inf")  # Invalid format → end
    else:
        ts = float("inf")  # Missing dates → end

    return (status_priority, ts)


def to_utc_iso(dt):
    """
    Convert a datetime to UTC and return ISO string.
    """
    if isinstance(dt, str):
        # try to parse string first
        try:
            if "/" in dt:
                dt = datetime.strptime(dt, "%d/%m/%Y %H:%M:%S")
            else:
                dt = datetime.fromisoformat(dt)
        except Exception:
            # fallback to now
            dt = datetime.now(timezone.utc)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat()


def get_impacted_satellite(a):
    """
    Determine impacted satellite from provided field or environment.
    Picks the first valid prefix in VALID_PREFIXES from semicolon-separated environment string.
    """
    impacted_satellite = a.get("impactedSatellite") or ""
    if impacted_satellite and any(
        impacted_satellite.startswith(p) for p in VALID_PREFIXES
    ):
        return impacted_satellite

    env = a.get("environment", "")
    if isinstance(env, str):
        # Split by ';' and check each segment
        candidates = [seg.strip() for seg in env.split(";") if seg.strip()]
        for candidate in candidates:
            prefix_part = candidate.split("-")[0].strip()
            if any(prefix_part.startswith(p) for p in VALID_PREFIXES):
                return prefix_part
    return ""


def parse_datatakes_completeness(raw_field):
    """Safely parse datatakes_completeness field."""
    if not raw_field:
        return []

    if isinstance(raw_field, (list, dict)):
        return raw_field

    if isinstance(raw_field, str):
        try:
            normalized = raw_field.replace("'", '"')
            return json.loads(normalized)
        except json.JSONDecodeError:
            pass
        try:
            return ast.literal_eval(raw_field)
        except Exception:
            pass

    return []


def calc_completeness(values):
    numeric_values = [v for v in values if isinstance(v, (int, float))]
    return sum(numeric_values) / len(numeric_values) if numeric_values else 0


def build_event_instance(a, logger=None):

    # Parse start/end time from publicationDate
    date_str = a.get("publicationDate")
    start_date = None
    if date_str:
        start_date = to_utc(date_str)
    else:
        start_date = datetime.now(timezone.utc)

    end_str = a.get("end")
    end_date = None

    if end_str:
        end_date = to_utc(end_str)
    else:
        end_date = start_date + timedelta(minutes=1)

    # Impacted satellite: prefer provided, otherwise derive from environment
    impacted_satellite = get_impacted_satellite(a)

    category = a.get("category", "Unknown")

    datatakes_raw = parse_datatakes_completeness(a.get("datatakes_completeness"))
    # current_app.logger.info(f"[PARSE DATATAKES COMPLETENESS]: {datatakes_raw}")

    datatake_ids = []
    datatake_records = []
    all_recovered = True
    any_partial = False
    any_failed = False

    for dt_entry in datatakes_raw:
        try:
            # If the entry is a string, try to parse it (sometimes elements are stringified)
            if isinstance(dt_entry, str):
                try:
                    parsed_candidate = json.loads(dt_entry.replace("'", '"'))
                except Exception:
                    try:
                        parsed_candidate = ast.literal_eval(dt_entry)
                    except Exception:
                        parsed_candidate = None
                if parsed_candidate is not None:
                    dt_entry = parsed_candidate

            # If now it's a dict with a 'datatakeID' field (Shape A)
            if isinstance(dt_entry, dict) and "datatakeID" in dt_entry:
                dtid = dt_entry.get("datatakeID")
                if not dtid or not isinstance(dtid, str):
                    continue
                # enforce prefix filter
                if not any(dtid.startswith(p) for p in VALID_PREFIXES):
                    continue
                if dtid not in datatake_ids:
                    datatake_ids.append(dtid)

                # collect numeric L* values
                values = [dt_entry.get("L0_"), dt_entry.get("L1_"), dt_entry.get("L2_")]
                values = [v for v in values if isinstance(v, (int, float))]

                # no numeric values -> skip
                if not values:
                    continue

                completeness = calc_completeness(values)

                # Skip datatakes with completeness == 100 (no need to report)
                if completeness == 100:
                    # do NOT mark as recovered/partial/failed, simply omit
                    # current_app.logger.debug(f"[SKIP DT 100%] {dtid}")
                    continue

                # classify
                if completeness >= THRESHOLD_RECOVERED:
                    status = "ok"
                    # ok datatakes do not change all_recovered (they confirm recovered)
                elif completeness >= THRESHOLD_PARTIAL:
                    status = "partial"
                    any_partial = True
                    all_recovered = False
                else:
                    status = "failed"
                    any_failed = True
                    all_recovered = False

                datatake_records.append(
                    {
                        "datatake_id": dtid,
                        "values": values,
                        "completeness": completeness,
                        "status": status,
                    }
                )

            # If it's a dict that maps id -> values (Shape B)
            elif isinstance(dt_entry, dict):
                for candidate_id, candidate_val in dt_entry.items():
                    # candidate_id might be the datatake id (old format)
                    if not isinstance(candidate_id, str):
                        continue
                    if not any(candidate_id.startswith(p) for p in VALID_PREFIXES):
                        # skip irrelevant prefixes
                        continue
                    if candidate_id not in datatake_ids:
                        datatake_ids.append(candidate_id)

                    # extract numeric values from candidate_val
                    values = []
                    if isinstance(candidate_val, dict):
                        for v in candidate_val.values():
                            if isinstance(v, (int, float)):
                                values.append(v)
                    elif isinstance(candidate_val, (int, float)):
                        values.append(candidate_val)
                    else:
                        # if candidate_val is a list/tuple, try extract numeric
                        if isinstance(candidate_val, (list, tuple)):
                            for v in candidate_val:
                                if isinstance(v, (int, float)):
                                    values.append(v)

                    if not values:
                        continue

                    completeness = calc_completeness(values)

                    # Skip datatakes with completeness == 100
                    if completeness == 100:
                        # current_app.logger.debug(f"[SKIP DT 100%] {candidate_id}")
                        continue

                    if completeness >= THRESHOLD_RECOVERED:
                        status = "ok"
                    elif completeness >= THRESHOLD_PARTIAL:
                        status = "partial"
                        any_partial = True
                        all_recovered = False
                    else:
                        status = "failed"
                        any_failed = True
                        all_recovered = False

                    datatake_records.append(
                        {
                            "datatake_id": candidate_id,
                            "values": values,
                            "completeness": completeness,
                            "status": status,
                        }
                    )

            else:
                # unknown entry type: skip but mark not all recovered to be safe
                current_app.logger.debug(
                    f"[build_event_instance] Unknown datatake entry: {dt_entry}"
                )
                all_recovered = False

        except Exception as exc:
            current_app.logger.warning(
                f"[build_event_instance] Parse error for entry {dt_entry}: {exc}"
            )
            all_recovered = False
            continue

    # If there were datatake IDs but none produced valid completeness records -> skip event
    if datatake_ids and not datatake_records:
        #  if logger:
        #      logger.info(
        #          f"[SKIP EVENT] {a.get('key')} - has datatake id's but not completeness data (or all were 100%)."
        #      )
        return None

    # If no datatake info at all -> skip
    if not datatake_ids and not datatake_records:
        # if logger:
        #     logger.info(
        #         f"[SKIP EVENT] {a.get('key')} - no datatake id's information available"
        #     )
        return None

    # overall_status: failed > partial > ok (JS-like semantics)
    overall_status = "unknown"
    if any_failed:
        overall_status = "failed"
    elif any_partial:
        overall_status = "partial"
    elif all_recovered:
        overall_status = "ok"

    full_recover = overall_status == "ok"
    partial_recover = overall_status == "partial"

    # color mapping (you can tune hexes)
    color = "#31ce36" if full_recover else ("#F9A825" if partial_recover else "#D32F2F")

    instance = {
        "id": a.get("key"),
        "from": start_date.isoformat(),
        "publicationDate": start_date.isoformat(),
        "to": end_date.isoformat(),
        "endDate": end_date.isoformat(),
        "title": a.get("title") or f"{category} Event",
        "category": category,
        "description": f"Impacted Satellite: {impacted_satellite}",
        "environment": impacted_satellite,
        "color": color,
        "colorText": "white",
        "colorBorder": "white",
        "fullRecover": full_recover,
        "partialRecover": partial_recover,
        "overall_status": overall_status,
        "datatake_ids": datatake_ids,
        "datatakes_completeness": datatake_records,
    }

    # if logger:
    #     logger.info(f"[EVENT INSTANCE BUILT] {json.dumps(instance, indent=2)}")

    return instance


def get_previous_quarter_anomalies():
    start_date, _ = date_utils.prev_quarter_interval_from_date(datetime.today())
    end_date = datetime.today().replace(hour=23, minute=59, second=59)
    result = Anomalies.query.filter(
        Anomalies.start >= start_date, Anomalies.start <= end_date
    ).all()
    return result


def get_last_quarter_anomalies():
    start_date = datetime.today() - relativedelta(months=3)
    end_date = datetime.today().replace(hour=23, minute=59, second=59)
    return Anomalies.query.filter(
        Anomalies.start >= start_date, Anomalies.start <= end_date
    ).all()


def serialize_anomalie(anomalie):
    return {
        "id": anomalie.id,
        "key": anomalie.key,
        "title": anomalie.title,
        "text": anomalie.text,
        "publicationDate": (
            anomalie.publicationDate.isoformat() if anomalie.publicationDate else None
        ),
        "category": anomalie.category,
        "impactedSatellite": anomalie.impactedSatellite,
        "impactedItem": anomalie.impactedItem,
        "startDate": anomalie.start.isoformat() if anomalie.start else None,
        "endDate": anomalie.end.isoformat() if anomalie.end else None,
        "environment": anomalie.environment,
        "datatakesCompleteness": anomalie.datatakes_completeness,
        "newsLink": anomalie.newsLink,
        "newsTitle": anomalie.newsTitle,
        "modifyDate": anomalie.modifyDate.isoformat() if anomalie.modifyDate else None,
    }


def load_cache_as_list(cache_uri: str, name: str) -> list:
    """
    Safely load a cached value from flask_cache and always return a list.
    Works with Response, JSON string, bytes, or list.
    """
    raw_cache = flask_cache.get(cache_uri)

    if raw_cache is None:
        current_app.logger.warning(f"[DATA-AVAILABILITY] No {name} cache found")
        return []

    try:
        # Flask Response
        if hasattr(raw_cache, "get_json"):
            return raw_cache.get_json() or []

        # Flask Response object
        elif hasattr(raw_cache, "get_data"):
            return json.loads(raw_cache.get_data(as_text=True)) or []

        # String or bytes
        elif isinstance(raw_cache, (str, bytes)):
            return json.loads(raw_cache) or []

        # Already a list
        elif isinstance(raw_cache, list):
            return raw_cache

        else:
            current_app.logger.warning(
                f"[DATA-AVAILABILITY] Unknown cache type for {name}: {type(raw_cache)}"
            )
            return []

    except Exception as e:
        current_app.logger.warning(f"[DATA-AVAILABILITY] Failed to parse {name}: {e}")
        return []


def generate_completeness_cache():
    """
    Generate summary of all datatakes completeness, store in Redis.
    """
    datatakes_data = datatakes_cache.load_all_datatakes()  # or your cached list
    summary = {}

    for d in datatakes_data:
        src = d.get("_source", {}) or {}
        datatake_id = src.get("datatake_id") or src.get("id")
        completeness_list = [
            {"productType": k.replace("_local_percentage", ""), "status": round(v, 2)}
            for k, v in src.items()
            if isinstance(v, (int, float)) and k.endswith("_local_percentage")
        ]
        summary[datatake_id] = completeness_list

    # Store JSON in Redis (or any persistent cache)
    redis_client.set("datatakes_completeness_summary", json.dumps(summary))


def enrich_datatake(dt):
    dt_copy = dt.copy()
    dt_id = dt_copy.get("id") or dt_copy.get("datatake_id")
    if not dt_id:
        return dt_copy

    full_details = datatakes_cache.load_datatake_details(dt_id) or {}
    raw = full_details.get("_source", full_details)

    completeness_list = [
        {"productType": k, "status": round(v, 2)}
        for k, v in raw.items()
        if k.endswith("_local_percentage") and isinstance(v, (int, float))
    ]
    dt_copy["completeness_list"] = completeness_list

    comp = raw.get("completeness_status", {}) or {}
    acq = comp.get("ACQ", {})
    pub = comp.get("PUB", {})
    dt_copy["acquisition_status"] = acq.get("status") or "ACQUIRED"
    dt_copy["publication_status"] = pub.get("status") or "PUBLISHED"

    raw["completeness_status"] = {
        "ACQ": {
            "status": dt_copy["acquisition_status"],
            "percentage": acq.get("percentage") or 100,
        },
        "PUB": {
            "status": dt_copy["publication_status"],
            "percentage": pub.get("percentage") or 100,
        },
    }
    dt_copy["raw"] = raw
    return dt_copy


def make_json_safe(o):
    if isinstance(o, dict):
        return {k: make_json_safe(v) for k, v in o.items()}
    elif isinstance(o, list):
        return [make_json_safe(x) for x in o]
    elif isinstance(o, datetime):
        return o.isoformat()
    elif isinstance(o, Undefined):
        return None
    else:
        try:
            json.dumps(o)
            return o
        except:
            return str(o)
