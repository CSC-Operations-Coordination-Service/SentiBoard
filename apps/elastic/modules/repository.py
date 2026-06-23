# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) -
All rights reserved.

This document discloses subject matter in which  has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of  to fulfill the purpose for which the document was
delivered to him.
"""
from apps.elastic import client as elastic_client


def get_cds_publication_size_complex(
    start_date, end_date, mission, product_level, product_type
):
    """
    Retrieve sum of size for products aggregating by
        mission/product level/product type
    """
    index = "cds-publication"
    elastic = elastic_client.ElasticClient()
    results = []
    try:
        query = {
            "bool": {
                "must": [
                    {
                        "range": {
                            "publication_date": {"gte": start_date, "lte": end_date}
                        }
                    },
                    {"match": {"mission": mission}},
                    {"match": {"product_level": product_level}},
                    {"match": {"product_type": product_type}},
                    {"match": {"service_type": "DD"}},
                ]
            }
        }
        aggs = {"content_length_sum": {"sum": {"field": "content_length"}}}
        result = elastic.search(index=index, query=query, aggs=aggs, size=10)[
            "aggregations"
        ]["content_length_sum"]["value"]
        results.append({"index": index, "content_length_sum": result})
    except Exception as ex:
        result = []
    return results


def get_cds_publication_count_complex(
    start_date, end_date, mission, product_level, product_type
):
    index = "cds-publication"
    elastic = elastic_client.ElasticClient()
    results = []
    try:
        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "range": {
                                "publication_date": {"gte": start_date, "lte": end_date}
                            }
                        },
                        {"match": {"mission": mission}},
                        {"match": {"product_level": product_level}},
                        {"match": {"product_type": product_type}},
                    ]
                }
            }
        }
        result = elastic.count(index=index, body=query)["count"]
        results.append({"index": index, "count": result})
    except Exception as ex:
        results = []
    return results
