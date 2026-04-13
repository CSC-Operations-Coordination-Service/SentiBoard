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
    redirect,
    url_for,
    flash,
    current_app,
    Response,
    Flask,
    jsonify,
    abort,
)
from jinja2 import TemplateNotFound
from urllib.parse import urlparse, urljoin
from apps.routes.home import blueprint
from functools import wraps
import os
import json
import traceback

PAGE_METADATA = {
    "index.html": {
        "title": "Copernicus Sentinel Operations Dashboard | Real-Time Satellite Data & Events",
        "description": (
            "The Copernicus Sentinel Operations Dashboard (Sentiboard) provides real-time satellite data,"
            " mission events, data availability, and acquisition status for ESA's Copernicus Sentinel missions. "
            "Monitor Earth observation activities, satellite events, and mission performance through the official ESA operations dashboard. "
            "ESA operations dashboard."
        ),
        "page_keywords": [
            "Copernicus Sentinel Operations Dashboard",
            "Sentiboard real-time satellite data",
            "ESA Sentinel mission events",
            "Sentinel data availability monitoring",
            "Acquisition status of Copernicus satellites",
            "Sentinel processors release timeline",
            "Real-time satellite event dashboard",
        ],
    },
    "about.html": {
        "title": "About the Copernicus Sentinel Dashboard | ESA Earth Observation Missions",
        "description": (
            "Learn about the Copernicus Sentinel Dashboard (Sentiboard) and how it supports real-time monitoring of ESA Earth observation missions. "
            "Discover how Sentinel satellite data availability, acquisition status, and mission events are tracked to provide reliable satellite data services. "
        ),
        "page_keywords": [
            "Copernicus Earth observation programme",
            "Sentinel satellite data monitoring",
            "ESA Copernicus Space Component",
            "Sentinel mission planning and acquisition",
            "Copernicus Operations Dashboard overview",
            "Earth observation mission data services",
            "Sentinel data availability and quality",
            "Copernicus Ground Segment transformation",
        ],
    },
    "acquisitions-status.html": {
        "title": "Sentinel Acquisition Status Map | Copernicus Satellite Observation Schedule",
        "description": (
            "Explore the Sentinel acquisition status map on the Copernicus Sentinel Dashboard (Sentiboard). Visualize real-time satellite acquisition planning, "
            "sensing scenarios, orbit data, and observation schedules for Sentinel missions using an interactive 3D globe. "
        ),
        "page_keywords": [
            "Sentinel acquisition status map",
            "Copernicus satellite observation schedule",
            "Real-time Sentinel acquisition planning",
            "Interactive 3D globe Sentinel missions",
            "Sentinel orbit data and sensing scenarios",
            "Datatake filtering by satellite or date",
            "Published Sentinel products overview",
            "Copernicus acquisition plans visualization",
        ],
    },
    "events.html": {
        "title": "Sentinel Events & Anomalies | Real-Time Copernicus Mission Operations",
        "description": (
            "Browse Sentinel mission events on the Copernicus Sentinel Dashboard (Sentiboard), including real-time events, satellite anomalies,  "
            "calibration activities, and mission manoeuvres. Understand how operational events impact Sentinel data production and availability."
        ),
        "page_keywords": [
            "Sentinel mission events dashboard",
            "Copernicus real-time satellite anomalies",
            "Sentinel calibration activities",
            "Mission Manoeuvre impact on data",
            "ESA Sentinel operations monitoring",
            "Sentinel data completeness analysis",
            "Event types affecting satellite products",
            "Real-time Copernicus event tracking",
        ],
    },
    "data-availability.html": {
        "title": "Copernicus Sentinel Data Availability | Real-Time Earth Observation Data",
        "description": (
            "Monitor Copernicus Sentinel data availability in real time using the Sentiboard. "
            "Track satellite data access, publication completeness, data quality, and delivery status "
            "across Sentinel missions and Earth observation collections."
        ),
        "page_keywords": [
            "Copernicus Sentinel data availability",
            "Real-time Earth observation data",
            "Sentinel data publication completeness",
            "Acquisition platform and sensor mode tracking",
            "Sentinel data delivery status monitoring",
            "Filter datatakes by mission or satellite",
            "Sentinel-5P data access monitoring",
            "Copernicus satellite data quality metrics",
        ],
    },
    "processors-viewer.html": {
        "title": "Copernicus Sentinel Processor Releases | ESA Data Processing Timeline",
        "description": (
            "Explore the Copernicus Sentinel processor releases timeline on the Sentiboard. "
            "Track ESA processor versions, data processing updates, and changes across the "
            "Copernicus processing chain using an interactive release history."
        ),
        "page_keywords": [
            "Copernicus Sentinel processor releases",
            "ESA Sentinel data processing timeline",
            "Interactive processor release history",
            "Sentinel processor version tracking",
            "Copernicus processing chain updates",
            "Timeline of Sentinel data processing",
            "Sentinel data processing change log",
            "Processor releases and satellite data updates",
        ],
    },
}
# Default fallback metadata for any page not listed above:
DEFAULT_PAGE_METADATA = {
    "title": "Copernicus Sentinel Operations Dashboard | ESA Earth Observation",
    "description": (
        "The Copernicus Sentinel Operations Dashboard (Sentiboard) provides real-time satellite data, "
        "mission events, data availability, and acquisition status for ESA Earth observation missions. "
        "Explore satellite operations, Sentinel mission monitoring, and Copernicus data services."
    ),
    "page_keywords": [
        "Copernicus Sentinel Operations Dashboard",
        "Sentiboard real-time satellite data",
        "ESA Sentinel mission events",
        "Sentinel data availability monitoring",
        "Acquisition status of Copernicus satellites",
        "Sentinel processors release timeline",
        "Real-time satellite event dashboard",
    ],
}
BATCH_SIZE = 10

PERIOD_TO_CACHE = {
    "day": "24h",
    "week": "7d",
    "month": "30d",
    "prev-quarter": "previous-quarter",
    "prev-quarter-specific": "previous-quarter",
}

# used on product-timeliness
MISSIONS = {
    "S1": {
        "title": "Sentinel-1",
        "charts": [
            {"id": "ntc", "title": "Default Timeliness"},
            {"id": "nrt", "title": "NRT"},
        ],
    },
    "S2": {
        "title": "Sentinel-2",
        "charts": [
            {"id": "ntc", "title": "Default Timeliness"},
        ],
    },
    "S3": {
        "title": "Sentinel-3",
        "charts": [
            {"id": "nrt-olci", "title": "OLCI NRT"},
            {"id": "nrt-slstr", "title": "SLSTR NRT"},
            {"id": "nrt-sral", "title": "SRAL NRT"},
            {"id": "stc-sral", "title": "SRAL STC"},
            {"id": "stc-syn", "title": "SYN STC"},
            {"id": "ntc-olci", "title": "OLCI Default"},
            {"id": "ntc-slstr", "title": "SLSTR Default"},
            {"id": "ntc-sral", "title": "SRAL Default"},
            {"id": "ntc-syn", "title": "SYN Default"},
        ],
    },
    "S5": {
        "title": "Sentinel-5",
        "charts": [
            {"id": "ntc-l1", "title": "L1 Default"},
            {"id": "ntc-l2", "title": "L2 Default"},
            {"id": "nrt-l2", "title": "L2 NRT"},
        ],
    },
}

PAGE_METADATA = {
    "index.html": {
        "title": "Copernicus Sentinel Operations Dashboard | Real-Time Satellite Data & Events",
        "description": (
            "The Copernicus Sentinel Operations Dashboard (Sentiboard) provides real-time satellite data,"
            " mission events, data availability, and acquisition status for ESA's Copernicus Sentinel missions. "
            "Monitor Earth observation activities, satellite events, and mission performance through the official ESA operations dashboard. "
            "ESA operations dashboard."
        ),
        "page_keywords": [
            "Copernicus Sentinel Operations Dashboard",
            "Sentiboard real-time satellite data",
            "ESA Sentinel mission events",
            "Sentinel data availability monitoring",
            "Acquisition status of Copernicus satellites",
            "Sentinel processors release timeline",
            "Real-time satellite event dashboard",
        ],
    },
    "about.html": {
        "title": "About the Copernicus Sentinel Dashboard | ESA Earth Observation Missions",
        "description": (
            "Learn about the Copernicus Sentinel Dashboard (Sentiboard) and how it supports real-time monitoring of ESA Earth observation missions. "
            "Discover how Sentinel satellite data availability, acquisition status, and mission events are tracked to provide reliable satellite data services. "
        ),
        "page_keywords": [
            "Copernicus Earth observation programme",
            "Sentinel satellite data monitoring",
            "ESA Copernicus Space Component",
            "Sentinel mission planning and acquisition",
            "Copernicus Operations Dashboard overview",
            "Earth observation mission data services",
            "Sentinel data availability and quality",
            "Copernicus Ground Segment transformation",
        ],
    },
    "acquisitions-status.html": {
        "title": "Sentinel Acquisition Status Map | Copernicus Satellite Observation Schedule",
        "description": (
            "Explore the Sentinel acquisition status map on the Copernicus Sentinel Dashboard (Sentiboard). Visualize real-time satellite acquisition planning, "
            "sensing scenarios, orbit data, and observation schedules for Sentinel missions using an interactive 3D globe. "
        ),
        "page_keywords": [
            "Sentinel acquisition status map",
            "Copernicus satellite observation schedule",
            "Real-time Sentinel acquisition planning",
            "Interactive 3D globe Sentinel missions",
            "Sentinel orbit data and sensing scenarios",
            "Datatake filtering by satellite or date",
            "Published Sentinel products overview",
            "Copernicus acquisition plans visualization",
        ],
    },
    "events.html": {
        "title": "Sentinel Events & Anomalies | Real-Time Copernicus Mission Operations",
        "description": (
            "Browse Sentinel mission events on the Copernicus Sentinel Dashboard (Sentiboard), including real-time events, satellite anomalies,  "
            "calibration activities, and mission manoeuvres. Understand how operational events impact Sentinel data production and availability."
        ),
        "page_keywords": [
            "Sentinel mission events dashboard",
            "Copernicus real-time satellite anomalies",
            "Sentinel calibration activities",
            "Mission Manoeuvre impact on data",
            "ESA Sentinel operations monitoring",
            "Sentinel data completeness analysis",
            "Event types affecting satellite products",
            "Real-time Copernicus event tracking",
        ],
    },
    "data-availability.html": {
        "title": "Copernicus Sentinel Data Availability | Real-Time Earth Observation Data",
        "description": (
            "Monitor Copernicus Sentinel data availability in real time using the Sentiboard. "
            "Track satellite data access, publication completeness, data quality, and delivery status "
            "across Sentinel missions and Earth observation collections."
        ),
        "page_keywords": [
            "Copernicus Sentinel data availability",
            "Real-time Earth observation data",
            "Sentinel data publication completeness",
            "Acquisition platform and sensor mode tracking",
            "Sentinel data delivery status monitoring",
            "Filter datatakes by mission or satellite",
            "Sentinel-5P data access monitoring",
            "Copernicus satellite data quality metrics",
        ],
    },
    "processors-viewer.html": {
        "title": "Copernicus Sentinel Processor Releases | ESA Data Processing Timeline",
        "description": (
            "Explore the Copernicus Sentinel processor releases timeline on the Sentiboard. "
            "Track ESA processor versions, data processing updates, and changes across the "
            "Copernicus processing chain using an interactive release history."
        ),
        "page_keywords": [
            "Copernicus Sentinel processor releases",
            "ESA Sentinel data processing timeline",
            "Interactive processor release history",
            "Sentinel processor version tracking",
            "Copernicus processing chain updates",
            "Timeline of Sentinel data processing",
            "Sentinel data processing change log",
            "Processor releases and satellite data updates",
        ],
    },
}
# Default fallback metadata for any page not listed above:
DEFAULT_PAGE_METADATA = {
    "title": "Copernicus Sentinel Operations Dashboard | ESA Earth Observation",
    "description": (
        "The Copernicus Sentinel Operations Dashboard (Sentiboard) provides real-time satellite data, "
        "mission events, data availability, and acquisition status for ESA Earth observation missions. "
        "Explore satellite operations, Sentinel mission monitoring, and Copernicus data services."
    ),
    "page_keywords": [
        "Copernicus Sentinel Operations Dashboard",
        "Sentiboard real-time satellite data",
        "ESA Sentinel mission events",
        "Sentinel data availability monitoring",
        "Acquisition status of Copernicus satellites",
        "Sentinel processors release timeline",
        "Real-time satellite event dashboard",
    ],
}

# List of services and their cache keys -- data-access.html
SERVICE_CACHE_MAP = {
    "DAS": "DD_DAS",
    "DHUS": "DD_DHUS",
    "ACRI": "LTA_Acri",
    "CLOUDFERRO": "LTA_CloudFerro",
    "EXPRIVIA": "LTA_Exprivia",
    "WERUM": "LTA_Werum",
}

SERVICE_COLOR_MAP = {
    "DAS": "info",
    "DHUS": "warning",
    "ACRI": "primary",
    "CLOUDFERRO": "secondary",
    "EXPRIVIA": "success",
    "WERUM": "warning",
}


def get_metadata(template):
    return PAGE_METADATA.get(template, DEFAULT_PAGE_METADATA)


@blueprint.route("/index")
def index():
    metadata = get_metadata("index.html")
    metadata["page_url"] = request.url
    return render_template("home/index.html", segment="index", **metadata)


@blueprint.route("/<template>")
def route_template(template):
    try:
        if not template.endswith(".html"):
            abort(404)

@blueprint.route("/events")
def events():
    try:
        metadata = get_metadata("events.html")
        metadata["page_url"] = request.url

        if template in admin_pages:

            # Serve the file (if exists) from app/templates/admin/FILE.html
            return render_template("admin/" + template, segment=segment, **metadata)

        # Serve the file (if exists) from app/templates/home/FILE.html
        return render_template("home/" + template, segment=segment, **metadata)

    except TemplateNotFound:
        return render_template("home/page-404.html"), 404

    except:
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


# --- BASIC AUTH ---
def check_auth(username, password):
    return username == "admin" and password == "yourpassword"


def authenticate():
    return Response(
        "Login required.", 401, {"WWW-Authenticate": 'Basic realm="Login Required"'}
    )


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return authenticate()
        return f(*args, **kwargs)

    return decorated


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

    requested_period = request.args.get("period", "prev-quarter-specific")
    if requested_period == "prev-quarter":
        period_id = "prev-quarter-specific"
    else:
        period_id = requested_period

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

    acquisitions = acquisitions_utils._cache_to_list(flask_cache.get(acquisitions_key))
    edrs_acquisitions = acquisitions_utils._cache_to_list(flask_cache.get(edrs_key))

    payload = acquisitions_utils.build_acquisition_payload(
        acquisitions, edrs_acquisitions, period_id=period_id
    )

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
    # ---- check user authorization
    authorized = auth_utils.is_user_authorized(["admin", "ecuser", "esauser"])
    if not authorized:
        abort(403)

    current_app.logger.info("[SPACE SEGMENT] SSR route START")

    # ---- period selection (SSR)
    period = request.args.get("period", "prev-quarter-specific")

    if period == "prev-quarter":
        period = "prev-quarter-specific"

    now = datetime.now(timezone.utc)

    current_app.logger.info(
        "[SPACE SEGMENT] Incoming request: period=%s",
        request.args.get("period"),
    )

    cache_prefix = "last"

    if period == "day":
        cache_range = "24h"
        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif period == "week":
        cache_range = "7d"
        period_start = now - relativedelta(days=7)
        period_end = now
    elif period == "month":
        cache_range = "30d"
        period_start = now - relativedelta(days=30)
        period_end = now
    elif period == "prev-quarter-specific":
        period = "prev-quarter-specific"
        cache_prefix = "previous"
        cache_range = "quarter"
        year = now.year
        quarter = (now.month - 1) // 3 + 1

        if quarter == 1:
            start_year = year - 1
            start_month = 10
        else:
            start_year = year
            start_month = (quarter - 2) * 3 + 1

        period_start = datetime(start_year, start_month, 1, tzinfo=timezone.utc)
        period_end = (period_start + relativedelta(months=3)) - relativedelta(seconds=1)
    else:
        # Fallback for "last-quarter" or anything else
        cache_range = "quarter"
        period_start = now - relativedelta(months=3)
        period_end = now

    current_app.logger.info(
        "[SPACE SEGMENT] Period resolved -> period=%s start=%s end=%s",
        period,
        period_start.isoformat(),
        period_end.isoformat(),
    )

    # ---- cache keys
    datatakes_key = datatakes_cache.datatakes_cache_key.format(
        cache_prefix, cache_range
    )
    unavailability_key = unavailability_cache.unavailability_cache_key.format(
        cache_prefix, cache_range
    )

    # ---- read cache
    def parse_cache(raw):
        if raw is None:
            return []
        if isinstance(raw, Response):
            return raw.get_json(silent=True) or []
        return raw

    datatakes_json = parse_cache(flask_cache.get(datatakes_key))
    unavailability_json = parse_cache(flask_cache.get(unavailability_key))

    datatakes_sources = [
        it.get("_source", it) for it in datatakes_json if isinstance(it, dict)
    ]
    unavailability_sources = [
        it.get("_source", it) for it in unavailability_json if isinstance(it, dict)
    ]

    # ---- build SSR object
    satellites = acquisitions_utils.build_space_segment_ssr(
        datatakes_sources,
        unavailability_sources,
        period_start,
        period_end,
    )

    # ---- compute L0/L1/L2 completeness for SSR tables
    stats = {}
    for sat in satellites.values():
        for dt in sat.get("datatakes", []):
            dt["completeness"] = acquisitions_utils.recalc_completeness(dt)

    for sat_id, sat_data in satellites.items():
        # Calculate % based on total planned hours vs success hours
        unavail = sat_data["unavailability"]
        total_planned = (
            sat_data["success"] + unavail["sat"] + unavail["acq"] + unavail["other"]
        )

        if total_planned > 0:
            sat_data["success_percentage"] = (sat_data["success"] / total_planned) * 100
        else:
            sat_data["success_percentage"] = 100.0

    stats = {
        sat: {
            "success": satellites[sat]["success"],
            "success_percentage": satellites[sat]["success_percentage"],
            "class": satellites[sat]["class"],
            "instruments": satellites[sat]["instruments"],
            "datatakes": satellites[sat]["datatakes"],
            "unavailability": satellites[sat]["unavailability"],
            "events": satellites[sat].get("events", {}),
        }
        for sat in satellites
    }

    space_segment_colors = {
        "S1A": "info",
        "S1C": "info",
        "S2A": "success",
        "S2B": "success",
        "S2C": "success",
        "S3A": "warning",
        "S3B": "warning",
        "S5P": "secondary",
    }

    prev_quarter_label = acquisitions_utils.previous_quarter_label()

    return render_template(
        "home/space-segment.html",
        satellites=satellites,
        segment="acquisition-service",
        period_id=period,
        prev_quarter_label=prev_quarter_label,
        sensing_stats=acquisitions_utils.safe_serialize(stats),
        datatakes=acquisitions_utils.safe_serialize(datatakes_sources),
        unavailability=acquisitions_utils.safe_serialize(unavailability_sources),
        start=period_start.isoformat(),
        end=period_end.isoformat(),
        space_segment_colors=space_segment_colors,
        details_allowed=authorized,
    )


@blueprint.route("/product-timeliness")
@blueprint.route("/product-timeliness.html")
@login_required
def product_timeliness_page():
    TIMELINESS_LABELS = {
        "NTC": "Default Timeliness",
        "NRT": "NRT",
        "STC": "STC",
    }

    TIMELINESS_ORDER_BY_MISSION = {
        "S1": ["NTC", "NRT"],
        "S2": ["NTC"],
        "S3": ["NTC", "NRT", "STC"],
        "S5": ["NTC", "NRT"],
    }

    # ---- check user authorization
    authorized = auth_utils.is_user_authorized(["admin", "ecuser", "esauser"])
    if not authorized:
        abort(403)

    current_app.logger.info("[PRODUCT TIMELINESS] SSR route START")

    # ---- period selection (SSR)
    period = request.args.get("period", "prev-quarter-specific")
    now = datetime.now(timezone.utc)
    period_id = None

    # ---- determine previous calendar quarter (always)
    quarter_index = (now.month - 1) // 3
    prev_quarter_start_month = quarter_index * 3 - 2
    prev_quarter_year = now.year
    if prev_quarter_start_month <= 0:
        prev_quarter_start_month += 12
        prev_quarter_year -= 1

    prev_quarter_start = datetime(
        prev_quarter_year, prev_quarter_start_month, 1, tzinfo=timezone.utc
    )
    prev_quarter_end = (
        prev_quarter_start + relativedelta(months=3) - relativedelta(seconds=1)
    )
    prev_quarter_label = acquisitions_utils.previous_quarter_label()

    if period == "day":
        period_start = now - relativedelta(days=1)
        period_end = now
        mode = "last"
        period_id = "24h"

    elif period == "week":
        period_start = now - relativedelta(days=7)
        period_end = now
        mode = "last"
        period_id = "7d"

    elif period == "month":
        period_start = now - relativedelta(days=30)
        period_end = now
        mode = "last"
        period_id = "30d"

    elif period in ("prev-quarter", "prev-quarter-specific", "last-3-months"):
        # Treat both as fixed previous quarter
        period_start = prev_quarter_start
        period_end = prev_quarter_end
        period_id = "quarter"
        mode = "previous"

    else:
        abort(400)

    cache_key = timeliness_cache.timeliness_cache_key_format.format(mode, period_id)

    # ---- log period for debugging
    current_app.logger.info(
        "[PRODUCT TIMELINESS] Selected period: %s (%s → %s), period_id=%s, cache_key=%s",
        period,
        period_start.isoformat(),
        period_end.isoformat(),
        period_id,
        cache_key,
    )

    # ---- get from cache (may be Response, dict, or None)
    timeliness_data = flask_cache.get(cache_key)

    # ---- normalize Response early (important)
    if hasattr(timeliness_data, "get_json"):
        current_app.logger.info(
            "[PRODUCT TIMELINESS] Cache returned Response, extracting JSON"
        )
        timeliness_data = timeliness_data.get_json()

    # ---- decide if cache must be recomputed
    needs_reload = (
        not isinstance(timeliness_data, dict)
        or not isinstance(timeliness_data.get("data"), list)
        or len(timeliness_data.get("data", [])) == 0
    )

    if needs_reload:
        current_app.logger.info(
            "[PRODUCT TIMELINESS] Cache reload using period_id=%s (from period=%s)",
            period_id,
            period,
        )

        current_app.logger.warning(
            "[PRODUCT TIMELINESS] Cache empty → recompute for %s", period
        )

        if mode == "previous":
            timeliness_cache.load_timeliness_cache_previous_quarter()
        else:
            timeliness_cache.timeliness_load_cache(period_id)

        timeliness_data = flask_cache.get(cache_key)

        if hasattr(timeliness_data, "get_json"):
            timeliness_data = timeliness_data.get_json()

    # ---- final validation
    if not isinstance(timeliness_data, dict):
        current_app.logger.error(
            "[PRODUCT TIMELINESS] Unexpected cache payload after reload: %r",
            timeliness_data,
        )
        abort(500)

    # ---- extract list payload (THIS is the real data)
    raw_items = timeliness_data.get("data", [])

    if not isinstance(raw_items, list):
        current_app.logger.error(
            "[PRODUCT TIMELINESS] 'data' is not a list: %r",
            raw_items,
        )
        abort(500)

    # ---- build SSR view model
    view_model = {}

    for item in raw_items:
        if not isinstance(item, dict):
            continue

        mission = item.get("mission")
        timeliness = item.get("timeliness")

        if not mission or not timeliness:
            continue

        product_group = item.get("product_group")

        # Sentinel-3 MUST be split by product
        if mission == "S3" and not product_group:
            current_app.logger.info(
                f"Skipping S3 item without product group: {timeliness}"
            )
            continue

        # Sentinel-5: product_group is implicit (L1 / L2)
        if mission == "S5" and not product_group:
            # Try to infer from item content
            inferred_pg = (
                item.get("product_level")
                or item.get("level")
                or item.get("processing_level")
            )

            if inferred_pg:
                product_group = inferred_pg.upper()
            else:
                current_app.logger.info(
                    f"Skipping S5 item without inferable product group: {timeliness}"
                )
                continue

        timeliness_key = timeliness.upper()
        total = item.get("total_count", 0)
        on_time = item.get("on_time", 0)

        value = round((on_time / total) * 100, 2) if total else 0.0

        try:
            threshold = int(item.get("threshold"))
        except (TypeError, ValueError):
            threshold = None

        mission_block = view_model.setdefault(mission, {})
        timeliness_block = mission_block.setdefault(timeliness_key, {})

        chart_payload = {
            "value": value,
            "threshold": threshold,
            "label": TIMELINESS_LABELS.get(timeliness_key, timeliness_key),
            "pieId": (
                f"{mission}-{timeliness_key}"
                + (f"-{product_group.upper()}" if product_group else "")
                + "-gauge-chart"
            ).lower(),
        }

        # Mission-level chart
        if product_group:
            timeliness_block[product_group.upper()] = chart_payload
        else:
            timeliness_block["_mission"] = chart_payload

    ordered_view_model = {}

    for mission, mission_block in view_model.items():
        order = TIMELINESS_ORDER_BY_MISSION.get(mission, [])
        ordered_timeliness = {}

        # First: known ordered timeliness
        for t in order:
            if t in mission_block:
                ordered_timeliness[t] = mission_block[t]

        # Then: any unexpected timeliness types
        for t, v in mission_block.items():
            if t not in ordered_timeliness:
                ordered_timeliness[t] = v

        ordered_view_model[mission] = ordered_timeliness

    view_model = ordered_view_model

    current_app.logger.info(
        "[PRODUCT TIMELINESS] View model missions: %s",
        list(view_model.keys()),
    )

    current_app.logger.info(
        "[PRODUCT TIMELINESS] FINAL SSR model size: %s charts",
        sum(len(v) for v in view_model.values()),
    )

    current_app.logger.info(
        "[PT][RENDER] sending to template | period_type=%s | period_id=%s | label=%s",
        period,
        period_id,
        prev_quarter_label,
    )

    if period in ["prev-quarter", "last-3-months"]:
        period_id_for_select = "prev-quarter-specific"
    else:
        period_id_for_select = {
            "24h": "day",
            "7d": "week",
            "30d": "month",
            "quarter": period,
        }.get(period_id, period)

    # ---- render SSR page
    return render_template(
        "home/product-timeliness.html",
        timeliness=view_model,
        missions=MISSIONS,
        period_type=period,
        period_id=period_id_for_select,
        segment="acquisition-service",
        prev_quarter_label=prev_quarter_label,
        raw=timeliness_data,
        period_start=period_start,
        period_end=period_end,
    )


@blueprint.route("/data-access.html")
@login_required
def data_access_page():
    # AUTH
    if current_user.role not in ["admin", "ecuser", "esauser"]:
        abort(403)

    logger.info(
        "[DATA ACCESS] SSR START user=%s role=%s",
        current_user.username,
        current_user.role,
    )

    # PERIOD
    period = request.args.get("time-period-select", "prev-quarter-specific")
    logger.info("[DATA ACCESS] period=%s", period)

    # 2. Normalize 'prev-quarter' to 'prev-quarter-specific' to match your dropdown value
    if period == "prev-quarter" or not period:
        period = "prev-quarter-specific"

    now = datetime.now(timezone.utc)

    if period == "day":
        cache_prefix, cache_range = "last", "24h"
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif period == "week":
        cache_prefix, cache_range = "last", "7d"
        start_date = now - relativedelta(days=7)
        end_date = now
    elif period == "month":
        cache_prefix, cache_range = "last", "30d"
        start_date = now - relativedelta(days=30)
        end_date = now
    elif period == "prev-quarter-specific":
        cache_prefix, cache_range = "previous", "quarter"

        # Exact Calendar Quarter Calculation
        year = now.year
        quarter = (now.month - 1) // 3 + 1
        if quarter == 1:
            start_year, start_month = year - 1, 10
        else:
            start_year, start_month = year, (quarter - 2) * 3 + 1

        start_date = datetime(start_year, start_month, 1, tzinfo=timezone.utc)
        end_date = (start_date + relativedelta(months=3)) - relativedelta(seconds=1)
    else:
        # Fallback for last-3-months
        cache_prefix, cache_range = "last", "quarter"
        start_date = now - relativedelta(months=3)
        end_date = now

    # 3. Synchronize variables for Template and Mapping
    ui_period = period  # For the dropdown 'selected' state
    effective_period = period  # For the SSR payload
    scope = cache_prefix  # 'previous' or 'last'
    cache_period = cache_range  # 'quarter', '24h', etc.

    period_duration_sec = (end_date - start_date).total_seconds()

    logger.info(
        "[DATA ACCESS] Period: %s | Scope: %s | Range: %s to %s",
        period,
        scope,
        start_date,
        end_date,
    )

    # 4. Fetch Cache (Uses your trend/volume format)
    trend_key = publication_cache.publication_trend_api_format.format(
        scope, cache_period
    )
    volume_key = publication_cache.publication_volume_trend_api_format.format(
        scope, cache_period
    )

    raw_trend = flask_cache.get(trend_key)
    raw_volume = flask_cache.get(volume_key)

    def normalize_cache(obj, label):
        if obj is None:
            logger.warning("[SSR][%s] cache MISS", label)
            return {}
        if isinstance(obj, Response):
            return obj.get_json() or {}
        if isinstance(obj, dict):
            return obj
        logger.warning("[SSR][%s] unexpected type=%s", label, type(obj))
        return {}

    raw_trend = normalize_cache(raw_trend, "TREND")
    raw_volume = normalize_cache(raw_volume, "VOLUME")

    trend_data = raw_trend.get("data", {})
    volume_data = raw_volume.get("data", {})

    logger.info(
        "[SSR TREND/VOLUME] trend_keys=%d volume_keys=%d",
        len(trend_data),
        len(volume_data),
    )

    # ===== NEW SSR AVAILABILITY (REPLACES API) =====
    interface_status_map = {svc: [] for svc in SERVICE_CACHE_MAP.keys()}
    for svc_name, elastic_service_name in SERVICE_CACHE_MAP.items():
        logger.info(
            "[SSR][ELASTIC] Fetching interface monitoring svc=%s scope=%s period=%s",
            svc_name,
            scope,
            cache_period,
        )

        # ---- EXACT SAME Elastic calls as API loaders ----
        if scope == "last":
            quarter_items = (
                elastic_interface_monitoring.fetch_interface_monitoring_last_quarter(
                    elastic_service_name
                )
            )

            if cache_period == "quarter":
                raw_items = quarter_items
            else:
                now = datetime.now(timezone.utc)

                def in_window(row, delta):
                    t = acquisitions_utils.parse_utc(
                        row["_source"]["status_time_start"]
                    )
                    return t >= now - delta

                if cache_period == "24h":
                    raw_items = [
                        i for i in quarter_items if in_window(i, timedelta(hours=24))
                    ]
                elif cache_period == "7d":
                    raw_items = [
                        i for i in quarter_items if in_window(i, timedelta(days=7))
                    ]
                elif cache_period == "30d":
                    raw_items = [
                        i for i in quarter_items if in_window(i, timedelta(days=30))
                    ]
                else:
                    raw_items = []
        else:
            raw_items = (
                elastic_interface_monitoring.fetch_interface_monitoring_prev_quarter(
                    elastic_service_name
                )
            )

        logger.info(
            "[SSR][ELASTIC RAW] svc=%s items=%d",
            svc_name,
            len(raw_items),
        )

        # ---- Time-window clipping (IDENTICAL to frontend logic) ----
        for row in raw_items:
            src = row.get("_source", {})
            try:
                start = acquisitions_utils.parse_utc(src["status_time_start"])
                stop = acquisitions_utils.parse_utc(src["status_time_stop"])
            except Exception as e:
                logger.warning("[SSR][PARSE FAIL] %s", e)
                continue

            if stop <= start_date or start >= end_date:
                continue

            interface_status_map[svc_name].append(
                {
                    "start": max(start, start_date),
                    "stop": min(stop, end_date),
                }
            )

    logger.info(
        "[SSR][WINDOWED] svc=%s intervals=%d",
        svc_name,
        len(interface_status_map[svc_name]),
    )

    # AVAILABILITY COMPUTATION
    availability_map = {}

    for svc, intervals in interface_status_map.items():
        unav_sec = sum((i["stop"] - i["start"]).total_seconds() for i in intervals)

        availability = (
            (1.0 - unav_sec / period_duration_sec) * 100.0
            if period_duration_sec > 0
            else 100.0
        )
        availability_map[svc] = availability

        interface_status_map[svc] = [
            {"start": i["start"].isoformat(), "stop": i["stop"].isoformat()}
            for i in intervals
        ]

    logger.info(
        "[SSR][AVAILABILITY] svc=%s unav_sec=%.2f avail=%.5f",
        svc,
        unav_sec,
        availability,
    )

    prev_quarter_label = acquisitions_utils.previous_quarter_label()

    # FINAL RENDER
    return render_template(
        "home/data-access.html",
        segment="acquisition-service",
        ssr_payload={
            "period_type": effective_period,
            "ui_period": ui_period,
            "scope": scope,
            "availability_map": availability_map,
            "interface_status_map": interface_status_map,
            "service_color_map": SERVICE_COLOR_MAP,
            "trend": {
                "sample_times": raw_trend.get("sample_times", []),
                "data": trend_data,
            },
            "volume": {
                "sample_times": raw_volume.get("sample_times", []),
                "data": volume_data,
            },
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        period_type=effective_period,
        period_id=ui_period,
        selected_scope=scope,
        prev_quarter_label=prev_quarter_label,
    )


@blueprint.route("/data-archive.html")
@login_required
def data_archive_page():
    if current_user.role not in ["admin", "ecuser", "esauser"]:
        return "Unauthorized", 403

    services = ["ACRI", "CLOUDFERRO", "EXPRIVIA", "WERUM"]

    periods = {
        "24h": ("last", "24h"),
        "7d": ("last", "7d"),
        "30d": ("last", "30d"),
        "prev-quarter": ("previous", "quarter"),
        "prev-quarter-specific": ("previous", "quarter"),
        "lifetime": ("all", "lifetime"),
    }

    # Build the archive payload
    archive_payload = {}

    for label, (ptype, pid) in periods.items():
        raw = archive_cache.get_archive_cached_data(ptype, pid)
        normalized = acquisitions_utils.normalize_cached_json(raw, default={})
        normalized.setdefault("data", [])
        normalized.setdefault("interval", {"from": None, "to": None})
        archive_payload[label] = acquisitions_utils.safe_serialize(normalized)

    service_monitoring_payload = {}

    for service in services:
        interface_monitoring_cache_ssr.ensure_interface_cache_loaded_ssr(service)

    for label, (ptype, pid) in periods.items():
        start, end = acquisitions_utils.resolve_period_dates(label)

        period_events = []
        for service in services:
            events = interface_monitoring_cache_ssr.load_interface_events_ssr(
                service=service, period_type=ptype, period_id=pid
            )

            # logger.info(
            #     "[SSR][IM][%s][%s] events=%d sample=%s",
            #     service,
            #     label,
            #     len(events),
            #     events[:1],
            # )

            period_events.extend(events)

        interface_status_map = acquisitions_utils.build_interface_status_map(
            period_events
        )

        clean_status_map = {}
        for iface, failures in interface_status_map.items():
            # Remove 'LTA_' and uppercase everything to match UI IDs
            clean_name = iface.replace("LTA_", "").upper()
            clean_status_map[clean_name] = (
                acquisitions_utils.normalize_interface_events(failures)
            )

        interface_status_map = clean_status_map

        availability_map = acquisitions_utils.compute_availability_from_interface_map(
            interface_status_map, start, end
        )

        service_monitoring_payload[label] = {
            "interface_status_map": interface_status_map,
            "availability_map": availability_map,
        }

        for iface, failures in interface_status_map.items():
            logger.info(
                "[SSR][FAILURES][%s][%s] count=%d",
                label,
                iface,
                len(failures),
            )

    for label, monitoring in service_monitoring_payload.items():
        archive_payload.setdefault(label, {})
        archive_payload[label]["availability_map"] = monitoring["availability_map"]
        archive_payload[label]["interface_status_map"] = monitoring[
            "interface_status_map"
        ]

    prev_quarter_label = acquisitions_utils.previous_quarter_label()

    # logger.info("[SSR][DONE] Payload ready")

    return render_template(
        "home/data-archive.html",
        segment="acquisition-service",
        archive_payload=archive_payload,
        prev_quarter_label=prev_quarter_label,
    )


@blueprint.route("/news.html")
@login_required
def news_manager():
    # Attempt to get data
    news_api_uri = events_cache.news_cache_key.format("previous", "quarter")
    cached_res = flask_cache.get(news_api_uri)

    if not cached_res:
        events_cache.load_news_cache_previous_quarter()
        cached_res = flask_cache.get(news_api_uri)

    # cached_res is a Response object in your code, we need the JSON data
    news_data = json.loads(cached_res.get_data()) if cached_res else []

    return render_template("admin/news.html", news_list=news_data)


@blueprint.route("/anomalies.html", methods=["GET", "POST"])
@login_required
def show_anomalies_page():
    if request.method == "POST":
        try:
            # Authorization Check
            if not auth_utils.is_user_authorized(["admin"]):
                flash("Not authorized", "danger")
                return redirect(url_for("home_blueprint.show_anomalies_page"))
            is_new = request.form.get("is_new") == "true"
            key = request.form.get("key")
            logger.info(f"SSR SAVE START: is_new={is_new}, key={key}")
            title = request.form.get("title")
            category = request.form.get("category")
            impacted_item = request.form.get("impactedItem")
            impacted_satellite = request.form.get("impactedSatellite")
            environment = request.form.get("environment")
            news_title = request.form.get("newsTitle")
            news_link = request.form.get("newsLink")
            pub_date_str = request.form.get("publicationDate")

            if is_new:
                if not key or not title:
                    logger.error("ADD FAILED: Key or Title is missing")
                    return redirect(url_for("home_blueprint.show_anomalies_page"))

                try:
                    if len(pub_date_str) <= 10:
                        pub_date_str += " 00:00:00"
                    publication_date = datetime.strptime(
                        pub_date_str, "%d/%m/%Y %H:%M:%S"
                    )
                except Exception as d_err:
                    logger.error(f"DATE PARSE ERROR: {d_err} for string {pub_date_str}")
                    publication_date = datetime.now()

                start_date = publication_date
                end_date = start_date + timedelta(hours=24)

                logger.info(f"Calling save_anomaly for {key}")
                anomalies_model.save_anomaly(
                    title,
                    key,
                    "",
                    publication_date,
                    category,
                    impacted_item,
                    impacted_satellite,
                    start_date,
                    end_date,
                    "",
                    "",
                    news_link,
                    news_title,
                )
            else:
                # --- UPDATE EXISTING ANOMALY LOGIC ---
                logger.info(f"SSR: Updating anomaly {key}")
                anomalies_model.update_anomaly_categorization(
                    key,
                    category,
                    impacted_item,
                    impacted_satellite,
                    environment,
                    news_link,
                    news_title,
                )

            # Force Cache Reload so the table shows new data
            events_cache.load_anomalies_cache_previous_quarter()
            logger.info("SSR SAVE SUCCESSFUL")

        except Exception as ex:
            logger.error(f"CRITICAL ERROR IN SSR SAVE: {ex}", exc_info=True)

        return redirect(url_for("home_blueprint.show_anomalies_page"))

    logger.info("Serving Anomalies Admin Page - Server Side")

    anomalies_api_uri = events_cache.anomalies_cache_key.format("previous", "quarter")
    anomalies_data = flask_cache.get(anomalies_api_uri)

    if isinstance(anomalies_data, Response):
        anomalies_data = anomalies_data.get_data(as_text=True)

    if isinstance(anomalies_data, str):
        try:
            anomalies_list = json.loads(anomalies_data)
        except json.JSONDecodeError:
            anomalies_list = []
    else:
        anomalies_list = anomalies_data or []

    if isinstance(anomalies_list, dict):
        anomalies_list = anomalies_list.get("anomalies", [])

    anomalies_json = json.dumps({a["key"]: a for a in anomalies_list})

    for a in anomalies_list:
        pub_date = a.get("publicationDate")
        if pub_date and isinstance(pub_date, str):
            try:
                a["publicationDate"] = datetime.fromisoformat(pub_date.replace("Z", ""))
            except Exception:
                pass

    return render_template(
        "admin/anomalies.html", anomalies=anomalies_list, anomalies_json=anomalies_json
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


@blueprint.app_template_filter("format_datetime")
def format_datetime(value):
    if not value:
        return "N/A"

    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y %H:%M:%S")

    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", ""))
            return dt.strftime("%d/%m/%Y %H:%M:%S")
        except:
            try:
                dt = datetime.strptime(value, "%d/%m/%Y %H:%M:%S")
                return dt.strftime("%d/%m/%Y %H:%M:%S")
            except:
                return value
    return value


@blueprint.app_template_filter("sortable_date")
def sortable_date(value):
    if not value:
        return "00000000000000"

    dt_obj = None

    if hasattr(value, "strftime"):
        dt_obj = value
    elif isinstance(value, str):
        try:
            dt_obj = datetime.fromisoformat(value.replace("Z", ""))
        except:
            try:
                dt_obj = datetime.strptime(value, "%d/%m/%Y %H:%M:%S")
            except:
                return value

    if dt_obj:
        return dt_obj.strftime("%Y%m%d%H%M%S")
    return value
