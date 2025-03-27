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
from datetime import datetime

from pykml.factory import KML_ElementMaker as KML

from apps.ingestion.acquisition_plans.acq_plan_fragments import INTERVAL_TIME_FMT, AcqDatatake
from apps.ingestion.acquisition_plans.orbit_datatake_acquisitions import DatatakeAcquisition, DATATAKE_ID_KEY, \
    OBSERVATION_START_KEY, OBSERVATION_END_KEY


class OrbitAcquisitionKmlFragmentBuilder:
    """
    Class in charge of creating KML Fragments from a polyline
    of geodetic points, with a name, and a start/end date
    Datatake id is also provided
    Class object receives the data and produces a KML Fragment in the form:
    KML Folder
        KML Folder
            Placemark List
    """
    def __init__(self, day_str, sat_name):
        self._day_folder = self._create_daily_folder(day_str, sat_name)

    @property
    def fragment(self):
        return self._day_folder

    @property
    def placemarks_folder(self):
        if self._day_folder is not None:
            return self._day_folder.Folder[0]
        else:
            raise Exception("Main folder not defined")

    @property
    def placemark_list(self):
        folder = self.placemarks_folder
        return folder.Placemark if hasattr(folder, "Placemark") else []

    @staticmethod
    def _create_daily_folder(day_str, sat_name):
        day_fold = KML.Folder(
            KML.name(day_str)
        )
        sat_folder = KML.Folder(
            KML.name(sat_name)
        )
        day_fold.append(sat_folder)
        return day_fold

    def add_to_daily_folder(self, day_str, sat_name, kml_placemark):
        # day_folder = self._day_folders.setdefault(day_str, self._create_daily_folder(day_str, sat_name))
        self.placemarks_folder.append(kml_placemark)


_extended_data_key_labels = {
    OBSERVATION_START_KEY: "ObservationTimeStart",
    OBSERVATION_END_KEY: "ObservationTimeStop",
    "satellite_unit": "SatelliteUnit",
    "instrument_mode": "InstrumentMode",
    "absolute_orbit": "OrbitAbsolute"
}


def _transcode_extended_data_key(key):
    """
    Convert key to a human readable form.
    If key (datatake dictionary key) is not present in
    translation table, return it
    Args:
        key (string): the datatake key to be transocded

    Returns: a string

    """
    label = _extended_data_key_labels.get(key, None)
    return label if label is not None else key

def _build_datatake_placemark(acq_dt: DatatakeAcquisition, id_key):
    """

    Args:
        acq_dt (DatatakeAcquisition):
        id_key (str): NOT NEEDED if ID KEY is set to DATATAKE_ID_KEY

    Returns: the generated Placemark object

    """
    name = acq_dt.datatake_id
    start_time = acq_dt.start_time
    stop_time = acq_dt.end_time
    datatake_parameters = acq_dt.datatake_params
    excluded_keys = [DATATAKE_ID_KEY, 'L0_', 'L1_', 'L2_', 'completeness_status']
    # Create Extended Data from Datatake parameters
    # Define a TimeSpan
    # Put Time using format:
    start_interval = datetime.strftime(start_time, INTERVAL_TIME_FMT)
    end_interval = datetime.strftime(stop_time, INTERVAL_TIME_FMT)
    acq_interval = KML.TimeSpan(KML.begin(start_interval), KML.end(end_interval))
    extended_data = KML.ExtendedData()
    # Add Datatake Id
    extended_data.append(KML.Data(KML.value(acq_dt.datatake_id),
                                  name=id_key))
    # Add to Extended Data Data Elements
    # Corresponding to Datatake dictionary items
    for key, value in datatake_parameters.items():
        if key not in excluded_keys:
            extended_key = _transcode_extended_data_key(key)
            extended_data.append(KML.Data(KML.value(value), name=extended_key))
    placemark = KML.Placemark(KML.name(name), acq_interval,
                              extended_data)
    return placemark


def _points_to_coordinates(point_list):
    # Coordinates for Placemark
    # have units degree in range:
    # -180.0 - +180.0 degree for longitude
    # -90 - +90 degree for longitude
    # degree are decimal (no minutes or seconds)
    # Altitude is in metres
    # Order in generated string for each point is:
    # Longitude, latitude, altitude
    n = 5
    point_coords = [",".join([f"{pnt.lon:.{n}f}",
                              f"{pnt.lat:.{n}f}",
                              f"{pnt.altitude}"])
                    for pnt in point_list]
    point_coords_str = ' '.join(point_coords)
    return point_coords_str


# TODO: Change to receive a list of Acquistion Ponts,
# with the actual points number (to use extra points if needed)
# The actual points are used to draw the acquisition profile
def build_acquisition_line_placemark(acquisition_datatake: DatatakeAcquisition):
    """

    Args:
        acquisition_datatake ():

    Returns:

    """
    dt_points = acquisition_datatake.acquisition_points
    dt_point_coords_str = _points_to_coordinates(dt_points)
    pm_line = KML.LineString(KML.altitudeMode('clampToGround'),
                             KML.tessellate(1),
                             KML.coordinates(dt_point_coords_str))

    # placemark = _build_datatake_placemark(acquisition_datatake)
    # placemark.append(pm_line)
    # return placemark
    return pm_line


def build_acquisition_polygon_placemark(acquisition_datatake: DatatakeAcquisition):
    # Retrieve from dt_points points coordinates:
    # If Point dataclass: retrieve lat, lon
    # Otherwise assumption is that each point is  a tuple, containing lat and long
    # New list shall put together coordinates, and altitude ordered as:
    # long1, lat1, alt1 long2, lat2, alt2
    # Each point has coordinates separated by comma
    # Each triplet is separated from next triplet using space
    # No space should be present around commas.
    # Decimal separator is dot
    #<coordinates>-164.23240,69.84658,0 -170.43121,59.44702,0 -174.83276,59.86316,0 -170.70917,70.36110,0 -164.23240,69.84658,0</coordinates>
    dt_points = acquisition_datatake.acquisition_points
    polygon_dt_points = dt_points[:]
    # Add last point equal to first point to close the polygon
    polygon_dt_points.append(dt_points[0])
    # Normalize Acquistion Point Longitudes
    dt_point_coords_str = _points_to_coordinates(dt_points)
    pm_ring = KML.LinearRing(KML.coordinates(dt_point_coords_str)
                             )
    pm_polygon = KML.Polygon(
        KML.altitudeMode("clampToGround"),
        KML.tessellate(1),
        KML.outerBoundaryIs(pm_ring)
    )
    return pm_polygon
    # return pm_ring