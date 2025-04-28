# -*- encoding: utf-8 -*-
"""
Copyright (c) 2019 - present AppSeed.us
"""

import json
import re

from flask import Response
from flask import render_template, redirect, request, url_for
from flask_login import current_user, login_user, logout_user, login_required

import apps.utils.auth_utils as auth_utils
from apps import db, login_manager
from apps.models.user_role import delete_role as model_delete_role
from apps.models.user_role import get_roles as model_get_roles
from apps.models.user_role import save_role as model_save_role
from apps.models.users import Users
from apps.models.users import delete_user as model_delete_user
from apps.models.users import get_users as model_get_users
from apps.models.users import save_user as model_save_user
from apps.models.users import update_user as model_update_user
from apps.routes.auth import blueprint
from apps.routes.auth.forms import LoginForm, CreateAccountForm
from apps.utils import db_utils
from apps.utils.auth_utils import verify_pass


@blueprint.route("/")
def route_default():
    return redirect(url_for("home_blueprint.index"))


# Login


@blueprint.route("/login", methods=["GET", "POST"])
def login():
    login_form = LoginForm(request.form)
    if "login" in request.form:

        # read form data
        username = request.form["username"]
        password = request.form["password"]

        # Locate user
        user = Users.query.filter_by(username=username).first()

        # Check the password
        if user and verify_pass(password, user.password):
            login_user(user)
            return redirect(url_for("auth_blueprint.route_default"))

        # Something (user or pass) is not ok
        return render_template(
            "accounts/login.html", msg="Wrong user or password", form=login_form
        )

    if not current_user.is_authenticated:
        return render_template("accounts/login.html", form=login_form)
    return redirect(url_for("home_blueprint.index"))


@blueprint.route("/register", methods=["GET", "POST"])
def register():
    create_account_form = CreateAccountForm(request.form)
    if "register" in request.form:

        username = request.form["username"]
        email = request.form["email"]

        # Check usename exists
        user = Users.query.filter_by(username=username).first()
        if user:
            return render_template(
                "accounts/register.html",
                msg="Username already registered",
                success=False,
                form=create_account_form,
            )

        # Check email exists
        user = Users.query.filter_by(email=email).first()
        if user:
            return render_template(
                "accounts/register.html",
                msg="Email already registered",
                success=False,
                form=create_account_form,
            )

        # else we can create the user
        user = Users(**request.form)
        db.session.add(user)
        db.session.commit()

        return render_template(
            "accounts/register.html",
            msg="User created successfully.",
            success=True,
            form=create_account_form,
        )

    else:
        return render_template("accounts/register.html", form=create_account_form)


@blueprint.route("/logout")
def logout():
    logout_user()
    return redirect(url_for("auth_blueprint.route_default"))


# Users management


@blueprint.route("/api/auth/users", methods=["GET"])
@login_required
def get_users():
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        regexp = re.compile(
            r"(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)"
        )
        if request.remote_addr == "localhost" or regexp.search(request.remote_addr):
            users = model_get_users()
            return Response(
                json.dumps(users, cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=200,
            )
        else:
            return Response(
                json.dumps("Unauthorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/auth/user", methods=["GET"])
def get_user():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        user = auth_utils.get_user_info()

        return Response(
            json.dumps(user, cls=db_utils.AlchemyEncoder),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/auth/user", methods=["POST"])
@login_required
def post_save_user():
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        regexp = re.compile(
            r"(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)"
        )
        if request.remote_addr == "localhost" or regexp.search(request.remote_addr):
            data = json.loads(request.data.decode("utf8"))
            if data.get("username") is None or data.get("email") is None:
                return Response(
                    json.dumps({"error": "500"}),
                    mimetype="application/json",
                    status=500,
                )
            if data.get("id") is None:
                user = model_save_user(
                    data.get("username"),
                    data.get("email"),
                    data.get("password"),
                    data.get("role"),
                )
            else:
                user = model_update_user(
                    data.get("id"),
                    data.get("username"),
                    data.get("email"),
                    data.get("password"),
                    data.get("role"),
                )
            if user is not None:
                data["password"] = None
            return Response(
                json.dumps(data, cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=200,
            )
        else:
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/auth/user", methods=["DELETE"])
@login_required
def delete_user():
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        regexp = re.compile(
            r"(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)"
        )
        if request.remote_addr == "localhost" or regexp.search(request.remote_addr):
            data = json.loads(request.data.decode("utf8"))
            if data.get("username") is None:
                return Response(
                    json.dumps({"error": "500"}),
                    mimetype="application/json",
                    status=500,
                )
            user = model_delete_user(data.get("username"))
            return Response(
                json.dumps(data, cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=200,
            )
        else:
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/auth/quarter-authorized", methods=["GET"])
def get_quarter_authorized():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        user = auth_utils.get_user_info()

        return Response(
            json.dumps(
                {"authorized": user.get("role") in ("admin", "ecuser", "esauser")}
            ),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/auth/datatakes-details-authorized", methods=["GET"])
def get_datatakes_details_authorized():
    try:
        if not auth_utils.is_user_authorized(["admin", "esauser"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        user = auth_utils.get_user_info()

        return Response(
            json.dumps({"authorized": user.get("role") in ("admin", "esauser")}),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


# Roles management


@blueprint.route("/api/auth/roles", methods=["GET"])
@login_required
def get_roles():
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        regexp = re.compile(
            r"(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)"
        )
        if request.remote_addr == "localhost" or regexp.search(request.remote_addr):
            roles = model_get_roles()
            return Response(
                json.dumps(roles, cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=200,
            )
        else:
            return Response(
                json.dumps("Unauthorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/auth/role", methods=["POST"])
@login_required
def post_save_role():
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        regexp = re.compile(
            r"(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)"
        )
        if request.remote_addr == "localhost" or regexp.search(request.remote_addr):
            data = json.loads(request.data.decode("utf8"))
            if data.get("name") is None:
                return Response(
                    json.dumps({"error": "500"}),
                    mimetype="application/json",
                    status=500,
                )
            role = model_save_role(data.get("name"), data.get("description"))
            return Response(
                json.dumps(data, cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=200,
            )
        else:
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/auth/role", methods=["DELETE"])
@login_required
def delete_role():
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        regexp = re.compile(
            r"(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)"
        )
        if request.remote_addr == "localhost" or regexp.search(request.remote_addr):
            data = json.loads(request.data.decode("utf8"))
            if data.get("name") is None:
                return Response(
                    json.dumps({"error": "500"}),
                    mimetype="application/json",
                    status=500,
                )
            role = model_delete_role(data.get("name"))
            return Response(
                json.dumps(data, cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=200,
            )
        else:
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


# Errors


@login_manager.unauthorized_handler
def unauthorized_handler():
    return render_template("home/page-403.html"), 403


@blueprint.errorhandler(403)
def access_forbidden(error):
    return render_template("home/page-403.html"), 403


@blueprint.errorhandler(404)
def not_found_error(error):
    return render_template("home/page-404.html"), 404


@blueprint.errorhandler(500)
def internal_error(error):
    return render_template("home/page-500.html"), 500
