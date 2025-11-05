# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear}
All rights reserved.

This document discloses subject matter in which SERCO has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of SERCO to fulfill the purpose for which the document was
delivered to him.
"""

from flask import render_template, request, current_app, Response, abort
from flask_login import current_user, login_required
from jinja2 import TemplateNotFound
from urllib.parse import urlparse, urljoin
from apps.routes.home import blueprint
from apps.elastic.modules import datatakes as datatakes_module
from functools import wraps
from apps.models import anomalies as anomalies_model
import apps.cache.modules.events as events_cache
from apps.utils import date_utils
from apps.utils.anomalies_utils import model_to_dict
from datetime import datetime, date, timedelta, timezone
from dateutil.relativedelta import relativedelta
from dateutil.parser import parse as parse_date
from calendar import monthrange
from apps import flask_cache
import os
import json
from flask import jsonify
import traceback
import logging
import re
import ast
from jinja2 import Undefined

logger = logging.getLogger(__name__)

VALID_PREFIXES = ("S1", "S2", "S3", "S5P")
THRESHOLD_FULL = 90
THRESHOLD_OK = 80
THRESHOLD_PARTIAL = 10


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
        try:
            start_date = datetime.fromisoformat(date_str)
        except ValueError:
            try:
                start_date = datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S")
            except Exception:
                if logger:
                    logger.warning(
                        f"[build_event_instance] Invalid date '{date_str}', using now()."
                    )
                start_date = datetime.now(timezone.utc)
    else:
        start_date = datetime.now(timezone.utc)

    end_date = start_date + timedelta(minutes=1)

    # Impacted satellite: prefer provided, otherwise derive from environment
    impacted_satellite = a.get("impactedSatellite") or ""
    if not impacted_satellite:
        env = a.get("environment", "")
        if isinstance(env, str) and "-" in env:
            impacted_satellite = env.split("-")[0].strip()

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


def safe_get(val, default=""):
    if val is None or isinstance(val, Undefined):
        return default
    return val


def admin_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if getattr(current_user, "role", None) not in ("admin", "ecuser", "esauser"):
            return abort(403)
        return f(*args, **kwargs)

    return decorated


@blueprint.route("/index")
def index():
    segment = "index"
    period_id = "24h"

    anomalies_api_uri = events_cache.anomalies_cache_key.format("last", period_id)
    anomalies_data = flask_cache.get(anomalies_api_uri) or []
    now = datetime.now(timezone.utc)
    anomalies_details = []
    for item in anomalies_data:
        event_time_str = item.get("time")
        if not event_time_str:
            continue
        try:
            event_time = datetime.fromisoformat(event_time_str)
        except Exception as e:
            current_app.logger.warning(
                "Invalid datetime format in event: %s (%s)", item, e
            )
            continue

        diff = now - event_time
        if diff.days >= 1:
            time_ago = f"{diff.days} day(s) ago"
        elif diff.seconds >= 3600:
            time_ago = f"{diff.seconds // 3600 } hour(s) ago"
        else:
            time_ago = f"{diff.seconds // 60 } minute(s) ago"

        anomalies_details.append(
            {
                "time_ago": time_ago,
                "content": item.get("content", "No details available"),
            }
        )

    return render_template(
        "home/index.html", segment=segment, anomalies_details=anomalies_details
    )


@blueprint.route("/events")
def events():
    from datetime import datetime, date, timedelta, timezone
    from calendar import monthrange
    import json, re, ast

    today = datetime.today()
    year = request.args.get("year", type=int, default=today.year)
    month = request.args.get("month", type=int, default=today.month)

    icon_map = {
        "acquisition": "fas fa-broadcast-tower",
        "calibration": "fas fa-compass",
        "manoeuvre": "/static/assets/img/joystick.svg",
        "production": "fas fa-cog",
        "satellite": "fas fa-satellite-dish",
    }

    event_type_map = {
        "acquisition": "acquisition",
        "calibration": "calibration",
        "data access": "data-access",
        "manoeuvre": "manoeuvre",
        "production": "production",
        "satellite": "satellite",
    }

    valid_prefixes = ("S1", "S2", "S3", "S5")
    quarter_authorized = current_user.is_authenticated and current_user.role in (
        "admin",
        "ecuser",
        "esauser",
    )

    # Load cached anomalies
    if quarter_authorized:
        events_cache.load_anomalies_cache_previous_quarter()
        cache_key = events_cache.anomalies_cache_key.format("previous", "quarter")
    else:
        events_cache.load_anomalies_cache_last_quarter()
        cache_key = events_cache.anomalies_cache_key.format("last", "quarter")

    cache_entry = events_cache.flask_cache.get(cache_key)
    raw_anomalies = json.loads(cache_entry.data) if cache_entry else []

    # --- Serialize anomalies ---
    def serialize_anomaly(a):
        source = a.get("_source", a if isinstance(a, dict) else {})
        iso_date = (
            source.get("occurence_date")
            or source.get("occurrence_date")
            or source.get("publicationDate")
            or source.get("created")
        )
        if isinstance(iso_date, datetime):
            iso_date = iso_date.isoformat()

        dt_ids = (
            source.get("datatake_ids")
            or source.get("datatakes")
            or source.get("datatakes_ids_raw")
            or []
        )
        if isinstance(dt_ids, str):
            dt_ids = [s.strip() for s in re.split(r"[;,]\s*", dt_ids) if s.strip()]

        environment = ";".join(dt_ids) if dt_ids else source.get("environment") or ""
        origin = source.get("origin")
        category = source.get("category") or origin or source.get("type") or "Unknown"

        # Normalize category
        mapping = {
            "Satellite": "Platform",
            "Production": "Production",
            "DD": "Data access",
            "LTA": "Archive",
            "Acquisition": "Acquisition",
            "RFI": "Acquisition",
            "CAM": "Manoeuvre",
        }
        category = mapping.get(origin, category)
        if category.strip().lower() in ("other", "unknown", ""):
            return None

        dt_completeness = source.get("datatakes_completeness") or []
        return {
            "key": source.get("key") or source.get("id") or a.get("_id"),
            "publicationDate": iso_date,
            "environment": environment,
            "datatakes_ids": dt_ids,
            "datatakes_completeness": dt_completeness,
            "category": category,
            "impactedSatellite": source.get("affected_systems")
            or source.get("impactedSatellite")
            or "",
            "description": source.get("description", ""),
            "status": source.get("status", ""),
            "newsLink": source.get("url") or source.get("newsLink", ""),
            "newsTitle": source.get("title") or source.get("newsTitle", ""),
            "_raw_source": source,
        }

    anomalies = [s for a in raw_anomalies if (s := serialize_anomaly(a)) is not None]

    # --- Normalize datatakes_completeness ---
    for a in anomalies:
        dtc = a.get("datatakes_completeness")
        if isinstance(dtc, str):
            try:
                dtc = ast.literal_eval(dtc)
            except Exception:
                dtc = []
        elif not isinstance(dtc, list):
            dtc = []
        a["datatakes_completeness"] = dtc

    # --- Filtering functions ---
    def has_valid_datatake(a):
        env = a.get("environment", "")
        if not env or env.lower().startswith("no"):
            return False
        datatakes = [s.strip() for s in re.split(r"[;,]\s*", env) if s.strip()]
        return any(
            dt.startswith(prefix) for dt in datatakes for prefix in valid_prefixes
        )

    def has_relevant_datatakes(a):
        return any(
            isinstance(dt, dict) and dt.get("datatakeID")
            for dt in a.get("datatakes_completeness", [])
        )

    def has_impacted_satellite(a):
        return bool(a.get("impactedSatellite", "").strip())

    anomalies = [
        a
        for a in anomalies
        if has_valid_datatake(a)
        and (has_relevant_datatakes(a) or has_impacted_satellite(a))
    ]

    # --- Load datatakes ---
    datatakes_data = (
        datatakes_module.fetch_anomalies_datatakes_prev_quarter()
        if quarter_authorized
        else datatakes_module.fetch_anomalies_datatakes_last_quarter()
    )
    datatakes_by_id = {}
    for d in datatakes_data:
        src = d.get("_source", {})
        dt_id = src.get("datatake_id")
        if dt_id:
            datatakes_by_id[dt_id] = {
                "datatakeID": dt_id,
                "L0_": src.get("L0_")
                or src.get("completeness_status", {}).get("ACQ", {}).get("percentage"),
                "L1_": src.get("L1_"),
                "L2_": src.get("L2_")
                or src.get("completeness_status", {}).get("PUB", {}).get("percentage"),
                "instrument_mode": src.get("instrument_mode"),
                "satellite_unit": src.get("satellite_unit"),
            }

    # --- Build anomalies by date & check missing datatakes ---
    anomalies_by_date = {}
    missing_datatakes_info = []

    for a in anomalies:
        iso_date = a.get("publicationDate")
        if not iso_date:
            continue
        date_key = (
            iso_date[:10] if isinstance(iso_date, str) else iso_date.date().isoformat()
        )
        env = a.get("environment", "")
        dt_ids = [s.strip() for s in re.split(r"[;,]\s*", env) if s.strip()]
        missing = [dt for dt in dt_ids if dt not in datatakes_by_id]
        if missing:
            missing_datatakes_info.append(
                {"anomaly_key": a.get("key"), "missing_ids": missing}
            )
        anomalies_by_date.setdefault(date_key, []).append(a)

    seen_envs = set()
    calendar_events = []
    for a in anomalies:
        env = a.get("environment")
        if env in seen_envs:
            continue
        seen_envs.add(env)
        instance = build_event_instance(a, current_app.logger)
        if not instance:
            current_app.logger.warning(
                f"[SKIP EVENT] instance returned None for {a.get('key')}"
            )
            continue
        if not instance.get("fullRecover"):
            calendar_events.append(instance)

    # --- Month info ---
    days_in_month = monthrange(year, month)[1]
    first_day_offset = date(year, month, 1).weekday()
    month_name = date(year, month, 1).strftime("%B")

    return render_template(
        "home/events.html",
        current_month=month,
        current_year=year,
        current_month_name=month_name,
        days_in_month=days_in_month,
        first_day_offset=first_day_offset,
        anomalies_by_date=anomalies_by_date,
        json_anomalies=anomalies,
        json_events=calendar_events,
        json_datatakes=datatakes_data,
        quarter_authorized=quarter_authorized,
        icon_map=icon_map,
        event_type_map=event_type_map,
        missing_datatakes_info=missing_datatakes_info,
    )


@blueprint.route("/events_data")
def events_data():
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    if not year or not month:
        return jsonify({"error": "Missing year or month"}), 400

    try:
        quarter_authorized = current_user.is_authenticated and current_user.role in (
            "admin",
            "ecuser",
            "esauser",
        )
        if quarter_authorized:
            events_cache.load_anomalies_cache_previous_quarter()
            cache_key = events_cache.anomalies_cache_key.format("previous", "quarter")
        else:
            events_cache.load_anomalies_cache_last_quarter()
            cache_key = events_cache.anomalies_cache_key.format("last", "quarter")

        cache_entry = events_cache.flask_cache.get(cache_key)
        raw_anomalies = json.loads(cache_entry.data) if cache_entry else []

        if raw_anomalies:
            current_app.logger.info(
                f"[RAW] First anomaly: {json.dumps(raw_anomalies[0], indent=2)}"
            )

        def serialize_anomalie(a):
            src = a.get("_source", a)
            date_str = (
                src.get("occurence_date")
                or src.get("occurrence_date")
                or src.get("publicationDate")
                or src.get("created")
            )
            if isinstance(date_str, datetime):
                date_str = date_str.isoformat()

            environment = src.get("environment", "")
            impacted_satellite = ""
            if environment:
                impacted_satellite = environment.split(";")[0].split("-")[0].strip()

            if not any(impacted_satellite.startswith(p) for p in VALID_PREFIXES):
                current_app.logger.info(
                    f"[SKIP serialize_anomalie] Non-Sx prefix: '{impacted_satellite}' | env = '{environment}'"
                )
                return None

            datatakes_completeness = src.get("datatakes_completeness", [])
            if isinstance(datatakes_completeness, str):
                try:
                    datatakes_completeness = json.loads(
                        datatakes_completeness.replace("'", '"')
                    )
                except Exception:
                    datatakes_completeness = []

            return {
                "key": safe_get(src.get("key")) or safe_get(src.get("id")),
                "category": src.get("category") or src.get("type") or "Unknown",
                "environment": src.get("environment", ""),
                "publicationDate": date_str,
                "description": src.get("description", ""),
                "impactedSatellite": impacted_satellite,
                "datatakes_completeness": datatakes_completeness,
            }

        anomalies = []
        for a in raw_anomalies:
            serialized = serialize_anomalie(a)
            if serialized:
                anomalies.append(serialized)
            else:
                current_app.logger.info("[SKIPPED] anomaly filtered by prefix")
        events = []
        anomalies_by_date = {}

        for a in anomalies:
            instance = build_event_instance(a, current_app.logger)
            if not instance:
                continue
            current_app.logger.info(
                f"[EVENT INSTANCE] {json.dumps(instance, indent=2)}"
            )

            date_str = instance.get("from") or instance.get("publicationDate")
            if not date_str:
                current_app.logger.info(f"Skipping instance without 'from': {instance}")
                continue
            try:
                dt = datetime.fromisoformat(instance["from"][:10])
            except Exception:
                current_app.logger.info(f"invalid date format in instance: {instance}")
                continue

            if dt.year == year and dt.month == month:
                date_key = dt.strftime("%Y-%m-%d")
                anomalies_by_date.setdefault(date_key, []).append(instance)
                events.append(instance)

        current_app.logger.info(
            f"[FILTERED] Total events for {month}/{year}: {len(events)}"
        )
        current_app.logger.info(
            f"[FILTERED] Anomalies by date keys: {list(anomalies_by_date.keys())}"
        )

        # Print full content per date for debugging
        for k, v in anomalies_by_date.items():
            if not isinstance(v, list):
                current_app.logger.info(f"Anomalies for {k} is not a list: {v}")
            else:
                current_app.logger.info(
                    f"Anomalies for {k} is a list with {len(v)} items:"
                )
                for i, item in enumerate(v):
                    current_app.logger.info(f"  [{i}] {json.dumps(item, indent=2)}")

        current_app.logger.info(
            "[FINAL RESPONSE] "
            + json.dumps(
                {
                    "year": year,
                    "month": month,
                    "anomalies_by_date": anomalies_by_date,
                    "count": sum(len(v) for v in anomalies_by_date.values()),
                    "events": events,
                },
                indent=2,
            )
        )
        return jsonify(
            {
                "year": year,
                "month": month,
                "anomalies_by_date": anomalies_by_date,
                "count": sum(len(v) for v in anomalies_by_date.values()),
                "events": events,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error in /events_data: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@blueprint.route("/<template>")
def route_template(template):
    try:
        if not template.endswith(".html"):
            template += ".html"

        # Detect the current page
        segment = get_segment(request)

        # List of admin pages
        admin_pages = ["users.html", "roles.html", "news.html", "anomalies.html"]

        # Handle admin pages
        if template in admin_pages:
            return render_template("admin/" + template, segment=segment)

        # Special case: events page
        if template in ["events", "events.html"]:
            # Determine if the user is quarter authorized
            return events()

        # Default: serve page from home
        return render_template("home/" + template, segment=segment)

    except TemplateNotFound:
        return render_template("home/page-404.html"), 404

    except Exception as e:
        current_app.logger.exception(e)
        return render_template("home/page-500.html"), 500


# Helper - Extract current page name from request
def get_segment(request):
    try:

        segment = request.path.split("/")[-1]

        if segment == "":
            segment = "index"

        return segment

    except:
        return None


def is_safe_url(target):
    # Prevent open redirects
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ("http", "https") and ref_url.netloc == test_url.netloc


@blueprint.route("/admin/message", methods=["GET"])
def admin_home_message():
    try:
        # This empty object is used to populate the form initially
        empty_message = {
            "title": "",
            "text": "",
            "link": "",
            "messageType": "info",
            "publicationDate": "",
        }

        return render_template(
            "admin/newMessages.html", message=empty_message, segment="admin-message"
        )

    except Exception as e:
        current_app.logger.error(
            "Exception in admin_home_message: %s", traceback.format_exc()
        )
        return f"An error occurred: {e}", 500
