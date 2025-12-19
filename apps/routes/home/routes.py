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

from flask import (
    render_template,
    request,
    current_app,
    abort,
    jsonify,
    session,
    redirect,
    url_for,
    Response,
    flash,
)
from flask_login import current_user, login_required
from jinja2 import TemplateNotFound
from urllib.parse import urlparse, urljoin
from apps.routes.home import blueprint
from functools import wraps
import apps.cache.modules.acquisitions as acquisitions_cache
import apps.cache.modules.events as events_cache
import apps.cache.modules.datatakes as datatakes_cache
import apps.cache.modules.acquisitionplans as acquisition_plans_cache
import apps.cache.modules.acquisitionassets as acquisition_assets_cache
import apps.models.instant_messages as instant_messages_model
import apps.utils.auth_utils as auth_utils
import apps.utils.acquisitions_utils as acquisitions_utils
import apps.cache.modules.unavailability as unavailability_cache
from apps.utils.date_utils import format_pub_date
from datetime import datetime, date, timezone, timedelta
from dateutil import parser
from calendar import monthrange
from apps import flask_cache, db
from collections import Counter
import json
import requests
import time
import logging
import math
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

LOCAL_TZ = ZoneInfo("Europe/Rome")

from apps.utils.events_utils import (
    build_event_instance,
    get_impacted_satellite,
    to_utc,
    to_utc_iso,
    safe_get,
    load_cache_as_list,
    safe_value,
    safe_json_value,
    replace_undefined,
    datatake_sort_key,
    enrich_datatake,
    make_json_safe,
    find_undefined_paths,
)

PAGE_METADATA = {
    "index.html": {
        "title": "Copernicus Sentinel Operations Dashboard",
        "description": "Explore real-time satellite events, data availability, and acquisition status from ESA's Copernicus Sentinels. Stay informed with the comprehensive Sentiboard.",
        "page_keywords": [
            "Copernicus Sentinel Dashboard",
            "Sentiboard",
            "real-time satellite data",
            "ESA operations dashboard",
            "Sentinel mission monitoring",
            "Copernicus events",
            "data availability",
            "acquisition status",
            "Earth observation platform",
            "satellite event tracker",
            "Copernicus Sentinel missions",
        ],
    },
    "about.html": {
        "title": "About Copernicus",
        "description": "Discover how the Sentiboard enables real-time monitoring of Sentinel satellite missions, data delivery, and Earth observation event tracking.",
        "page_keywords": [
            "About Copernicus Dashboard",
            "Sentiboard",
            "Copernicus Sentinel missions",
            "ESA Earth observation",
            "satellite data services",
            "real-time satellite monitoring",
            "Sentinel data availability",
            "acquisition status",
            "Earth observation platform",
            "satellite event tracker",
        ],
    },
    "acquisitions-status.html": {
        "title": "Sentinel Acquisitions Map",
        "description": "Explore Sentinel satellite acquisition plans on the Sentiboard's real-time 3D globe. Filter by satellite, date, or datatake and view sensing timelines and coverage.",
        "page_keywords": [
            "Sentinels Acquisition Status",
            "Sentiboard",
            "satellite acquisition planning",
            "Copernicus sensing scenarios",
            "Sentinel-1 orbit data",
            "Sentinel-2 acquisition map",
            "real-time satellite tracking",
            "Copernicus observation schedule",
        ],
    },
    "events.html": {
        "title": "Sentinel Event Viewer",
        "description": "Browse Sentinel event logs including anomalies, calibrations, and manoeuvres on the Sentiboard. See how real-time mission events affect satellite data availability.",
        "page_keywords": [
            "Sentinel events",
            "Sentiboard",
            "Sentinels Events/real-time events",
            "satellite anomalies",
            "calibration activities",
            "mission manoeuvres",
            "Copernicus event log",
            "Sentinel data production impacts",
            "real-time satellite operations",
        ],
    },
    "data-availability.html": {
        "title": "Copernicus Sentinel Data Availability",
        "description": "Explore real-time data availability and completeness for Copernicus Sentinel satellite missions using the Sentiboard. Monitor delivery status, publication percentages, and filter by satellite or mission.",
        "page_keywords": [
            "Sentinels Data Availability",
            "Sentiboard",
            "Copernicus data availability",
            "Sentinel data access",
            "satellite data products",
            "real-time Earth observation data",
            "Copernicus collections",
            "Sentinel data quality monitoring",
        ],
    },
    "processors-viewer.html": {
        "title": "Processor Releases Timeline",
        "description": "Use the Sentiboard to browse the release history of Copernicus Sentinel processors using an interactive timeline. Click for details on each processor version.",
        "page_keywords": [
            "Sentinels Processors",
            "Copernicus processing chain",
            "Sentiboard",
            "data release timeline",
            "ESA processor versions",
            "satellite data processing updates",
        ],
    },
}
# Default fallback metadata for any page not listed above:
DEFAULT_PAGE_METADATA = {
    "title": "Copernicus Sentinel Operations Dashboard",
    "description": "Explore real-time satellite events, data availability, and acquisition status from ESA's Copernicus Sentinels. Stay informed with the comprehensive Sentiboard.",
    "page_keywords": [
        "Copernicus Sentinel Dashboard",
        "Sentiboard",
        "real-time satellite data",
        "ESA operations dashboard",
        "Sentinel mission monitoring",
        "Copernicus events",
        "data availability",
        "acquisition status",
        "Earth observation platform",
        "satellite event tracker",
        "Copernicus Sentinel missions",
    ],
}

BATCH_SIZE = 10

PERIOD_TO_CACHE = {
    "day": "24h",
    "week": "7d",
    "month": "30d",
    "prev-quarter": "previous-quarter",
}


def get_metadata(template):
    return PAGE_METADATA.get(template, DEFAULT_PAGE_METADATA)


def admin_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if getattr(current_user, "role", None) not in ("admin", "ecuser", "esauser"):
            return abort(403)
        return f(*args, **kwargs)

    return decorated


@blueprint.route("/index.html")
def index_html_redirect():
    return redirect(url_for("home_blueprint.index"))


@blueprint.route("/index")
def index():

    metadata = get_metadata("index.html")
    metadata["page_url"] = request.url
    segment = "index"
    period_id = "7d"

    ALLOWED_SATELLITES = {
        "S1A",
        "S1C",
        "S2A",
        "S2B",
        "S2C",
        "S3A",
        "S3B",
        "S5P",
    }

    # Build the cache key
    anomalies_api_uri = events_cache.anomalies_cache_key.format("last", period_id)
    current_app.logger.info(f"[INDEX] starting here")
    # current_app.logger.info(f"[INDEX] using cache key: {anomalies_api_uri}")

    # Get and inspect cache content
    raw_cache = flask_cache.get(anomalies_api_uri)
    current_app.logger.info(f"[INDEX] Cache content raw type: {type(raw_cache)}")
    current_app.logger.info(
        f"[INDEX] Cache raw content preview: {str(raw_cache)[:400]}"
    )

    # ---- SAFE CACHE HANDLING ----
    anomalies_data = []

    if raw_cache is None:
        current_app.logger.warning(
            "[INDEX] Cache empty or missing for %s", anomalies_api_uri
        )

    elif hasattr(raw_cache, "get_json"):  # Flask Response
        try:
            anomalies_data = raw_cache.get_json() or []
            current_app.logger.info(
                f"[INDEX] Parsed JSON from Response: {len(anomalies_data)} items"
            )
        except Exception as e:
            current_app.logger.warning(f"[INDEX] Failed to parse Response JSON: {e}")

    elif isinstance(raw_cache, (bytes, str)):
        try:
            anomalies_data = json.loads(raw_cache) or []
            current_app.logger.info(
                f"[INDEX] Parsed raw JSON string: {len(anomalies_data)} items"
            )
        except Exception as e:
            current_app.logger.warning(f"[INDEX] Failed to decode JSON string: {e}")

    elif isinstance(raw_cache, list):
        anomalies_data = raw_cache
        current_app.logger.info(
            f"[INDEX] Using cached list: {len(anomalies_data)} items"
        )

    else:
        current_app.logger.warning(f"[INDEX] Unknown cache type {type(raw_cache)}")

    current_app.logger.info(f"[INDEX] Total anomalies read: {len(anomalies_data)}")

    now = datetime.now(timezone.utc)
    anomalies_details = []

    SATELLITE_DISPLAY_NAMES = {
        "S1A": "Copernicus Sentinel-1A",
        "S1C": "Copernicus Sentinel-1C",
        "S2A": "Copernicus Sentinel-2A",
        "S2B": "Copernicus Sentinel-2B",
        "S2C": "Copernicus Sentinel-2C",
        "S3A": "Copernicus Sentinel-3A",
        "S3B": "Copernicus Sentinel-3B",
        "S5P": "Copernicus Sentinel-5P",
    }

    for idx, item in enumerate(anomalies_data):
        if not isinstance(item, dict):
            current_app.logger.warning(
                f"[INDEX] Skipping invalid anomaly at index {idx}: {item}"
            )
            continue

        event_time_str = item.get("start")

        if not event_time_str:
            current_app.logger.warning(
                f"[INDEX] Missing 'time' field in item {idx}: {item} "
            )
            continue

        try:
            if isinstance(event_time_str, str):
                try:
                    # try ISO format first (e.g. "2025-11-06T16:41:41")
                    event_time = datetime.fromisoformat(event_time_str)
                except ValueError:
                    # fallback to European style: "06/11/2025 16:41:41"
                    event_time = datetime.strptime(event_time_str, "%d/%m/%Y %H:%M:%S")
            elif isinstance(event_time_str, (int, float)):
                event_time = datetime.fromtimestamp(event_time_str, timezone.utc)
            else:
                event_time = event_time_str
        except Exception as e:
            current_app.logger.warning(
                f"[INDEX] Invalid datetime in item {idx}: {event_time_str} ({e})"
            )
            continue

        # Ensure event_time is timezone-aware
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=LOCAL_TZ)

        event_time = event_time.astimezone(timezone.utc)

        diff = now - event_time
        total_hours = diff.total_seconds() / 3600
        days = int(total_hours // 24)
        hours = int(total_hours % 24)
        minutes = int((diff.total_seconds() % 3600) // 60)

        if days >= 1:
            time_ago = f"{days} day(s)"
            if hours > 0:
                time_ago += f", {hours} hour(s)"
        elif total_hours >= 1:
            time_ago = f"{round(total_hours)} hour(s)"
        else:
            time_ago = f"{minutes} minute(s)"

        category = item.get("category", "Unknown")

        raw_impacted_sat = item.get("impactedSatellite")

        # Skip missing or empty
        if not raw_impacted_sat:
            current_app.logger.info(
                f"[INDEX] Skipping anomaly without impactedSatellite at index {idx}"
            )
            continue

        impacted_sat = (
            raw_impacted_sat.replace("Copernicus", "")
            .replace("Sentinel-", "S")
            .replace("Sentinel ", "S")
            .replace("-", "")
            .replace(" ", "")
            .upper()
        )

        # Filter only allowed satellites
        if impacted_sat not in ALLOWED_SATELLITES:
            current_app.logger.info(
                f"[INDEX] Skipping non-allowed satellite {impacted_sat} at index {idx}"
            )
            continue

        display_satellite = SATELLITE_DISPLAY_NAMES.get(impacted_sat, raw_impacted_sat)
        # Default title
        title = None
        if category == "Platform":
            title = f"Satellite issue, affecting {display_satellite} data."
        elif category == "Acquisition":
            title = f"Acquisition issue, affecting {display_satellite} data."
        elif category == "Production":
            title = f"Production issue, affecting {display_satellite} data."
        elif category == "Manoeuvre":
            title = f"Manoeuvre issue, affecting {display_satellite} data."
        elif category == "Calibration":
            title = f"Calibration issue, affecting {display_satellite} data."
        else:
            title = f"{category} issue, affecting {display_satellite} data."
        # Add “Read More” link
        pub_date = item.get("publicationDate", "")[:10]
        title += f' <a href="/events.html?showDayEvents={pub_date}">Read More</a>'

        # Append to list
        if now - event_time <= timedelta(hours=48):
            anomalies_details.append({"time_ago": time_ago, "content": title})

    # ---- SSR: Load Instant Messages for Home ----
    try:
        page_size = 3  # number of messages to show on home page

        # sorting publicationDate descending
        query = db.session.query(instant_messages_model.InstantMessages).order_by(
            instant_messages_model.InstantMessages.publicationDate.desc()
        )

        total_messages = query.count()
        instant_messages_raw = query.limit(page_size).all()

        # Serialize messages to JSON-friendly format
        instant_messages = [
            {
                "id": msg.id,
                "title": msg.title,
                "text": msg.text,
                "messageType": msg.messageType,
                "publicationDate": format_pub_date(msg.publicationDate),
                "link": msg.link,
            }
            for msg in instant_messages_raw
        ]

    except Exception:
        logger.exception("Failed to load SSR Home News")
        instant_messages = []
        total_messages = 0

    # Include user role
    user_role = getattr(current_user, "role", None)

    # Ensure JSON-safe values
    instant_messages_safe = make_json_safe(instant_messages)

    # Serialize to JSON string
    instant_messages_json = json.dumps(instant_messages_safe)

    return render_template(
        "home/index.html",
        segment=segment,
        anomalies_details=anomalies_details,
        instant_messages_json=instant_messages_json,
        total_messages=total_messages,
        user_role=user_role,
        **metadata,
    )


@blueprint.route("/events")
def events():

    try:
        metadata = get_metadata("events.html")
        metadata["page_url"] = request.url

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

        quarter_authorized = current_user.is_authenticated and current_user.role in (
            "admin",
            "ecuser",
            "esauser",
        )

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
            anomalies_by_date={},
            json_anomalies=[],
            json_events=[],
            json_datatakes=[],
            quarter_authorized=quarter_authorized,
            icon_map=icon_map,
            event_type_map=event_type_map,
            missing_datatakes_info=[],
            **metadata,
        )
    except Exception as e:
        current_app.logger.error(f"Error rendering / events: {e}", exc_info=True)
        abort(500)


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

        if not raw_anomalies:
            current_app.logger.info(f"[EVENTS DATA] no cache anomalies")
            return jsonify({"anomalies": [], "anomalies_by_date": {}, "events": []})

        def serialize_anomalie(a):
            src = a.get("_source", a)
            date_str = (
                src.get("occurence_date")
                or src.get("occurrence_date")
                or src.get("publicationDate")
                or src.get("created")
            )

            if isinstance(date_str, datetime):
                date_str = to_utc_iso(date_str)

            if isinstance(date_str, str) and "/" in date_str:
                try:
                    dt = datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S")
                    date_str = to_utc_iso(dt)
                except Exception:
                    pass

            impacted_satellite = get_impacted_satellite(src)

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
        skipped_full = 0
        kept_partial = 0

        for a in anomalies:
            instance = build_event_instance(a, current_app.logger)
            if not instance:
                continue
            if instance.get("fullRecover"):
                skipped_full += 1
                continue
            else:
                kept_partial += 1

            date_str = instance.get("from") or instance.get("publicationDate")
            if not date_str:
                current_app.logger.info(f"Skipping instance without 'from': {instance}")
                continue

            try:
                dt = datetime.fromisoformat(date_str)
            except Exception:
                try:
                    dt = datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S")
                except Exception:
                    current_app.logger.info(
                        f"invalid date format in instance: {instance}"
                    )
                    continue

            if dt.year == year and dt.month == month:
                date_key = dt.strftime("%Y-%m-%d")
                anomalies_by_date.setdefault(date_key, []).append(instance)
                events.append(instance)

        # --- Return clean JSON response ---
        response = {
            "year": year,
            "month": month,
            "anomalies": anomalies,
            "anomalies_by_date": anomalies_by_date,
            "count": sum(len(v) for v in anomalies_by_date.values()),
            "events": events,
        }

        return jsonify(response)

    except Exception as e:
        current_app.logger.error(f"Error in /events_data: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@blueprint.app_template_filter("to_utc_dt")
def to_utc_dt(value):
    """
    Jinja filter to ensure ISO strings or datetimes render properly in templates.
    Converts to a UTC-aware datetime using existing to_utc().
    """
    try:
        return to_utc(value)
    except Exception:
        return None


@blueprint.route("/data-availability", methods=["GET", "POST"])
def data_availability():
    metadata = get_metadata("data-availability.html")
    metadata["page_url"] = request.url
    segment = "data-availability"

    try:
        current_app.logger.info("[DATA-AVAILABILITY] Starting route")

        # Detect AJAX
        is_ajax = request.args.get("ajax") == "1"
        search_query = request.args.get("search", "").strip()
        has_search = bool(search_query)

        # --- Determine selected period ---
        if has_search:
            selected_period = "prev-quarter"
            session.pop("selected_period", None)  # remove old user period
        else:
            selected_period = request.args.get("period") or session.get(
                "selected_period", "week"
            )

        # Save user-selected period in session only if not search
        if not has_search and "period" in request.args:
            session["selected_period"] = selected_period
            if not is_ajax:
                return redirect(url_for("home_blueprint.data_availability"))

        # --- Cache keys ---
        datatakes_cache_key_map = {
            "day": "last-24h",
            "week": "last-7d",
            "month": "last-30d",
            "prev-quarter": "previous-quarter",
            "default": "last-7d",
        }

        datatakes_key = datatakes_cache_key_map.get(selected_period, "last-7d")
        anomalies_cache_uri = events_cache.anomalies_cache_key.format(
            "last",
            "last" if selected_period == "prev-quarter" else "7d",
        )
        datatakes_cache_uri = datatakes_cache.datatakes_cache_key.format(
            "last",
            datatakes_key.split("-")[-1] if "-" in datatakes_key else "7d",
        )

        # --- Load caches ---
        anomalies_data = load_cache_as_list(anomalies_cache_uri, "anomalies") or []
        datatakes_data = load_cache_as_list(datatakes_cache_uri, "datatakes") or []

        # --- POST: datatake details ---
        datatake_details = None
        if request.method == "POST":
            selected_id = request.form.get("datatake_id")
            if selected_id:
                datatake_details = (
                    datatakes_cache.load_datatake_details(selected_id) or {}
                )

        # --- Authorization ---
        quarter_authorized = current_user.is_authenticated and current_user.role in (
            "admin",
            "ecuser",
            "esauser",
        )

        if selected_period == "prev-quarter":
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(days=90)

            filtered = []
            for item in datatakes_data:
                src = item.get("_source", {})
                raw = src.get("observation_time_start")
                try:
                    dt = parser.isoparse(raw)
                    if dt >= cutoff:
                        filtered.append(item)
                except Exception:
                    continue

            datatakes_data = filtered
            current_app.logger.info(
                f"[PREV-QUARTER OVERRIDE] Filtered to last 90 days → {len(datatakes_data)} items"
            )

        # --- Normalize datatakes ---
        normalized_datatakes = []
        for d in datatakes_data:
            src = d.get("_source", {}) or {}
            dt_id = src.get("datatake_id") or src.get("id")
            start_time = (
                to_utc(src.get("observation_time_start"))
                if src.get("observation_time_start")
                else None
            )
            stop_time = (
                to_utc(src.get("observation_time_stop"))
                if src.get("observation_time_stop")
                else None
            )

            normalized_datatakes.append(
                {
                    "id": dt_id,
                    "platform": safe_json_value(src.get("satellite_unit") or "Unknown"),
                    "start_time": to_utc_iso(start_time) if start_time else None,
                    "stop_time": to_utc_iso(stop_time) if stop_time else None,
                    "acquisition_status": src.get("completeness_status", {})
                    .get("ACQ", {})
                    .get("status", "unknown"),
                    "publication_status": src.get("completeness_status", {})
                    .get("PUB", {})
                    .get("status", "unknown"),
                    "raw": src,
                }
            )

        # --- Normalize anomalies ---
        normalized_anomalies = []
        for a in anomalies_data:
            src = a.get("_source", {}) or {}
            normalized_anomalies.append(
                {
                    "key": safe_json_value(src.get("key") or src.get("id"), "unknown"),
                    "category": safe_json_value(
                        src.get("category") or src.get("type"), "Unknown"
                    ),
                    "publicationDate": safe_json_value(
                        src.get("occurence_date")
                        or src.get("occurrence_date")
                        or src.get("publicationDate")
                        or src.get("created")
                        or ""
                    ),
                    "impactedSatellite": safe_json_value(
                        src.get("impactedSatellite"), "Unknown"
                    ),
                    "description": safe_json_value(src.get("description"), ""),
                    "datatakes_completeness": src.get("datatakes_completeness", []),
                    "start": src.get("start"),
                    "end": src.get("end"),
                    "title": src.get("title"),
                    "text": src.get("text"),
                }
            )

        normalized_datatakes = replace_undefined(normalized_datatakes)
        normalized_anomalies = replace_undefined(normalized_anomalies)

        # --- Filter & sort ---
        normalized_datatakes = [
            dt for dt in normalized_datatakes if dt.get("start_time") and dt.get("id")
        ]

        normalized_datatakes.sort(key=datatake_sort_key)
        datatakes_cache.generate_completeness_cache(normalized_datatakes)

        # --- Pagination ---
        try:
            page = int(request.args.get("page", 1))
            if page < 1:
                page = 1
        except Exception:
            page = 1
        start_idx = (page - 1) * BATCH_SIZE
        end_idx = start_idx + BATCH_SIZE

        paged_datatakes = normalized_datatakes[start_idx:end_idx]
        datatakes_for_ssr = [enrich_datatake(dt) for dt in paged_datatakes]

        total_pages = (len(normalized_datatakes) + BATCH_SIZE - 1) // BATCH_SIZE

        current_app.logger.info(
            f"[DATA-AVAILABILITY] pagination slice for period '{selected_period}': {start_idx} → {end_idx}"
        )

        payload = {
            "anomalies": replace_undefined(normalized_anomalies),
            "datatakes": datatakes_for_ssr,
            "quarter_authorized": quarter_authorized,
            "selected_period": selected_period,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "datatake_details": datatake_details,
            "current_page": page,
            "total_pages": (len(normalized_datatakes) + BATCH_SIZE - 1) // BATCH_SIZE,
            "has_search": has_search,
            "search_query": search_query,
        }

        # --- Return JSON for AJAX ---
        if is_ajax:
            safe_payload = {
                "datatakes": make_json_safe(datatakes_for_ssr),
                "current_page": page,
                "total_pages": total_pages,
            }
            return jsonify(safe_payload), 200

        # --- Otherwise render template ---
        current_app.logger.info(
            f"[DATA-AVAILABILITY] sending {len(datatakes_for_ssr)} datatakes to frontend (search={has_search})"
        )
        return render_template(
            "home/data-availability.html",
            **payload,
            normalized_datatakes=normalized_datatakes,
            segment=segment,
            **metadata,
            datatakes_for_ssr=replace_undefined(datatakes_for_ssr),
            BATCH_SIZE=BATCH_SIZE,
        )

    except Exception as e:
        current_app.logger.error(
            f"[DATA-AVAILABILITY] Error rendering template: {e}", exc_info=True
        )
        if request.args.get("ajax") == "1":
            return jsonify({"error": "internal_server_error"}), 500
        abort(500)


@blueprint.route("/data-availability/enrich", methods=["POST"])
def enrich_datatake_modal():
    datatake_id = request.form.get("datatake_id")
    if not datatake_id:
        return jsonify({"error": "missing_id"}), 400

    dt = datatakes_cache.load_datatake_details(datatake_id)
    if not dt:
        return jsonify({"error": "not_found"}), 404

    enriched = enrich_datatake(dt)

    safe_enriched = make_json_safe(enriched)
    return jsonify(safe_enriched), 200


@blueprint.route("/acquisitions-status")
def acquisitions_status():
    """
    SSR: Render the Acquisitions Status page with:
    - Acquisition Plan Coverage
    - Satellite Orbits
    - Acquisition Stations (SSR)
    """
    metadata = get_metadata("acquisitions-status.html")
    metadata["page_url"] = request.url
    segment = "acquisitions-status"

    try:
        logger.info("[BEG] SSR: Acquisitions Status")

        # Step 1 — Retrieve acquisition plan coverage
        logger.info("[BEG] Retrieve Acquisition Plans Coverage")
        plans_raw = acquisition_plans_cache.get_acquisition_plans_coverage()
        logger.info("[END] Retrieve Acquisition Plans Coverage")

        if isinstance(plans_raw, Response):
            try:
                plans_raw = plans_raw.get_json(force=True)
                logger.info("[DEBUG] Extracted JSON from Response object")
            except Exception as e:
                logger.exception("[ERR] Failed to parse Response JSON")
                plans_raw = {}  # fallback to empty dict

        plans_coverage = make_json_safe(plans_raw)
        logger.info(f"[INFO] Retrieved {len(plans_coverage)} plans coverage items")

        # Step 2 -  SATELLITE ORBITS (SSR)
        logger.info("[BEG] Retrieve Satellite Orbits (SSR)")
        orbits_api_key = acquisition_assets_cache.orbits_cache_key
        orbits_raw = flask_cache.get(orbits_api_key)
        logger.info("[END] Retrieve Satellite Orbits (SSR)")

        if isinstance(orbits_raw, Response):
            try:
                orbits_raw = orbits_raw.get_json(force=True)
                logger.info("[DEBUG] Extracted JSON from orbits Response")
            except Exception:
                logger.exception("[ERR] Failed to parse orbits Response JSON")
                orbits_raw = {}

        orbits_safe = make_json_safe(orbits_raw)
        logger.info("[INFO] SSR satellite orbits loaded")

        # Step 3 - ACQUISITION STATIONS (SSR)
        logger.info("[BEG] Retrieve Acquisition Stations (SSR)")
        stations_api_key = acquisition_assets_cache.stations_cache_key
        stations_raw = flask_cache.get(stations_api_key)
        logger.info("[END] Retrieve Acquisition Stations (SSR)")

        if isinstance(stations_raw, Response):
            try:
                stations_raw = stations_raw.get_json(force=True)
                logger.info("[DEBUG] Extracted JSON from stations Response")
            except Exception:
                logger.exception("[ERR] Failed to parse stations Response JSON")
                stations_raw = {}

        stations_safe = make_json_safe(stations_raw)
        logger.info("[INFO] SSR acquisition stations loaded")

        # Step 4 — Render the template with SSR-injected JSON
        return render_template(
            "home/acquisitions-status.html",
            plans_coverage_json=plans_coverage,
            satellite_orbits_json=orbits_safe,
            acquisition_stations_json=stations_safe,
            segment=segment,
            **metadata,
        )

    except Exception:
        logger.exception("[ERR] SSR: Acquisitions Status")
        return render_template("home/page-500.html"), 500

    finally:
        logger.info("[END] SSR: Acquisitions Status")


@blueprint.route("/newsList.html")
def news_list_ssr():
    try:
        page = int(request.args.get("page", 1))
        page_size = 6
        offset = (page - 1) * page_size

        query = db.session.query(instant_messages_model.InstantMessages).order_by(
            instant_messages_model.InstantMessages.publicationDate.desc()
        )

        total_messages = query.count()
        messages_raw = query.offset(offset).limit(page_size).all()

        messages = []
        for m in messages_raw:
            if m.publicationDate:
                pub_dt_rome = m.publicationDate.replace(tzinfo=timezone.utc).astimezone(
                    LOCAL_TZ
                )
                pub_str = pub_dt_rome.strftime("%Y-%m-%d %H:%M")
            else:
                pub_str = None
            messages.append(
                {
                    "id": m.id,
                    "title": m.title,
                    "text": m.text,
                    "link": m.link,
                    "messageType": m.messageType,
                    "publicationDate": pub_str,
                    "publicationDateUtc": (
                        m.publicationDate.isoformat() if m.publicationDate else None
                    ),
                }
            )

        total_pages = math.ceil(total_messages / page_size)

        user_role = getattr(current_user, "role", "guest")

        return render_template(
            "home/newsList.html",
            messages=make_json_safe(messages),
            total_pages=total_pages,
            current_page=page,
            user_role=user_role,
        )

    except Exception:
        logger.exception("Failed to render SSR News List")
        abort(500)


@blueprint.route("/admin/message", methods=["GET"])
@login_required
def message_form_ssr():
    try:
        # Role protection
        if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
            abort(403)

        message_id = request.args.get("id")
        next_url = request.args.get("next", "/newsList.html")

        message_data = None

        if message_id:
            message = (
                db.session.query(instant_messages_model.InstantMessages)
                .filter_by(id=message_id)
                .first()
            )

            if not message:
                abort(404)

            if message.publicationDate:
                pub_dt_rome = message.publicationDate.replace(
                    tzinfo=timezone.utc
                ).astimezone(LOCAL_TZ)
                pub_str = pub_dt_rome.strftime("%Y-%m-%dT%H:%M")
            else:
                pub_str = ""

            message_data = {
                "id": message.id,
                "title": message.title,
                "text": message.text,
                "link": message.link,
                "messageType": message.messageType,
                "publicationDate": pub_str,
            }

        return render_template(
            "admin/newMessages.html",
            message=message_data,
            next_url=next_url,
        )

    except Exception:
        logger.exception("Failed to render SSR Message Form")
        abort(500)


@blueprint.route("/admin/instant-messages/add", methods=["POST"])
@login_required
def add_instant_message_ssr():
    # logger.info("SSR Add route called")

    try:
        if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
            abort(403)

        next_url = request.form.get("next", "/newsList.html")

        title = request.form.get("title", "").strip()
        text = request.form.get("text", "").strip()
        link = request.form.get("link", "").strip()
        message_type = request.form.get("messageType", "").strip()
        publication_date_str = request.form.get("publicationDate", "").strip()

        if not title or not text or not publication_date_str:
            flash("Missing required fields", "danger")
            return redirect(next_url)

        local_dt = datetime.strptime(publication_date_str, "%Y-%m-%dT%H:%M").replace(
            tzinfo=LOCAL_TZ
        )

        publication_date = local_dt.astimezone(timezone.utc)

        modify_date = datetime.now(timezone.utc)

        # Save the message
        instant_messages_model.save_instant_messages(
            title=title,
            text=text,
            link=link,
            publication_date=publication_date,
            message_type=message_type,
            modify_date=modify_date,
        )

        flash("News added successfully!", "success")
        return redirect(next_url)

    except Exception:
        logger.exception("SSR Add failed")
        flash("Failed to add news", "danger")
        return redirect(next_url)


@blueprint.route("/admin/instant-messages/update", methods=["POST"])
@login_required
def update_instant_message_ssr():
    # logger.info("SSR Update route called")

    try:
        if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
            abort(403)

        message_id = request.form.get("id", "").strip()
        next_url = request.form.get("next", "/newsList.html")

        if not message_id:
            flash("Missing news ID", "danger")
            return redirect(next_url)

        title = request.form.get("title", "").strip()
        text = request.form.get("text", "").strip()
        link = request.form.get("link", "").strip()
        message_type = request.form.get("messageType", "").strip()
        publication_date_str = request.form.get("publicationDate", "").strip()

        local_dt = datetime.strptime(publication_date_str, "%Y-%m-%dT%H:%M").replace(
            tzinfo=LOCAL_TZ
        )

        new_pub_dt_utc = local_dt.astimezone(timezone.utc)

        message = (
            db.session.query(instant_messages_model.InstantMessages)
            .filter_by(id=message_id)
            .first()
        )

        if not message:
            flash("News post not found", "danger")
            return redirect(next_url)

        message.title = title
        message.text = text
        message.link = link
        message.messageType = message_type
        message.publicationDate = new_pub_dt_utc
        message.modifyDate = datetime.now(timezone.utc)

        db.session.commit()

        flash("News updated successfully", "success")
        return redirect(next_url)

    except Exception:
        logger.exception("SSR Update failed")
        db.session.rollback()
        flash("Update failed", "danger")
        return redirect("/newsList.html")


@blueprint.route("/admin/instant-messages/delete", methods=["POST"])
@login_required
def delete_instant_message_modal():
    # logger.info("Delete route called")
    try:
        if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
            logger.warning(f"Unauthorized user: {current_user}")
            abort(403)

        message_id = request.form.get("id", "").strip()
        next_url = request.form.get("next", "/newsList.html")
        # logger.info(f"Message ID to delete: {message_id}, next: {next_url}")

        if not message_id:
            flash("Missing news ID", "danger")
            logger.warning("Missing news ID")
            return redirect(next_url)

        message = (
            db.session.query(instant_messages_model.InstantMessages)
            .filter_by(id=message_id)
            .first()
        )

        if not message:
            flash("News not found", "danger")
            logger.warning(f"News not found: {message_id}")
            return redirect(next_url)

        db.session.delete(message)
        db.session.commit()
        # logger.info(f"News deleted: {message_id}")

        flash("News successfully deleted", "success")
        return redirect(next_url)

    except Exception as ex:
        logger.exception("Error deleting News post")
        db.session.rollback()
        flash("Delete failed", "danger")
        return redirect("/newsList.html")


@blueprint.route("/processors-viewer.html")
def processors_page():
    metadata = get_metadata("processors-viewer.html")
    metadata["page_url"] = request.url
    segment = "processors-viewer"
    COPERNICUS_URL = (
        "https://configuration.copernicus.eu/rest/api/baseline/processors-releases"
    )
    CACHE_TTL = 3600
    now = time.time()

    if not hasattr(processors_page, "_cache"):
        processors_page._cache = {}

    cache = processors_page._cache.get("processors")

    if cache and now - cache["ts"] < CACHE_TTL:
        processors_releases = cache["data"]
    else:
        try:
            r = requests.get(COPERNICUS_URL, timeout=20)
            r.raise_for_status()
            raw = r.json()

            graph_raw = raw.get("graph")
            graph = json.loads(graph_raw) if isinstance(graph_raw, str) else graph_raw
            processors_releases = graph.get("processors_releases", [])

            processors_page._cache["processors"] = {
                "data": processors_releases,
                "ts": now,
            }

        except Exception:
            logging.exception("Copernicus processors fetch failed")
            processors_releases = cache["data"] if cache else []

    return render_template(
        "home/processors-viewer.html",
        processors_releases=processors_releases,
        segment=segment,
        **metadata,
    )


@blueprint.route("/acquisition-service")
@blueprint.route("/acquisition-service.html")
@login_required
def acquisition_service_page():
    if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
        abort(403)

    period_id = request.args.get("period", "prev-quarter")

    current_app.logger.info("[ACQUISITION SERVICE] Requested period: %s", period_id)

    cache_period = PERIOD_TO_CACHE.get(period_id, "previous-quarter")

    if cache_period == "previous-quarter":
        acquisitions_key = acquisitions_cache.acquisitions_cache_key.format(
            "previous", "quarter"
        )
        edrs_key = acquisitions_cache.edrs_acquisitions_cache_key.format(
            "previous", "quarter"
        )
    else:
        acquisitions_key = acquisitions_cache.acquisitions_cache_key.format(
            "last", cache_period
        )
        edrs_key = acquisitions_cache.edrs_acquisitions_cache_key.format(
            "last", cache_period
        )

    # current_app.logger.info(
    #     "[ACQUISITION SERVICE] Cache keys-> acquisitions=%s edrs=%s",
    #     acquisitions_key,
    #     edrs_key,
    # )

    acquisitions = acquisitions_utils._cache_to_list(flask_cache.get(acquisitions_key))
    edrs_acquisitions = acquisitions_utils._cache_to_list(flask_cache.get(edrs_key))

    # current_app.logger.info(
    #    "[ACQUISITION SERVICE] loaded rows-> acquisitions=%d edrs=%d",
    #    len(acquisitions),
    #    len(edrs_acquisitions),
    # )

    payload = acquisitions_utils.build_acquisition_payload(
        acquisitions, edrs_acquisitions, period_id=period_id
    )

    # current_app.logger.info(
    #    "[ACQUISITION SERVICE] Paylod global-> %s",
    #    payload["global"],
    # )

    prev_quarter_label = acquisitions_utils.previous_quarter_label()

    return render_template(
        "home/acquisition-service.html",
        payload=payload,
        period_id=period_id,
        segment="acquisition-service",
        prev_quarter_label=prev_quarter_label,
    )


@blueprint.route("/space-segment")
@blueprint.route("/space-segment.html")
@login_required
def admin_space_segment():

    if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
        abort(403)

    period = request.args.get("period", "previous-quarter")

    if period == "previous-quarter":
        unavailability = flask_cache.get(
            unavailability_cache.unavailability_cache_key.format("previous", "quarter")
        )
        datatakes = flask_cache.get(
            datatakes_cache.datatakes_cache_key.format("previous", "quarter")
        )
    else:
        unavailability = flask_cache.get(
            unavailability_cache.unavailability_cache_key.format("last", period)
        )
        datatakes = flask_cache.get(
            datatakes_cache.datatakes_cache_key.format("last", period)
        )

    if isinstance(unavailability, Response):
        unavailability = unavailability.get_json(silent=True) or {}

    if isinstance(datatakes, Response):
        datatakes = datatakes.get_json(silent=True) or {}

    unavailability = acquisitions_utils.normalize_unavailability(unavailability)
    datatakes = acquisitions_utils.normalize_datatakes(datatakes)

    current_app.logger.info(
        "Datatakes keys: %s",
        list(datatakes.keys()) if isinstance(datatakes, dict) else type(datatakes),
    )
    payload = acquisitions_utils.build_space_segment_payload(unavailability, datatakes)

    return render_template(
        "home/space-segment.html",
        payload=payload,
        period=period,
    )


@blueprint.route("/<template>")
def route_template(template):
    try:
        if template in ("space-segment", "acquisition-service"):
            abort(404)

        # Detect the current page
        segment = get_segment(request)

        # Get metadata safely
        metadata = get_metadata(template)
        metadata["page_url"] = request.url

        if template in ["processors-viewer", "processors-viewer.html"]:
            return processors_page()

        if template in ["newsList", "newsList.html"]:
            return news_list_ssr()

        # List of admin pages
        admin_pages = ["users.html", "roles.html", "news.html", "anomalies.html"]

        # Handle admin pages
        if template in admin_pages:
            return render_template("admin/" + template, segment=segment, **metadata)

        # acquisition page
        if template == "acquisition-service.html":
            return acquisition_service_page()

        # space segment
        if template in ["space-segment", "space-segment.html"]:
            return admin_space_segment()

        # events page
        if template in ["events", "events.html"]:
            return events()

        # data-availability
        if template in ["data-availability", "data-availability.html"]:
            return data_availability()

        # acquisitions-status
        if template in ["acquisitions-status", "acquisitions-status.html"]:
            return acquisitions_status()

        # Default: serve page from home
        return render_template("home/" + template, segment=segment, **metadata)

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


@blueprint.before_request
def protect_internal_apis():
    internal_prefixes = (
        "/api/worker/",
        "/api/acquisitions/",
    )

    if request.path.startswith(internal_prefixes):
        # 1. Must be same-origin browser request
        fetch_header = request.headers.get("X-Requested-With")
        referer = request.headers.get("Referer", "")
        host = request.host_url.rstrip("/")

        if fetch_header != "XMLHttpRequest":
            abort(403)

        if not referer.startswith(host):
            abort(403)
