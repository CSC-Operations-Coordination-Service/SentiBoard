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

import io
import json
import logging

from flask import Response, send_file

import apps.cache.modules.datatakes as datatakes_cache
from apps import flask_cache

# 1 day and some more time
from apps.ingestion.acquisition_plans.acq_plan_fragments import (
    AcqPlanFragments,
    AcqPlanDayFragment,
)
from apps.ingestion.acq_plan_ingestor import (
    AcqPlanIngestor,
    acq_plans_mission_satellites,
    kml_acq_plans_missions,
    orbit_kml_acq_plans_missions,
    acq_plans_missions,
    kml_from_orbits,
)
from apps.ingestion.acquisition_plans.fragment_completeness import (
    FragmentCompletenessHandler,
)
from apps.ingestion.kml_processor import AcqPlanKmlBuilder
from apps.utils.date_utils import get_past_day_str

logger = logging.getLogger(__name__)

acq_plan_cache_duration = 604800
acq_past_num_days = 15


def get_acquisition_plan_key(mission):
    return f"AcqPlans_{mission}"


def get_acquisition_plan(mission, satellite, day_str):
    logger.info(
        "[BEG] - Build and download Acq Plan for satellite %s, on day %s",
        satellite,
        day_str,
    )
    # mission_fragments = self._acqplans.get(mission)
    # satellite_fragments = mission_fragments.get(satellite)
    # TODO: Check key exists
    satellite_fragments = _get_fragments(mission, satellite)
    kml_title = f"{mission}_{satellite}_{day_str}"
    logger.debug("Building Result KML file string")
    kml_builder = AcqPlanKmlBuilder(kml_title, mission)
    try:
        kml_builder.add_folder(satellite_fragments.get_fragment(day_str))
    except Exception as ex:
        return Response(str(ex))
    kml_string = kml_builder.to_string()
    # logger.debug("Building response from KML string")
    # acq_plan_data = {
    #     'mission': mission,
    #     'satellite': satellite,
    #     'plan_day': day_str,
    #     'kml_acqplan': kml_string.decode('utf-8-sig')
    # }
    # return Response(json.dumps(acq_plan_data),
    #               mimetype="application/json", status=200),
    logger.info(
        "[END] - Build and download Acq Plan for satellite %s, on day %s",
        satellite,
        day_str,
    )
    return send_file(
        io.BytesIO(kml_string),
        # download_name=f'{kml_title}.kml',
        mimetype="application/octet-stream",
    )


def _load_mission_acquisition_coverage(plans_coverage, mission, sat_list):
    mission_coverage = plans_coverage.setdefault(mission, {})
    for satellite in sat_list:
        logger.debug("Getting Day Coverage for satellite %s", satellite)
        satellite_fragments = _get_fragments(mission, satellite)
        if satellite_fragments is not None:
            mission_coverage[satellite] = satellite_fragments.day_list


def get_acquisition_plans_coverage():
    """
    Extracts the daily coverage for acquisition plans
    stored in cache.
    Returns: a dictionary: for each mission/satellite,
    a list of daily strings corresponding to days stored
    in cache.
    strings have the format: '%Y-%m-%d'
    AcqPlanDayFragment.FOLDER_DAY_FMT

    """
    logger.info("[BEG] Retrieve Acquisition Plans Coverage ")

    plans_coverage = {}
    for mission in kml_acq_plans_missions:
        sat_list = acq_plans_mission_satellites.get(mission)
        _load_mission_acquisition_coverage(plans_coverage, mission, sat_list)
    if kml_from_orbits:
        # Load plans coverage for KML files of Orbit derived KML
        for mission in orbit_kml_acq_plans_missions:
            sat_list = acq_plans_mission_satellites.get(mission)
            _load_mission_acquisition_coverage(plans_coverage, mission, sat_list)
    else:
        # Temporary: to be done according to configuration
        # and/or presence of missions in orbit_kml_acq_plans_missions
        # Compute Plans Coverage from Datatakes info
        get_datatake_acquisitions_coverage(plans_coverage)
    logger.debug("Retrieved Acquisition Plans Coverage: %s", plans_coverage)
    logger.info("[END] Retrieve Acquisition Plans Coverage ")
    return Response(json.dumps(plans_coverage), mimetype="application/json", status=200)


def get_datatake_acquisitions_coverage(datatake_plans_coverage):
    logger.info("[BEG] Retrieve Acquisition Datatakes Coverage ")
    # Compute a Mission Coverage for
    # Acquisitions based only on datatakes and orbits
    daily_datatakes = datatakes_cache.get_daily_datatakes()
    datatakes_day_list = list(sorted(daily_datatakes.keys()))
    # Look for past_num days, and set as first item in list
    earliest_day_str = get_past_day_str(
        acq_past_num_days, AcqPlanDayFragment.FOLDER_DAY_FMT
    )
    index = datatakes_day_list.index(earliest_day_str)
    for mission in orbit_kml_acq_plans_missions:
        mission_coverage = datatake_plans_coverage.setdefault(mission, {})
        for satellite in acq_plans_mission_satellites.get(mission):
            logger.debug("Getting Day Coverage for satellite %s", satellite)
            # Compute list of days from Pat days to last day available for datatakes for this satellite
            mission_coverage[satellite] = datatakes_day_list[index:]
    logger.info("[END] Retrieve Acquisition Datatakes Coverage ")


def save_acquisition_plans_to_cache(mission, kml_fragments: AcqPlanFragments):
    acq_plan_key = get_acquisition_plan_key(mission)
    # Acquisition Plans are saved on cache, indexing by Mission.
    # Retrieving Cache, extract satellite data (in _get_fragments)
    flask_cache.set(acq_plan_key, kml_fragments, acq_plan_cache_duration)


def load_all_acquisition_plans():
    """
    Load on cache KML fragments received on AcqPlan Table
    Returns:

    """
    # TODO: Read past num days from configuration
    logger.info(
        "[BEG] Load Acquisition Plan KML data for up to %d days in the past",
        acq_past_num_days,
    )
    ingestor = AcqPlanIngestor(past_num_days=acq_past_num_days)

    # Selection of links shall include up to past_num_days
    earliest_day_str = get_past_day_str(
        acq_past_num_days, AcqPlanDayFragment.FOLDER_DAY_FMT
    )
    ingestor.retrieve_acq_plans(earliest_day_str)

    logger.info(
        "Updating Publication Completeness on Acquisition Plan Fragments in Cache"
    )
    mission_fragments_retriever_fun = ingestor.get_fragments
    _set_update_acquisition_completeness(mission_fragments_retriever_fun)

    # # Load fragments for Acquisition for S3/S5 (computed from Orbit + Datatakes)
    # orbit_ingestor = OrbitDatatakeAcquisitionIngestor(acq_past_num_days)
    # orbit_ingestor.retrieve_aq_plans(earliest_day_str)
    # orbit_fragments_retriever_fun = orbit_ingestor.get_fragments
    # # TODO: CHECK: we need to update completeness on all fragments together
    # _set_update_acquisition_completeness(orbit_fragments_retriever_fun)

    # update_acquisition_completeness()
    logger.info(
        "[END] Load Acquisition Plan KML data for up to %d days in the past",
        acq_past_num_days,
    )


def update_acquisition_completeness():
    logger.info("[BEG] Update Acquisition Plan KML data with datatakes completeness")
    mission_fragments_retriever_fun = _get_mission_fragments
    _set_update_acquisition_completeness(mission_fragments_retriever_fun)
    logger.info("[END] Update Acquisition Plan KML data with datatakes completeness")


def _set_update_acquisition_completeness(mission_fragments_retriever_fun):
    """

    Args:
        mission_fragments_retriever_fun ():

    Returns:

    """

    logger.debug("[BEG] Setting on Acquisition Plans Completeness Status")
    # Save  KML Fragments table in Cache
    # on a Per Mission basis
    # Completeness updates are done on Cache contents
    # and are better done on a Per Mission basis
    # This leads to organize cache with a Mission only key
    # and access Sat portions accessing the stored dictionary
    daily_datatakes = datatakes_cache.get_daily_datatakes()

    for mission in acq_plans_missions:
        logger.debug(
            "[BEG] Setting on Acquisition Plans Completeness Status for mission %s",
            mission,
        )
        mission_fragments = mission_fragments_retriever_fun(mission)
        if mission_fragments is None:
            logger.warning(
                "Tried to load on Cache not acquired Acquisition Plans for mission %s",
                mission,
            )
        # LOad Completeness on Cache Fragments
        completeness_hnd = FragmentCompletenessHandler(
            mission, mission_fragments, daily_datatakes
        )
        completeness_hnd.set_completeness()
        # Save back thMission Fragments
        save_acquisition_plans_to_cache(mission, mission_fragments)
        logger.debug(
            "[END] Setting on Acquisition Plans Completeness Status for mission %s",
            mission,
        )
    logger.debug("[END] Setting on Acquisition Plans Completeness Status")


def _get_fragments(mission, satellite):
    mission_fragments = _get_mission_fragments(mission)
    satellite_fragments = (
        mission_fragments.get(satellite) if mission_fragments else None
    )
    return satellite_fragments


def _get_mission_fragments(mission):
    acq_plan_key = get_acquisition_plan_key(mission)
    logger.debug("Retrieving KML fragments with key %s", acq_plan_key)
    if not flask_cache.has(acq_plan_key):
        logger.debug("Fragments not found, start acquisition of plans")
        load_all_acquisition_plans()
        logger.debug(
            "After All Plans acquisition, Retrieving KML fragment with key %s",
            acq_plan_key,
        )
    mission_fragments = flask_cache.get(acq_plan_key)
    return mission_fragments
