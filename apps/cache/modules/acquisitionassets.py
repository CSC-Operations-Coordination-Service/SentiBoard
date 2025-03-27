# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) - ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which  has 
proprietary rights. Recipient of the document shall not duplicate, use or 
disclose in whole or in part, information contained herein except for or on 
behalf of  to fulfill the purpose for which the document was 
delivered to him.
"""

import logging
from datetime import datetime, timedelta
from time import perf_counter

import pytz
from czml import czml
from satellite_czml import satellite
from satellite_czml import satellite_czml
from satellite_tle import fetch_tle_from_celestrak

from apps import flask_cache

logger = logging.getLogger(__name__)

orbits_cache_key = '/api/acquisition/satellite/orbits'

stations_cache_key = '/api/acquisition/stations'

assets_cache_duration = 604800

sat_ids = ['S1A', 'S2A', 'S2B', 'S3A', 'S3B', 'S5P']
norad_id_map = {'S1A': 39634, 'S1B': 41456,
                'S2A': 40697, 'S2B': 42063,
                'S3A': 41335, 'S3B': 43437,
                'S5P': 42969}


def get_latest_tle(satellite):
    # Otherwise retrieve from CACHE!
    norad_id = norad_id_map[satellite]
    return fetch_tle_from_celestrak(norad_id)


def load_satellite_orbits():
    """
    Build the CZML satellite orbit, in the specified time period
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Copernicus Sentinels orbits")
    cache_start_time = perf_counter()

    # Init satellite and color maps
    multiple_sats = []
    color_map = {'S1A': [72, 171, 247, 255], 'S1B': [72, 171, 247, 255],
                 'S2A': [49, 206, 54, 255], 'S2B': [49, 206, 54, 255],
                 'S3A': [255, 173, 70, 255], 'S3B': [255, 173, 70, 255],
                 'S5P': [104, 97, 206, 255]}
    marker_map = {'S1A': 'static/assets/img/sentinel-1.png', 'S1B': 'static/assets/img/sentinel-1.png',
                  'S2A': 'static/assets/img/sentinel-2.png', 'S2B': 'static/assets/img/sentinel-2.png',
                  'S3A': 'static/assets/img/sentinel-3.png', 'S3B': 'static/assets/img/sentinel-3.png',
                  'S5P': 'static/assets/img/sentinel-5p.png'}

    # To avoid breaking the scheduler, protect the connection loop in a try-except block
    try:

        # Calculate orbits for each satellite
        for sat_id in sat_ids:

            # Retrieve latest TLE
            tle = get_latest_tle(sat_id)

            # Build the CZML orbit data from TLE, in the specified time period
            sat = satellite(tle,
                            description='Satellite: ' + tle[0],
                            marker_scale=1,
                            image=marker_map[sat_id],
                            use_default_image=False,
                            start_time=pytz.utc.localize(datetime.now() - timedelta(days=20)),
                            end_time=pytz.utc.localize(datetime.now() + timedelta(days=20)),
                            show_label=True,
                            show_path=True,
                            )

            # Customize orbit path features
            sat.build_path(rebuild=True,
                           show=True,
                           color=color_map[sat_id],
                           width=2
                           )

            # Customize the satellite label
            sat.build_label(rebuild=True,
                            show=True,
                            font='12pt Lato',
                            color=color_map[sat_id],
                            outlineColor=color_map[sat_id],
                            outlineWidth=3,
                            )

            # Generate the CZML object
            multiple_sats.append(sat)

        # Convert the satellites in CZML objects
        czml_obj = satellite_czml(satellite_list=multiple_sats)
        czml_string = czml_obj.get_czml()

        # Populate the orbit cache
        _set_satellite_orbit_cache(czml_string)

    except Exception as ex:
        logger.error(ex)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(f"[END] Loading satellite orbits - Execution Time : {cache_end_time - cache_start_time:0.6f}")


def load_stations():
    """
    Build the CZML ground stations positions
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Acquisition Stations")
    cache_start_time = perf_counter()

    # Init stations and color maps
    stations_map = {'Svalbard': [15.399, 78.228, 450], 'Inuvik': [-133.72181, 68.34986, 15.00],
                    'Maspalomas': [-15.6332, 27.76329, 153], 'Matera': [16.7046, 40.6486, 536.9],
                    'Neustrelitz': [13.0670437, 53.3622189, 73.00]}
    color = [215, 222, 252, 255]
    marker = 'static/assets/img/antenna.png'

    # Initialize the CZML document
    doc = czml.CZML()
    packet1 = czml.CZMLPacket(id='document', version='1.0')
    doc.packets.append(packet1)

    # Loop over each station and build the corresponding CZML
    for station, position in stations_map.items():

        # Create and append a new station object
        packet = czml.CZMLPacket(id=station)
        bb = czml.Billboard(scale=1.0, show=True)
        bb.image = marker
        bb.scale = 0.5
        bb.color = {'rgba': color}
        packet.billboard = bb
        packet.position = {'cartographicDegrees': position}
        doc.packets.append(packet)

    # Populate the stations cache
    filename = '/tmp/stations.txt'
    doc.write(filename)
    with open(filename, 'r') as file:
        _set_stations_cache(file.read().rstrip())

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(f"[END] Loading Acquisition Stations - Execution Time : {cache_end_time - cache_start_time:0.6f}")


def _set_satellite_orbit_cache(orbits_data):
    """
        Store in cache the provided results, and set the validity time of cache according to the data period.
        """

    # Log an acknowledgement message
    logger.debug("Caching orbits")

    seconds_validity = assets_cache_duration
    flask_cache.set(orbits_cache_key, orbits_data, seconds_validity)


def _set_stations_cache(stations_data):
    """
        Store in cache the provided results, and set the validity time of cache according to the data period.
        """

    # Log an acknowledgement message
    logger.debug("Caching stations")

    seconds_validity = assets_cache_duration
    flask_cache.set(stations_cache_key, stations_data, seconds_validity)
