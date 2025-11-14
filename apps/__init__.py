# -*- encoding: utf-8 -*-
"""
Copyright (c) 2019 - present AppSeed.us
"""

import os
import socket
from importlib import import_module
from pathlib import Path

from flask import Flask, request, send_from_directory, Response
from flask_caching import Cache
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
login_manager = LoginManager()


def register_extensions(app):
    db.init_app(app)
    login_manager.init_app(app)


def register_blueprints(app):
    path = os.getcwd() + "/apps/routes/"
    p = Path(path)
    subdirectories = [x for x in p.iterdir() if x.is_dir()]
    for module_name in subdirectories:
        module_name = str(module_name).replace(path, "")
        if (
            module_name is None
            or module_name.startswith("_")
            or module_name == ""
            or module_name.isspace()
            or "apps.routes.." in "apps.routes.{}.routes".format(module_name)
        ):
            continue
        module = import_module("apps.routes.{}.routes".format(module_name))
        app.register_blueprint(module.blueprint)


def configure_database(app):
    from apps.models.instant_messages import InstantMessages

    @app.before_first_request
    def initialize_database():
        app.logger.info("Initializing Database")
        db.create_all()
        app.logger.info("Database initialization completed")

    @app.teardown_request
    def shutdown_session(exception=None):
        db.session.remove()


def start_scheduler(app):
    def schedule_process():
        import schedule
        import apps.utils.html_utils as html_utils
        from apps.cache.modules import (
            acquisitions,
            publication,
            archive,
            timeliness,
            unavailability,
            events,
            datatakes,
            interface_monitoring,
            acquisitionplans,
            acquisitionassets,
        )
        from apps.ingestion import news_ingestor, anomalies_ingestor

        ################################################################################################################
        ##                                                                                                            ##
        ##  Wrapping functions, used to invoke the ingestion of new anomalies and the update of datatakes with the    ##
        ##  "app_context()" imported. This is mandatory, to allow saving results on the local DB.                     ##
        ##                                                                                                            ##
        ################################################################################################################

        def news_updater():
            with app.app_context():
                pass
                # news_ingestor.NewsIngestor().ingest_news()

        def anomalies_updater():
            with app.app_context():
                anomalies_ingestor.AnomaliesIngestor().ingest_anomalies()

        def news_cache_loader():
            with app.app_context():
                pass
                # events.load_news_cache_previous_quarter()

        def anomalies_cache_loader():
            with app.app_context():
                events.load_anomalies_cache_previous_quarter()

        def datatakes_cache_loader():
            with app.app_context():
                datatakes.load_datatakes_cache_last_quarter()

        def datatakes_prev_quarter_cache_loader():
            with app.app_context():
                datatakes.load_datatakes_cache_previous_quarter()

        def acquisition_plans_cache_loader():
            with app.app_context():
                acquisitionplans.load_all_acquisition_plans()

        def acquisition_plans_cache_completeness_loader():
            with app.app_context():
                acquisitionplans.update_acquisition_completeness()

        def acquisition_assets_cache_loader():
            with app.app_context():
                acquisitionassets.load_stations()
                acquisitionassets.load_satellite_orbits()

        def data_access_status_monitoring_cache_loader():
            with app.app_context():
                interface_monitoring.load_interface_monitoring_cache_last_quarter(
                    "DD_DAS"
                )
                # interface_monitoring.load_interface_monitoring_cache_last_quarter('DD_DHUS')

        def data_access_status_monitoring_cache_loader_prev_quarter():
            with app.app_context():
                interface_monitoring.load_interface_monitoring_cache_prev_quarter(
                    "DD_DAS"
                )
                # interface_monitoring.load_interface_monitoring_cache_prev_quarter('DD_DHUS')

        def data_archive_status_monitoring_cache_loader():
            with app.app_context():
                interface_monitoring.load_interface_monitoring_cache_last_quarter(
                    "LTA_Acri"
                )
                interface_monitoring.load_interface_monitoring_cache_last_quarter(
                    "LTA_CloudFerro"
                )
                interface_monitoring.load_interface_monitoring_cache_last_quarter(
                    "LTA_Exprivia"
                )
                interface_monitoring.load_interface_monitoring_cache_last_quarter(
                    "LTA_Werum"
                )

        def data_archive_status_monitoring_cache_loader_prev_quarter():
            with app.app_context():
                interface_monitoring.load_interface_monitoring_cache_prev_quarter(
                    "LTA_Acri"
                )
                interface_monitoring.load_interface_monitoring_cache_prev_quarter(
                    "LTA_CloudFerro"
                )
                interface_monitoring.load_interface_monitoring_cache_prev_quarter(
                    "LTA_Exprivia"
                )
                interface_monitoring.load_interface_monitoring_cache_prev_quarter(
                    "LTA_Werum"
                )

        ################################################################################################################
        ##                                                                                                            ##
        ##  This is the main backend orchestrator: it is meant to schedule the execution of all listed jobs, so to    ##
        ##  populate the application cache, without need of executing runtime queries. This method is divided into    ##
        ##  three main sections:                                                                                      ##
        ##  1. The ingestion of anomalies, to be executed once per hour                                               ##
        ##  2. The update of data collected in the last quarter, to be executed once per hour                         ##
        ##  3. The reload of consolidated data from the previous quarter, to be executed once per day                 ##
        ##                                                                                                            ##
        ################################################################################################################
        """
        """
        ################################################################################################################
        # 1. Ingest News and Anomalies
        # schedule.every().hour.at(":00").do(news_updater)
        schedule.every().hour.at(":00").do(anomalies_updater)

        ################################################################################################################
        # 2. Populate cache - load data in the last quarter
        # Load News and Anomalies
        # schedule.every().hour.at(":01").do(news_cache_loader)
        schedule.every().hour.at(":01").do(anomalies_cache_loader)

        # Load Datatakes for all missions
        schedule.every().hour.at(":02").do(datatakes_cache_loader)

        # Load acquisition assets (orbits)
        schedule.every(4).hours.at(":04").do(acquisition_assets_cache_loader)

        # Load Product Timeliness for different Time Periods, for all the missions
        schedule.every().hour.at(":05").do(
            timeliness.load_all_periods_timeliness_cache
        ).tag("Timeliness")

        # Load Publication statistics for different Time Periods, for all the missions
        schedule.every().hour.at(":08").do(
            publication.load_all_periods_publication_stats_cache
        ).tag("Publication")

        # Load Archive statistics for different Time Periods, for all the missions
        schedule.every().hour.at(":09").do(
            publication.load_all_periods_publication_trend_cache
        ).tag("Publication")

        # Load Long Term Archive statistics for different Time Periods, for all the missions
        schedule.every().hour.at(":11").do(archive.load_all_periods_archive_cache).tag(
            "Archive"
        )

        # Load Long Term Archive statistic from start of operations, for all the missions
        schedule.every().hour.at(":13").do(archive.load_archive_cache_lifetime).tag(
            "Archive"
        )

        # Load Acquisition statistics for all ground station, including EDRS
        schedule.every().hour.at(":14").do(
            acquisitions.load_acquisitions_cache_last_quarter
        ).tag("Acquisitions")
        schedule.every().hour.at(":14").do(
            acquisitions.load_edrs_acquisitions_cache_last_quarter
        ).tag("Acquisitions")

        # Load Unavailability occurrences for all platforms
        schedule.every().hour.at(":15").do(
            unavailability.load_unavailability_cache_last_quarter
        ).tag("Unavailability")

        # Load Status interface monitoring for "DD_DAS" and "DD_DHUS"
        schedule.every().hour.at(":19").do(
            data_access_status_monitoring_cache_loader
        ).tag("Data Access Status")

        # Load Status interface monitoring for "LTA_Acri", "LTA_CloudFerro", "LTA_Exprivia", "LTA_Werum"
        schedule.every().hour.at(":21").do(
            data_archive_status_monitoring_cache_loader
        ).tag("Data Archive Status")

        ################################################################################################################
        # 3. Populate cache - load data from the previously completed quarter
        # Load Datatakes for all missions
        schedule.every().day.at("02:21").do(datatakes_prev_quarter_cache_loader)

        # Load Product Timeliness the previously completed quarter, for all the missions
        schedule.every().day.at("02:24").do(
            timeliness.load_timeliness_cache_previous_quarter
        ).tag("Timeliness")
        schedule.every().day.at("02:26").do(
            timeliness.timeliness_stats_load_cache_previous_quarter
        ).tag("Timeliness")

        # Load Publication statistics the previously completed quarter, for all the missions
        schedule.every().day.at("02:30").do(
            publication.load_all_previous_quarter_publication_cache
        ).tag("Publication")

        # Load Archive statistics the previously completed quarter, for all the missions
        schedule.every().day.at("02:32").do(
            archive.load_archive_cache_previous_quarter
        ).tag("Archive")

        # Load Acquisition statistics for all ground station, including EDRS
        schedule.every().day.at("02:34").do(
            acquisitions.load_acquisitions_cache_previous_quarter
        ).tag("Acquisitions")
        schedule.every().day.at("02:34").do(
            acquisitions.load_edrs_acquisitions_cache_previous_quarter
        ).tag("Acquisitions")

        # Load Acquisition statistics for all ground station, including EDRS
        schedule.every().day.at("02:35").do(
            unavailability.load_unavailability_cache_previous_quarter
        ).tag("Unavailability")

        # Load Acquisition plans as daily KML
        schedule.every().day.at("02:45").do(acquisition_plans_cache_loader).tag(
            "AcquisitionPlans"
        )
        schedule.every().hour.at(":05").do(acquisition_plans_cache_completeness_loader)
        # Load Status interface monitoring for "DD_DAS" and "DD_DHUS"
        schedule.every().day.at("02:49").do(
            data_access_status_monitoring_cache_loader_prev_quarter
        ).tag("Data Access Status")

        # Load Status interface monitoring for "LTA_Acri", "LTA_CloudFerro", "LTA_Exprivia", "LTA_Werum"
        schedule.every().day.at("02:51").do(
            data_archive_status_monitoring_cache_loader_prev_quarter
        ).tag("Data Archive Status")

        ################################################################################################################
        # Print thread status
        # print("Timeliness Scheduled jobs: ", schedule.get_jobs("Timeliness"))
        # print("Publication Scheduled jobs: ", schedule.get_jobs("Publication"))

    def check_schedule():
        import time
        import schedule

        app.logger.info("[BEG] Scheduler - RUN ALL tasks")
        try:
            schedule.run_all(10)
        except Exception as ex:
            app.logger.error("[ERR] Scheduler - Error running schedule tasks: %s", ex)
        app.logger.info("[END] Scheduler - RUN ALL tasks")

        while True:
            app.logger.debug("[BEG] Scheduler - RUN pending tasks")
            try:
                schedule.run_pending()
                time.sleep(10)
            except Exception as ex:
                app.logger.error(
                    "[ERR] Loop Scheduler - Error running loop schedule tasks: %s", ex
                )
                app.logger.error(
                    "[ERR] Loop Scheduler - Traceback of error ", exc_info=1
                )
            app.logger.debug("[END] Scheduler - RUN pending tasks")

    import _thread

    # if not app.debug:
    with app.app_context():
        app.logger.info("Configuring and starting scheduler...")
        schedule_process()
        app.logger.info("Jobs scheduled")
        _thread.start_new_thread(check_schedule, ())
        app.logger.info("Scheduler thread started")


flask_cache = None
# Check if REDIS is on, listening on port 7478
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
result = sock.connect_ex(("127.0.0.1", 7478))
if result == 0:
    print("Using REDIS CACHE")
    import sys

    flask_cache = Cache(
        config={
            "CACHE_TYPE": "RedisCache",
            "CACHE_REDIS_URL": "redis://:8870294a71d1fc6205af6e4d5.-a@127.0.0.1:7478/0",
            "CACHE_DEFAULT_TIMEOUT": sys.maxsize,
        }
    )
else:
    flask_cache = Cache(config={"CACHE_TYPE": "SimpleCache"})
sock.close()
print(flask_cache.config.get("CACHE_TYPE"))


def create_app(config):
    print("Creating Application...")
    app = Flask(__name__)
    app.config.from_object(config)

    # --- Google verification route (safe) ---
    @app.route("/google<verification_id>.html")
    def google_verification(verification_id):
        return send_from_directory(
            os.path.join(app.root_path, "static/verification"),
            f"google{verification_id}.html",
        )

    # ---------------------------------
    # --- Robots.txt route ---
    @app.route("/robots.txt")
    def robots_txt():
        host = request.host.lower()

        if "staging.sentiboard.onda-dias.com" in host:
            content = """# Robots.txt for Copernicus Sentinel Operations Dashboard (STAGING)
            User-agent: *
            Disallow: /
            """
        else:
            content = """# Robots.txt for Copernicus Sentinel Operations Dashboard (PRODUCTION)
            User-agent: *
            Allow: /
            Sitemap: https://operations.dashboard.copernicus.eu/sitemap.xml
            """

        return Response(content, mimetype="text/plain")

    # --- Manifest.json route (dynamic for prod URLs) ---
    @app.route("/manifest.json")
    def manifest():
        from flask import jsonify

        return jsonify(
            {
                "name": "Copernicus Sentinel Operations Dashboard",
                "short_name": "Copernicus Dashboard",
                "description": "Explore real-time satellite events, data availability, and acquisition status from ESA's Copernicus Sentinels.",
                "start_url": "https://operations.dashboard.copernicus.eu/",
                "scope": "https://operations.dashboard.copernicus.eu/",
                "display": "standalone",
                "background_color": "#006B7C",
                "theme_color": "#006B7C",
                "icons": [
                    {
                        "src": "/static/assets/img/icons/favicon-96.png",
                        "sizes": "96x96",
                        "type": "image/png",
                    },
                    {
                        "src": "/static/assets/img/icons/icon-192.png",
                        "sizes": "192x192",
                        "type": "image/png",
                        "purpose": "any maskable",
                    },
                    {
                        "src": "/static/assets/img/icons/icon-512.png",
                        "sizes": "512x512",
                        "type": "image/png",
                        "purpose": "any maskable",
                    },
                ],
            }
        )

    # ------------------------
    # --- Sitemap.xml route ---
    @app.route("/sitemap.xml")
    def sitemap():
        return send_from_directory(
            os.path.join(app.root_path, "static"),
            "sitemap.xml",
            mimetype="application/xml",
        )

    # ------------------------
    print("Configuring Application ...")
    register_extensions(app)
    register_blueprints(app)

    # This context processor
    @app.context_processor
    def inject_page_url_and_keywords():
        def page_url():
            try:
                # enforce https and production hostname
                return request.url.replace(
                    request.host, "operations.dashboard.copernicus.eu"
                ).replace("http://", "https://")
            except RuntimeError:
                return ""

        return dict(
            page_url=page_url,
        )

    print("Starting Cache ...")
    flask_cache.init_app(app)
    print("Starting Database ...")
    configure_database(app)
    print("Starting Scheduler ...")
    start_scheduler(app)
    print("Application Created ...")
    return app
