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
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from skyfield.api import EarthSatellite
from skyfield.api import load as sky_load
from skyfield.toposlib import wgs84 as sky_wgs84, GeographicPosition

from sgp4.earth_gravity import wgs72
from sgp4.io import twoline2rv

import pytz
from skyfield.units import Angle

from apps.elastic.modules.datatakes import ELASTIC_TIME_FORMAT

logger = logging.getLogger(__name__)

DATATAKE_ID_KEY = "datatake_id"
OBSERVATION_START_KEY = "observation_time_start"
OBSERVATION_END_KEY = "observation_time_stop"

# SWATHS for Satellites
# IN Km

swaths = {"S3A": 1270, "S3B": 1270, "S5P": 2600}


@dataclass
class TimedCartesianGeoPoint:
    x: float
    y: float
    z: float
    relative_time: int


@dataclass
class GeographicGeoPoint:
    lat: float
    lon: float
    altitude: float

    def degrees_to_radians(self):
        self.lat = math.degrees(self.lat)
        self.lon = math.degrees(self.lon)

    def radians_to_degree(self):
        self.lat = math.radians(self.lat)
        self.lon = math.radians(self.lon)


class DatatakeAcquisition:
    def __init__(self, datatake):
        # NOTE: Temporary untile Datatake data are loaded on sub-dictionary
        # '_source' directly taken from Elastic query
        self._datatake = datatake
        self._points_list = None
        self.datatake_id = datatake[DATATAKE_ID_KEY]

    @property
    def start_time(self):
        start_time_str = self._datatake[OBSERVATION_START_KEY]
        return datetime.strptime(start_time_str, ELASTIC_TIME_FORMAT)

    @property
    def end_time(self):
        end_time_str = self._datatake[OBSERVATION_END_KEY]
        return datetime.strptime(end_time_str, ELASTIC_TIME_FORMAT)

    @property
    def start_time_str(self):
        return self._datatake[OBSERVATION_START_KEY]

    @property
    def end_time_str(self):
        return self._datatake[OBSERVATION_END_KEY]

    @property
    def acquisition_points(self):
        return self._points_list

    @acquisition_points.setter
    def acquisition_points(self, points_list):
        self._points_list = points_list

    @property
    def datatake_params(self):
        return self._datatake


class OrbitPropagatorSkyfield:
    def __init__(self, tle_data, step, extra_point=False):
        # TODO: add if an extra point shall be generated for each propagation
        # self.tle_obj = twoline2rv(tle_data[1], tle_data[2], wgs72)
        self._step = step
        self._add_extra_point = extra_point
        self._timescale = sky_load.timescale()
        self._satellite = EarthSatellite(
            tle_data[1], tle_data[2], tle_data[0], self._timescale
        )
        logger.debug(
            "Orbit Propagator (Skyfield) - step: %s, satellite: %s",
            step,
            self._satellite,
        )

    # Request positions from start to end included, plus an optional additional one
    # positions shall be timed (to allow for transformation to LLA)
    def _generate_orbit_ecef_positions(self, start_time: datetime, end_time: datetime):
        logger.debug(
            "Propagating orbit for satellite %s, from %s, to %s, with step %s sec, add extra point: %s",
            self._satellite.name,
            start_time,
            end_time,
            self._step,
            self._add_extra_point,
        )
        # Include start point, and a point at end time
        number_of_positions = (
            int((end_time - start_time).total_seconds() / self._step) + 2
        )

        time_step = 0
        positions = []
        for _ in range(number_of_positions):

            current_time = start_time + timedelta(seconds=time_step)
            if current_time > end_time:
                current_time = end_time
                time_step = (current_time - start_time).total_seconds()
            geocentric = self._generate_ecef_pos(current_time)
            positions.append(geocentric)
            time_step += self._step
        if self._add_extra_point:
            current_time = start_time + timedelta(seconds=time_step)
            geocentric = self._generate_ecef_pos(current_time)
            positions.append(geocentric)
        # If an extra point is present, number of positions indicates the
        # points from start to end, excluding the extra point
        return number_of_positions, positions

    def _generate_ecef_pos(self, postime):
        ts_datetime = pytz.utc.localize(postime)
        t = self._timescale.from_datetime(ts_datetime)
        geocentric = self._satellite.at(t)
        # t=self._timescale.fromdatetime(postime)
        # geocentric = self._satellite.at(t.utc())
        # print("Ecef Position: ", geocentric.position.km, " at time: ", ts_datetime)
        return geocentric

    def add_extra_point(self, flag):
        self._add_extra_point = flag

    @staticmethod
    def _orb_ecef_2_lla_points(ecef_points):
        """
        Converts a list of ECEF points to a list o fLLA points
        LLA points are computed by taking the SubPoint of the c
        corresponding ECEF position
        Args:
            ecef_points (): a list of GeographicPosition points
                representing ECEF positions

        Returns: a list of GeographicPositions

        """
        lla_points = []
        for ecef_pnt in ecef_points:
            lla_points.append(sky_wgs84.subpoint_of(ecef_pnt))
        # return map(sky_wgs84.subpoint_of, ecef_points)
        return lla_points

    def get_orbit_lla_points(self, start_time: datetime, end_time: datetime):
        """

        Args:
            start_time (datetime):
            end_time (datetime):


        Returns: a tuple, containing:
            num_samples (int): the number of samples expected, including start and end point
            a list of LLA points, plus an extra optional point (if requested when instattating th eclass)

        """
        num_samples, orb_ecef_positions_list = self._generate_orbit_ecef_positions(
            start_time, end_time
        )
        return num_samples, self._orb_ecef_2_lla_points(orb_ecef_positions_list)


class OrbitPropagator:
    def __init__(self, tle_data, step, extra_point=False):
        self.tle_obj = twoline2rv(tle_data[1], tle_data[2], wgs72)
        self.step = step
        self._add_extra_point = extra_point
        self._interpolation_algorithm = ("LAGRANGE",)
        self._interpolation_degree = (5,)
        self._reference_frame = ("INERTIAL",)

    def _generate_orbit_positions(
        self, start_time: datetime, end_time: datetime, extra_point=False
    ):
        # czmlPosition = Position()
        # czmlPosition.interpolationAlgorithm = self._interpolation_algorithm
        # czmlPosition.interpolationDegree = self._interpolation_degree
        # czmlPosition.referenceFrame = self._reference_frame
        # czmlPosition.epoch = start_time.isoformat()
        # TODO: A positin for end time must be computed
        # TODO: Add option to compute extra positions (number) before or after
        # they must be distinguished
        number_of_positions = int((end_time - start_time).total_seconds() / self.step)
        number_of_positions += 1  # so there is more than 1
        time_step = 0

        positions = []
        velocities = []
        # current_time = start_time
        for _ in range(number_of_positions):
            current_time = start_time + timedelta(seconds=time_step)
            eci_position, eci_velocity = self.tle_obj.propagate(
                current_time.year,
                current_time.month,
                current_time.day,
                current_time.hour,
                current_time.minute,
                current_time.second,
            )

            # Build a Skyfield GeographicPosition
            # converts km's to m's
            orb_point = TimedCartesianGeoPoint(
                eci_position[0] * 1000,
                eci_position[1] * 1000,
                eci_position[2] * 1000,
                time_step,
            )
            orb_vel = TimedCartesianGeoPoint(
                eci_velocity[0] * 1000,
                eci_velocity[1] * 1000,
                eci_velocity[2] * 1000,
                time_step,
            )
            logger.debug(
                "Angle between 0 and 1: %s",
                math.degrees(math.atan2(eci_velocity[0], eci_position[1])),
            )
            logger.debug(
                "Angle between 0 and 2: %s",
                math.degrees(math.atan2(eci_velocity[0], eci_position[2])),
            )
            logger.debug(
                "Angle between 1 and 2: %s",
                math.degrees(math.atan2(eci_velocity[1], eci_position[2])),
            )
            positions.append(orb_point)
            velocities.append(orb_vel)
            time_step += self.step
            # current_time += timedelta(seconds=self.step)

        # czmlPosition.cartesian = positions
        return positions, velocities

    def add_extra_point(self, flag):
        self._add_extra_point = flag

    def get_orbit_lla_points(
        self,
        start_time,
        end_time,
    ):
        """

        Args:
            start_time ():
            end_time ():

        Returns: a list of LLA points, with time informaiton (relatie)

        """
        orb_positions_list, orb_velocities_list = self._generate_orbit_positions(
            start_time, end_time
        )
        return self._orbit_points_to_points(start_time, orb_positions_list)

    def _orbit_points_to_points(self, start_time, orbit_eci_points_list):
        """
        Convert points from TLE propagation
        to Acquisition Image Points
        Args:
            orbit_eci_points_list (): a list of Orbit points (cartesian) with time
                information (relative to start) (TimedCartesianGeoPoint)

        Returns: a list of GeographicGeoPoint (LLA)

        """
        # Convert Cartesian ECI TO ECEF
        # Convert ECEF to Geographic
        #
        suborbit_lla_points_list = []
        for cart_pnt in orbit_eci_points_list:
            point_time = start_time + timedelta(seconds=cart_pnt.relative_time)
            ecef_point = eci2ecef(cart_pnt, point_time)
            lla_point = ecef2lla(ecef_point, point_time)
            suborbit_lla_points_list.append(lla_point)

        return suborbit_lla_points_list


class AcquisitionLineProfileFromOrbit:
    # Receives: start, end time, interval length
    # builds list of orbit positions at N intervals
    # builds polyline for acquisition
    needs_extra_point = False

    def __init__(self, orbit_propagator, swath_wid):
        self._orbit_propagator = orbit_propagator

    def build_image_profile(self, start_time, end_time):
        """

        Args:
            start_time ():
            end_time ():

        Returns: a list of GeographicGeoPoint (in degree, altitude in metres)

        """
        logger.debug(
            "Computing Line Image Profile - start: %s, end: %s", start_time, end_time
        )
        # Generate Acquisition from Swath and OrbitPositions list
        # NOTE: It could be requested to generate extra orbit position at end and/or start
        # But these extra point should not be part of out
        # For Line Profile, we are not asking for extra points
        num_points, lla_points = self._orbit_propagator.get_orbit_lla_points(
            start_time, end_time
        )
        logger.debug("Line Image Profile Builder: computed %d points", num_points)
        return list(
            map(
                lambda geop: GeographicGeoPoint(
                    geop.latitude.degrees, geop.longitude.degrees, geop.elevation.m
                ),
                lla_points,
            )
        )


class GeoPointOperations:
    EarthRadius = 6378100  # metres
    PiCircle = 2.0 * math.pi
    """

    """

    def __init__(self, point: GeographicPosition):
        """

        Args:
            point ():
        """
        self._point = point

    def get_point_north_bearing(self, point2):
        """
        Implement Formula or use a Library function
        Args:
            point2 ():

        Returns:

        """
        # OR USE SKYFIELD!
        # X,Y in metres, return value in radians
        # return math.atan2(velocity.x, velocity.y)
        lat1_rad = self._point.latitude.radians
        lat2_rad = point2.latitude.radians
        lon1_rad = self._point.longitude.radians
        lon2_rad = point2.longitude.radians

        # Calculate the differences between the latitudes and longitudes
        delta_lat = lat2_rad - lat1_rad
        delta_lon = lon2_rad - lon1_rad
        a = math.sin(delta_lon) * math.cos(lat2_rad)
        b = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(
            lat2_rad
        ) * math.cos(delta_lon)
        theta = math.atan2(a, b)
        #                           math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat1_rad) * math.cos(delta_lon))
        return Angle(radians=theta)

    # TODO: to be replaced by a call to a Library function
    # e.g.
    def get_target(self, bearing, gc_distance):
        """
        NOTE: WE NEED RADIANT ANGLES
        Find target point from starting point, going to bearing
        direction, at gc_distances (great circle)
        Use Inverse Haversine formula
        Args:
            bearing (): direction in radians
            gc_distance ():

        Returns:

        """
        # rad = m/m
        distance_arc = gc_distance / self.EarthRadius
        distance_arc_sin = math.sin(distance_arc)
        distance_arc_cos = math.cos(distance_arc)
        # Point defined by lat/lon in radiant
        lon1 = self._point.longitude.radians
        lat1 = self._point.latitude.radians
        point_lat_cos = math.cos(lat1)
        point_lat_sin = math.sin(lat1)
        bearing_rad = bearing.radians
        # Normale to -Pi - Pi the radians
        fix_angle_domain = False
        if fix_angle_domain:
            if bearing_rad > math.pi:
                logger.debug(
                    "Fixed Bearing from %f to %f",
                    bearing_rad,
                    bearing_rad - self.PiCircle,
                )
                bearing_rad -= self.PiCircle
            elif bearing_rad < -math.pi:
                logger.debug(
                    "Fixed Bearing from %f to %f (Degrees: %s)",
                    bearing_rad,
                    bearing_rad + self.PiCircle,
                    math.degrees(bearing_rad + self.PiCircle),
                )
                bearing_rad += self.PiCircle
        lat2 = math.asin(
            point_lat_sin * math.cos(distance_arc)
            + point_lat_cos * distance_arc_sin * math.cos(bearing_rad)
        )
        lon2 = lon1 + math.atan2(
            math.sin(bearing_rad) * distance_arc_sin * point_lat_cos,
            distance_arc_cos - point_lat_sin * math.sin(lat2),
        )
        fix_lon_domain = False
        if fix_lon_domain:
            if lon2 > math.pi:
                logger.debug(
                    "Fixed Longitude from %f to %f", lon2, lon2 - self.PiCircle
                )

                lon2 = lon2 - self.PiCircle
            elif lon2 < -math.pi:
                logger.debug(
                    "Fixed Longitude from %f to %f", lon2, lon2 + self.PiCircle
                )
                lon2 = lon2 + self.PiCircle
        # Return a point, after converting radians to Degrees
        return GeographicGeoPoint(math.degrees(lat2), math.degrees(lon2), 0)


class AcquisitionPolygonProfileFromOrbit:
    HalphPi = math.pi / 2.0
    needs_extra_point = True

    # Receives: start, end time, interval length
    # builds list of orbit positions at N intervals
    # builds polyline for acquisition
    def __init__(self, orbit_propagator, swath_wid):
        """

        Args:
            orbit_propagator ():
            swath_wid (int): Width of the swath in Km
        """
        self._orbit_propagator = orbit_propagator
        self._orbit_propagator.add_extra_point = True
        # self._swath_width = swath_wid
        self.half_swath = swath_wid * 1000.0 / 2.0

    def build_image_profile(self, start_time, end_time):
        # Generate Acquisition from Swath and OrbitPositions list
        #   Find North bearing
        # Find East/West points at half Swath distance
        # NOTE: It could be requested to generate extra orbit position at end and/or start
        # But these extra point should not be part of out
        num_samples, orb_positions_list = self._orbit_propagator.get_orbit_lla_points(
            start_time, end_time
        )
        return self._get_acquisition_boundaries(orb_positions_list, num_samples)

    def _get_acquisition_boundaries(self, points_list, num_samples):
        """
        Build a polygon by computing orthogonal points at "half swath" width
        for num_samples points in points list
        it is expected that points list contains an extra point ( in addition to num_samples)
        to allow computing north hading on the last point
        For this extra pnt no orthogonal segment is computed
        Args:
            points_list (): a list of Point objects
                Each Point has 2(3) coordinates.
                Coordinates can be taken in several ways:
                    - cartesian
                    - geodetic
                    - degree....

        Returns:

        """
        west_points = []
        east_points = []
        # print ("Computing ", num_samples, " Orthogonal points; Using ", len(points_list)," points")
        for index in range(num_samples):
            # point_vel = velocity_list[index]
            curr_point = points_list[index]
            next_point = points_list[index + 1]
            point_ops = GeoPointOperations(curr_point)
            point_north_heading = point_ops.get_point_north_bearing(next_point)
            swath_ends = self._get_swath_ends(point_ops, point_north_heading)
            logger.debug(
                "Computed  orbit point %s, east: %s, west: %s",
                curr_point,
                swath_ends["east"],
                swath_ends["west"],
            )
            west_points.append(swath_ends.get("west"))
            east_points.append(swath_ends.get("east"))
        # Combine east and reversed west points in a single list
        # West points are reversed, since the last east point is followed by
        # last west point, and continues in the reverse direction
        # up to first point
        west_points.reverse()
        return east_points + west_points

    def _get_swath_ends(self, point_ops: GeoPointOperations, north_bearing: Angle):
        """

        Args:
            point (): Swath to be positioned at this point,
            expressed in Geodetic coordinates
            north_bearing (float): azimuth to North, in radians

        Returns:

        """
        logger.debug(
            "Computing West target  for point %s", point_ops._point.target_name
        )
        w_brng = self._get_west_bearing(north_bearing)
        west_end_point = point_ops.get_target(w_brng, self.half_swath)
        logger.debug(
            "Computing East target  for point %s", point_ops._point.target_name
        )
        e_brng = self._get_east_bearing(north_bearing)
        east_end_point = point_ops.get_target(e_brng, self.half_swath)
        return {"west": west_end_point, "east": east_end_point}

    def _get_east_bearing(self, north_b):
        east_rad = north_b.radians + self.HalphPi
        return Angle(radians=east_rad)

    def _get_west_bearing(self, north_b):
        west_rad = north_b.radians - self.HalphPi
        return Angle(radians=west_rad)

    @staticmethod
    def _normalize_longitude_degrees(lon):
        # NOTE: WE NEED DEGREES!
        return (lon + 540) % 360 - 180


class OrbitAcquisitionsBuilder:
    # Loads TLE (most recent, or list of tles on a period
    # from a list of datatakes, builds a list of
    # acquisitions (to be passed to a KML Builder)
    # Each acquisitions specifies: start/stop time,
    #  polyline, datatake id
    def __init__(self, sat_id, tle_data, step, acquisition_profile_builder_class):
        # TODO : Check on satellite_czml how to handle TLE returned from function
        # TODO: Check how to specify list of past TLE
        self.tle_data = tle_data
        self.name = self.tle_data[0]
        swath_width_km = swaths.get(sat_id)
        extra_point = acquisition_profile_builder_class.needs_extra_point
        orbit_propagator = OrbitPropagatorSkyfield(tle_data, step, extra_point)
        # Instantiate the Profile Builder, that creates a list of points
        # for a time interval, using the passed orbit propagator
        self._acquisition_profile_builder = acquisition_profile_builder_class(
            orbit_propagator, swath_width_km
        )

    def compute_acquisition_points(self, start_time, end_time):
        return self._acquisition_profile_builder.build_image_profile(
            start_time, end_time
        )
