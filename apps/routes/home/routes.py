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

        # Detect the current page
        segment = get_segment(request)
        # Serve the file (if exists) from app/templates/home/FILE.html
        # or from app/templates/admin/FILE.html, depending on the requested page
        admin_pages = ["users.html", "roles.html", "news.html", "anomalies.html"]

        # Get metadata safely
        metadata = get_metadata(template)
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
        return f"An error occurred: {e}", 500
