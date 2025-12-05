# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${SERCO}
All rights reserved.

This document discloses subject matter in which SERCO has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of SERCO to fulfill the purpose for which the document was
delivered to him.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from os import abort

from apps.utils.events_utils import make_json_safe
from flask import request, Response
from flask_login import login_required

import apps.cache.modules.acquisitions as acquisitions_cache
import apps.cache.modules.acquisitionplans as acquisition_plans_cache
import apps.cache.modules.acquisitionassets as acquisition_assets_cache
import apps.cache.modules.archive as archive_cache
import apps.cache.modules.datatakes as datatakes_cache
import apps.cache.modules.events as events_cache
import apps.cache.modules.interface_monitoring as interface_monitoring_cache
import apps.cache.modules.publication as publication_cache
import apps.cache.modules.timeliness as timeliness_cache
import apps.cache.modules.unavailability as unavailability_cache
import apps.ingestion.anomalies_ingestor as anomalies_ingestor
import apps.ingestion.news_ingestor as news_ingestor
import apps.models.anomalies as anomalies_model
import apps.models.news as news_model
import apps.models.instant_messages as instant_messages_model
from apps import flask_cache, db
from . import blueprint
from ...utils import auth_utils, db_utils

logger = logging.getLogger(__name__)


# Public functions - login not required


# TEMPORARY ENDPOINT UNTIL ORBIT ACQUISITION PLANS ARE IMPLEMENTED
@blueprint.route(
    "/api/acquisitions/acquisition-datatakes/<mission>/<satellite>/<day>",
    methods=["GET"],
)
def get_acquisition_datatakes(mission, satellite, day):
    if request.headers.get("X-Requested-With") != "XMLHttpRequest":
        logger.warning("[BLOCKED] Direct access attempt to  Acquisition Datatakes API")
        abort(403)
    logger.info(
        "[BEG] INTERNAL Acquisition Datatakes for %s %s %s", mission, satellite, day
    )

    satellite_day_datatakes = datatakes_cache.get_satellite_day_datatakes(
        satellite, day
    )

    return Response(
        json.dumps(make_json_safe(satellite_day_datatakes)),
        mimetype="application/json",
        status=200,
    )


@blueprint.route(
    "/api/acquisitions/acquisition-plans/<mission>/<satellite>/<day>", methods=["GET"]
)
def get_acquisition_plans(mission, satellite, day):
    logger.debug("Called INTERNAL Acquisition Plan KML")

    return acquisition_plans_cache.get_acquisition_plan(mission, satellite, day)


@blueprint.route("/api/acquisitions/acquisition-plan-days", methods=["GET"])
def get_acquisition_plan_days():
    logger.info("[BEG] API Get Acquisition Plan Coverage")
    return acquisition_plans_cache.get_acquisition_plans_coverage()


@blueprint.route("/api/acquisitions/satellite/orbits", methods=["GET"])
def get_satellites_orbits():
    logger.debug("Called API Satellites Orbits")
    orbits_api_key = acquisition_assets_cache.orbits_cache_key
    # if not flask_cache.has(orbits_api_key):
    #    logger.debug("Loading Satellites Orbits from NORAD")
    #    acquisition_assets_cache.load_satellite_orbits()
    return flask_cache.get(orbits_api_key)


@blueprint.route("/api/acquisitions/stations", methods=["GET"])
def get_acquisitions_stations():
    logger.debug("Called API Acquisition Stations")
    stations_api_key = acquisition_assets_cache.stations_cache_key
    # if not flask_cache.has(stations_api_key):
    #    logger.debug("Loading Ground Stations")
    #    acquisition_assets_cache.load_stations()
    return flask_cache.get(stations_api_key)


@blueprint.route("/api/events/anomalies/update", methods=["GET"])
def update_anomalies():
    logger.info("Called API Update Anomalies")
    anomalies_ingestor.AnomaliesIngestor().ingest_anomalies()
    return Response(json.dumps({"OK": "200"}), mimetype="application/json", status=200)


@blueprint.route("/api/events/anomalies/last-<period_id>", methods=["GET"])
def get_anomalies_last(period_id):
    logger.info("Called API Anomalies last %s", period_id)
    anomalies_api_uri = events_cache.anomalies_cache_key.format("last", period_id)
    logger.debug("URI cache key: %s", anomalies_api_uri)
    # if not flask_cache.has(anomalies_api_uri):
    #     logger.info("Loading Anomalies Cache from API Anomalies last %s", period_id)
    #     events_cache.load_anomalies_cache_last_quarter()
    return flask_cache.get(anomalies_api_uri)


@blueprint.route("/api/events/anomalies/previous-quarter", methods=["GET"])
def get_anomalies_previous_quarter():
    logger.info("Called API Anomalies previous quarter")
    anomalies_api_uri = events_cache.anomalies_cache_key.format("previous", "quarter")
    logger.debug("URI cache key: %s", anomalies_api_uri)
    # if not flask_cache.has(anomalies_api_uri):
    #     logger.info("Loading Anomalies Cache from API Anomalies previous quarter")
    #     events_cache.load_anomalies_cache_previous_quarter()
    return flask_cache.get(anomalies_api_uri)


@blueprint.route("/api/events/anomalies/<date_from>/<date_to>", methods=["GET"])
def get_anomalies_in_range(date_from, date_to):
    logger.info("Called API Anomalies in date range")
    start_date = datetime.strptime(date_from, "%Y-%m-%d")
    end_date = datetime.strptime(date_to, "%Y-%m-%d")
    end_date = (
        end_date + timedelta(hours=23) + timedelta(minutes=59) + timedelta(seconds=59)
    )
    return Response(
        json.dumps(
            anomalies_model.get_anomalies(start_date, end_date),
            cls=db_utils.AlchemyEncoder,
        ),
        mimetype="application/json",
        status=200,
    )


@blueprint.route("/api/events/news/update", methods=["GET"])
def update_news():
    logger.info("Called API Update News")
    news_ingestor.NewsIngestor().ingest_news()
    return Response(json.dumps({"OK": "200"}), mimetype="application/json", status=200)


@blueprint.route("/api/events/news/last-<period_id>", methods=["GET"])
def get_news_last(period_id):
    logger.info("Called API News last %s", period_id)
    news_api_uri = events_cache.news_cache_key.format("last", period_id)
    logger.debug("URI cache key: %s", news_api_uri)
    # if not flask_cache.has(news_api_uri):
    #    logger.info("Loading News Cache from API News last %s", period_id)
    #    events_cache.load_news_cache_last_quarter()
    return flask_cache.get(news_api_uri)


@blueprint.route("/api/events/news/previous-quarter", methods=["GET"])
def get_news_previous_quarter():
    logger.info("Called API News previous quarter")
    news_api_uri = events_cache.news_cache_key.format("previous", "quarter")
    logger.debug("URI cache key: %s", news_api_uri)
    # if not flask_cache.has(news_api_uri):
    #    logger.info("Loading News Cache from API News previous quarter")
    #    events_cache.load_news_cache_previous_quarter()
    return flask_cache.get(news_api_uri)


@blueprint.route("/api/instant-messages/add", methods=["POST"])
@login_required
def add_instant_message():
    logger.info("Called API Add Home News")
    try:
        if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        data = json.loads(request.data.decode("utf8"))
        logger.info(f"Received data: {data}")

        title = data.get("title", "")
        text = data.get("text", "")
        link = data.get("link", "")
        message_type = data.get("messageType", "").strip()
        publication_date_str = data.get("publicationDate", "").strip()

        if not title or not text or not publication_date_str:
            return Response(
                json.dumps({"error": "Missing required fields"}),
                mimetype="application/json",
                status=400,
            )

        try:
            publication_date = datetime.strptime(publication_date_str, "%Y-%m-%d")
        except ValueError:
            return Response(
                json.dumps(
                    {"error": "Invalid publication date format, use yyyy-mm-dd"}
                ),
                mimetype="application/json",
                status=400,
            )

        modify_date = datetime.now(timezone.utc)

        instant_messages_model.save_instant_messages(
            title=title,
            text=text,
            link=link,
            publication_date=publication_date,
            message_type=message_type,
            modify_date=modify_date,
        )

        return Response(
            json.dumps({"OK": "News post added"}),
            mimetype="application/json",
            status=200,
        )

    except Exception as ex:
        logger.exception("Error while adding Home News")
        return Response(
            json.dumps({"error": str(ex)}), mimetype="application/json", status=500
        )


@blueprint.route("/api/instant-messages/all", methods=["GET"])
def get_all_instant_messages():

    if request.headers.get("X-Requested-With") != "XMLHttpRequest":
        return Response(
            json.dumps({"error": "Forbidden"}), status=403, mimetype="application/json"
        )

    logger.info("Called API Home News with pagination")
    try:
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("pageSize", 20))

        query = db.session.query(instant_messages_model.InstantMessages).order_by(
            instant_messages_model.InstantMessages.publicationDate.desc()
        )

        total_count = query.count()
        messages = query.offset((page - 1) * page_size).limit(page_size).all()

        result = {
            "total": total_count,
            "page": page,
            "pageSize": page_size,
            "messages": messages,
        }

        return Response(
            json.dumps(result, cls=db_utils.AlchemyEncoder),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        logger.exception("Failed to fetch paginated Home News")
        return Response(
            json.dumps({"error": str(ex)}), mimetype="application/json", status=500
        )


@blueprint.route("/api/instant-messages/get", methods=["GET"])
@login_required
def get_instant_message():
    logger.info("Called API Get Home News")
    try:
        message_id = request.args.get("id", "").strip()
        if not message_id:
            return Response(
                json.dumps({"error": "Missing ID"}),
                mimetype="application/json",
                status=400,
            )

        message = (
            db.session.query(instant_messages_model.InstantMessages)
            .filter_by(id=message_id)
            .first()
        )
        if not message:
            return Response(
                json.dumps({"error": "News post not found"}),
                mimetype="application/json",
                status=404,
            )

        result = {
            "id": message.id,
            "title": message.title,
            "text": message.text,
            "link": message.link,
            "messageType": message.messageType,
            "publicationDate": (
                message.publicationDate.strftime("%Y-%m-%d")
                if message.publicationDate
                else ""
            ),
        }

        return Response(json.dumps(result), mimetype="application/json", status=200)
    except Exception as ex:
        logger.exception("Error retrieving Home News")
        return Response(
            json.dumps({"error": str(ex)}), mimetype="application/json", status=500
        )


@blueprint.route("/api/instant-messages/update", methods=["POST"])
@login_required
def update_instant_message():
    logger.info("Called API Home News Update")
    try:
        if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        data = json.loads(request.data.decode("utf8"))
        logger.info(f"Update data: {data}")

        message_id = data.get("id", "").strip()
        if not message_id:
            return Response(
                json.dumps({"error": "Missing news ID"}),
                mimetype="application/json",
                status=400,
            )

        title = data.get("title", "").strip()
        text = data.get("text", "").strip()
        link = data.get("link", "").strip()
        message_type = data.get("messageType", "").strip()
        publication_date_str = data.get("publicationDate", "").strip()

        if not publication_date_str:
            return Response(
                json.dumps({"error": "Missing publication date"}),
                mimetype="application/json",
                status=400,
            )

        try:
            publication_date = datetime.strptime(publication_date_str, "%Y-%m-%d")
        except ValueError:
            return Response(
                json.dumps(
                    {"error": "Invalid publication date format, use yyyy-mm-dd"}
                ),
                mimetype="application/json",
                status=400,
            )

        modify_date = datetime.now(timezone.utc)

        # Fetch the existing message
        message = (
            db.session.query(instant_messages_model.InstantMessages)
            .filter_by(id=message_id)
            .first()
        )
        if not message:
            return Response(
                json.dumps({"error": "News post not found"}),
                mimetype="application/json",
                status=404,
            )

        # Update fields
        message.title = title
        message.text = text
        message.link = link
        message.messageType = message_type
        message.publicationDate = publication_date
        message.modifyDate = modify_date

        db.session.commit()

        return Response(
            json.dumps({"OK": "News post updated"}),
            mimetype="application/json",
            status=200,
        )

    except Exception as ex:
        logger.exception("Error updating News post")
        db.session.rollback()
        return Response(
            json.dumps({"error": str(ex)}), mimetype="application/json", status=500
        )


@blueprint.route("/api/instant-messages/delete", methods=["POST"])
@login_required
def delete_instant_message():
    try:
        if not auth_utils.is_user_authorized(["admin", "ecuser", "esauser"]):
            return Response(
                json.dumps("Not authorized"), mimetype="application/json", status=401
            )

        data = json.loads(request.data.decode("utf8"))
        message_id = data.get("id", "").strip()

        if not message_id:
            return Response(
                json.dumps({"error": "Missing news ID"}),
                mimetype="application/json",
                status=400,
            )

        message = (
            db.session.query(instant_messages_model.InstantMessages)
            .filter_by(id=message_id)
            .first()
        )
        if not message:
            return Response(
                json.dumps({"error": "News not found"}),
                mimetype="application/json",
                status=404,
            )

        db.session.delete(message)
        db.session.commit()

        return Response(
            json.dumps({"OK": "News post deleted"}),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        logger.exception("Error deleting News post")
        db.session.rollback()
        return Response(
            json.dumps({"error": str(ex)}), mimetype="application/json", status=500
        )


@blueprint.route("/api/worker/cds-datatake/<datatake_id>", methods=["GET"])
def get_cds_datatake(datatake_id):
    if request.headers.get("X-Requested-With") != "XMLHttpRequest":
        logger.warning("[BLOCKED] Direct access attempt to  CDS Datatakes API")
        abort(403)
    logger.info("[BEG] INTERNAL API GET Datatake info %s ", datatake_id)

    data = datatakes_cache.load_datatake_details(datatake_id)

    return Response(
        json.dumps(make_json_safe(data)), mimetype="application/json", status=200
    )


@blueprint.route("/api/worker/cds-datatakes/last-<period_id>", methods=["GET"])
def get_cds_datatakes_last(period_id):
    logger.info("Called API CDS Datatakes last %s", period_id)
    datatakes_api_uri = datatakes_cache.datatakes_cache_key.format("last", period_id)
    logger.debug("URI cache key: %s", datatakes_api_uri)
    # if not flask_cache.has(datatakes_api_uri):
    #    logger.info("Loading Datatakes Cache from API CDS Datatakes last %s", period_id)
    #    datatakes_cache.load_datatakes_cache_last_quarter()
    return flask_cache.get(datatakes_api_uri)


@blueprint.route("/api/worker/cds-datatakes/previous-quarter", methods=["GET"])
def get_cds_datatakes_previous_quarter():
    logger.info("Called API CDS Datatakes previous quarter")
    datatakes_api_uri = datatakes_cache.datatakes_cache_key.format(
        "previous", "quarter"
    )
    logger.debug("URI cache key: %s", datatakes_api_uri)
    # if not flask_cache.has(datatakes_api_uri):
    #    logger.info("Loading Datatakes Cache from API CDS Datatakes previous quarter")
    #    datatakes_cache.load_datatakes_cache_previous_quarter()
    return flask_cache.get(datatakes_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-volume/last-<period_id>", methods=["GET"]
)
def get_cds_product_publication_size_statistics_last(period_id):
    logger.debug("Called API Publication Volume Statistics Last %s", period_id)
    publication_api_uri = publication_cache.publication_size_api_format.format(
        "last", period_id
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #    logger.debug("Loading Cache from API Publication Volume Statistics Last %s", period_id)
    #    cache_data = flask_cache.get_dict(publication_api_uri)
    #    logger.debug("Expiration for cache: %s", cache_data[publication_api_uri][0])
    #    publication_cache.load_publication_cache(publication_cache.PUBLICATION_VOLUME, period_id)
    return flask_cache.get(publication_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-volume/previous-quarter", methods=["GET"]
)
def get_cds_product_publication_size_statistics_previous_quarter():
    logger.debug("Called API Publication Volume Stastistics Previous Quarter")
    publication_api_uri = publication_cache.publication_size_api_format.format(
        "previous", "quarter"
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #    logger.debug("Loading Cache from API Publication Volume Stastistics Previous Quarter")
    #    publication_cache.load_publication_cache_previous_quarter(publication_cache.PUBLICATION_VOLUME)
    return flask_cache.get(publication_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-count/last-<period_id>", methods=["GET"]
)
def get_cds_product_publication_count_statistics_last(period_id):
    logger.debug("Called API Publication Statistics Last %s", period_id)
    publication_api_uri = publication_cache.publication_count_api_format.format(
        "last", period_id
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #    logger.debug("Loading Cache from API Publication Statistics Last %s", period_id)
    #    publication_cache.load_publication_cache(publication_cache.PUBLICATION_COUNT, period_id)
    return flask_cache.get(publication_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-count/previous-quarter", methods=["GET"]
)
def get_cds_product_publication_count_statistics_previous_quarter():
    logger.debug("Called API Publication Stastistics Previous Quarter")
    publication_api_uri = publication_cache.publication_count_api_format.format(
        "previous", "quarter"
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #    logger.debug("Loading Cache from API Publication Stastistics previous quarter")
    #    publication_cache.load_publication_cache_previous_quarter(publication_cache.PUBLICATION_COUNT)
    return flask_cache.get(publication_api_uri)


# Restricted functions - login required


@blueprint.route("/api/events/anomalies/add", methods=["POST"])
@login_required
def add_anomaly():
    logger.info("Called API Add Anomaly")
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        data = json.loads(request.data.decode("utf8"))
        publication_date = datetime.strptime(
            data["publicationDate"], "%d/%m/%Y %H:%M:%S"
        )
        start_date = datetime.strptime(data["publicationDate"], "%d/%m/%Y %H:%M:%S")
        end_date = start_date + timedelta(hours=24)
        anomalies_model.save_anomaly(
            data["title"],
            data["key"],
            "",
            publication_date,
            data["category"],
            data["impactedItem"],
            data["impactedSatellite"],
            start_date,
            end_date,
            "",
            "",
            data["newsLink"],
            data["newsTitle"],
        )

        events_cache.load_anomalies_cache_previous_quarter()  # Explicitly force cache reloading
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )

    return Response(json.dumps({"OK": "200"}), mimetype="application/json", status=200)


@blueprint.route("/api/events/anomalies/update", methods=["PUT"])
@login_required
def update_anomaly():
    logger.info("Called API Update Anomaly")
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        data = json.loads(request.data.decode("utf8"))
        anomalies_model.update_anomaly_categorization(
            data["key"],
            data["category"],
            data["impactedItem"],
            data["impactedSatellite"],
            data["environment"],
            data["newsLink"],
            data["newsTitle"],
        )

        events_cache.load_anomalies_cache_previous_quarter()  # Explicitly force cache reloading
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )

    return Response(json.dumps({"OK": "200"}), mimetype="application/json", status=200)


@blueprint.route("/api/events/news/update", methods=["POST"])
@login_required
def update_news_item():
    logger.info("Called API Update News")
    try:
        if not auth_utils.is_user_authorized(["admin"]):
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        data = json.loads(request.data.decode("utf8"))
        news_model.update_news_categorization(
            data["link"],
            data["category"],
            data["impactedSatellite"],
            data["environment"],
            data["occurrenceDate"],
        )

        events_cache.load_news_cache_previous_quarter()  # Explicitly force cache reloading
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )

    return Response(json.dumps({"OK": "200"}), mimetype="application/json", status=200)


@blueprint.route("/api/reporting/cds-acquisitions/last-<period_id>", methods=["GET"])
@login_required
def get_cds_acquisitions_last(period_id):
    logger.info("Called API CDS Acquisitions last %s", period_id)
    acquisitions_api_uri = acquisitions_cache.acquisitions_cache_key.format(
        "last", period_id
    )
    logger.debug("URI cache key: %s", acquisitions_api_uri)
    # if not flask_cache.has(acquisitions_api_uri):
    #    logger.info("Loading Acquisitions Cache from API CDS Acquisitions last %s", period_id)
    #    acquisitions_cache.load_acquisitions_cache_last_quarter()
    return flask_cache.get(acquisitions_api_uri)


@blueprint.route("/api/reporting/cds-acquisitions/previous-quarter", methods=["GET"])
@login_required
def get_cds_acquisitions_previous_quarter():
    logger.info("Called API CDS Acquisitions previous quarter")
    acquisitions_api_uri = acquisitions_cache.acquisitions_cache_key.format(
        "previous", "quarter"
    )
    logger.debug("URI cache key: %s", acquisitions_api_uri)
    # if not flask_cache.has(acquisitions_api_uri):
    #    logger.info("Loading Acquisitions Cache from API CDS Acquisitions previous quarter")
    #    acquisitions_cache.load_acquisitions_cache_previous_quarter()
    return flask_cache.get(acquisitions_api_uri)


@blueprint.route(
    "/api/reporting/cds-edrs-acquisitions/last-<period_id>", methods=["GET"]
)
@login_required
def get_cds_edrs_acquisitions_last(period_id):
    logger.info("Called API CDS EDRS Acquisitions last %s", period_id)
    edrs_acquisitions_api_uri = acquisitions_cache.edrs_acquisitions_cache_key.format(
        "last", period_id
    )
    logger.debug("URI cache key: %s", edrs_acquisitions_api_uri)
    # if not flask_cache.has(edrs_acquisitions_api_uri):
    #    logger.info("Loading EDRS Acquisitions Cache from API CDS EDRS Acquisitions last %s", period_id)
    #    acquisitions_cache.load_edrs_acquisitions_cache_last_quarter()
    return flask_cache.get(edrs_acquisitions_api_uri)


@blueprint.route(
    "/api/reporting/cds-edrs-acquisitions/previous-quarter", methods=["GET"]
)
@login_required
def get_cds_edrs_acquisitions_previous_quarter():
    logger.info("Called API CDS EDRS Acquisitions previous quarter")
    edrs_acquisitions_api_uri = acquisitions_cache.edrs_acquisitions_cache_key.format(
        "previous", "quarter"
    )
    logger.debug("URI cache key: %s", edrs_acquisitions_api_uri)
    # if not flask_cache.has(edrs_acquisitions_api_uri):
    #    logger.info("Loading EDRS Acquisitions Cache from API CDS EDRS Acquisitions previous quarter")
    #    acquisitions_cache.load_edrs_acquisitions_cache_previous_quarter()
    return flask_cache.get(edrs_acquisitions_api_uri)


@blueprint.route(
    "/api/reporting/cds-sat-unavailability/last-<period_id>", methods=["GET"]
)
@login_required
def get_cds_sat_unavailability_last(period_id):
    logger.info("Called API CDS Sat Unavailability last %s", period_id)
    sat_unavailability_api_uri = unavailability_cache.unavailability_cache_key.format(
        "last", period_id
    )
    logger.debug("URI cache key: %s", sat_unavailability_api_uri)
    # if not flask_cache.has(sat_unavailability_api_uri):
    #   logger.info("Loading Sat Unavailability Cache from API CDS Sat Unavailability last %s", period_id)
    #   unavailability_cache.load_unavailability_cache_last_quarter()
    return flask_cache.get(sat_unavailability_api_uri)


@blueprint.route(
    "/api/reporting/cds-sat-unavailability/previous-quarter", methods=["GET"]
)
@login_required
def get_cds_sat_unavailability_previous_quarter():
    logger.info("Called API CDS Sat Unavailability previous quarter")
    sat_unavailability_api_uri = unavailability_cache.unavailability_cache_key.format(
        "previous", "quarter"
    )
    logger.debug("URI cache key: %s", sat_unavailability_api_uri)
    # if not flask_cache.has(sat_unavailability_api_uri):
    #    logger.info("Loading Sat Unavailability Cache from API CDS Sat Unavailability previous quarter")
    #    unavailability_cache.load_unavailability_cache_previous_quarter()
    return flask_cache.get(sat_unavailability_api_uri)


@blueprint.route(
    "/api/reporting/cds-interface-status-monitoring/last-<period_id>/<service_name>",
    methods=["GET"],
)
@login_required
def get_cds_interface_status_monitoring_last(period_id, service_name):
    logger.info("Called API CDS Interface Status Monitoring last %s", period_id)
    interface_monitoring_api_uri = (
        interface_monitoring_cache.interface_monitoring_cache_key.format(
            "last", period_id, service_name
        )
    )
    logger.debug("URI cache key: %s", interface_monitoring_api_uri)
    # if not flask_cache.has(interface_monitoring_api_uri):
    # logger.info("Loading Interface Status Monitoring Cache from CDS Interface Status Monitoring in last quarter")
    # interface_monitoring_cache.load_interface_monitoring_cache_last_quarter(service_name)
    return flask_cache.get(interface_monitoring_api_uri)


@blueprint.route(
    "/api/reporting/cds-interface-status-monitoring/previous-quarter/<service_name>",
    methods=["GET"],
)
@login_required
def get_cds_interface_status_monitoring_previous_quarter(service_name):
    logger.info("Called API CDS Interface Status Monitoring previous quarter")
    interface_monitoring_api_uri = (
        interface_monitoring_cache.interface_monitoring_cache_key.format(
            "previous", "quarter", service_name
        )
    )

    logger.debug("URI cache key: %s", interface_monitoring_api_uri)
    # if not flask_cache.has(interface_monitoring_api_uri):
    # logger.info("Loading Interface Status Monitoring Cache from CDS Interface Status Monitoring in previous quarter")
    # interface_monitoring_cache.load_interface_monitoring_cache_prev_quarter(service_name)
    return flask_cache.get(interface_monitoring_api_uri)


@blueprint.route(
    "/api/reporting/cds-product-archive-volume/last-<period_id>", methods=["GET"]
)
@login_required
def get_cds_product_archive_size_last(period_id):
    logger.debug("Called API Long Term Archive Volume Last %s", period_id)
    # TODO: Add check on period id vality!
    return archive_cache.get_archive_cached_data("last", period_id)


@blueprint.route(
    "/api/reporting/cds-product-archive-volume/previous-quarter", methods=["GET"]
)
@login_required
def get_cds_product_archive_size_previous_quarter():
    logger.debug("Called API Long Term Archive Volume Previous Quarter")
    return archive_cache.get_archive_cached_data("previous", "quarter")


@blueprint.route("/api/reporting/cds-product-archive-volume/lifetime", methods=["GET"])
@login_required
def get_cds_product_archive_size_lifetime():
    logger.debug("Called API Long Term Archive Volume Lifetime")
    return archive_cache.get_archive_cached_data("all", "lifetime")


@blueprint.route(
    "/api/reports/cds-timeliness-statistics/last-<period_id>", methods=["GET"]
)
@login_required
def get_cds_timeliness_statistics_last(period_id):
    logger.debug("Called API Timeliness Statistics Last %s", period_id)
    timeliness_api_uri = timeliness_cache.timeliness_stats_cache_key_format.format(
        "last", period_id
    )
    logger.debug("Uri cache key: %s", timeliness_api_uri)
    # if not flask_cache.has(timeliness_api_uri):
    #    logger.debug("Loading Cache from API Timeliness Statistics Last %s", period_id)
    #    timeliness_cache.timeliness_stats_load_cache(period_id)
    return flask_cache.get(timeliness_api_uri)


@blueprint.route(
    "/api/reports/cds-timeliness-statistics/previous-quarter", methods=["GET"]
)
@login_required
def get_cds_timeliness_statistics_previous_quarter():
    logger.debug("Called API Timeliness Statistics Previous Quarter")
    timeliness_api_uri = timeliness_cache.timeliness_stats_cache_key_format.format(
        "previous", "quarter"
    )
    logger.debug("Uri cache key: %s", timeliness_api_uri)
    # if not flask_cache.has(timeliness_api_uri):
    #    logger.debug("Loading Cache from API Timeliness Statistics Previous Quarter")
    #    timeliness_cache.timeliness_stats_load_cache_previous_quarter()
    return flask_cache.get(timeliness_api_uri)


@blueprint.route(
    "/api/reports/cds-product-timeliness/last-<period_id>", methods=["GET"]
)
@login_required
def get_cds_product_timeliness_last(period_id):
    logger.debug("Called API Timeliness Last %s", period_id)
    timeliness_api_uri = timeliness_cache.timeliness_cache_key_format.format(
        "last", period_id
    )
    logger.debug("Uri cache key: %s", timeliness_api_uri)
    # if not flask_cache.has(timeliness_api_uri):
    #    logger.debug("Loading Cache from API Timeliness Last %s", period_id)
    #    timeliness_cache.timeliness_load_cache(period_id)
    return flask_cache.get(timeliness_api_uri)


@blueprint.route(
    "/api/reports/cds-product-timeliness/previous-quarter", methods=["GET"]
)
@login_required
def get_cds_product_timeliness_previous_quarter():
    logger.debug("Called API Timeliness Previous Quarter")
    timeliness_api_uri = timeliness_cache.timeliness_cache_key_format.format(
        "previous", "quarter"
    )
    logger.debug("Uri cache key: %s", timeliness_api_uri)
    # if not flask_cache.has(timeliness_api_uri):
    #    logger.debug("Loading Cache from API Timeliness Previous Quarter")
    #    timeliness_cache.load_timeliness_cache_previous_quarter()
    return flask_cache.get(timeliness_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-trend/last-<period_id>", methods=["GET"]
)
@login_required
def get_cds_product_publication_trend_statistics_last(period_id):
    logger.info("[BEG] API Publication Trend Statistics Last %s", period_id)
    publication_api_uri = publication_cache.publication_trend_api_format.format(
        "last", period_id
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #     publication_cache.load_publication_cache(publication_cache.PUBLICATION_TREND, period_id)
    logger.info("[END] API Publication Trend Statistics Last %s", period_id)
    return flask_cache.get(publication_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-trend/previous-quarter", methods=["GET"]
)
@login_required
def get_cds_product_publication_trend_statistics_previous_quarter():
    logger.debug("Called API Publication Stastistics Previous Quarter")
    publication_api_uri = publication_cache.publication_trend_api_format.format(
        "previous", "quarter"
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #    publication_cache.load_publication_cache_previous_quarter(publication_cache.PUBLICATION_TREND)
    return flask_cache.get(publication_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-volume-trend/last-<period_id>",
    methods=["GET"],
)
@login_required
def get_cds_product_publication_volume_trend_statistics_last(period_id):
    logger.info("[BEG] API Publication Volume Trend Stastistics Last %s", period_id)
    publication_api_uri = publication_cache.publication_volume_trend_api_format.format(
        "last", period_id
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #    publication_cache.load_publication_cache(publication_cache.PUBLICATION_VOLUME_TREND, period_id)
    logger.info("[END] API Publication Volume Trend Stastistics Last %s", period_id)
    return flask_cache.get(publication_api_uri)


@blueprint.route(
    "/api/statistics/cds-product-publication-volume-trend/previous-quarter",
    methods=["GET"],
)
@login_required
def get_cds_product_publication_volume_trend_statistics_previous_quarter():
    logger.debug("Called API Publication Volume Trend Previous Quarter")
    publication_api_uri = publication_cache.publication_volume_trend_api_format.format(
        "previous", "quarter"
    )
    logger.debug("Uri cache key: %s", publication_api_uri)
    # if not flask_cache.has(publication_api_uri):
    #    publication_cache.load_publication_cache_previous_quarter(publication_cache.PUBLICATION_VOLUME_TREND)
    return flask_cache.get(publication_api_uri)


# SSR
@blueprint.route("/acquisitions/acquisition-plan-days")
def acquisition_plan_days_ssr():
    """
    Server-side acquisition plan coverage.
    Injects data into a template instead of exposing API directly.
    """
    logger.info("[BEG] SSR: Acquisition Plan Days")
    plans_coverage = acquisition_plans_cache.get_acquisition_plans_coverage()
    logger.info("[END] SSR: Acquisition Plan Days")

    # Render template with preloaded JSON
    return render_template(
        "acquisitions-status.html", plans_coverage_json=json.dumps(plans_coverage)
    )
