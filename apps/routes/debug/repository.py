# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
"""

import json
import logging
from datetime import datetime

from dateutil.relativedelta import relativedelta
from flask import Response
from flask_login import login_required

import apps.elastic.client as elastic_client
import apps.elastic.modules.repository as elastic_repository
import apps.jira.client as jira_client
from apps import flask_cache
from apps.models import anomalies as anomalies_model
from apps.models import news as news_model
from apps.utils import auth_utils, db_utils, elastic_utils
from apps.utils.date_utils import Quarter
from . import blueprint

logger = logging.getLogger(__name__)

CDS_S1S2_MISSIONS = {
    "s1": ["s1a", "s1c", "s1d"],
    "s2": ["s2a", "s2b", "s2c"],
}


def _build_s1s2_indices():
    indices = []
    for mission, sats in CDS_S1S2_MISSIONS.items():
        indices.extend([f"cds-completeness-{mission}-{sat}-dd-das" for sat in sats])
    return indices


@blueprint.route("/api/repository/news", methods=["GET"])
@login_required
def get_news():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        return Response(
            json.dumps(news_model.get_news(), cls=db_utils.AlchemyEncoder),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/issue", methods=["GET"])
@login_required
def get_issue():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        res = jira_client.JiraClient().search_issue_by_project("PDGSANOM")
        return Response(
            json.dumps(res, cls=db_utils.AlchemyEncoder),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/anomalies", methods=["GET"])
@login_required
def get_anomalies():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        # Return anomalies in the last six months
        end = datetime.today()
        start = end - relativedelta(months=6)
        return Response(
            json.dumps(
                anomalies_model.get_anomalies(start, end), cls=db_utils.AlchemyEncoder
            ),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/anomalies/<start_date>/<end_date>", methods=["GET"])
@login_required
@flask_cache.cached(timeout=60)
def get_anomalies_by_date_range(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        # Return anomalies in the time interval
        start_date = datetime.strptime(start_date, "%d-%m-%YT%H:%M:%S")
        end_date = datetime.strptime(end_date, "%d-%m-%YT%H:%M:%S")
        return Response(
            json.dumps(
                anomalies_model.get_anomalies(start_date, end_date),
                cls=db_utils.AlchemyEncoder,
            ),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/anomalies/<environment>", methods=["GET"])
@login_required
@flask_cache.cached(timeout=60)
def get_anomalies_by_environment(environment):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        return Response(
            json.dumps(
                anomalies_model.get_anomalies_by_environment(environment),
                cls=db_utils.AlchemyEncoder,
            ),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-sat-unavailability/<start_date>/<end_date>", methods=["GET"]
)
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_sat_unavailability(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%YT%H:%M:%S")
        end_date = datetime.strptime(end_date, "%d-%m-%YT%H:%M:%S")

        indices = elastic_utils.get_index_name_from_interval_date(
            "cds-sat-unavailability", start_date, end_date
        )
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_date_range(
                    index, "start_time", start_date, end_date
                )
                results += result
            except Exception as ex:
                logger.error(ex)

        # results = news_model.get_news_by_date(start_date)
        return Response(
            json.dumps(results, cls=db_utils.AlchemyEncoder),
            mimetype="application/json",
            status=200,
        )
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-datatake/<start_date>/<end_date>", methods=["GET"]
)
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_datatake(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        # indices = ["cds-datatake"]
        # Dynamic S1/S2 indices
        indices = _build_s1s2_indices()
        # Add S3 and S5 with old indices
        indices += ["cds-s3-completeness", "cds-s5-completeness"]

        logger.info(
            "[CDS] Querying indices=%s from=%s to=%s",
            indices,
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d"),
        )

        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                logger.info("[CDS] Query index=%s", index)
                result = elastic.query_date_range(
                    index=index,
                    date_key="observation_time_start",
                    from_date=start_date,
                    to_date=end_date,
                )
                # TODO: save records on file on record mode, to use them for testing purposes
                results += result
            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)
                raise cex
            except Exception as ex:
                logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-datatake-selected-fields/<start_date>/<end_date>",
    methods=["GET"],
)
@login_required
def get_cds_datatake_selected_fields(start_date, end_date):
    try:
        seconds_validity = 3600
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        s1s2_datatakes = flask_cache.get(
            "/api/repository/cds-datatake-selected-fields/"
            + start_date.strftime("%d-%m-%Y")
            + "/"
            + end_date.strftime("%d-%m-%Y")
        )
        if s1s2_datatakes:
            return s1s2_datatakes

        # indices = ["cds-datatake"]
        # Dynamic S1/S2 indices + S3/S5 old
        indices = _build_s1s2_indices() + ["cds-s3-completeness", "cds-s5-completeness"]
        logger.info("[CDS] Querying selected fields from indices=%s", indices)

        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                logger.info("[CDS] Query index=%s", index)
                result = elastic.query_date_range_selected_fields(
                    index=index,
                    date_key="observation_time_start",
                    from_date=start_date,
                    to_date=end_date,
                    selected_fields=[
                        "key",
                        "datatake_id",
                        "satellite_unit",
                        "observation_time_start",
                        "observation_time_stop",
                        "instrument_mode",
                        "*_local_percentage",
                    ],
                )
                # TODO: save records on file on record mode, to use them for testing purposes
                results += result
            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)
                raise cex
            except Exception as ex:
                logger.error(ex)

        response = Response(
            json.dumps(results), mimetype="application/json", status=200
        )
        flask_cache.set(
            "/api/repository/cds-datatake-selected-fields/"
            + start_date.strftime("%d-%m-%Y")
            + "/"
            + end_date.strftime("%d-%m-%Y"),
            response,
            seconds_validity,
        )
        return response
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-downlink-datatake/<start_date>/<end_date>/<datatake_id>",
    methods=["GET"],
)
@login_required
@flask_cache.cached(timeout=60)
def get_cds_downlink_datatake_by_datatake_id(start_date, end_date, datatake_id):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        indices = elastic_utils.get_index_name_from_interval_date(
            "cds-downlink-datatake", start_date, end_date
        )
        elastic = elastic_client.ElasticClient()
        results = []

        if datatake_id.upper() == "ALL":
            for index in indices:
                try:
                    result = elastic.query_scan(index=index)
                    results += result
                except Exception as ex:
                    logger.error(ex)
        else:
            for index in indices:
                try:
                    result = elastic.query_scan(
                        index=index,
                        query={"query": {"match": {"datatake_id": datatake_id}}},
                    )
                    results += result
                except Exception as ex:
                    logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-s3-completeness/<start_date>/<end_date>", methods=["GET"]
)
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_s3_completeness(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        indices = ["cds-s3-completeness"]

        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            logger.info("On index %s", index)
            try:
                result = elastic.query_date_range(
                    index=index,
                    date_key="observation_time_start",
                    from_date=start_date,
                    to_date=end_date,
                )
                results += result
            except Exception as ex:
                logger.error(ex)
        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error(ex)
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-s3-completeness-selected-fields/<start_date>/<end_date>",
    methods=["GET"],
)
@login_required
def get_cds_s3_completeness_selected_fields(start_date, end_date):
    try:
        seconds_validity = 3600
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        response = flask_cache.get(
            "/api/repository/cds-s3-completeness-selected-fields/"
            + start_date.strftime("%d-%m-%Y")
            + "/"
            + end_date.strftime("%d-%m-%Y")
        )
        if response:
            return response

        indices = ["cds-s3-completeness"]

        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            logger.info("On index %s", index)
            try:
                result = elastic.query_date_range_selected_fields(
                    index=index,
                    date_key="observation_time_start",
                    from_date=start_date,
                    to_date=end_date,
                    selected_fields=[
                        "datatake_id",
                        "satellite_unit",
                        "observation_time_start",
                        "observation_time_stop",
                        "product_level",
                        "product_type",
                        "status",
                        "percentage",
                    ],
                )
                results += result
            except Exception as ex:
                logger.error(ex)

        response = Response(
            json.dumps(results), mimetype="application/json", status=200
        )
        flask_cache.set(
            "/api/repository/cds-s3-completeness-selected-fields/"
            + start_date.strftime("%d-%m-%Y")
            + "/"
            + end_date.strftime("%d-%m-%Y"),
            response,
            seconds_validity,
        )
        return response
    except Exception as ex:
        logger.error(ex)
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-s5-completeness/<start_date>/<end_date>", methods=["GET"]
)
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_s5_completeness(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        # indices = utils.get_index_name_from_interval_date('cds-s5-completeness', start_date, end_date)
        indices = ["cds-s5-completeness"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_date_range(
                    index=index,
                    date_key="observation_time_start",
                    from_date=start_date,
                    to_date=end_date,
                )
                results += result
            except Exception as ex:
                logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-s5-completeness-selected-fields/<start_date>/<end_date>",
    methods=["GET"],
)
@login_required
def get_cds_s5_completeness_selected_fields(start_date, end_date):
    try:
        seconds_validity = 3600

        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        response = flask_cache.get(
            "/api/repository/cds-s5-completeness-selected-fields/"
            + start_date.strftime("%d-%m-%Y")
            + "/"
            + end_date.strftime("%d-%m-%Y")
        )
        if response:
            return response

        # indices = utils.get_index_name_from_interval_date('cds-s5-completeness', start_date, end_date)
        indices = ["cds-s5-completeness"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_date_range_selected_fields(
                    index=index,
                    date_key="observation_time_start",
                    from_date=start_date,
                    to_date=end_date,
                    selected_fields=[
                        "datatake_id",
                        "satellite_unit",
                        "observation_time_start",
                        "observation_time_stop",
                        "product_level",
                        "product_type",
                        "status",
                        "percentage",
                    ],
                )
                results += result
            except Exception as ex:
                logger.error(ex)

        response = Response(
            json.dumps(results), mimetype="application/json", status=200
        )
        flask_cache.set(
            "/api/repository/cds-s5-completeness-selected-fields/"
            + start_date.strftime("%d-%m-%Y")
            + "/"
            + end_date.strftime("%d-%m-%Y"),
            response,
            seconds_validity,
        )

        return response
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/cds-interface-status-monitoring", methods=["GET"])
@login_required
@flask_cache.cached(timeout=60)
def get_cds_interface_status_monitoring():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        indices = ["cds-interface-status-monitoring"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_scan(index=index)
                results += result
            except Exception as ex:
                logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-ddp-data-available/<start_date>/<end_date>", methods=["GET"]
)
@login_required
@flask_cache.cached(timeout=60)
def get_cds_ddp_data_available(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")
        indices = elastic_utils.get_index_name_from_interval_year(
            "cds-ddp-data-available", start_date, end_date
        )
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_scan(index=index)
                results += result
            except Exception as ex:
                logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/maas-collector-journal", methods=["GET"])
@login_required
@flask_cache.cached(timeout=60)
def get_maas_collector_journal():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        indices = ["maas-collector-journal"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_scan(index=index)
                results += result
            except Exception as ex:
                logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/cds-s2-tilpar-tiles", methods=["GET"])
@login_required
@flask_cache.cached(timeout=60)
def get_cds_s2_tilpar_tiles():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        indices = ["cds-s2-tilpar-tiles"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_scan(index=index)
                results += result
            except Exception as ex:
                logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route("/api/repository/external-interfaces-counting", methods=["GET"])
@login_required
@flask_cache.cached(timeout=60)
def get_external_interfaces_counting():
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        indices = ["external-interfaces-counting"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_scan(index=index)
                results += result
            except Exception as ex:
                logger.error(ex)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/raw-data-aps-products/<start_date>/<end_date>", methods=["GET"]
)
@login_required
@flask_cache.cached(timeout=60)
def get_raw_data_aps_products(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%YT%H:%M:%S")
        end_date = datetime.strptime(end_date, "%d-%m-%YT%H:%M:%S")

        indices = ["raw-data-aps-product"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_date_range(
                    index, "first_frame_start", start_date, end_date
                )
                results += result
            except Exception as ex:
                logger.error(ex)

        # Remove duplicates (entries having the same first_frame_start)
        # Theoretically, aggregation should be done on Elastic side
        result_dict = {}
        for record in results:
            if record["_source"]["first_frame_start"] not in result_dict:
                result_dict[record["_source"]["first_frame_start"]] = record
        return Response(
            json.dumps(list(result_dict.values())),
            mimetype="application/json",
            status=200,
        )
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/raw-data-aps-edrs-products/<start_date>/<end_date>",
    methods=["GET"],
)
@login_required
@flask_cache.cached(timeout=60)
def get_raw_data_aps_edrs_products(start_date, end_date):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        start_date = datetime.strptime(start_date, "%d-%m-%YT%H:%M:%S")
        end_date = datetime.strptime(end_date, "%d-%m-%YT%H:%M:%S")

        indices = ["raw-data-aps-edrs-product"]
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_date_range(
                    index, "planned_link_session_start", start_date, end_date
                )
                results += result
            except Exception as ex:
                logger.error(ex)

        # Remove duplicates (entries having the same first_frame_start)
        # Theoretically, aggregation should be done on Elastic side
        result_dict = {}
        for record in results:
            if record["_source"]["link_session_id"] not in result_dict:
                result_dict[record["_source"]["link_session_id"]] = record
        return Response(
            json.dumps(list(result_dict.values())),
            mimetype="application/json",
            status=200,
        )
    except:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-publication-count-quarter/<year>/<quarter>/<mission>/<product_level>/<product_type>",
    methods=["GET"],
)
@login_required
@flask_cache.cached(timeout=2628288 * 3)  # 3 Months
def get_cds_publication_count_complex_quarter(
    year, quarter, mission, product_level, product_type
):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        quarter_class = Quarter()
        quarter_class.set_year(year)
        end_date = quarter_class.get(int(quarter))["end"]
        start_date = quarter_class.get(int(quarter))["start"]

        results = elastic_repository.get_cds_publication_count_complex(
            start_date, end_date, mission, product_level, product_type
        )

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )


@blueprint.route(
    "/api/repository/cds-publication-size-quarter/<year>/<quarter>/<mission>/<product_level>/<product_type>",
    methods=["GET"],
)
@login_required
@flask_cache.cached(timeout=2628288 * 3)  # 3 Months
def get_cds_publication_size_complex_quarter(
    year, quarter, mission, product_level, product_type
):
    try:
        if not auth_utils.is_user_authorized():
            return Response(
                json.dumps("Not authorized", cls=db_utils.AlchemyEncoder),
                mimetype="application/json",
                status=401,
            )

        quarter_class = Quarter()
        quarter_class.set_year(year)
        end_date = quarter_class.get(int(quarter))["end"]
        start_date = quarter_class.get(int(quarter))["start"]

        results = elastic_repository.get_cds_publication_size_complex(
            start_date, end_date, mission, product_level, product_type
        )

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        return Response(
            json.dumps({"error": "500"}), mimetype="application/json", status=500
        )
