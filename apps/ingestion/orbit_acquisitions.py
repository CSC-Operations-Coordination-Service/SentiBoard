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
import os

from satellite_tle import fetch_tle_from_celestrak

import logging

# from apps.elastic.modules.datatakes import OBSERVATION_START_KEY, OBSERVATION_END_KEY
# from apps.elastic.modules.datatakes import DATATAKE_ID_KEY
from apps.cache.modules.acquisitionassets import norad_id_map
from apps.ingestion.acquisition_plans.fragment_completeness import (
    MissionDatatakeIdHandler,
)
from apps.ingestion.acquisition_plans.orbit_acquisitions_kml import (
    OrbitAcquisitionKmlFragmentBuilder,
    _build_datatake_placemark,
    build_acquisition_line_placemark,
    build_acquisition_polygon_placemark,
)
from apps.ingestion.acquisition_plans.orbit_datatake_acquisitions import (
    OrbitAcquisitionsBuilder,
    AcquisitionLineProfileFromOrbit,
    DatatakeAcquisition,
    AcquisitionPolygonProfileFromOrbit,
)

logger = logging.getLogger(__name__)

local_tle_files = {
    "S3A": "S3A_20231012.tle",
    "S3B": "S3B_20231017.tle",
    "S5P": "S5P_20231017.tle",
}


def get_latest_tle(satellite):
    # Otherwise retrieve from CACHE!
    norad_id = norad_id_map[satellite]
    try:
        return fetch_tle_from_celestrak(norad_id)
    except Exception as ex:
        tle_path = "test/unit_tests/test_tles"
        # Retrieve Last TLE from file
        tle_file = local_tle_files.get(satellite, None)
        if tle_file is not None:
            tle_full = os.path.join(tle_path, tle_file)
            with open(tle_full, "r") as tle_in:
                lines = tle_in.readlines()
                for line in lines:
                    line.strip()
            return lines
        raise ex


# ORBIT_PROPAGATION_STEP = 60
ORBIT_PROPAGATION_STEP = 90


class OrbitBuilderFactory:
    def __init__(self):
        self._acquisition_builders = {}
        self._kml_builders = {}

    def register_acquisition_image_builder(self, type_key, builder_class):
        self._acquisition_builders[type_key] = builder_class

    def register_kml_builder(self, type_key, builder_class):
        self._kml_builders[type_key] = builder_class

    def get_kml_builder(self, type_key):
        return self._kml_builders.get(type_key, None)

    def get_acquisition_image_builder(self, type_key):
        return self._acquisition_builders.get(type_key, None)


# TO CONVERT FROM TIMED ECI to ECEF we need EPOCH:
# Start time of orbit + relative time
# Then we can convert ECEF to GEO coords
# epoch = start_time.isoformat()


# Class should create basic Daily Fragment KML Folder
# Placemarks should be built using a function!


orbit_builder_factory = OrbitBuilderFactory()
orbit_builder_factory.register_acquisition_image_builder(
    "Line", AcquisitionLineProfileFromOrbit
)
orbit_builder_factory.register_acquisition_image_builder(
    "Polygon", AcquisitionPolygonProfileFromOrbit
)
orbit_builder_factory.register_kml_builder("Line", build_acquisition_line_placemark)
orbit_builder_factory.register_kml_builder(
    "Polygon", build_acquisition_polygon_placemark
)


class AcquisitionPlanOrbitDatatakeBuilder:
    """ """

    def __init__(self, mission, mission_fragments, daily_datatakes, profile="Polygon"):
        """

        Args:
            mission ():
            mission_fragments ():
        """
        self._mission = mission
        self._id_key = MissionDatatakeIdHandler(mission).datatake_id_key
        self._mission_acqplan_fragments = mission_fragments
        # Get Implementation Classes according to current
        # Acquisition Type (Line/Polygon)
        placemark_profile = profile

        self._acquisition_image_builder_class = (
            orbit_builder_factory.get_acquisition_image_builder(placemark_profile)
        )
        self._placemark_geometry_builder_fun = orbit_builder_factory.get_kml_builder(
            placemark_profile
        )
        # TODO: For Test purposes, mock this function to get test datatakes
        self._daily_datatakes = daily_datatakes
        if self._daily_datatakes is None:
            logger.warning("No Datatake index information found in cache")

    def retrieve_mission_acq_plans(self, from_date):
        """

        Args:
            from_date ():

        Returns:

        """
        logger.info(
            "[BEG] Retrieving from internet Acquisition Plan KML files for mission %s, date %s",
            self._mission,
            from_date,
        )
        orbit_step = ORBIT_PROPAGATION_STEP  # Propagation at 10 seconds

        # For each satellite for mission
        for satellite in self._mission_acqplan_fragments.keys():
            #  TODO: CHECK: we have not yet a list of Fragments in the table!
            # take Day List from Datatakes
            fragment_days = self._daily_datatakes.keys()
            # 1. instantiate an Orbit Acquisitions Builder (it needs a TLE or a list of TLE for the period)
            # Retrieve latest TLE
            sat_tle_data = get_latest_tle(satellite)
            logger.warning(sat_tle_data)

            # Use a Builder that creates acquisitions from Orbit points
            sat_orbit_builder = OrbitAcquisitionsBuilder(
                satellite,
                sat_tle_data,
                orbit_step,
                self._acquisition_image_builder_class,
            )
            #  Instantiate the KML Fragments Builder
            self._build_satellite_fragments(fragment_days, sat_orbit_builder, satellite)
        logger.info(
            "[END] Retrieving from internet Acquisition Plan KML files for mission %s, date %s",
            self._mission,
            from_date,
        )

    # TODO: Either use constants for Dictionary keys,
    #   or define a dataclass to be imported from datatakes
    #   dictionaries
    @staticmethod
    def _acquisition_from_datatake(datatake, sat_orbit_builder):
        acq = DatatakeAcquisition(datatake)
        # NOTE: DT Has no Start/End Time
        acq.acquisition_points = sat_orbit_builder.compute_acquisition_points(
            acq.start_time, acq.end_time
        )
        logger.debug(
            "Datatake %s: Computed %d points for acquisition profile",
            acq.datatake_id,
            len(acq.acquisition_points),
        )
        return acq

    def _build_satellite_fragments(self, fragment_days, sat_orbit_builder, satellite):
        """

        Args:
            fragment_days ():
            sat_orbit_builder ():
            satellite ():

        Returns:

        """
        for acq_day in fragment_days:
            logger.debug(
                "Building Fragments from Orbit/datatakes - satellite: %s, day: %s",
                satellite,
                acq_day,
            )
            # Instantiate a KML Builder for each Day
            # Each builder creates a KML Fragment
            #      Let the KML Fragments Builder create a Fragment for current day
            sat_kml_builder = OrbitAcquisitionKmlFragmentBuilder(acq_day, satellite)
            #  Retrieve the Daily Datatakes for the satellite (from the cache)
            day_datatakes = self._daily_datatakes.get(acq_day)
            if day_datatakes is not None:
                day_sat_datatakes = day_datatakes.get(satellite)
                # 2. For each day in Datatakes table
                #        Create the acquisitions for the current day

                #     Pass the Acquisition lists to the Fragment Builder, in order to append to the current day Fragment
                if day_sat_datatakes is not None:
                    for dt_id, dt in day_sat_datatakes.items():
                        logger.debug("Building acquisition for datatake %s", dt_id)
                        acq = self._acquisition_from_datatake(dt, sat_orbit_builder)
                        acq_placemark = _build_datatake_placemark(acq, self._id_key)
                        acq_placemark.append(self._placemark_geometry_builder_fun(acq))
                        sat_kml_builder.add_to_daily_folder(
                            acq_day, satellite, acq_placemark
                        )

                # Add the P Mist to current Fragment
                # Save the KML Fragments on the Mission Acqplan Fragments Area.
                self._mission_acqplan_fragments[satellite].process_kml_folder(
                    sat_kml_builder.fragment
                )


acq_orbit_mission_satellites = {"S3": ["S3A", "S3B"], "S5": ["S5P"]}


# class OrbitDatatakeAcquisitionIngestor:
#     def __init__(self, past_num_days):
#         self.acqplan_fragments = {
#             mission: {
#                 sat: AcqPlanFragments(sat, sat, past_num_days)
#                 for sat in acq_orbit_mission_satellites[mission]
#             } for mission in acq_orbit_mission_satellites
#         }
#
#     def retrieve_acq_plans(self, from_date):
#         for mission in acq_orbit_mission_satellites:
#             self._retrieve_mission_acq_plans(mission, from_date)
#
#     def _retrieve_mission_acq_plans(self, mission, from_date):
#         daily_datatakes = get_daily_datatakes()
#         acq_from_orbit_builder = AcquisitionPlanOrbitDatatakeBuilder(mission,
#                                                                      self.acqplan_fragments.get(mission),
#                                                                      daily_datatakes)
#         acq_from_orbit_builder.retrieve_mission_acq_plans(from_date)
#
#     def get_fragments(self, mission):
#         mission_fragments = self.acqplan_fragments.get(mission, None)
#         if mission_fragments is None:
#             logger.warning("No Acquisition Plan KML Fragments for mission %s",
#                            mission)
#         return mission_fragments
#
#     def get_kml_fragments(self, mission, satellite, date_list):
#         fragments = self.get_fragments(mission)
#         sat_fragments = fragments.get(satellite, {})
#         return [sat_fragments.get_fragment(day)
#                 for day in date_list]
