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
    logger.info("[BEG] - Build and download Acq Plan for satellite %s, on day %s", satellite, day_str)

    acq_plan_key = get_acquisition_plan_key(mission)
    mission_cache = flask_cache.get(acq_plan_key)
    if mission_cache is None:
        logger.warning("No cached acquisition plans for mission %s", mission)
        return Response(f"No acquisition plan data available for mission {mission}", status=503)

    sat_cache = mission_cache.get(satellite)
    if sat_cache is None:
        logger.warning("No cached acquisition plans for satellite %s", satellite)
        return Response(f"No acquisition plan data available for satellite {satellite}", status=404)

    kml_bytes = sat_cache.get(day_str)
    if kml_bytes is None:
        logger.warning("No cached acquisition plan for %s day %s", satellite, day_str)
        return Response(f"No data for day {day_str}", status=404)

    pm_count = kml_bytes.count(b'<Placemark')
    logger.warning("Fragment for %s day %s has %d placemarks", satellite, day_str, pm_count)

    logger.info("[END] - Build and download Acq Plan for satellite %s, on day %s", satellite, day_str)
    return send_file(
        io.BytesIO(kml_bytes),
        mimetype='application/octet-stream'
    )


def _load_mission_acquisition_coverage(plans_coverage, mission, sat_list):
    mission_coverage = plans_coverage.setdefault(mission, {})
    acq_plan_key = get_acquisition_plan_key(mission)
    mission_cache = flask_cache.get(acq_plan_key)
    if mission_cache is None:
        logger.warning("No cached fragments for mission %s", mission)
        return
    for satellite in sat_list:
        logger.debug("Getting Day Coverage for satellite %s", satellite)
        sat_cache = mission_cache.get(satellite)
        if sat_cache:
            mission_coverage[satellite] = sorted(sat_cache.keys())


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


# def save_acquisition_plans_to_cache(mission, kml_fragments: AcqPlanFragments):
  #  acq_plan_key = get_acquisition_plan_key(mission)
    # Acquisition Plans are saved on cache, indexing by Mission.
    # Retrieving Cache, extract satellite data (in _get_fragments)
   # flask_cache.set(acq_plan_key, kml_fragments, acq_plan_cache_duration)


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

    # Serialize fragments to KML strings and write to cache
    for mission in acq_plans_missions:
        sat_fragments_map = ingestor.get_fragments(mission)
        if sat_fragments_map is None:
            logger.warning("No fragments for mission %s, skipping cache write", mission)
            continue
        serialized = {}
        for sat, fragments in sat_fragments_map.items():
            serialized[sat] = {}
            for day in fragments.day_list:
                try:
                    fragment = fragments.get_fragment(day)
                    builder = AcqPlanKmlBuilder(f"{mission}_{sat}_{day}", mission)
                    builder.add_folder_copy(fragment)   # deep copy — don't gut the fragment
                    serialized[sat][day] = builder.to_string()
                except Exception as ex:
                    logger.error("Failed to serialize fragment %s/%s/%s: %s",
                                mission, sat, day, ex, exc_info=True)
        acq_plan_key = get_acquisition_plan_key(mission)
        flask_cache.set(acq_plan_key, serialized, acq_plan_cache_duration)
        total = sum(len(v) for v in serialized.values())
        logger.info("Cached %d fragments for mission %s", total, mission)

    logger.info("[END] Load Acquisition Plan KML data for up to %d days in the past", acq_past_num_days)


def update_acquisition_completeness():
    logger.info("Acquisition Plan KML data with datatakes completeness: is handled by load_all_acquisition_plans, skipping")
#    mission_fragments_retriever_fun = _get_mission_fragments
#    _set_update_acquisition_completeness(mission_fragments_retriever_fun)
#    logger.info("[END] Update Acquisition Plan KML data with datatakes completeness")


def _set_update_acquisition_completeness(mission_fragments_retriever_fun):
    logger.debug("[BEG] Setting on Acquisition Plans Completeness Status")
    daily_datatakes = datatakes_cache.get_daily_datatakes()

    for mission in acq_plans_missions:
        logger.debug("[BEG] Setting completeness for mission %s", mission)
        mission_fragments = mission_fragments_retriever_fun(mission)
        if mission_fragments is None:
            logger.warning("Tried to load on Cache not acquired Acquisition Plans for mission %s", mission)
            return
        completeness_hnd = FragmentCompletenessHandler(mission,
                                                       mission_fragments,
                                                       daily_datatakes)
        completeness_hnd.set_completeness()
        logger.debug("[END] Setting completeness for mission %s", mission)
    logger.debug("[END] Setting on Acquisition Plans Completeness Status")


#def _get_fragments(mission, satellite):
#    mission_fragments = _get_mission_fragments(mission)
#    satellite_fragments = mission_fragments.get(satellite) if mission_fragments else None
#    return satellite_fragments


#def _get_mission_fragments(mission):
#    acq_plan_key = get_acquisition_plan_key(mission)
#    logger.debug("Retrieving KML fragments with key %s", acq_plan_key)
#    if not flask_cache.has(acq_plan_key):
#        logger.warning("Fragments not in cache for mission %s - cache may still be loading", mission)
        # load_all_acquisition_plans() <--to not uncomment
        # logger.debug("After All Plans acquisition, Retrieving KML fragment with key %s", acq_plan_key)
#        return None
#    mission_fragments = flask_cache.get(acq_plan_key)
#    return mission_fragments
