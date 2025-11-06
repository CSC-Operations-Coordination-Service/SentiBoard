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

from flask import render_template, request, current_app, abort
from flask_login import current_user, login_required
from jinja2 import TemplateNotFound
from urllib.parse import urlparse, urljoin
from apps.routes.home import blueprint
from functools import wraps
import apps.cache.modules.events as events_cache
from datetime import datetime, date, timezone
from calendar import monthrange
from apps import flask_cache
import json
from flask import jsonify
import traceback
import logging

logger = logging.getLogger(__name__)

from apps.utils.events_utils import (
    build_event_instance,
    get_impacted_satellite,
    to_utc_iso,
    safe_get,
)


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
    anomalies_data = flask_cache.get(anomalies_api_uri)

    # Ensure anomalies_data is a list
    if hasattr(anomalies_data, "get_json"):  # if it's a Response
        try:
            anomalies_data = anomalies_data.get_json() or []
        except Exception as e:
            current_app.logger.warning(
                "Failed to parse JSON from cached Response: %s", e
            )
            anomalies_data = []
    elif not isinstance(anomalies_data, list):
        anomalies_data = []

    now = datetime.now(timezone.utc)
    anomalies_details = []

    for item in anomalies_data:
        if not isinstance(item, dict):
            continue  # skip invalid entries

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
            time_ago = f"{diff.seconds // 3600} hour(s) ago"
        else:
            time_ago = f"{diff.seconds // 60} minute(s) ago"

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

    try:
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

        if raw_anomalies:
            current_app.logger.info(
                f"[RAW] First anomaly: {json.dumps(raw_anomalies[0], indent=2)}"
            )

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
                "anomalies": anomalies,
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
