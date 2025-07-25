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

from apps.routes.home import blueprint
from functools import wraps
import os
import json


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

# --- Admin route to manage the home banner ---
@blueprint.route("/admin/message", methods=["GET", "POST"])
# --- @requires_auth ---
def admin_home_message():
    json_path = os.path.join(current_app.root_path, "static/assets/json/custom-message.json")
    os.makedirs(os.path.dirname(json_path), exist_ok=True)

    try:
        with open(json_path, "r") as f:
            messages = json.load(f)
            if not isinstance(messages, list):
                messages = []
    except Exception:
        messages = []

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

        return redirect("/index_2.html")

    return render_template("admin/admin-message.html", message=messages, segment="admin-message")

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

