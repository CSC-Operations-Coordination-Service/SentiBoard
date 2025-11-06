import json
import ast
from datetime import datetime, timedelta, timezone
import logging
from apps.utils import date_utils
from dateutil.relativedelta import relativedelta
import logging
from apps.models.anomalies import Anomalies
from jinja2 import Undefined
from flask import current_app

logger = logging.getLogger(__name__)


VALID_PREFIXES = ("S1", "S2", "S3", "S5P")
THRESHOLD_FULL = 90
THRESHOLD_OK = 80
THRESHOLD_PARTIAL = 10


# --- Date helpers ---


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


# --- Satellite & datatake helpers ---


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
    return ""  # fallback if nothing valid


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


# --- Core event builder ---


def build_event_instance(a, logger=None):

    # Parse start/end time from publicationDate
    date_str = a.get("publicationDate")
    start_date = None
    if date_str:
        start_date = to_utc(date_str)
    else:
        start_date = datetime.now(timezone.utc)

    end_date = start_date + timedelta(minutes=1)

    # Impacted satellite: prefer provided, otherwise derive from environment
    impacted_satellite = get_impacted_satellite(a)

    category = a.get("category", "Unknown")

    datatakes = parse_datatakes_completeness(a.get("datatakes_completeness"))
    current_app.logger.info(f"[PARSE DATATAKES COMPLETENESS]: {datatakes}")

    datatake_ids = []
    valid_datatakes = []
    any_ok = False
    any_failed = False
    any_partial = False

    for dtObj in datatakes:
        parsed = dtObj
        if isinstance(parsed, str):
            parsed = parsed.strip()
            parsed_obj = None
            try:
                parsed_obj = json.loads(parsed.replace("'", '"'))
                if logger:
                    logger.info(f"[PARSED DATATAKE STRING] {parsed}")
            except Exception:
                try:
                    parsed_obj = ast.literal_eval(parsed)
                except Exception:
                    parsed_obj = None
            parsed = parsed_obj if parsed_obj is not None else parsed

        if isinstance(parsed, list):
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                inner = item

                datatake_id = inner.get("datatakeID")
                values = []
                if datatake_id:
                    if not any(datatake_id.startswith(p) for p in VALID_PREFIXES):
                        continue
                    if datatake_id not in datatake_ids:
                        datatake_ids.append(datatake_id)
                    values = [inner.get("L0_"), inner.get("L1_"), inner.get("L2_")]
                    values = [v for v in values() if isinstance(v, (int, float))]
                    if not values:
                        continue
                    completeness = calc_completeness(values)
                    if completeness >= THRESHOLD_FULL:
                        continue
                    if THRESHOLD_OK <= completeness < THRESHOLD_FULL:
                        status = "ok"
                        any_ok = True
                    elif THRESHOLD_PARTIAL <= completeness < THRESHOLD_OK:
                        status = "partial"
                        any_partial = True
                        any_failed = any_failed or False
                    elif 0 <= completeness < THRESHOLD_PARTIAL:
                        status = "failed"
                        any_failed = True
                    else:
                        continue

                    valid_datatakes.append(
                        {
                            "datatake_id": datatake_id,
                            "values": values,
                            "completeness": completeness,
                            "status": status,
                        }
                    )
                else:
                    for key, val in inner.items():
                        candidate_id = key
                        if not any(candidate_id.startswith(p) for p in VALID_PREFIXES):
                            pass

                        if candidate_id not in datatake_ids and isinstance(
                            candidate_id, str
                        ):
                            datatake_ids.append(candidate_id)

                        values2 = []
                        if isinstance(val, dict):
                            for v in val.values():
                                if instance(v, (int, float)):
                                    values2.append(v)
                        elif isinstance(val, (int, float)):
                            values2.append(val)
                        if not values2:
                            continue
                        completeness = calc_completeness(values2)
                    if completeness >= THRESHOLD_FULL:
                        continue
                    if THRESHOLD_OK <= completeness < THRESHOLD_FULL:
                        status = "ok"
                        any_ok = True
                    elif THRESHOLD_PARTIAL <= completeness < THRESHOLD_OK:
                        status = "partial"
                        any_partial = True
                        any_failed = any_failed or False
                    elif 0 <= completeness < THRESHOLD_PARTIAL:
                        status = "failed"
                        any_failed = True
                    else:
                        continue

                    valid_datatakes.append(
                        {
                            "datatake_id": candidate_id,
                            "values": values2,
                            "completeness": completeness,
                            "status": status,
                        }
                    )

            continue
        if not isinstance(parsed, dict):
            continue

        # --- parsed is a dict: determine old vs new format ---
        # new format has datatakeID field
        dtid = parsed.get("datatakeID")
        if dtid:
            if not any(dtid.startswith(p) for p in VALID_PREFIXES):
                # skip irrelevant prefixes
                continue
            if dtid not in datatake_ids:
                datatake_ids.append(dtid)
            values = [parsed.get("L0_"), parsed.get("L1_"), parsed.get("L2_")]
            values = [v for v in values if isinstance(v, (int, float))]

            if not values:
                continue
            completeness = calc_completeness(values)

            if completeness >= THRESHOLD_FULL:
                continue
            if THRESHOLD_OK <= completeness < THRESHOLD_FULL:
                status = "ok"
                any_ok = True
            elif THRESHOLD_PARTIAL <= completeness < THRESHOLD_OK:
                status = "partial"
                any_partial = True
                any_failed = any_failed or False
            elif 0 <= completeness < THRESHOLD_PARTIAL:
                status = "failed"
                any_failed = True
            else:
                continue

            valid_datatakes.append(
                {
                    "datatake_id": dtid,
                    "values": values,
                    "completeness": completeness,
                    "status": status,
                }
            )
        else:
            # old format: keys -> values
            for key, val in parsed.items():
                candidate_id = key
                if candidate_id not in datatake_ids and isinstance(candidate_id, str):
                    datatake_ids.append(candidate_id)
                values = []
                if isinstance(val, dict):
                    for v in val.values():
                        if isinstance(v, (int, float)):
                            values.append(v)
                elif isinstance(val, (int, float)):
                    values.append(val)
                # compute completeness
                if not values:
                    continue
                completeness = calc_completeness(values)

                if completeness >= THRESHOLD_FULL:
                    continue
                if THRESHOLD_OK <= completeness < THRESHOLD_FULL:
                    status = "ok"
                    any_ok = True
                elif THRESHOLD_PARTIAL <= completeness < THRESHOLD_OK:
                    status = "partial"
                    any_partial = True
                    any_failed = any_failed or False
                elif 0 <= completeness < THRESHOLD_PARTIAL:
                    status = "failed"
                    any_failed = True
                else:
                    continue
                valid_datatakes.append(
                    {
                        "datatake_id": candidate_id,
                        "values": values,
                        "completeness": completeness,
                        "status": status,
                    }
                )

    # overall_status: failed > partial > ok (JS-like semantics)
    overall_status = "unknown"
    if any_failed:
        overall_status = "failed"
    elif any_partial:
        overall_status = "partial"
    elif any_ok:
        overall_status = "ok"

    full_recover = overall_status == "ok"
    partial_recover = overall_status == "partial"

    # color mapping (you can tune hexes)
    color = "#31ce36" if full_recover else ("#F9A825" if partial_recover else "#D32F2F")

    if datatake_ids and not valid_datatakes:
        if logger:
            logger.info(
                f"[SKIP EVENT] {a.get('key')} - has datatake id's but not completeness data"
            )
        return None

    if not datatake_ids and not valid_datatakes:
        if logger:
            logger.info(
                f"[SKIP EVENT] {a.get('key')} - no datatake id's information available"
            )
        return None

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
        "datatakes_completeness": valid_datatakes,
    }

    if logger:
        logger.info(f"[EVENT INSTANCE BUILT] {json.dumps(instance, indent=2)}")

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
