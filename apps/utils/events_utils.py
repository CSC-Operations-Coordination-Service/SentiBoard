import json
import ast
from datetime import datetime, timedelta, timezone
import logging
from apps.utils import date_utils
from dateutil.relativedelta import relativedelta
import logging
from apps.models.anomalies import Anomalies
import apps.cache.modules.datatakes as datatakes_cache
from apps.elastic.modules.datatakes import (
    _calc_s1_datatake_completeness,
    _calc_s2_datatake_completeness,
    _calc_s3_datatake_completeness,
    _calc_s5_datatake_completeness,
    _calc_datatake_completeness_status,
)
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
    dt_id = dt.get("id") or dt.get("datatake_id")
    if not dt_id:
        return dt

    full_details = datatakes_cache.load_datatake_details(dt_id) or {}

    is_list = isinstance(full_details, list)

    # 1. Normalize the data structure for legacy functions
    if is_list:
        prod_list = []
        for item in full_details:
            if isinstance(item, dict) and "_source" in item:
                prod_list.append(item)
            else:
                prod_list.append({"_source": item})
    else:
        source_content = full_details.get("_source", full_details)
        prod_list = [{"_source": source_content, "_id": dt_id}]

    if not prod_list:
        return dt

    src = prod_list[0]["_source"]

    comp_levels = {}

    # 2. Mission-Specific Calculation Logic
    mission = dt_id.upper()
    try:
        if "S1" in mission:
            comp_levels = _calc_s1_datatake_completeness(prod_list[0])
        elif "S2" in mission:
            comp_levels = _calc_s2_datatake_completeness(prod_list[0])
        elif "S3" in mission:
            comp_levels = _calc_s3_datatake_completeness(prod_list)
        elif "S5" in mission:
            comp_levels = _calc_s5_datatake_completeness(prod_list)

        # 3. Merge calculated levels into src for the Status Calculator
        src.update(comp_levels)

        # 4. Calculate Status (needs 'satellite_unit' and 'observation_time_stop' in src)
        # Ensure mission-critical fields are in src if they were missing
        if "satellite_unit" not in src:
            src["satellite_unit"] = dt_id[:3].upper()

        if "S1" in mission or "S2" in mission:
            unique_products = {}
            for k, v in src.items():
                if k.endswith("_local_percentage"):
                    p_type = k.replace("_local_percentage", "")
                    unique_products[p_type] = round(v, 2)

            # Convert unique dictionary back to the list the JS expects
            sorted_products = [
                {"productType": pt, "status": val}
                for pt, val in unique_products.items()
            ]

            # Sort using your helper: L0 -> L1 -> L2 -> OUT_OF_MONITORING
            sorted_products.sort(
                key=lambda x: get_product_level_python(x.get("productType", ""))
            )

            # Overwrite the list to ensure NO duplicates are sent to frontend
            src["completeness_list"] = sorted_products
            if "products" in src:
                del src["products"]

        status_obj = _calc_datatake_completeness_status(src)

        acq_status_upper = str(status_obj["ACQ"]["status"]).upper()
        pub_status_upper = str(status_obj["PUB"]["status"]).upper()

        # 5. Final Update
        dt.update(
            {
                "acquisition_status": acq_status_upper,
                "publication_status": pub_status_upper,
                "completeness_status": status_obj,
                "raw": src,
            }
        )

        dt["raw"]["completeness_status"] = status_obj

    except Exception as e:
        # Log error but return partial dt so the page doesn't crash
        print(f"Error enriching {dt_id}: {e}")

    # print(f"DEBUG: {dt_id} list size: {len(src.get('completeness_list', []))}")

    return dt


def get_product_level_python(product_type):
    """Replicates the JS getProductLevel logic for sorting S1/S2"""
    if not product_type or product_type == "OUT_OF_MONITORING":
        return 99

    # 1. Direct check for common S2 levels that might miss the regex
    if "_L1C" in product_type:
        return 1
    if "_L2A" in product_type:
        return 2
    if "_L0_" in product_type:
        return 0

    # 2. Match the level (e.g., IW_RAW__0S -> 0, MSD_L1B___ -> 1)
    # Improved regex to look for the digit specifically after the double underscore
    match = re.search(r"__([0-9A-Z])", product_type)
    if match:
        lvl = match.group(1)
        if lvl.isdigit():
            return int(lvl)
        if lvl == "A":  # Handle Level-3 or specialized 'A' products
            return 3
        if lvl == "S":
            return 0

    # 3. Sentinel-1 specific defaults for processed products
    if any(prefix in product_type for prefix in ["GRDH", "ETA", "OCN", "SLC"]):
        return 2

    return 98


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


def find_undefined_paths(obj, path="root"):
    """Recursively log paths containing Undefined values."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_path = f"{path}.{k}"
            if isinstance(v, Undefined):
                logger.error(f"[UNDEFINED] Found at {new_path}")
            find_undefined_paths(v, new_path)
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            new_path = f"{path}[{idx}]"
            if isinstance(v, Undefined):
                logger.error(f"[UNDEFINED] Found at {new_path}")
            find_undefined_paths(v, new_path)


import re
