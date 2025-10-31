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
from calendar import monthrange
import os
import json
from flask import jsonify
import traceback
import logging
import re
import ast

logger = logging.getLogger(__name__)


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
    return render_template("home/index.html", segment="index")


@blueprint.route("/events")
def events():
    today = datetime.today()
    try:
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

        # Load cached anomalies
        if quarter_authorized:
            current_app.logger.info("loading anomalies from previous quarter (cache)")
            events_cache.load_anomalies_cache_previous_quarter()
            cache_key = events_cache.anomalies_cache_key.format("previous", "quarter")
        else:
            current_app.logger.info("loading anomalies from last quarter (cache)")
            events_cache.load_anomalies_cache_last_quarter()
            cache_key = events_cache.anomalies_cache_key.format("last", "quarter")

        cache_entry = events_cache.flask_cache.get(cache_key)
        if not cache_entry:
            current_app.logger.info(f"No cache data found for key: {cache_key}")
            raw_anomalies = []
        else:
            try:
                raw_anomalies = json.loads(cache_entry.data)
            except Exception as parse_err:
                current_app.logger.info(f"Error parsing cache data: {parse_err}")
                raw_anomalies = []

        current_app.logger.info(
            f"loaded {len(raw_anomalies)} anomalies for cache "
            f"{'previous' if quarter_authorized else 'last'} quarter)"
        )

        # Serialize anomalies
        def serialize_anomalie(anomaly):
            source = anomaly.get(
                "_source", anomaly if isinstance(anomaly, dict) else {}
            )
            iso_date = (
                source.get("occurence_date")
                or source.get("occurrence_date")
                or source.get("publicationDate")
                or source.get("created")
                or None
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

            environment = (
                ";".join(dt_ids) if dt_ids else source.get("environment") or ""
            )
            origin = source.get("origin")
            category = (
                source.get("category") or origin or source.get("type") or "Unknown"
            )

            # Normalize category
            if origin in ("Satellite",):
                category = "Platform"
            elif origin in ("Production",):
                category = "Production"
            elif origin in ("DD",):
                category = "Data access"
            elif origin in ("LTA",):
                category = "Archive"
            elif origin in ("Acquisition", "RFI"):
                category = "Acquisition"
            elif origin in ("CAM",):
                category = "Manoeuvre"

            if category.upper() == "RFI":
                category = "Acquisition"

            if not category or category.strip().lower() in ("other", "unknown", ""):
                return None

            datatakes_completeness = source.get("datatakes_completeness") or []

            return {
                "key": source.get("key") or source.get("id") or anomaly.get("_id"),
                "occurence_date": iso_date[:10] if isinstance(iso_date, str) else None,
                "occurrence_date": iso_date[:10] if isinstance(iso_date, str) else None,
                "publicationDate": iso_date,
                "environment": environment,
                "datatakes_ids": (
                    source.get("datatakes_ids")
                    or source.get("datatakes")
                    or source.get("datatakes_ids_raw")
                    or []
                ),
                "datatakes_completeness": datatakes_completeness,
                "description": source.get("description", ""),
                "status": source.get("status", ""),
                "category": category,
                "impactedSatellite": source.get("affected_systems")
                or source.get("impactedSatellite")
                or "",
                "newsLink": source.get("url") or source.get("newsLink", ""),
                "newsTitle": source.get("title") or source.get("newsTitle", ""),
                "_raw_source": source,
            }

        if (
            raw_anomalies
            and isinstance(raw_anomalies[0], dict)
            and "_source" not in raw_anomalies[0]
        ):
            current_app.logger.info("Cache already contains serialized anomalies")
            anomalies = raw_anomalies
        else:
            anomalies = [
                s for a in raw_anomalies if (s := serialize_anomalie(a)) is not None
            ]

        cache_key_processed = (
            f"processed_anomalies_{'previous' if quarter_authorized else 'last'}"
        )
        cached_anomalies = events_cache.flask_cache.get(cache_key_processed)

        if cached_anomalies:
            current_app.logger.info(
                f"Using cached processed anomalies: {cache_key_processed}"
            )
            anomalies = json.loads(cached_anomalies)
        else:
            current_app.logger.info(
                f"caching processed anomalies under: {cache_key_processed}"
            )
            events_cache.flask_cache.set(cache_key_processed, json.dumps(anomalies))

        # Normalize datatakes_completeness BEFORE filtering
        def normalize_datatakes_completeness(anomaly):
            dtc = anomaly.get("datatakes_completeness") or []
            if isinstance(dtc, str):
                try:
                    dtc = ast.literal_eval(dtc)
                except Exception:
                    dtc = []
            elif not isinstance(dtc, list):
                dtc = []
            anomaly["datatakes_completeness"] = dtc
            return anomaly

        anomalies = [normalize_datatakes_completeness(a) for a in anomalies]

        valid_prefixes = ("S1", "S2", "S3", "S5")

        def has_valid_datatake(anomaly):
            env = anomaly.get("environment", "")
            if not env or env.lower().startswith("no"):
                return False
            datatakes = re.split(r"[;,]\s*", env)
            return any(
                dt.strip().startswith(prefix)
                for dt in datatakes
                for prefix in valid_prefixes
            )

        def has_relevant_datatakes(anomaly):
            dt_compl = anomaly.get("datatakes_completeness") or []
            return any(isinstance(dt, dict) and dt.get("datatakeID") for dt in dt_compl)

        def has_impacted_satellite(anomaly):
            impacted = anomaly.get("impactedSatellite", "")
            return bool(impacted.strip())

        cats = list({a["category"] for a in anomalies})
        current_app.logger.info(f"Before filtering: {len(anomalies)} anomalies")

        anomalies = [
            a
            for a in anomalies
            if has_valid_datatake(a)
            and (has_relevant_datatakes(a) or has_impacted_satellite(a))
        ]
        current_app.logger.info(f"after filtering: {len(anomalies)} anomalies")

        # Load datatakes
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
                    or src.get("completeness_status", {})
                    .get("ACQ", {})
                    .get("percentage"),
                    "L1_": src.get("L1_"),
                    "L2_": src.get("L2_")
                    or src.get("completeness_status", {})
                    .get("PUB", {})
                    .get("percentage"),
                    "completeness_status": src.get("completeness_status"),
                    "instrument_mode": src.get("instrument_mode"),
                    "satellite_unit": src.get("satellite_unit"),
                }

        anomalies_by_date = {}
        missing_datatakes_info = []

        days_in_month = monthrange(year, month)[1]
        first_day_offset = date(year, month, 1).weekday()
        month_name = date(year, month, 1).strftime("%B")

        for a in anomalies:
            occur_date = (
                a.get("occurrence_date")
                or a.get("occurence_date")
                or a.get("publicationDate")
                or a.get("created")
            )
            if not occur_date:
                current_app.logger.warning(
                    f"Anomaly without occurrence date: {a.get('key','unknown')}"
                )
                continue

            if isinstance(occur_date, str):
                if "/" in occur_date:
                    try:
                        dt = datetime.strptime(occur_date.split(" ")[0], "%d/%m/%Y")
                        date_key = dt.strftime("%Y-%m-%d")
                    except Exception:
                        current_app.logger.warning(
                            f"Invalid date format for anomaly: {a.get('key','unknown')}:{occur_date}"
                        )
                        continue
                else:
                    date_key = occur_date[:10]
            elif isinstance(occur_date, datetime):
                date_key = occur_date.date().isoformat()
            else:
                continue

            env = a.get("environment", "")
            datatake_ids = [s.strip() for s in re.split(r"[;,]\s*", env) if s.strip()]
            missing = [dt for dt in datatake_ids if dt not in datatakes_by_id]

            if missing:
                missing_datatakes_info.append(
                    {"anomaly_key": a.get("key"), "missing_ids": missing}
                )

            anomalies_by_date.setdefault(date_key, []).append(a)

        current_app.logger.info(f"Total calendar dates {len(anomalies_by_date)}")

        # Debug summary before rendering
        # current_app.logger.info("=== DEBUG SUMMARY FOR /events ===")
        # current_app.logger.info(f"Total anomalies serialized: {len(anomalies)}")
        # for date_key, items in anomalies_by_date.items():
        #    current_app.logger.info(f"{date_key}: {len(items)} anomalies")
        # if anomalies:
        #    sample = anomalies[0]
        #    current_app.logger.info(f"Sample anomaly keys: {list(sample.keys())}")
        #    current_app.logger.info(
        #        f"Sample occurrence_date: {sample.get('occurrence_date')}"
        #    )
        #    current_app.logger.info(f"Sample environment: {sample.get('environment')}")
        #    current_app.logger.info(f"Sample environment: {sample.get('environment')}")

        return render_template(
            "home/events.html",
            current_month=month,
            current_year=year,
            current_month_name=month_name,
            days_in_month=days_in_month,
            first_day_offset=first_day_offset,
            anomalies_by_date=anomalies_by_date,
            json_anomalies=anomalies,
            json_datatakes=datatakes_data,
            quarter_authorized=quarter_authorized,
            icon_map=icon_map,
            event_type_map=event_type_map,
            missing_datatakes_info=missing_datatakes_info,
        )

    except Exception as e:
        current_app.logger.error(f"Exception in events: {e}", exc_info=True)
        return render_template("home/page-500.html"), 500


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

            return {
                "key": src.get("key") or src.get("id"),
                "category": src.get("category") or src.get("type") or "Unknown",
                "environment": src.get("environment", ""),
                "publicationDate": date_str,
                "description": src.get("description", ""),
                "impactedSatellite": src.get("impactedSatellite", ""),
            }

        anomalies = [s for a in raw_anomalies if (s := serialize_anomalie(a))]

        today = datetime.now(timezone.utc)
        three_months_ago = today - timedelta(days=90)

        # Group anomalies by date
        anomalies_by_date = {}
        for a in anomalies:
            date_str = a.get("publicationDate")
            if not date_str:
                continue

            try:
                dt_naive = datetime.fromisoformat(date_str[:10])
                dt = dt_naive.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                continue
            if dt < three_months_ago or dt > today:
                continue
            if dt.year != year or dt.month != month:
                continue

        return jsonify(
            {
                "year": year,
                "month": month,
                "anomalies_by_date": anomalies_by_date,
                "count": sum(len(v) for v in anomalies_by_date.values()),
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
