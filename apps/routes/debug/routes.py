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
from datetime import datetime, timedelta
from time import perf_counter

from flask import Response, request
from flask_login import login_required

import apps.elastic.client as elastic_client
import apps.elastic.modules.publication as elastic_publication
import apps.elastic.modules.timeliness as elastic_timeliness
import apps.utils.auth_utils as auth_utils
import apps.utils.db_utils as db_utils
import apps.utils.elastic_utils as elastic_utils
from apps import flask_cache
from apps.utils.date_utils import Quarter
from . import blueprint

logger = logging.getLogger(__name__)

mission_pub_extra_must_criteria = {
    # TODO Add Fileanme ending for each mission
    'S1': [
        {
            "wildcard": {
                'product_type': {
                    'value': "*S"
                },
            }
        }
    ],
    'S2': [
        {
            "terms": {
                'product_level': ['L1C', 'L2A']
            }
        }
    ]
}

mission_pub_extra_must_not_criteria = {
    'S3': [
        {"terms": {
            'product_level': ["L0_", "null"]
        }
        }
    ],
    'S2': [
        {'term': {
            'product_type': 'OLQC_REPORT'
        }
        }
    ]
}

fname_ends = {
    'S1': 'SAFE.zip',
    'S2': 'tar',
    'S3': 'SEN3.zip',
    'S5': 'nc'
}

platform_missions = {
    'S1A': 'S1',
    'S2A': 'S2',
    'S2B': 'S2',
    'S3A': 'S3',
    'S3B': 'S3',
    'S5P': 'S5'
}


@blueprint.route('/api/debug/cds-publication/<start_date>/<end_date>/<platform>', methods=['GET'])
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_publication_by_mission(start_date, end_date, platform):
    logger.info("Requested Publications from %s to %s for  platform %s",
                start_date, end_date, platform)
    mission = platform_missions.get(platform)
    remove_dups = True
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)

        start_date = datetime.strptime(start_date, '%d-%m-%Y')
        end_date = datetime.strptime(end_date, '%d-%m-%Y')

        # indices = utils.get_index_name_from_interval_date('cds-publication', start_date, end_date)
        indices = ['cds-publication']

        elastic = elastic_client.ElasticClient()
        start_date_str, end_date_str = elastic.date_interval_to_elastic_range(start_date, end_date)
        logger.info("Querying publications for platform %s from %s to %s excluded",
                    platform, start_date_str, end_date_str)
        results = []
        initial_size = 10000
        next_size = 5000
        max_records = 400000
        query_dict = {'bool': {
            'must': [
                {'match': {
                    'satellite_unit': platform
                }
                },
                {'range': {
                    'publication_date': {
                        'gte': start_date_str,
                        'lt': end_date_str
                    }
                }
                },
            ]
            , 'must_not': [
                {'term': {
                    'product_level': 'L__'
                }
                }
            ]
        }
        }
        # Add criteria to query , according to configuration, based on mission
        mission_extra_criteria = mission_pub_extra_must_criteria.get(mission, None)
        mission_mustnot_extra = mission_pub_extra_must_not_criteria.get(mission, None)
        # We assume that:
        # 1. extra criteria is a list of dictionaries implementing
        # elastic query criteria
        # 2. the extra criteria are all part of must clause

        if mission_extra_criteria is not None:
            query_dict['bool']['must'].extend(mission_extra_criteria)
        if mission_mustnot_extra is not None:
            query_dict['bool']['must_not'].extend(mission_mustnot_extra)
        source_fields = ['datatake_id',
                         'name', 'mission',
                         'product_level', 'product_type',
                         'satellite_unit', 'content_length',
                         'service_type',
                         'publication_date']

        # configurable pageing: initial size to be set by utility, sort to be set by utility using field list
        search_body = {'size': initial_size,
                       'query': query_dict
            , "_source": source_fields
            , "sort": [
                {"publication_date": "asc"},
                {"_id": "asc"}
            ]
                       }

        for index in indices:
            logger.info("On index %s", index)
            try:
                # query  selects by mission and by date range
                # Manage pagination:
                #  request 10000 records
                #   repeat until result is empty
                # after first search
                # each next  search pass last search biggest sort[0] value
                # using "search_after": [<sort_value>, <id of record with biggest sort value >"],
                logger.info("first query: %s", search_body)
                result = elastic.get_connection().search(index=index, body=search_body)['hits']['hits']
                index_records = len(result)
                # Remove filename duplicates
                if remove_dups:
                    # TODO Make configurable end of filename, also not configured
                    result_no_dup_names = {result_rec['_source']['name']: result_rec
                                           for result_rec in result
                                           if mission in fname_ends and result_rec['_source']['name'].endswith(
                            fname_ends[mission])}
                    result = list(result_no_dup_names.values())
                logger.info("Performed initial Query")
                if result is not None:
                    # logger.info("Copying %d results on after result", len(result))
                    after_result = result[:]
                else:
                    after_result = None
                # must_not: combine product level and mission
                #                   remove L__ for missiother than S5
                search_after_body = {}
                search_after_body.update(search_body)
                search_after_body['size'] = next_size
                while after_result is not None and len(after_result):
                    # Take last record in previous query result
                    last_rec = after_result[-1]

                    # Use last record sort values to define next search after
                    search_after_body.update({'search_after': last_rec['sort']})
                    logger.info("Searching with query: %s", search_after_body)
                    after_result = elastic.get_connection().search(index=index, body=search_after_body)['hits']['hits']
                    if after_result is not None:
                        index_records += len(after_result)
                        logger.info("adding %d results; total now: %s", len(after_result), index_records)
                        if remove_dups:
                            result_no_dup_names = {result_rec['_source']['name']: result_rec
                                                   for result_rec in after_result
                                                   if mission in fname_ends and result_rec['_source']['name'].endswith(
                                    fname_ends[mission])}
                            after_result = list(result_no_dup_names.values())
                        result.extend(after_result)
                    if index_records > max_records:
                        logger.warning("Collected more than 100.000 records. Interrupting")
                        break

                # Look for biggest sort value in record
                # Take the related id.
                results += result
            except Exception as ex:
                logger.error(ex)
        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error(ex)
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-product-timeliness/<start_date>/<end_date>/<mission>', methods=['GET'])
@blueprint.route('/api/debug/cds-product-timeliness/<start_date>/<end_date>/<mission>/<timeliness>', methods=['GET'])
@blueprint.route('/api/debug/cds-product-timeliness/<start_date>/<end_date>/<mission>/<timeliness>/<published>', methods=['GET'])
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_product_timeliness(start_date, end_date, mission, timeliness=None, published=True):
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)
        start_date = datetime.strptime(start_date, '%d-%m-%YT%H:%M:%S')
        end_date = datetime.strptime(end_date, '%d-%m-%YT%H:%M:%S')
        logger.info("Querying timeliness for mission %s from %s to %s excluded",
                    mission, start_date, end_date)
        # MOVE to ELASTIC UTILS FUNCTION
        results = []
        if timeliness is None:
            results = elastic_timeliness.get_cds_mission_product_timeliness(start_date, end_date, mission)
        else:
            results = elastic_timeliness.get_cds_product_timeliness(start_date, end_date, mission, timeliness, published)
        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error("Failed request: %s", ex, exc_info=True)
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-product/<start_date>/<end_date>/<datatake_id>', methods=['GET'])
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_product(start_date, end_date, datatake_id):
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)

        start_date = datetime.strptime(start_date, '%d-%m-%Y')
        end_date = datetime.strptime(end_date, '%d-%m-%Y')

        indices = elastic_utils.get_index_name_from_interval_date('cds-product', start_date, end_date)
        elastic = elastic_client.ElasticClient()
        results = []
        for index in indices:
            try:
                result = elastic.query_scan(index=index, query={"query": {"match": {"datatake_id": datatake_id}}})
                results += result
            except Exception as ex:
                logger.error("Received error while executing query, on Elastic: %s", ex, exc_info=True)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except:
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-publication-trend-by-mission/<start_date>/<end_date>/<num_periods>/<mission>',
                 methods=['GET'])
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_publication_trend_by_mission(start_date, end_date, num_periods, mission):
    logger.info("Trend for mission %s, %s periods, from %s to %s",
                mission, num_periods, start_date, end_date)
    # TODO: Missing selection of levels and/or product types!
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)
        api_start_time = perf_counter()

        start_date = datetime.strptime(start_date, '%d-%m-%YT%H:%M:%S')
        end_date = datetime.strptime(end_date, '%d-%m-%YT%H:%M:%S')
        trend_result = elastic_publication.get_cds_publication_trend_by_mission(start_date, end_date, mission, num_periods)
        api_end_time = perf_counter()
        logger.info(f"API TREND for mission {mission}, start: {start_date}, end: {end_date} - Execution Time : {api_end_time - api_start_time:0.6f}")

        return Response(json.dumps(trend_result), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error("Failure on mission %s: %s", mission, ex)
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-publication-count-by-mission/<start_date>/<end_date>/<mission>', methods=['GET'])
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_publication_count_by_mission(start_date, end_date, mission):
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)
        logger.debug("Get CDS Publication COUNT by mission: From %s, to %s, Mission: %s",
                     start_date, end_date, mission)
        start_date = datetime.strptime(start_date, '%d-%m-%YT%H:%M:%S')
        end_date = datetime.strptime(end_date, '%d-%m-%YT%H:%M:%S')
        results = elastic_publication.get_cds_publication_count_by_mission(start_date, end_date, mission)
        logger.debug("Received results from cds_publication_count: %s", results)
        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error("Failure on mission %s: %s", mission, ex)
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-publication-size-by-mission/<start_date>/<end_date>/<mission>', methods=['GET'])
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_publication_size_by_mission(start_date, end_date, mission):
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)
        logger.debug("Get CDS Publication SIZE by mission: From %s, to %s, Mission: %s",
                     start_date, end_date, mission)

        start_date = datetime.strptime(start_date, '%d-%m-%YT%H:%M:%S')
        end_date = datetime.strptime(end_date, '%d-%m-%YT%H:%M:%S')

        results = elastic_publication.get_cds_publication_size_by_mission(start_date, end_date, mission)
        logger.debug("Received results from cds_publication_count: %s", results)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error("Error: %s", ex)
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-publication-by-datatakes-id-and-date', methods=['POST'])
@login_required
@flask_cache.cached(timeout=60 * 60)
def get_cds_publication_by_datatakes_id():
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)

        body = json.loads(request.data.decode('utf8'))
        id = body['value']
        start_date = datetime.strptime(body['date'], '%d-%m-%Y')
        delta = timedelta(days=14)
        end_date = start_date + delta
        results = elastic_utils.get_cds_publication_from_datake(id)

        list_filtered = []
        for result in results:
            result = result['_source']
            if datetime.strptime(result['publication_date'],
                                 "%Y-%m-%dT%H:%M:%S.%fZ") >= start_date and datetime.strptime(
                result['publication_date'], "%Y-%m-%dT%H:%M:%S.%fZ") <= end_date:
                list_filtered.append(result)

        return Response(json.dumps(list_filtered, cls=db_utils.AlchemyEncoder), mimetype="application/json", status=200)
    except Exception as ex:
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-publication-size-by-mission-quarter/<year>/<quarter>/<mission>', methods=['GET'])
@login_required
@flask_cache.cached(timeout=2628288 * 3)  # 3 Months
def get_cds_publication_size_by_mission_quarter(year, quarter, mission):
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)

        quarter_class = Quarter()
        quarter_class.set_year(year)
        end_date = quarter_class.get(int(quarter))['end']
        start_date = quarter_class.get(int(quarter))['start']

        results = elastic_publication.get_cds_publication_size_by_mission(start_date, end_date, mission)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error("Error: %s", ex)
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)


@blueprint.route('/api/debug/cds-publication-count-by-mission-quarter/<year>/<quarter>/<mission>', methods=['GET'])
@login_required
@flask_cache.cached(timeout=2628288 * 3)  # 3 Months
def get_cds_publication_count_by_mission_quarter(year, quarter, mission):
    try:
        if not auth_utils.is_user_authorized():
            return Response(json.dumps("Not authorized", cls=db_utils.AlchemyEncoder), mimetype="application/json",
                            status=401)

        quarter_class = Quarter()
        quarter_class.set_year(year)
        end_date = quarter_class.get(int(quarter))['end']
        start_date = quarter_class.get(int(quarter))['start']

        results = elastic_publication.get_cds_publication_count_by_mission(start_date, end_date, mission)

        return Response(json.dumps(results), mimetype="application/json", status=200)
    except Exception as ex:
        logger.error("Failure on mission %s: %s", mission, ex)
        return Response(json.dumps({'error': '500'}), mimetype="application/json", status=500)
