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

from flask import render_template, request, current_app, Response
from flask_login import current_user
from jinja2 import TemplateNotFound
from urllib.parse import urlparse, urljoin
from apps.routes.home import blueprint
from apps.elastic.modules import datatakes as datatakes_module
from functools import wraps
from apps.elastic.modules import anomalies as elastic_anomalies
import os
import json
import traceback
import logging


@blueprint.route('/index')
def index():
    return render_template('home/index.html', segment='index')


@blueprint.route('/events')
def events():
    
    quarter_authorized = False
    if current_user.is_authenticated:
        quarter_authorized = current_user.role in ("admin", "ecuser", "esauser")

    if quarter_authorized:
        raw_events = elastic_anomalies.fetch_anomalies_prev_quarter()
    else:
        raw_events = elastic_anomalies.fetch_anomalies_last_quarter()
    
    anomalies = raw_events
    
    return render_template(
        "home/events.html",
        quarter_authorized=quarter_authorized,
        anomalies=anomalies
    )
    
@blueprint.route('/data-availability')
def data_availability():
    """
     Render the Data Availability page with datatakes data embedded via SSR.
    """
    try:
        quarter_authorized = False
        if current_user.is_authenticated:
            quarter_authorized = current_user.role in ("admin", "ecuser", "esauser")

        raw_events = elastic_anomalies.fetch_anomalies_prev_quarter() if quarter_authorized else elastic_anomalies.fetch_anomalies_last_quarter()
        anomalies = raw_events

        if quarter_authorized:
            datatakes_data = datatakes_module.fetch_anomalies_datatakes_prev_quarter()
        else:
            datatakes_data = datatakes_module.fetch_anomalies_datatakes_last_quarter()

        return render_template(
            "home/data-availability.html",
            quarter_authorized=quarter_authorized,
            datatakes=datatakes_data,
            anomalies=anomalies
        )
    except Exception as e:
        current_app.logger.error(f"Exception in data_availability: {e}", exec_info=True)
        return render_template("home/page-500.html"), 500

@blueprint.route('/<template>')
def route_template(template):
    try:
        if not template.endswith('.html'):
            template += '.html'

        # Detect the current page
        segment = get_segment(request)

        # List of admin pages
        admin_pages = ['users.html', 'roles.html', 'news.html', 'anomalies.html']

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
        return render_template('home/page-404.html'), 404

    except Exception as e:
        current_app.logger.exception(e)
        return render_template('home/page-500.html'), 500

# Helper - Extract current page name from request
def get_segment(request):
    try:

        segment = request.path.split('/')[-1]

        if segment == '':
            segment = 'index'

        return segment

    except:
        return None



# --- BASIC AUTH ---
def check_auth(username, password):
    return username == 'admin' and password == 'yourpassword'  

def authenticate():
    return Response('Login required.', 401, {'WWW-Authenticate': 'Basic realm="Login Required"'})

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
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc

@blueprint.route("/admin/message", methods=["GET"])
def admin_home_message():
    try:
        # This empty object is used to populate the form initially
        empty_message = {
            "title": "",
            "text": "",
            "link": "",
            "messageType": "info",
            "publicationDate": ""
        }

        return render_template("admin/newMessages.html", message=empty_message, segment="admin-message")

    except Exception as e:
        current_app.logger.error("Exception in admin_home_message: %s", traceback.format_exc())
        return f"An error occurred: {e}", 500

   

