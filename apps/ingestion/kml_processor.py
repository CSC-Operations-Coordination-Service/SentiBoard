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

from pykml.factory import KML_ElementMaker as KML
from lxml import etree

from apps.ingestion.acquisition_plans.acq_plan_fragments import DatatakeCompleteness

status_colors = {
    DatatakeCompleteness.PLANNED_STATUS: "a0908c",
    DatatakeCompleteness.PROCESSING_STATUS: "a0908c",
    DatatakeCompleteness.ACQUIRED_STATUS: "1ba40a",
    DatatakeCompleteness.PUBLISHED_STATUS: "1ba40a",
    DatatakeCompleteness.DELAYED_STATUS: "00ffff",
    DatatakeCompleteness.PARTIAL_STATUS: "00ffff",
    DatatakeCompleteness.LOST_STATUS: "0000ff",
    DatatakeCompleteness.UNDEFINED_STATUS: "00ffff",
}


class AcqPlanKmlBuilder:
    """
    This class allows to process a ACQPlan KML File:
     Parse the file:
        the class extracts a list of strings, one for each folder in the file
    Build a file:
        the class received a list of KML folder strings and creates a
        valid KML file in string format.
    """

    def __init__(self, title, mission):
        self._kmldoc = KML.kml(KML.Document(KML.name(title)))
        polygon_fill = 0 if mission in ["S3", "S5"] else 1
        # Add Styles
        for status, color in status_colors.items():
            # TODO: keep KML Styles in Class variables
            line_style = KML.LineStyle(KML.color(f"FF{color}"), KML.width(2))
            style_substyles = [
                line_style,
                KML.PolyStyle(KML.color(f"40{color}"), KML.fill(polygon_fill)),
            ]

            # define a polyline style, add it to the list
            # The style is composed of a list of sub styles
            # and has an id!
            self._kmldoc.Document.append(KML.Style(*style_substyles, id=status))

    def add_folder(self, kml_fragment):
        # retrieve all folders in kml file
        # Convert each folder to a string
        # Extract interval of folder
        # return tuples: interval start/stop, folder string
        # NOTE: we should be able to parse folder string and retrieve its Placemarks
        self._kmldoc.Document.append(kml_fragment.folder_kml)

    def to_string(self):
        return etree.tostring(self._kmldoc)
