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
)
from flask_login import current_user, login_required
from jinja2 import TemplateNotFound
from urllib.parse import urlparse, urljoin
from apps.routes.home import blueprint
from functools import wraps
import apps.cache.modules.events as events_cache
import apps.cache.modules.datatakes as datatakes_cache
from datetime import datetime, date, timezone
from dateutil import parser as date_parser
from calendar import monthrange
from apps import flask_cache
import json
import traceback
import logging

logger = logging.getLogger(__name__)

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


@blueprint.route("/index")
def index():

    metadata = get_metadata("index.html")
    metadata["page_url"] = request.url
    segment = "index"
    period_id = "24h"

    # Build the cache key
    anomalies_api_uri = events_cache.anomalies_cache_key.format("last", period_id)
    current_app.logger.info(f"[INDEX] starting here")
    current_app.logger.info(f"[INDEX] using cache key: {anomalies_api_uri}")

    # Get and inspect cache content
    raw_cache = flask_cache.get(anomalies_api_uri)
    current_app.logger.info(f"[INDEX] Cache content raw type: {type(raw_cache)}")
    current_app.logger.info(
        f"[INDEX] Cache raw content preview: {str(raw_cache)[:400]}"
    )

    # if not raw_cache:
    #    current_app.logger.warning("[INDEX] No 24h cache found, falling back to 7d")
    #    anomalies_api_uri = events_cache.anomalies_cache_key.format("last", "7d")
    #    raw_cache = flask_cache.get(anomalies_api_uri)

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
        import json

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

    for idx, item in enumerate(anomalies_data):
        if not isinstance(item, dict):
            current_app.logger.warning(
                f"[INDEX] Skipping invalid anomaly at index {idx}: {item}"
            )
            continue

        time_candidates = (
            item.get("time"),
            item.get("start"),
            item.get("publicationDate"),
            item.get("timestamp"),
        )

        event_time_str = None

        for cand in time_candidates:
            if cand:
                event_time_str = cand
                break
        if not event_time_str:
            current_app.logger.warning(f"[INDEX] Missing 'time' field in item {idx}")
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
            event_time = event_time.replace(tzinfo=timezone.utc)

        diff = now - event_time
        if diff.days >= 1:
            time_ago = f"{diff.days} day(s) ago"
        elif diff.seconds >= 3600:
            time_ago = f"{diff.seconds // 3600} hour(s) ago"
        else:
            time_ago = f"{diff.seconds // 60} minute(s) ago"

        category = item.get("category", "Unknown")

        impacted_sat = item.get("impactedSatellite", "Unknown")

        # Default title
        title = None
        if category == "Platform":
            title = f"Satellite issue, affecting {impacted_sat} data."
        elif category == "Acquisition":
            title = f"Acquisition issue, affecting {impacted_sat} data."
        elif category == "Production":
            title = f"Production issue, affecting {impacted_sat} data."
        elif category == "Manoeuvre":
            title = f"Manoeuvre issue, affecting {impacted_sat} data."
        elif category == "Calibration":
            title = f"Calibration issue, affecting {impacted_sat} data."
        else:
            title = f"{category} issue, affecting {impacted_sat} data."

        # Add “Read More” link
        pub_date = item.get("publicationDate", "")[:10]
        title += f' <a href="/events.html?showDayEvents={pub_date}">Read More</a>'

        # Append to list
        anomalies_details.append({"time_ago": time_ago, "content": title})

    if not anomalies_details:
        current_app.logger.info("[INDEX] No anomalies found, using mock test data")
        anomalies_details = [
            {
                "time_ago": "15 minute(s) ago",
                "content": "Acquisition issue, affecting Sentinel-1A data. "
                '<a href="/events.html?showDayEvents=2025-11-07">Read More</a>',
            },
            {
                "time_ago": "2 hour(s) ago",
                "content": "Production issue, affecting Sentinel-2B data. "
                '<a href="/events.html?showDayEvents=2025-11-07">Read More</a>',
            },
        ]

    return render_template(
        "home/index.html",
        segment=segment,
        anomalies_details=anomalies_details,
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

        # if raw_anomalies:
        #     current_app.logger.info(
        #         f"[RAW] First anomaly: {json.dumps(raw_anomalies[0], indent=2)}"
        #     )
        #     for a in raw_anomalies:
        #         srcTest = a.get("_source", a)
        #         if srcTest.get("key") == "GSANOM-19977":
        #             current_app.logger.warning(
        #                 f"[DEBUG GSANOM-19977] Full anomaly:\n{json.dumps(srcTest, indent=2)}"
        #             )

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
                # current_app.logger.info(
                #     f"[SKIP] Fully recovered anomaly:  {a.get('key')}"
                # )
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

        # --- Summary logs ---
        # total_events = len(events)
        # current_app.logger.info(
        #     f"[SUMMARY] Total anomalies processed: {len(anomalies)} | "
        #     f"Kept active: {kept_partial} | Skipped full-recovered: {skipped_full}"
        # )
        # current_app.logger.info(
        #     f"[SUMMARY] Total events for {month}/{year}: {total_events}"
        # )
        # current_app.logger.info(
        #     f"[SUMMARY] Anomalies by date keys: {list(anomalies_by_date.keys())}"
        # )

        # --- Return clean JSON response ---
        response = {
            "year": year,
            "month": month,
            "anomalies": anomalies,
            "anomalies_by_date": anomalies_by_date,
            "count": sum(len(v) for v in anomalies_by_date.values()),
            "events": events,
        }

        # current_app.logger.info(f"[FINAL RESPONSE] {json.dumps(response, indent=2)}")
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

        # POST HANDLING: user clicked on a row and requested full details
        if "period" in request.args:
            session["selected_period"] = request.args["period"]
            return redirect(url_for("home_blueprint.data_availability"))

        selected_period = session.get("selected_period", "week")

        page = int(request.args.get("page", 1))
        start_idx = (page - 1) * BATCH_SIZE
        end_idx = start_idx + BATCH_SIZE

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

        # --- Cache key map ---
        datatakes_cache_key_map = {
            "day": "last-24h",
            "week": "last-7d",
            "month": "last-30d",
            "prev-quarter": "previous-quarter",
            "default": "last-7d",
        }
        datatakes_key = datatakes_cache_key_map.get(
            selected_period, datatakes_cache_key_map["default"]
        )

        anomalies_cache_uri = events_cache.anomalies_cache_key.format(
            (
                "previous"
                if selected_period == "prev-quarter" and quarter_authorized
                else "last"
            ),
            "quarter" if selected_period == "prev-quarter" else "7d",
        )
        datatakes_cache_uri = datatakes_cache.datatakes_cache_key.format(
            "previous" if selected_period == "prev-quarter" else "last",
            datatakes_key.split("-")[-1] if "-" in datatakes_key else "7d",
        )

        # Load cached data
        anomalies_data = load_cache_as_list(anomalies_cache_uri, "anomalies") or []
        datatakes_data = load_cache_as_list(datatakes_cache_uri, "datatakes") or []

        # Normalize datatakes
        normalized_datatakes = []
        for d in datatakes_data:
            src = d.get("_source", {}) or {}
            datatake_id = src.get("datatake_id") or src.get("id")

            start_raw = src.get("observation_time_start")
            stop_raw = src.get("observation_time_stop")

            try:
                start_time = date_parser.parse(start_raw) if start_raw else None
            except Exception:
                start_time = None

            try:
                stop_time = date_parser.parse(stop_raw) if stop_raw else None
            except Exception:
                stop_time = None

            normalized_datatakes.append(
                {
                    "id": datatake_id,
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

        # Normalize anomalies
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

        # Cleanup undefined
        normalized_datatakes = replace_undefined(normalized_datatakes)
        normalized_anomalies = replace_undefined(normalized_anomalies)

        normalized_datatakes = [
            dt for dt in normalized_datatakes if dt.get("start_time") and dt.get("id")
        ]
        normalized_datatakes.sort(key=datatake_sort_key)

        datatakes_cache.generate_completeness_cache(normalized_datatakes)

        paged_datatakes = normalized_datatakes[start_idx:end_idx]
        datatakes_for_ssr = []

        for dt in paged_datatakes:
            dt_copy = dt.copy()
            dt_id = dt_copy["id"]

            # Load full details from cache
            full_details = datatakes_cache.load_datatake_details(dt_id) or {}
            raw = full_details.get("_source", full_details)

            # Build completeness_list for products (used in your modal table)
            completeness_list = [
                {"productType": k, "status": round(v, 2)}
                for k, v in raw.items()
                if k.endswith("_local_percentage") and isinstance(v, (int, float))
            ]
            dt_copy["completeness_list"] = completeness_list

            # Ensure ACQ and PUB completeness_status have both status and percentage
            comp = raw.get("completeness_status", {}) or {}

            acq = comp.get("ACQ", {})
            acq_status = acq.get("status") or "ACQUIRED"
            acq_percentage = acq.get("percentage") or 100

            pub = comp.get("PUB", {})
            pub_status = pub.get("status") or "PUBLISHED"
            pub_percentage = pub.get("percentage") or 100

            dt_copy["acquisition_status"] = acq_status
            dt_copy["publication_status"] = pub_status

            # Update raw completeness_status
            raw["completeness_status"] = {
                "ACQ": {"status": acq_status, "percentage": acq_percentage},
                "PUB": {"status": pub_status, "percentage": pub_percentage},
            }

            dt_copy["raw"] = raw

            datatakes_for_ssr.append(dt_copy)

        # Final payload
        payload = {
            "anomalies": normalized_anomalies,
            "datatakes": datatakes_for_ssr,
            "quarter_authorized": quarter_authorized,
            "selected_period": selected_period,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "datatake_details": datatake_details,
            "current_page": page,
            "total_pages": (len(normalized_datatakes) + BATCH_SIZE - 1) // BATCH_SIZE,
        }

        return render_template(
            "home/data-availability.html",
            **payload,
            normalized_datatakes=normalized_datatakes,
            segment=segment,
            **metadata,
            datatakes_for_ssr=replace_undefined(datatakes_for_ssr),
        )

    except Exception as e:
        current_app.logger.error(
            f"[DATA-AVAILABILITY] Error rendering template: {e}", exc_info=True
        )
        abort(500)


@blueprint.route("/<template>")
def route_template(template):
    try:
        if not template.endswith(".html"):
            abort(404)

        # Detect the current page
        segment = get_segment(request)

        # List of admin pages
        admin_pages = ["users.html", "roles.html", "news.html", "anomalies.html"]

        # Get metadata safely
        metadata = get_metadata(template)
        metadata["page_url"] = request.url

        # Handle admin pages
        if template in admin_pages:
            return render_template("admin/" + template, segment=segment, **metadata)

        # Special case: events page
        if template in ["events", "events.html"]:
            # Determine if the user is quarter authorized
            return events()

        # data-availability
        if template in ["data-availability", "data-availability.html"]:
            return data_availability()

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
