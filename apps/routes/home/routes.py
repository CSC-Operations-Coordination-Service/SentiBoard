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
from apps.elastic.modules import anomalies as elastic_anomalies
from apps.models import anomalies as anomalies_model
from apps.utils import date_utils
from apps.utils.anomalies_utils import model_to_dict
from datetime import datetime
from dateutil.relativedelta import relativedelta
from calendar import monthrange
import os
import json
import traceback
import logging

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
        "Acquisition": "acquisition",
        "calibration": "calibration",
        "Data access": "data-access",
        "Manoeuvre": "manoeuvre",
        "Production": "production",
        "Satellite": "satellite",
    }

    quarter_authorized = False
    if current_user.is_authenticated:
        quarter_authorized = current_user.role in ("admin", "ecuser", "esauser")

    if quarter_authorized:
        start_date, end_date = date_utils.prev_quarter_interval_from_date(today)
    else:
        start_date = today - relativedelta(months=3)
        end_date = today

    anomalies = anomalies_model.get_anomalies(start_date, end_date)
    datatakes_data = datatakes_module._get_cds_datatakes(start_date, end_date)

    anomalies_by_date = {}
    if anomalies:
        for anomaly in anomalies:

            completeness_raw = getattr(anomaly, "datatakes_completeness", None)
            if not completeness_raw:
                anomaly.status = "unknown"
                continue
            try:
                dt_list = json.loads(anomaly.datatakes_completeness.replace("'", '"'))
            except Exception as e:
                logger.warning(f"Could not parse completeness for {anomaly.id}:{e}")
                anomaly.status = "unknown"
                continue

            full_recover = True
            threshold = 90
            for dt_dict in dt_list:
                completeness_values = [
                    float(v)
                    for k, v in dt_dict.items()
                    if isinstance(v, (int, float, str)) and k.startswith("L")
                ]
                if not completeness_values:
                    continue

                avg_s = sum(completeness_values) / len(completeness_values)
                if avg_s < threshold:
                    full_recover = False

            anomaly.status = "ok" if full_recover else "partial"
            occ_field = next(
                (
                    getattr(anomaly, f, None)
                    for f in ("start", "end", "publicationDate", "modifyDate")
                    if getattr(anomaly, f, None)
                ),
                None,
            )
            anomaly.occurrence_date = (
                occ_field.strftime("%Y-%m-%d") if occ_field else None
            )

            if getattr(anomaly, "occurrence_date", None):
                date_str = anomaly.occurrence_date
                anomalies_by_date.setdefault(date_str, []).append(anomaly)

        days_in_month = monthrange(year, month)[1]
        first_day_offset = datetime(year, month, 1).weekday()
    else:
        logger.info("no anomalies found in this period")

    if isinstance(datatakes_data, list):
        try:
            datatakes_dict = {}
            for dt in datatakes_data:
                anomaly_id = getattr(dt, "anomaly_id", None)
                if anomaly_id:
                    datatakes_dict.setdefault(anomaly_id, []).append(dt)
        except Exception as e:
            logger.warning(f"Could not group datatakes by anomaly_id: {e}")
            datatakes_dict = {}
    else:
        datatakes_dict = datatakes_data or {}

    json_anomalies = [model_to_dict(a) for a in anomalies] if anomalies else []
    json_datatakes = {
        k: [model_to_dict(dt) for dt in v] for k, v in datatakes_dict.items()
    }

    return render_template(
        "home/events.html",
        quarter_authorized=quarter_authorized,
        anomalies=anomalies,
        datatakes=datatakes_dict,
        json_anomalies=json_anomalies,
        json_datatakes=json_datatakes,
        anomalies_by_date=anomalies_by_date,
        current_month=month,
        current_year=year,
        current_month_name=datetime(year, month, 1).strftime("%B"),
        days_in_month=days_in_month,
        first_day_offset=first_day_offset,
        today_str=today.strftime("%Y-%m-%d"),
        icon_map=icon_map,
        event_type_map=event_type_map,
    )


@blueprint.route("/data-availability")
def data_availability():
    """
    Render the Data Availability page with datatakes data embedded via SSR.
    """
    try:
        quarter_authorized = False
        if current_user.is_authenticated:
            quarter_authorized = current_user.role in ("admin", "ecuser", "esauser")

        raw_events = (
            elastic_anomalies.fetch_anomalies_prev_quarter()
            if quarter_authorized
            else elastic_anomalies.fetch_anomalies_last_quarter()
        )
        anomalies = raw_events

        if quarter_authorized:
            datatakes_data = datatakes_module.fetch_anomalies_datatakes_prev_quarter()
        else:
            datatakes_data = datatakes_module.fetch_anomalies_datatakes_last_quarter()

        return render_template(
            "home/data-availability.html",
            quarter_authorized=quarter_authorized,
            datatakes=datatakes_data,
            anomalies=anomalies,
        )
    except Exception as e:
        current_app.logger.error(f"Exception in data_availability: {e}", exec_info=True)
        return render_template("home/page-500.html"), 500


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

        # Special case: data availability page
        if template in ["data-availability", "data-availability.html"]:
            return data_availability()

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
