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

from flask import render_template, request, redirect, url_for, flash, current_app, Response, Flask, jsonify
from jinja2 import TemplateNotFound
from urllib.parse import urlparse, urljoin
from apps.routes.home import blueprint
from functools import wraps
import os
import json
import traceback


@blueprint.route('/index')
def index():
    return render_template('home/index.html', segment='index')


@blueprint.route('/<template>')
def route_template(template):
    try:

        if not template.endswith('.html'):
            template += '.html'

        # Detect the current page
        segment = get_segment(request)

        # Serve the file (if exists) from app/templates/home/FILE.html
        # or from app/templates/admin/FILE.html, depending on the requested page
        admin_pages = ['users.html', 'roles.html', 'news.html', 'anomalies.html']
        if template in admin_pages:

            # Serve the file (if exists) from app/templates/admin/FILE.html
            return render_template("admin/" + template, segment=segment)

        # Serve the file (if exists) from app/templates/home/FILE.html
        return render_template("home/" + template, segment=segment)

    except TemplateNotFound:
        return render_template('home/page-404.html'), 404

    except:
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

# --- @requires_auth to put this below the next line---
@blueprint.route("/admin/message", methods=["GET", "POST"])  
def admin_home_message():
    try:
        json_path = os.path.join(current_app.root_path, "static/assets/json/custom-message.json")
        os.makedirs(os.path.dirname(json_path), exist_ok=True)

        try:
            with open(json_path, "r") as f:
                messages = json.load(f)
                if not isinstance(messages, list):
                    messages = []
        except Exception:
            messages = []


        empty_message = {
            "active": False,
            "type": "info",
            "text": "",
            "link": ""
        }

        if request.method == "POST":
            new_message = {
                "active": request.form.get("active") == "on",
                "type": request.form.get("type", "info"),
                "text": request.form.get("text", ""),
                "link": request.form.get("link", "")
            }
            messages.insert(0, new_message)

            try:
                with open(json_path, "w") as f:
                    json.dump(messages, f, indent=2)
                flash("Message saved!", "success")
            except Exception as e:
                current_app.logger.error(f"Error writing JSON: {e}")
                flash("Failed to save message", "danger")

            next_url = request.form.get('next')
            if next_url and is_safe_url(next_url):
                return redirect(next_url)
            return redirect("/index_3.html")
        

        return render_template("admin/admin-message.html", message=empty_message, segment="admin-message")
    except Exception as e:
            current_app.logger.error("Exception in admin_home_message: %s", traceback.format_exc())
            # Return an error page or message for debugging
            return f"An error occurred: {e}", 500

@blueprint.route('/api/news-images')
def list_news_images():
    image_folder = os.path.join(current_app.static_folder, 'assets', 'img', 'news')

    try:
        images = [
            f for f in os.listdir(image_folder)
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))
        ]
    except FileNotFoundError:
        images = []

    return jsonify(images)

