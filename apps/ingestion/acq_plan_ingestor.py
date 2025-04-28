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

import logging

from apps.cache.modules.datatakes import get_daily_datatakes
from apps.ingestion.acquisition_plans.acq_link_page import AcqPlanKmlLinkIngestor
from apps.ingestion.acquisition_plans.acq_plan_fragments import AcqPlanFragments
from apps.ingestion.acquisition_plans.acq_plan_kml_loader import (
    S1MissionAcqPlanLoader,
    S2MissionAcqPlanLoader,
)
from apps.ingestion.orbit_acquisitions import AcquisitionPlanOrbitDatatakeBuilder

logger = logging.getLogger(__name__)


# Main Ingestor
# Mission Ingestor
#    Retrieves page with links
#    ActivatesTML Page generic ingestor
#    gets List of link
#    Activates Downloader of links
# HTML Page generic Ingestor
#       Extracts list of links
#    Archive ingestor
#    Latest Ingestor
#    PreviousYears Ingestor


#  TODO: Move to configuration
acq_plans_mission_satellites = {
    "S1": ["S1A"],
    "S2": ["S2A", "S2B", "S2C"],
    "S3": ["S3A", "S3B"],
    "S5": ["S5P"],
}
# Missions whose KML Acq Plan is retrieved from ESA
kml_acq_plans_missions = ["S1", "S2"]
# Missions whose KML Acq Plan is build based on Orbit TLE and datatakes
# TO BE EMPTIED if acq plans for these missions are computed from only datatakes
orbit_kml_acq_plans_missions = ["S3", "S5"]
# The list shall specify the Acquisition Plans provided as KML files
# If Acquisition plans are provided from only datatake, the orbit_kml list
# shall not be included

kml_from_orbits = True
acq_plans_missions = kml_acq_plans_missions + (
    orbit_kml_acq_plans_missions if kml_from_orbits else []
)


# AcquisitionPlansManager:


class AcqPlanIngestor:
    """
    This class manages and coordinates ingestion of acquisition plans:
        for each mission, it performs the following steps:
        1. retrieves (using a AcqPlanPageParser)
            a list of url links for each mission satellite from teh latest acqplan page
            (associated to the url of the host page)
        2. if configured, integrates the list of url links with those from archive page
        3. Each link is associated to the relevant date/time interval
        4. A selection is performed (according to rules and configuration),
            by knowing current contents of KML repository, and already downloaded files:
            the retrieved url links are filtered
        5. the AcqPlan KML files corresponding to the selected URL links are downloaded and loaded on KML Repository:
            For each link, using a Acqplan downloader, each of the url link is downloaded to a temporary file/string
            Note: the link is relative to the page it was retrieved from !
        6.  after the file is downloaded a KML Splitter is executed on the downloaded file
        7   the Fragments are passed to the AcqPlan KML Repository Loader
            AcaPlanTable.add_fragment (kml_file,  kml_folder, folder_interval, mission, satellite )
            TBD: who requests purging the oldest KML folders?
            Formats are associated to one day
            Fragments could be not saved on repository if too old (Age configurable)
        8. When all the links have been processed, Flask Cache is updated (HOW?)
            NO: Caller updates cache with Repository Contents
    """

    def __init__(self, past_num_days):

        # TODO: Fragments should be injected (instantiated
        # elsewhere)
        # Cache could be built starting from Fragments (and fragments removed)
        # or could be replaced by Fragments itself
        self.acqplan_fragments = {
            mission: {
                sat: AcqPlanFragments(sat, sat, past_num_days)
                for sat in acq_plans_mission_satellites[mission]
            }
            for mission in kml_acq_plans_missions
        }
        # Pass AcqPlanKmlLoader to MissionIngestor
        # ingestor classes for each mission, to be  instantiated for each satellite
        # TODO: instantiate ingestor class according to
        # presence of acq link page configuration
        # And configuration of usage of Acquisition From Orbit Datatake
        # Or from only datatake (just coverage, and different call from JS)
        self._mission_ingestors = {
            "S1": AcqPlanKmlLinkIngestor(
                "S1",
                self.acqplan_fragments.get("S1"),
                kml_loader=S1MissionAcqPlanLoader,
            ),
            "S2": AcqPlanKmlLinkIngestor(
                "S2",
                self.acqplan_fragments.get("S2"),
                kml_loader=S2MissionAcqPlanLoader,
            ),
            # 'S3': AcquisitionPlanOrbitDatatakeBuilder('S3',
            #                                           self.acqplan_fragments.get('S3'),
            #                                           daily_datatakes=curr_daily_datatakes),
            # 'S5': AcquisitionPlanOrbitDatatakeBuilder('S5',
            #                                           self.acqplan_fragments.get('S5'),
            #                                           daily_datatakes=curr_daily_datatakes),
        }
        if kml_from_orbits:
            curr_daily_datatakes = get_daily_datatakes()
            for mission in orbit_kml_acq_plans_missions:
                logger.debug("Adding mission %s Fragments to Ingestor table", mission)
                self.acqplan_fragments[mission] = {
                    sat: AcqPlanFragments(sat, sat, past_num_days)
                    for sat in acq_plans_mission_satellites[mission]
                }
                logger.debug("Creating Mission Ingestor for mission %s", mission)
                acquisition_shape = "Polygon"  # "Line"
                self._mission_ingestors[mission] = AcquisitionPlanOrbitDatatakeBuilder(
                    mission,
                    self.acqplan_fragments.get(mission),
                    daily_datatakes=curr_daily_datatakes,
                    profile=acquisition_shape,
                )

    # Get links to acqplans from specified date (last date of stored KML acqplans

    def retrieve_acq_plans(self, from_date):
        """
        Retrieve from configured sites the links to KML files for
        acquisition plans, for all configured missions
        Args:
            from_date (): oldest date to be included in retrieved acquisition plans

        Returns:

        """
        logger.info(
            "[BEG] Ingestion of Acq Plans for all missions from date %s", from_date
        )
        # for each mission
        # ["S1A", "S1B"],
        # Move Retrieve Mission Acq Plans to Mission Ingestor!
        # TODO: Remove when acq plan from only datatake will no more be used
        for mission in acq_plans_missions:
            logger.info("[BEG] Ingestion of Acq Plans for mission %s", mission)
            mission_ingestor = self._mission_ingestors.get(mission)
            mission_ingestor.retrieve_mission_acq_plans(from_date)
            logger.info("[END] Ingestion of Acq Plans for mission %s", mission)
        logger.info(
            "[END] Ingestion of Acq Plans for all missions from date %s", from_date
        )

        # At the end we have a table of KML Fragments (N daily folders for each satellite for each mission)
        # That have to be loaded on the Cache Tables

    def get_fragments(self, mission):
        mission_fragments = self.acqplan_fragments.get(mission, None)
        if mission_fragments is None:
            logger.warning("No Acquisition Plan KML Fragments for mission %s", mission)
        return mission_fragments

    def get_kml_fragments(self, mission, satellite, date_list):
        fragments = self.get_fragments(mission)
        sat_fragments = fragments.get(satellite, {})
        return [sat_fragments.get_fragment(day) for day in date_list]
