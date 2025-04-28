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
from pykml import parser as KMLparser
from pykml.factory import KML_ElementMaker as KML

from apps.ingestion.acquisition_plans.acq_plan_fragments import logger


class S1MissionAcqPlanLoader:
    def __init__(self):
        pass

    @staticmethod
    def _convert_placemark_line_style(folder):
        """
        S1 defines for placemarks a polyline.
        Convert it into a Polygon, with same coordinates
        Args:
            folder ():

        Returns:

        """
        subfolder = folder.Folder[0]
        for pm in subfolder.Placemark:
            pm_ring = pm.LinearRing
            pm_polygon = KML.Polygon(KML.outerBoundaryIs(pm_ring))
            pm.append(pm_polygon)
            # pm.remove(pm_ring)

    def load_acqplan_kml(self, kml_string, fragments_table):
        if kml_string is None:
            raise Exception("AcqPlan not available")
        parsed_kml = KMLparser.fromstring(kml_string)
        for folder in parsed_kml.Document.Folder:
            try:
                self._convert_placemark_line_style(folder)
                fragments_table.process_kml_folder(folder)
            except Exception as ex:
                logger.error("Error while loading S1 KML Folder : %s", ex, exc_info=1)


class S2MissionAcqPlanLoader:
    def __init__(self):
        # self._fragments = fragments_table
        self._day_folders = {}
        self._allocate_every_day = True

    @staticmethod
    def _create_daily_folder(day_str, sat_name):
        day_fold = KML.Folder(KML.name(day_str))
        sat_folder = KML.Folder(KML.name(sat_name))
        day_fold.append(sat_folder)
        return day_fold

    def _add_to_daily_folder(self, day_str, sat_name, kml_placemark):
        day_folder = self._day_folders.setdefault(
            day_str, self._create_daily_folder(day_str, sat_name)
        )
        sub_folder = day_folder.Folder
        sub_folder.append(kml_placemark)

    def _extract_mode_datatakes(self, kml_folder, sat_name):
        """
        Extract from KML Folder the Placemark Objects
        Assign them to a Day KML Folder (create if not existing)
        according to datatake date
        Args:
            kml_folder ():

        Returns:
            saves in instance the folder placemark to one or more
            daily folders
        """
        subfolder = kml_folder.Folder[0]
        for pm in subfolder.Placemark:
            # Read Interval

            # Take interval Day(s)
            start_day_str = str(pm.TimeSpan[0]["begin"]).split("T")[0]
            end_day_str = str(pm.TimeSpan[0]["end"]).split("T")[0]
            # According to configuration: if only one ad folder, add to start day folder
            # otherwise, add to both days folders
            # Add to Daily Folder
            self._add_to_daily_folder(start_day_str, sat_name, pm)
            if self._allocate_every_day and start_day_str != end_day_str:
                self._add_to_daily_folder(end_day_str, sat_name, pm)

    def load_acqplan_kml(self, kml_string, fragments_table):
        parsed_kml = KMLparser.fromstring(kml_string)
        # Folder at first level in document
        # is satellite  folder
        # that contain Mode acquisitions folders
        # Placemarks (datatakes) are contained in MOde folders
        for folder in parsed_kml.Document.Folder:
            sat_name = str(folder.name)
            logger.debug("Parsing S2 KML folder with nme %s", sat_name)
            for mode_folder in folder.Folder:
                mode_name = str(mode_folder.name)
                logger.debug(
                    "Extracting Placemarks from folder for mode %s, satellite %s",
                    mode_name,
                    sat_name,
                )
                self._extract_mode_datatakes(mode_folder, sat_name)

        for day_str, day_folder in self._day_folders.items():
            try:
                fragments_table.process_kml_folder(day_folder)
            except Exception as ex:
                logger.error("Error while loading S2 KML Folder : %s", ex, exc_info=1)
