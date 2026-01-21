# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) -
All rights reserved.

This document discloses subject matter in which SERCO has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of  to fulfill the purpose for which the document was
delivered to him.
"""

import logging
from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta

import apps.ingestion.anomalies_ingestor as anomalies_ingestor
from apps.elastic import client as elastic_client
from apps.models import anomalies as anomalies_model
from apps.utils import date_utils

logger = logging.getLogger(__name__)

level_ids = {
    "S3": {"L0_": "L0_", "L1_": "L1_", "L2_": "L2_"},
    "S5": {"L0_": "L0_", "L1_": "L1B", "L2_": "L2_"},
}

satellites_mission_map = {
    "S1A": "S1",
    "S1B": "S1",
    "S1C": "S1",
    "S1D": "S1",
    "S2A": "S2",
    "S2B": "S2",
    "S2C": "S2",
    "S2D": "S2",
    "S3A": "S3",
    "S3B": "S3",
    "S3C": "S3",
    "S3D": "S3",
    "S5P": "S5",
}

mission_time_thresholds = {"S1": 8, "S2": 10, "S3": 696, "S5": 48}

CDS_MISSIONS = {
    "s1": ["s1a", "s1c", "s1d"],
    "s2": ["s2a", "s2b", "s2c"],
    "s3": ["s3a", "s3b"],
    "s5": ["s5p"],
}

ELASTIC_TIME_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"


def fetch_anomalies_datatakes_last_quarter():
    """
    Fetch the datatakes in the last 3 months from Elastic DB using the exposed REST APIs. The start time is set at
    00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59 of the day after.
    """

    # Retrieve data takes in the last 3 months and store results of query in cache
    end_date = datetime.today()
    start_date = end_date - relativedelta(months=3)
    end_date = end_date + relativedelta(days=1)

    # Retrieve datatakes from Elastic client
    dt_last_quarter = _get_cds_datatakes(start_date, end_date)

    # Re-evaluate the impact of anomalies on datatakes completeness
    _refresh_anomalies_status(dt_last_quarter)

    # Return the complete and normalized set of datatakes
    return dt_last_quarter


def fetch_anomalies_datatakes_prev_quarter():
    """
    Fetch the datatakes in the previous completed quarter from Elastic DB using the exposed REST APIs. The start
    time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
    """

    # Retrieve data takes in the previous, completed quarter and store results of query in cache
    start_date, end_date = date_utils.prev_quarter_interval_from_date(datetime.today())

    # Retrieve datatakes from Elastic client and store results manually in cache
    dt_prev_quarter = _get_cds_datatakes(start_date, end_date)

    # Return the complete and normalized set of datatakes
    return dt_prev_quarter


def fetch_datatake_details(datatake_id):
    """
    Fetch the datatake information given the datatake ID.
    Choose the appropriate function according to the mission
    """

    if "S1" in datatake_id.upper() or "S2" in datatake_id.upper():
        return _get_cds_s1s2_datatake_details(datatake_id)
    elif "S3" in datatake_id.upper():
        return _get_cds_s3_datatake_details(datatake_id)
    elif "S5" in datatake_id.upper():
        return _get_cds_s5_datatake_details(datatake_id)
    else:
        return "Unrecongnized datatake ID: " + datatake_id


def _get_cds_datatakes(start_date: datetime, end_date: datetime):
    end_date_str = end_date.strftime("%d-%m-%Y")
    start_date_str = start_date.strftime("%d-%m-%Y")
    dt_interval = []
    dt_interval += _get_cds_s1s2_datatakes(start_date_str, end_date_str)
    dt_interval += _get_cds_s3_datatakes(start_date_str, end_date_str)
    dt_interval += _get_cds_s5_datatakes(start_date_str, end_date_str)
    return dt_interval


def _build_cds_completeness_indices(mission, satellites, splitted=False):
    """
    Build CDS completeness index names dynamically
    """
    prefix = "cds-completeness-splitted" if splitted else "cds-completeness"
    return [f"{prefix}-{mission}-{sat}-dd-das" for sat in satellites]


def _get_cds_s1s2_datatakes(start_date, end_date):
    """
    Fetch the datatakes of S1 and S2 missions in the last 3 months from Elastic DB using the exposed REST APIs. The
    start time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
    """

    results = []
    try:

        # Define start and end dates range
        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        # Auxiliary variable declaration
        # indices = ["cds-datatake"]
        indices = _build_cds_completeness_indices(
            "s1", CDS_MISSIONS["s1"]
        ) + _build_cds_completeness_indices("s2", CDS_MISSIONS["s2"])

        logger.info("[CDS][S1S2] Querying indices: %s", indices)
        elastic = elastic_client.ElasticClient()

        # Fetch results from Elastic database
        for index in indices:
            # logger.info("[CDS][S1S2] Query index=%s", index)
            try:
                result_gen = elastic.query_date_range_selected_fields(
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
                        "l0_sensing_duration",
                        "instrument_mode",
                        "*_local_percentage",
                        "cams_tickets",
                        "cams_origin",
                        "cams_description",
                        "last_attached_ticket",
                    ],
                )
                result = list(result_gen)
                # Convert result into array
                # logger.info(
                #    "[CDS][S1S2][LIST] index=%s fetched=%d docs",
                #    index,
                #    len(result),
                # )
                # if result:
                #    logger.debug(
                #        "[CDS][S1S2][LIST][RAW] sample _source keys=%s",
                #        sorted(result[0].get("_source", {}).keys()),
                #    )

                results.extend(result)
            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)
                raise cex

            except Exception as ex:
                logger.error("[CDS][S1S2] Error querying index=%s", index)
                logger.exception(ex)
    except Exception as ex:
        logger.error(ex)

    # Calculate completeness for every datatake
    for dt in results:
        # logger.info(
        #    "[CDS][S1S2][LIST][BEFORE] datatake_id=%s keys=%s",
        #    dt["_id"],
        #    sorted(dt["_source"].keys()),
        # )
        dt_id = dt["_id"]
        completeness = {}
        if any(s1_sat in dt_id for s1_sat in ["S1A", "S1B", "S1C"]):
            completeness = _calc_s1_datatake_completeness(dt)
            # logger.info(
            #    "[CDS][S1S2][LIST][CALC] datatake_id=%s completeness=%s",
            #    dt_id,
            #    completeness,
            # )

        elif any(s2_sat in dt_id for s2_sat in ["S2A", "S2B", "S2C"]):
            completeness = _calc_s2_datatake_completeness(dt)
        for key in list(dt["_source"]):
            if key.endswith("local_percentage"):
                dt["_source"].pop(key)

        # logger.info(
        #    "[CDS][S1S2][LIST][STRIPPED] datatake_id=%s remaining keys=%s",
        #    dt_id,
        #    sorted(dt["_source"].keys()),
        # )

        dt["_source"]["datatake_id"] = dt_id
        for level in ("L0_", "L1_", "L2_"):
            if level in completeness:
                dt["_source"][level] = completeness[level]

        # Calculate and append the completeness status
        dt["_source"]["completeness_status"] = _calc_datatake_completeness_status(
            dt["_source"]
        )
        # logger.info(
        #    "[CDS][S1S2][LIST][FINAL] datatake_id=%s completeness_status=%s",
        #    dt_id,
        #    dt["_source"].get("completeness_status"),
        # )
        # Mission + satellite
        sat = dt["_source"].get("satellite_unit", "")
        dt["_source"]["satellite"] = sat

        if sat.startswith("S1"):
            dt["_source"]["mission"] = "S1"
        elif sat.startswith("S2"):
            dt["_source"]["mission"] = "S2"
        else:
            dt["_source"]["mission"] = "UNKNOWN"

        # Product level (UI expects explicit value)
        if "L2_" in dt["_source"]:
            dt["_source"]["product_level"] = "L2"
        elif "L1_" in dt["_source"]:
            dt["_source"]["product_level"] = "L1"
        elif "L0_" in dt["_source"]:
            dt["_source"]["product_level"] = "L0"
        else:
            dt["_source"]["product_level"] = "UNKNOWN"

        # Main completeness percentage (UI KPI)
        status = dt["_source"].get("completeness_status", {})
        dt["_source"]["final_completeness_percentage"] = (
            status.get("PUB", {}).get("percentage")
            or status.get("ACQ", {}).get("percentage")
            or 0.0
        )

        # logger.info(
        #    "[CDS][S1S2][UI-READY] %s",
        #    {
        #        "datatake_id": dt["_source"].get("datatake_id"),
        #        "mission": dt["_source"].get("mission"),
        #        "satellite": dt["_source"].get("satellite"),
        #        "product_level": dt["_source"].get("product_level"),
        #        "final_completeness_percentage": dt["_source"].get(
        #            "final_completeness_percentage"
        #        ),
        #    },
        # )

    # Return the response
    return results


def _get_cds_s3_datatakes(start_date, end_date):
    """
    Fetch the datatakes of S3 satellites in the last 3 months from Elastic DB using the exposed REST APIs. The
    start time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
    """

    results = []
    try:

        # Define start and end dates range
        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        # Auxiliary variable declaration
        # indices = ["cds-s3-completeness"]
        indices = _build_cds_completeness_indices(
            "s3", CDS_MISSIONS["s3"], splitted=True
        )
        elastic = elastic_client.ElasticClient()

        logger.info("[CDS][S3] Querying indexes:%s", indices)

        # Fetch results (products) from Elastic database
        # Mission-Completeness Index
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
                        "cams_tickets",
                        "cams_origin",
                        "cams_description",
                        "last_attached_ticket",
                    ],
                )
                # Convert result into array
                logger.debug("Adding result from cds_s3_datatakes query")
                results += result

            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)
                raise cex

            except Exception as ex:
                logger.warning(
                    "(cds_s3_datatakes) Received Elastic error for index: %s", index
                )
                logger.error(ex)

    except Exception as ex:
        logger.error(ex)

    # Group S3 products according to datatake instances
    prod_dict = {}
    for prod in results:
        dt_id = prod["_source"]["datatake_id"]
        prod_dict.setdefault(dt_id, []).append(prod)

    # Build and collect datatake instances
    datatakes = []
    for dt_id, dt_prods in prod_dict.items():
        datatake = {"_source": {}}
        datatake["_source"]["datatake_id"] = dt_id
        datatake["_source"]["satellite_unit"] = dt_id[0:3]
        datatake["_source"]["instrument_mode"] = dt_prods[0]["_source"]["product_type"][
            5:8
        ]
        observation_window = _calc_s3_s5_datatake_observation_window(dt_prods)
        datatake["_source"]["observation_time_start"] = observation_window[
            "observation_time_start"
        ]
        datatake["_source"]["observation_time_stop"] = observation_window[
            "observation_time_stop"
        ]
        completeness = _calc_s3_datatake_completeness(dt_prods)
        for level in ["L0_", "L1_", "L2_"]:
            if level in completeness:
                datatake["_source"][level] = completeness[level]

        # Calculate and append the completeness status
        datatake["_source"]["completeness_status"] = _calc_datatake_completeness_status(
            datatake["_source"]
        )

        # Append CAMS related information
        for prod in dt_prods:
            for key in [
                "cams_tickets",
                "cams_origin",
                "cams_description",
                "last_attached_ticket",
            ]:
                if key in prod["_source"]:
                    datatake["_source"][key] = prod["_source"][key]

        # UI normalization
        datatake["_source"]["mission"] = "S3"
        datatake["_source"]["satellite"] = datatake["_source"]["satellite_unit"]
        if "L2_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L2"
        elif "L1_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L1"
        elif "L0_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L0"
        else:
            datatake["_source"]["product_level"] = "UNKNOWN"

        datatake["_source"]["final_completeness_percentage"] = (
            datatake["_source"]["completeness_status"]
            .get("PUB", {})
            .get("percentage", 0.0)
        )

        # Append the datatake in the list
        datatakes.append(datatake)

    # Return the datatakes list
    return datatakes


def _get_cds_s5_datatakes(start_date, end_date):
    """
    Fetch the datatakes of S5p satellite in the last 3 months from Elastic DB using the exposed REST APIs. The
    start time is set at 00:00:00 of the first day of the temporal interval; the stop time is set at 23:59:59.
    """

    results = []
    try:

        # Define start and end dates range
        start_date = datetime.strptime(start_date, "%d-%m-%Y")
        end_date = datetime.strptime(end_date, "%d-%m-%Y")

        # Auxiliary variable declaration
        # indices = ["cds-s5-completeness"]
        indices = _build_cds_completeness_indices(
            "s5", CDS_MISSIONS["s5"], splitted=True
        )
        elastic = elastic_client.ElasticClient()
        logger.info("[CDS][S5] Querying indexes:%s", indices)

        # Fetch results (products) from Elastic database
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
                        "cams_tickets",
                        "cams_origin",
                        "cams_description",
                        "last_attached_ticket",
                    ],
                )
                # Convert result into array
                logger.debug("Adding result from cds_s5_datatakes query")
                results += result

            except ConnectionError as cex:
                logger.error("Connection Error: %s", cex)

            except Exception as ex:
                logger.warning(
                    "(cds_s5_datatakes) Received Elastic error for index: %s", index
                )
                logger.error(ex)

    except Exception as ex:
        logger.error(ex)

    # Group S5 products according to datatake instances
    # Group datatake products
    prod_dict = {}
    for prod in results:
        dt_id = prod["_source"]["datatake_id"]
        prod_dict.setdefault(dt_id, []).append(prod)

    # Build and collect datatake instances
    datatakes = []
    for dt_id, dt_prods in prod_dict.items():
        datatake = {"_source": {}}
        datatake["_source"]["datatake_id"] = dt_id
        datatake["_source"]["satellite_unit"] = dt_id[0:3]
        datatake["_source"]["instrument_mode"] = dt_prods[0]["_source"]["product_type"][
            5:8
        ]
        observation_window = _calc_s3_s5_datatake_observation_window(dt_prods)
        datatake["_source"]["observation_time_start"] = observation_window[
            "observation_time_start"
        ]
        datatake["_source"]["observation_time_stop"] = observation_window[
            "observation_time_stop"
        ]
        completeness = _calc_s5_datatake_completeness(dt_prods)
        for level in ["L0_", "L1_", "L2_"]:
            if level in completeness:
                datatake["_source"][level] = completeness[level]

        datatake["_source"]["completeness_status"] = _calc_datatake_completeness_status(
            datatake["_source"]
        )

        # Calculate and append the completeness status
        datatake["_source"]["completeness_status"] = _calc_datatake_completeness_status(
            datatake["_source"]
        )

        sat = datatake["_source"].get("satellite_unit", "")
        datatake["_source"]["satellite"] = sat

        if sat.startswith("S3"):
            datatake["_source"]["mission"] = "S3"
        elif sat.startswith("S5"):
            datatake["_source"]["mission"] = "S5"
        else:
            datatake["_source"]["mission"] = "UNKNOWN"

        # Product level (UI expects explicit value)
        if "L2_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L2"
        elif "L1_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L1"
        elif "L0_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L0"
        else:
            datatake["_source"]["product_level"] = "UNKNOWN"

        # Main completeness percentage (UI KPI)
        status = datatake["_source"].get("completeness_status", {})
        datatake["_source"]["final_completeness_percentage"] = (
            status.get("PUB", {}).get("percentage")
            or status.get("ACQ", {}).get("percentage")
            or 0.0
        )

        # Append CAMS related information
        # CAMS info
        for prod in dt_prods:
            for key in [
                "cams_tickets",
                "cams_origin",
                "cams_description",
                "last_attached_ticket",
            ]:
                if key in prod["_source"]:
                    datatake["_source"][key] = prod["_source"][key]

        datatake["_source"]["mission"] = "S5"
        datatake["_source"]["satellite"] = datatake["_source"]["satellite_unit"]
        if "L2_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L2"
        elif "L1_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L1"
        elif "L0_" in datatake["_source"]:
            datatake["_source"]["product_level"] = "L0"
        else:
            datatake["_source"]["product_level"] = "UNKNOWN"

        datatake["_source"]["final_completeness_percentage"] = (
            datatake["_source"]["completeness_status"]
            .get("PUB", {})
            .get("percentage", 0.0)
        )

        # Append the datatake in the list
        datatakes.append(datatake)

    # Return the datatakes list
    return datatakes


def _calc_s1_datatake_completeness(datatake):
    """
    Calculate the completeness of S1 datatakes.
    """
    dt_id = datatake["_id"]
    completeness = {"datatakeID": dt_id}
    l0_count = 0
    l0_perc = 0
    l1_count = 0
    l1_perc = 0
    l2_count = 0
    l2_perc = 0

    # TODO: Replace with RE matching
    # TODO: Matching strings for Levels depends on mission
    keys = datatake["_source"].keys()
    for key in keys:
        if ("_0C_" in key or "_0S_" in key or "_0A_" in key or "_0N_" in key) and (
            "percentage" in key
        ):
            l0_count += 1
            l0_perc += datatake["_source"][key]
        elif ("_1A_" in key or "_1S_" in key) and ("percentage" in key):
            l1_count += 1
            l1_perc += datatake["_source"][key]
        elif ("_2A_" in key or "_2S_" in key) and ("percentage" in key):
            l2_count += 1
            l2_perc += datatake["_source"][key]
    if l0_count != 0:
        completeness["L0_"] = l0_perc / l0_count
    if l1_count != 0:
        completeness["L1_"] = l1_perc / l1_count
    if l2_count != 0:
        completeness["L2_"] = l2_perc / l2_count
    return completeness


def _calc_s2_datatake_completeness(datatake):
    """
    Calculate the completeness of S2 datatakes.
    """

    dt_id = datatake["_id"]
    completeness = {"datatakeID": dt_id}
    keys = datatake["_source"].keys()
    l0_count = 0
    l0_perc = 0
    l1_count = 0
    l1_perc = 0
    l2_count = 0
    l2_perc = 0
    for key in keys:
        if ("L0_" in key) and ("percentage" in key):
            l0_count += 1
            l0_perc += datatake["_source"][key]
        elif ("L1B_" in key or "L1C_" in key) and ("percentage" in key):
            l1_count += 1
            l1_perc += datatake["_source"][key]
        elif ("L2A_" in key or "_2S_" in key) and ("percentage" in key):
            l2_count += 1
            l2_perc += datatake["_source"][key]
    if l0_count != 0:
        completeness["L0_"] = l0_perc / l0_count
    if l1_count != 0:
        completeness["L1_"] = l1_perc / l1_count
    if l2_count != 0:
        completeness["L2_"] = l2_perc / l2_count
    return completeness


def _calc_s3_datatake_completeness(prod_list):
    """
    Calculate the completeness of S3 datatakes, given the global list of products and
    considering only the relevant product types.
    """
    mission_level_ids = level_ids["S3"]

    dt_id = prod_list[0]["_source"]["datatake_id"]
    completeness = {"datatakeID": dt_id}
    l0_count = 0
    l0_perc = 0
    l1_count = 0
    l1_perc = 0
    l2_count = 0
    l2_perc = 0
    mission = "S3"
    for prod in prod_list:
        if (
            "L0_" in prod["_source"]["product_level"]
            and "percentage" in prod["_source"]
        ):
            l0_count += 1
            l0_perc += prod["_source"]["percentage"]
        elif (
            "L1_" in prod["_source"]["product_level"]
            and "percentage" in prod["_source"]
        ):
            l1_count += 1
            l1_perc += prod["_source"]["percentage"]
        elif (
            "L2_" in prod["_source"]["product_level"]
            and "percentage" in prod["_source"]
        ):
            l2_count += 1
            l2_perc += prod["_source"]["percentage"]
    if l0_count != 0:
        completeness["L0_"] = l0_perc / l0_count
    if l1_count != 0:
        completeness["L1_"] = l1_perc / l1_count
    if l2_count != 0:
        completeness["L2_"] = l2_perc / l2_count
    return completeness


def _calc_s5_datatake_completeness(prod_list):
    """
    Calculate the completeness of S3 and S5p datatakes, given the global list of products and
    the product types of interest.
    """
    mission_level_ids = level_ids["S5"]

    dt_id = prod_list[0]["_source"]["datatake_id"]
    completeness = {"datatakeID": dt_id}
    l0_count = 0
    l0_perc = 0
    l1_count = 0
    l1_perc = 0
    l2_count = 0
    l2_perc = 0
    for prod in prod_list:
        if (
            mission_level_ids["L0_"] in prod["_source"]["product_level"]
            and "percentage" in prod["_source"]
        ):
            l0_count += 1
            l0_perc += prod["_source"]["percentage"]
        elif (
            mission_level_ids["L1_"] in prod["_source"]["product_level"]
            and "percentage" in prod["_source"]
        ):
            l1_count += 1
            l1_perc += prod["_source"]["percentage"]
        elif (
            mission_level_ids["L2_"] in prod["_source"]["product_level"]
            and "percentage" in prod["_source"]
        ):
            l2_count += 1
            l2_perc += prod["_source"]["percentage"]
    if l0_count != 0:
        completeness["L0_"] = l0_perc / l0_count
    if l1_count != 0:
        completeness["L1_"] = l1_perc / l1_count
    if l2_count != 0:
        completeness["L2_"] = l2_perc / l2_count
    return completeness


def _calc_datatake_completeness_status(datatake):
    """
    Computes Completeness status With two group of values:
    ACQ completeness
    PUB completeness
    The status is expressed with a string, and includes the numeric value

    Args:
        datatake (): a dictionary representing a datatake, cinluding a
        list of completeness values for L0/L1/L2 levels (in form of dictionary)

    Returns: No Return: completeness status information is added to datatake
    dictionary
    """

    # Auxiliary variables declaration
    completeness_status = {
        "ACQ": {"status": "", "percentage": 0},
        "PUB": {"status": "", "percentage": 0},
    }

    completeness_threshold = 90.0

    dt_level_completeness = datatake
    dt_sat_unit = datatake["satellite_unit"]
    dt_mission = satellites_mission_map.get(dt_sat_unit)
    time_threshold = mission_time_thresholds[dt_mission]
    failure_threshold = 10

    # Read Current Time in comparison with sensing stop time
    now = datetime.now()
    sensing_stop = datetime.strptime(
        datatake["observation_time_stop"], ELASTIC_TIME_FORMAT
    )

    # If the current date is before the sensing time stop, the status is PLANNED - move to the next record
    if now <= sensing_stop:
        completeness_status["ACQ"]["status"] = "PLANNED"
        completeness_status["ACQ"]["percentage"] = 0
        completeness_status["PUB"]["status"] = "PLANNED"
        completeness_status["PUB"]["percentage"] = 0
        return completeness_status

    # Set the ACQ completeness percentage
    # Manage rare events when L0 is not present, but L1 or L2 are available instead, i.e. for S5P datatakes
    if "L0_" in dt_level_completeness:
        completeness_status["ACQ"]["percentage"] = dt_level_completeness["L0_"]
    elif "L1_" in dt_level_completeness:
        completeness_status["ACQ"]["percentage"] = dt_level_completeness["L1_"]
    elif "L2_" in dt_level_completeness:
        completeness_status["ACQ"]["percentage"] = dt_level_completeness["L2_"]
    else:
        completeness_status["ACQ"]["percentage"] = 0

    # Set the PUB completeness percentage
    count = 0
    perc = 0
    if "L0_" in dt_level_completeness:
        count += 1
        perc += dt_level_completeness["L0_"]
    if "L1_" in dt_level_completeness:
        count += 1
        perc += dt_level_completeness["L1_"]
    if "L2_" in dt_level_completeness:
        count += 1
        perc += dt_level_completeness["L2_"]
    completeness_status["PUB"]["percentage"] = perc / count if count > 0 else 0.0

    # Override the ACQ completeness percentage when it is lower than the PUB percentage
    if (
        completeness_status["ACQ"]["percentage"]
        < completeness_status["PUB"]["percentage"]
    ):
        completeness_status["ACQ"]["percentage"] = completeness_status["PUB"][
            "percentage"
        ]

    # If the current date is within the defined time threshold w.r.t. the sensing stop time,
    # the ACQ and PUB status are set to PROCESSING - move to the next record
    sensing_elapsed_time = now - sensing_stop
    if sensing_elapsed_time < timedelta(hours=time_threshold):
        completeness_status["ACQ"]["status"] = (
            "ACQUIRED"
            if completeness_status["ACQ"]["percentage"] > completeness_threshold
            else "PROCESSING"
        )
        completeness_status["PUB"]["status"] = (
            "PUBLISHED"
            if completeness_status["PUB"]["percentage"] > completeness_threshold
            else "PROCESSING"
        )
        return completeness_status

    # If the current date is within an increased time threshold w.r.t. the sensing stop time and the
    # completeness is below the completeness_threshold, it is likely that we are experiencing a delay in the processing.
    # In this case, the ACQ and PUB status are set to DELAYED - move to the next record
    if (sensing_elapsed_time < timedelta(hours=time_threshold * 1.2)) and (
        completeness_status["PUB"]["percentage"] < completeness_threshold
    ):
        completeness_status["ACQ"]["status"] = (
            "ACQUIRED"
            if completeness_status["ACQ"]["percentage"] > completeness_threshold
            else "DELAYED"
        )
        completeness_status["PUB"]["status"] = "DELAYED"
        return completeness_status

    # In all other cases, if the completion percentage is below 90%, the status is partial;
    # If the completion percentage is below 5%, the product is assumed to be lost
    if completeness_status["ACQ"]["percentage"] >= completeness_threshold:
        completeness_status["ACQ"]["status"] = "ACQUIRED"
    elif (
        failure_threshold
        <= completeness_status["ACQ"]["percentage"]
        < completeness_threshold
    ):
        completeness_status["ACQ"]["status"] = "PARTIAL"
    else:
        completeness_status["ACQ"]["status"] = "UNAVAILABLE"

    if completeness_status["PUB"]["percentage"] >= completeness_threshold:
        completeness_status["PUB"]["status"] = "PUBLISHED"
    elif (
        failure_threshold
        <= completeness_status["PUB"]["percentage"]
        < completeness_threshold
    ):
        completeness_status["PUB"]["status"] = "PARTIAL"
    else:
        completeness_status["PUB"]["status"] = "UNAVAILABLE"

    return completeness_status


def _calc_s3_s5_datatake_observation_window(prod_list):
    """
    Calculate the time window of S3 and S5p datatakes.
    """

    start_time = datetime.strptime(
        prod_list[0]["_source"]["observation_time_start"], "%Y-%m-%dT%H:%M:%S.%fZ"
    )
    stop_time = datetime.strptime(
        prod_list[0]["_source"]["observation_time_stop"], "%Y-%m-%dT%H:%M:%S.%fZ"
    )
    escape_seq = ["DO", "NAV", "GM", "TN", "HKM", "HKM2", "OPER"]
    for prod in prod_list:
        if any(
            substring in prod["_source"]["product_type"] for substring in escape_seq
        ):
            continue
        start = datetime.strptime(
            prod["_source"]["observation_time_start"], "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        stop = datetime.strptime(
            prod["_source"]["observation_time_stop"], "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        start_time = start if start < start_time else start_time
        stop_time = stop if stop > stop_time else stop_time
        duration = stop_time - start_time
        if duration.total_seconds() / 60 > 97:
            stop_time = start_time + relativedelta(minutes=97)
    return {
        "observation_time_start": start_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ").replace(
            "000Z", "Z"
        ),
        "observation_time_stop": stop_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ").replace(
            "000Z", "Z"
        ),
    }


def _refresh_anomalies_status(dt_last_quarter):
    """
    Iterate over the anomalies retrieved from CAMS in the last 3 months, and update the impact on affected datatakes
    considering the recently published products.
    """
    logger.debug("[BEG] Refreshing Anomalies Status")
    # Compute the completeness of all data takes
    total_datatakes_completeness = {}
    for dt in dt_last_quarter:
        dt_id = dt["_source"]["datatake_id"]
        completeness = {"datatakeID": dt_id}
        if "L0_" in dt["_source"]:
            completeness["L0_"] = dt["_source"]["L0_"]
        if "L1_" in dt["_source"]:
            completeness["L1_"] = dt["_source"]["L1_"]
        if "L2_" in dt["_source"]:
            completeness["L2_"] = dt["_source"]["L2_"]
        total_datatakes_completeness[dt_id] = completeness

    # Retrieve the anomalies in a sliding window, from today and up to 3 months in the past
    list_anomalies = anomalies_ingestor.AnomaliesIngestor().get_anomalies_elastic()

    # Loop over all retrieved anomalies, and save or update them considering the impact on production
    for anomaly in list_anomalies:
        datatakes_completeness = []
        if (
            anomaly.get("environment") is not None
            and len(anomaly.get("environment")) > 0
        ):
            datatake_ids = anomaly.get("environment").split(";")
            for datatake_id in datatake_ids:
                if datatake_id is None or len(datatake_id) == 0:
                    continue
                datatake_id_mod = datatake_id.strip().replace("SNP", "S5P")
                if datatake_id_mod in total_datatakes_completeness:
                    datatakes_completeness.append(
                        total_datatakes_completeness[datatake_id_mod]
                    )
                else:
                    entry = {"datatakeID": datatake_id_mod}
                    datatakes_completeness.append(entry)
        # TODO: What if the anomaly is a new one, that was not saved on DB?
        anomalies_model.update_datatakes_completeness(
            key=anomaly["key"], datatakes_completeness=datatakes_completeness
        )
    logger.debug("[END] Refreshing Anomalies Status")


def _get_cds_s1s2_datatake_details(datatake_id):
    """
    Fetch S1/S2 datatake details with per-product completeness.
    Only returns instrument-level products (no L0/L1 aggregates).
    All keys end with '_local_percentage' for frontend table.
    """
    results = []
    try:
        # Build all relevant indices for S1 and S2
        indices = _build_cds_completeness_indices(
            "s1", CDS_MISSIONS["s1"]
        ) + _build_cds_completeness_indices("s2", CDS_MISSIONS["s2"])

        elastic = elastic_client.ElasticClient()
        logger.info("[CDS][S1S2] Querying indexes: %s", indices)

        for index in indices:
            try:
                result_gen = elastic.query_scan(
                    index, {"query": {"match": {"key": datatake_id}}}
                )
                result_list = list(result_gen)
                # logger.info(
                #    "[CDS][S1S2][DETAILS] index=%s hits=%d", index, len(result_list)
                # )
                results += result_list
            except Exception as ex:
                logger.warning("[CDS][S1S2][DETAILS] Elastic error on index %s", index)
                logger.error(ex)

    except Exception as ex:
        logger.error(
            "[CDS][S1S2][DETAILS] Error building indices or querying Elastic",
            exc_info=True,
        )

    # Base datatake object
    datatake = {
        "key": datatake_id,
        "satellite_unit": datatake_id[:3],
        "mission": "S1" if datatake_id.startswith("S1") else "S2",
    }

    if not results:
        logger.warning("[CDS][S1S2][DETAILS] no result for datatake_id=%s", datatake_id)
        return datatake

    # Copy common metadata from first hit
    base_fields = [
        "absolute_orbit",
        "polarization",
        "instrument_mode",
        "observation_time_start",
        "observation_time_stop",
        "final_completeness_percentage",
        "sensing_global_percentage",
    ]
    src0 = results[0]["_source"]
    for field in base_fields:
        if field in src0:
            datatake[field] = src0[field]

    completeness_list = []
    # Extract per-product completeness
    for prod in results:
        src = prod["_source"]
        logger.info("[CDS][S1S2][DETAILS] Processing source keys: %s", list(src.keys()))
        logger.info(
            "[CDS][S1S2][DETAILS][SRC] datatake_id=%s keys=%s",
            datatake_id,
            sorted(src.keys()),
        )
        for key, value in src.items():
            if not key.endswith("_local_percentage"):
                continue

            product = key.replace("_local_percentage", "")
            # logger.info(
            #    "[CDS][S1S2][DETAILS][FOUND] product=%s value=%s",
            #    product,
            #    value,
            # )
            # Skip aggregates
            if any(
                product.startswith(prefix)
                for prefix in ["L0__", "L1B_", "L1C_", "L2A_"]
            ):
                logger.info(
                    "[CDS][S1S2][DETAILS] Skipping aggregate product: %s", product
                )
                continue

            # Map to datatake with '_local_percentage'
            datatake[f"{product}_local_percentage"] = value
            # logger.info(
            #    "[CDS][S1S2][DETAILS] Added product: %s = %s",
            #    f"{product}_local_percentage",
            #    value,
            # )
        datatake["completeness_list"] = sorted(
            completeness_list,
            key=lambda x: x["productType"],
        )
        # KPI for header
        datatake["final_completeness_percentage"] = max(
            (p["percentage"] for p in completeness_list), default=0.0
        )

    logger.info(
        "[CDS][S1S2][DETAILS] Finished mapping datatake_id=%s, total products=%d",
        datatake_id,
        len([k for k in datatake.keys() if k.endswith("_local_percentage")]),
    )
    logger.info(
        "[CDS][S1S2][DETAILS][FINAL] products=%s",
        sorted(k for k in datatake if k.endswith("_local_percentage")),
    )
    return datatake


def _get_cds_s3_datatake_details(datatake_id):
    """
    Fetch the datatakes completeness information from the published products.
    """

    results = []
    try:

        # Auxiliary variable declaration
        indices = _build_cds_completeness_indices(
            "s3", CDS_MISSIONS["s3"], splitted=True
        )
        elastic = elastic_client.ElasticClient()
        logger.info("[CDS][S3] Querying indexes details:%s", indices)

        # Fetch results (products) from Elastic database
        for index in indices:
            try:
                results += elastic.query_scan(
                    index, {"query": {"match": {"datatake_id": datatake_id}}}
                )
            except Exception as ex:
                logger.warning("[CDS][S3] Error scanning index=%s", index)
                logger.exception(ex)

    except Exception as ex:
        logger.error(ex)

    # Build and collect datatake instances
    datatake = {
        "key": datatake_id,
        "satellite_unit": datatake_id[0:3],
    }
    observation_window = _calc_s3_s5_datatake_observation_window(results)
    datatake["observation_time_start"] = observation_window["observation_time_start"]
    datatake["observation_time_stop"] = observation_window["observation_time_stop"]
    for prod in results:
        prod_info = prod["_source"]
        if "percentage" in prod_info:
            # logger.info(
            #    "[CDS][S3][DETAILS][MAP] product=%s → %s%% | timeliness=%s",
            #    prod["_source"]["product_type"],
            #    prod["_source"]["percentage"],
            #    prod["_source"]["timeliness"],
            # )
            prod_key = prod_info["key"].replace(datatake_id + "-", "")
            datatake[prod_key + "_local_percentage"] = prod_info["percentage"]
            datatake[prod_key + "_timeliness"] = prod_info.get(
                "timeliness"
            )  # store per product
            datatake["instrument_mode"] = prod_info["product_type"][5:8]
        for key in [
            "cams_tickets",
            "cams_origin",
            "cams_description",
            "last_attached_ticket",
        ]:
            if key in prod_info:
                datatake[key] = prod_info[key]

    datatake["completeness_list"] = []

    for k, v in datatake.items():
        if k.endswith("_local_percentage"):
            base = k.replace("_local_percentage", "")
            timeliness = datatake.get(base + "_timeliness", "-")
            datatake["completeness_list"].append(
                {"productType": base, "status": v, "timeliness": timeliness}
            )

    datatake["mission"] = "S3"
    datatake["satellite"] = datatake["satellite_unit"]
    datatake["product_level"] = (
        "L2"
        if any(k.startswith("L2_") for k in datatake)
        else "L1" if any(k.startswith("L1_") for k in datatake) else "L0"
    )
    datatake["final_completeness_percentage"] = max(
        [v for k, v in datatake.items() if k.endswith("_local_percentage")], default=0.0
    )

    # Return the datatakes list
    return datatake


def _get_cds_s5_datatake_details(datatake_id):
    """
    Fetch the datatake information given the datatake ID.
    """

    results = []
    try:

        # Auxiliary variable declaration
        # indices = ["cds-s5-completeness"]
        indices = _build_cds_completeness_indices(
            "s5", CDS_MISSIONS["s5"], splitted=True
        )
        elastic = elastic_client.ElasticClient()
        logger.info("[CDS][S5] Querying indexes:%s", indices)

        # Fetch results from Elastic database
        for index in indices:
            try:
                results += elastic.query_scan(
                    index, {"query": {"match": {"datatake_id": datatake_id}}}
                )
            except Exception as ex:
                logger.warning("[CDS][S5] Error scanning index=%s", index)
                logger.exception(ex)

    except Exception as ex:
        logger.error(ex)

    # Build and collect datatake instances
    datatake = {"key": datatake_id, "satellite_unit": datatake_id[0:3]}
    observation_window = _calc_s3_s5_datatake_observation_window(results)
    datatake["observation_time_start"] = observation_window["observation_time_start"]
    datatake["observation_time_stop"] = observation_window["observation_time_stop"]
    for prod in results:
        if "percentage" in prod["_source"]:
            # logger.info(
            #    "[CDS][S5][DETAILS][MAP] product=%s → %s%% | timeliness=%s",
            #    prod["_source"]["product_type"],
            #    prod["_source"]["percentage"],
            #    prod["_source"]["timeliness"],
            # )
            product = prod["_source"]["product_type"]
            timeliness = prod["_source"]["timeliness"]
            key = f"{product}_{timeliness}"
            datatake[key + "_timeliness"] = timeliness
            datatake[key + "_local_percentage"] = prod["_source"]["percentage"]
            datatake["instrument_mode"] = prod["_source"]["product_type"][5:8]

        for key in [
            "cams_tickets",
            "cams_origin",
            "cams_description",
            "last_attached_ticket",
        ]:
            if key in prod["_source"]:
                datatake[key] = prod["_source"][key]
    # Build completeness_list for modal
    datatake["completeness_list"] = []

    for k, v in datatake.items():
        if k.endswith("_local_percentage"):
            base = k.replace("_local_percentage", "")
            timeliness = datatake.get(base + "_timeliness", None)
            datatake["completeness_list"].append(
                {"productType": base, "status": v, "timeliness": timeliness}
            )

    datatake["mission"] = "S5"
    datatake["satellite"] = datatake["satellite_unit"]
    datatake["product_level"] = (
        "L2"
        if any(k.startswith("L2_") for k in datatake)
        else "L1" if any(k.startswith("L1_") for k in datatake) else "L0"
    )
    datatake["final_completeness_percentage"] = max(
        [v for k, v in datatake.items() if k.endswith("_local_percentage")], default=0.0
    )
    # Return the datatakes list
    return datatake
