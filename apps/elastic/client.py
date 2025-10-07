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

import logging
from datetime import timedelta

from elasticsearch import Elasticsearch, RequestsHttpConnection
from elasticsearch.helpers import scan

from apps.cache.cache import ConfigCache

logger = logging.getLogger(__name__)
configured_filters = ConfigCache.load_object("elastic_filters")


class ElasticClient:
    def __init__(
        self,
        elastic_scheme=None,
        elastic_host=None,
        elastic_port=None,
        elastic_user=None,
        elastic_password=None,
        verify_certs=False,
        ssl_show_warn=False,
    ):
        self.__client = None
        if (
            elastic_scheme is None
            or elastic_host is None
            or elastic_port is None
            or elastic_user is None
            or elastic_password is None
            or verify_certs is None
            or ssl_show_warn is False
        ):
            elastic_config = ConfigCache.load_object("elastic_config")
            cfg_verify_certs = elastic_config["verify_certs"] == "true"
            cfg_ssl_show_warn = elastic_config["ssl_show_warn"] == "true"
            self.init(
                elastic_config["elastic_scheme"],
                elastic_config["elastic_host"],
                elastic_config["elastic_port"],
                elastic_config["elastic_user"],
                elastic_config["elastic_password"],
                cfg_verify_certs,
                cfg_ssl_show_warn,
            )
        else:
            self.init(
                elastic_scheme,
                elastic_host,
                elastic_port,
                elastic_user,
                elastic_password,
                verify_certs,
                ssl_show_warn,
            )

    def init(
        self,
        elastic_scheme,
        elastic_host,
        elastic_port,
        elastic_user,
        elastic_password,
        verify_certs,
        ssl_show_warn,
    ):
        # Create the client instance
        self.__client = Elasticsearch(
            elastic_host,
            http_auth=(elastic_user, elastic_password),
            connection_class=RequestsHttpConnection,
            scheme=elastic_scheme,
            port=elastic_port,
            timeout=999999,
            verify_certs=verify_certs,
            ssl_show_warn=ssl_show_warn,
        )

    def count(self, index, body=None):
        if body is None:
            body = {"match_all": {}}
        # print("Elastic Search Count: ", body)
        result = self.get_connection().count(index=index, body=body)
        # print("Result: ", result)
        return result

    @staticmethod
    def date_interval_to_elastic_range(from_date, to_date):
        start_date_str = from_date.strftime("%Y-%m-%dT00:00:00")
        to_date = to_date + timedelta(days=1)
        end_date_str = to_date.strftime("%Y-%m-%dT00:00:00")
        return start_date_str, end_date_str

    def get_info(self):
        return self.__client.info()

    def get_connection(self):
        return self.__client

    def query_date_range(self, index, date_key, from_date, to_date):
        """
        to_date: date with the last day to be retrieved (inclusive)
        """
        # set the end date as to_date +1 at midnight, to include whole to_date day
        start_date_str, end_date_str = self.date_interval_to_elastic_range(
            from_date, to_date
        )

        return self.query_scan(
            index=index,
            query={
                "query": {
                    "range": {date_key: {"gte": start_date_str, "lt": end_date_str}}
                }
            },
        )

    def query_date_range_selected_fields(
        self, index, date_key, from_date, to_date, selected_fields
    ):
        """
        to_date: date with the last day to be retrieved (inclusive)
        """
        # set the end date as to_date +1 at midnight, to include whole to_date day
        start_date_str, end_date_str = self.date_interval_to_elastic_range(
            from_date, to_date
        )
        range_clause = {
            "range": {date_key: {"gte": start_date_str, "lt": end_date_str}}
        }
        return self.query_scan(
            index=index, query={"query": range_clause, "_source": selected_fields}
        )

    # TODO: Modify so that passed query is value of query dict
    #   e.g.: instead of {"query": {"match_all": {}}}
    #    put {"match_all": {}}
    # It is superflous paissng "query" dictionary, if
    # it is expected always to be specified!!!!!
    def query_scan(self, index, query=None):
        if query is None:
            query = {"query": {"match_all": {}}}
        logger.debug("Executing Elastic query : %s, on index : %s", query, index)
        result = self.filtered_scan(self.get_connection(), index, query, False)
        return result

    def query_scan_date_range(self, index, date_key, from_date, to_date, query=None):
        """
        Execute a Scan on elastic, on the specified index,
        selecting data using the specified Date Range.
        Date Range is checked against the specified field (date_key)
        Extend with specified query, if any.
        NOTE: the date range is speicified using strings. it must be
        correclty formatted. Time values are included in range check.
        Range end is excluded, range start is included
        Args:
            index (): the index we are querying
            date_key (): the field in the index, representing a time value, whose value
            is filtered againste specified time interval
            from_date (): string representing a date in the format '%Y-%m-%dT%H:%M:%S'
            to_date (): string representing a date in the format '%Y-%m-%dT%H:%M:%S'
            query (): optional dictionary, speciifying additional clauses for the query

        Returns: a list of JSON records satisfying the query

        """
        range_clause = {"range": {date_key: {"gte": from_date, "lt": to_date}}}
        if query is None:
            query = {"query": range_clause}
        else:
            query = {"query": {"bool": {"must": [query, range_clause]}}}
        result = self.filtered_scan(self.get_connection(), index, query, False)
        return result

    def refresh_index(self, index):
        self.get_connection().indices.refresh(index)

    def search(self, index, from_element=0, size=0, query=None, aggs=None):
        if query is None:
            query = {"match_all": {}}
        if aggs is not None:
            body = {"size": size, "from": from_element, "query": query, "aggs": aggs}
        else:
            body = {"size": size, "from": from_element, "query": query}
        # print("Elastic Search: ", body)
        try:
            result = self.get_connection().search(
                index=index, body=body, request_cache=True
            )
        except Exception as ex:
            logger.error("Failure executing Elastic query: %s on index %s", body, index)
            raise ex
        return result

    def filtered_scan(self, connection, index, query, clear_scroll):
        # filters should be a dict index -> query
        filter_expression = configured_filters.get(index)
        if filter_expression:
            filtered_query = {
                "bool": {
                    "must": query["query"],
                    "must_not": filter_expression,
                }
            }
            query["query"] = filtered_query

        return scan(connection, index=index, query=query, clear_scroll=clear_scroll)
