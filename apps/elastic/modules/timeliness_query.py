# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${owner}
All rights reserved.

This document discloses subject matter in which ${ownerShort} has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of ${ownerShort} to fulfill the purpose for which the document was
delivered to him.
"""
import copy

import logging

from apps.cache.cache import PublicationProductTreeCache

logger = logging.getLogger(__name__)


def __timeliness_query_add_must_item(query_dict, timeliness_cfg, item_key):
    # logger.debug("Adding item %s", item_key)
    item_value = timeliness_cfg.get(item_key, None)
    if item_value is not None:
        # Operation has a different name depending on value being a list or not
        must_op = "terms" if type(item_value) is list else "term"
        # Add level specificaiton to query
        # TODO execute on a utility elastic_query class
        query_dict["bool"]["must"].append({must_op: {item_key: item_value}})


class ElasticQueryExpression:

    def __init__(self, must_clause_list, must_not_clause_list):
        self._query_dict = {
            "bool": {"must": must_clause_list, "must_not": must_not_clause_list}
        }

    def get_copy(self):
        must_list = copy.deepcopy(self._query_dict["bool"]["must"])
        must_not_list = copy.deepcopy(self._query_dict["bool"]["must_not"])
        return ElasticQueryExpression(must_list, must_not_list)

    def _add_clause(self, bool_key, clause):
        self._query_dict["bool"][bool_key].append(clause)

    def add_must_clause(self, clause):
        self._add_clause("must", clause)

    def add_must_not_clause(self, clause):
        self._add_clause("must_not", clause)

    def add_must_term_expr(self, field_name, field_value):
        """
        Add to the  Query expression a TERM condition,
        for the specified field and value.
        Use the propert Term/terms keyword depending on the type of field value
        (scalar or list)
        Args:
            field_name ():
            field_value ():

        Returns:
            Nothing.
            Side Effect: the  query expression is updated
        """
        if field_value is not None:
            # logger.debug("Adding to Query Expression MUST: field %s, value %s",
            #             field_name, field_value)
            # Operation has a different name depending on value being a list or not
            must_op = "terms" if type(field_value) is list else "term"
            # Add term specification to query
            self.add_must_clause({must_op: {field_name: field_value}})

    def add_must_range_clause(self, field_name, from_value, to_value):
        range_expr = {}
        if from_value is not None:
            range_expr.update({"gte": from_value})
        if to_value is not None:
            range_expr.update({"lt": to_value})
        # Add range clause only if at least one end ofhe range has a value
        if from_value is not None or to_value is not None:
            self.add_must_clause({"range": {field_name: range_expr}})

    def update_time_range(self, time_attr, time_interval):
        range_item = next(
            (
                clause["range"]
                for clause in self._query_dict["bool"]["must"]
                if "range" in clause
            ),
            None,
        )
        # update range item value
        range_item[time_attr]["gte"] = time_interval[0]
        range_item[time_attr]["lt"] = time_interval[1]

    def add_filter(self, filter_expr):
        self._query_dict["bool"].update({"filter": filter_expr})

    def get_query_dict(self):
        return self._query_dict


HOUR_SECONDS = 3600
DAY_SECONDS = HOUR_SECONDS * 24


# Publication vs product index queries
# 1. rnge_time_attribute: publication_date vs prip_publicaiton_date
# 2. threshold condition:
#    range on from_sensing_timeliness vs filter with script with parameter
# TimelinessProductElasticQuery vs TimelinessPublicationElasticQuery
class TimelinessConfigurationKeys:
    LevelKey = "product_level"
    TypeKey = "product_type"


class TimelinessElasticQuery:
    def __init__(self, mission, timeliness_cfg, use_publication=True):
        self._use_publication = use_publication
        logger.debug(
            "Building imeliness Query Builder for mission %s, using publicaton index: %s",
            mission,
            use_publication,
        )
        # self.range_time_attribute = 'prip_publication_date' if published else 'sensing_end_date'
        self.range_time_attribute = (
            "publication_date" if use_publication else "prip_publication_date"
        )
        # Retrieve Timeliness type keyword from configuraiton
        timeliness_keyword = timeliness_cfg.get("timeliness")

        #    ========     Restriction of products to be counted
        # Basequery.Add_must_term mission, mission
        # Basequery.add must_term timeliness
        _base_must_list = [
            {"term": {"mission": mission}},
            {"prefix": {"timeliness": timeliness_keyword}},
        ]
        #   ========    Exclusion specification
        _base_must_notlist = [{"term": {"product_level": "___"}}]

        if use_publication:
            publication_service = PublicationProductTreeCache.load_object(
                "current_publication_service"
            )
            # Basequery.add must_term service_type
            _base_must_list.append({"term": {"service_type": "DD"}})
            _base_must_list.append({"term": {"service_id": publication_service}})

        self._base_query = {
            "bool": {"must": _base_must_list, "must_not": _base_must_notlist}
        }
        self._queries = {}

    def set_interval(self, start_date, end_date):
        # TODO add must range to base query
        self.add_query_must_range_clause(
            self._base_query, self.range_time_attribute, start_date, end_date
        )
        # self._base_query['bool']['must'].append({'range':
        #                        {self.range_time_attribute: {
        #                            'gte': start_date,
        #                            'lt': end_date
        #                        }}
        # })

    def add_constraints(self, constraints_cfg):
        # TODO: add constraints to base query
        must_list = [self._base_query["bool"]["must"]]
        for constraint_key, constraint_value in constraints_cfg.items():
            # Apply the constraint:
            # use a term or a terms keyword, depending on type of constraint value
            must_op = "terms" if type(constraint_value) is list else "term"
            must_list.append({must_op: {constraint_key: constraint_value}})

    def create_query(self, query_name):
        self._queries[query_name] = ElasticQueryExpression(
            self._base_query["bool"]["must"], self._base_query["bool"]["must_not"]
        )
        # .deepcopy(self._base_query)
        return self._queries[query_name]

    # TODO Move to elastic_query class
    def _add_clause(self, query_dict, bool_key, clause):
        query_dict["bool"][bool_key].append(clause)

    def add_query_must_range_clause(self, query_expr, field_name, from_value, to_value):
        range_expr = {}
        if from_value is not None:
            range_expr.update({"gte": from_value})
        if to_value is not None:
            range_expr.update({"lt": to_value})
        # Add range clause only if at least one end ofhe range has a value
        if from_value is not None or to_value is not None:
            self._add_clause(query_expr, "must", {"range": {field_name: range_expr}})
        return query_expr

    # return copy of  elastic_query object
    def get_query_copy(self, query_name):
        return copy.deepcopy(self._queries.get(query_name))

    def _query_add_level_sensor_clauses(
        self, query_expr: ElasticQueryExpression, timeliness_cfg, sensor_cfg
    ):
        # TODO: operate on a elastic_query object
        level_key = TimelinessConfigurationKeys.LevelKey
        level_val = timeliness_cfg.get(level_key)
        query_expr.add_must_term_expr(level_key, level_val)
        if sensor_cfg:
            sensor_key = TimelinessConfigurationKeys.TypeKey
            sensor_val = sensor_cfg.get(sensor_key)
            query_expr.add_must_term_expr(sensor_key, sensor_val)
        return query_expr

    # Timlenes Query Builder
    # Timeliness publication query bulder
    # they instantiate a elasticquery for timeliness
    # same methods to retrieve query
    def _get_ontime_product_count_query(
        self, ontime_query_exp, timeliness_cfg, sensor_cfg
    ):
        temp_ontime_query = ontime_query_exp.get_copy()
        temp_ontime_query = self._query_add_level_sensor_clauses(
            temp_ontime_query, timeliness_cfg, sensor_cfg
        )
        # logger.debug("Timeliness Query after adding level: %s", query_dict)
        timeliness_value = timeliness_cfg.get("threshold", None)
        if timeliness_value is None:
            mission = timeliness_cfg.get("mission")
            tmtype = timeliness_cfg.get("timeliness")
            logger.error(
                "No Threshold set for timeliness for mission %s, timeliness %s",
                mission,
                tmtype,
            )
            raise Exception("Bad Timeliness Configuration")
        if self._use_publication:
            # Convert hour threshold to microseconds
            ms_threshold = int(timeliness_value) * HOUR_SECONDS * 1000000
            temp_ontime_query.add_must_range_clause(
                "from_sensing_timeliness", None, int(ms_threshold)
            )
        else:
            timeliness_script = {
                "script": {
                    "script": {
                        "source": "Long timediff = doc['prip_publication_date'].value.millis - doc['sensing_end_date'].value.millis;  return ( Duration.ofMillis(timediff).toHours() < params.threshold);",
                        "lang": "painless",
                        "params": {"threshold": int(timeliness_value)},
                    }
                }
            }
            temp_ontime_query.add_filter(timeliness_script)

        # timeliness_script["script"]["script"]["params"]["threshold"] = int(timeliness_value)
        query_body = {"query": temp_ontime_query.get_query_dict()}
        # logger.debug("Timeliness Query body: %s", query_body)
        return query_body

    def _get_timeliness_product_count_query(
        self, total_query_expr, timeliness_cfg, sensor_cfg
    ):
        temp_count_query = total_query_expr.get_copy()
        temp_count_query = self._query_add_level_sensor_clauses(
            temp_count_query, timeliness_cfg, sensor_cfg
        )
        query_body = {"query": temp_count_query.get_query_dict()}
        # logger.debug("Total Query body: %s", query_body)
        return query_body

    def _get_timeliness_statistics_query(
        self, stat_query_expr, timeliness_cfg, sensor_cfg
    ):
        temp_stat_query = stat_query_expr.get_copy()
        temp_stat_query = self._query_add_level_sensor_clauses(
            temp_stat_query, timeliness_cfg, sensor_cfg
        )
        return temp_stat_query.get_query_dict()

    def update_query_time_range(self, query_expr, time_interval):
        """
                Updates the time interval specified in the range conditon
            indluded in the must dictionary inside the specified
            query dictionary.
            Being items references, the update is propagated
            in the base_query_dict.
            The time range is passed as a tuple: (start, end)

        Args:
            query_expr ():
            time_interval ():

        Returns:

        """
        time_attr = self.range_time_attribute
        # look for range item in must list
        must_list = query_expr["bool"]["must"]
        # First item having range as key
        range_item = next(
            (clause["range"] for clause in must_list if "range" in clause), None
        )
        # update range item value
        range_item[time_attr]["gte"] = time_interval[0]
        range_item[time_attr]["lt"] = time_interval[1]
        # no need to return: query has be neupdated
