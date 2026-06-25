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
import math
import pytz
from czml import czml
from satellite_czml import satellite
from satellite_czml import satellite_czml
from satellite_tle import fetch_tle_from_celestrak
from apps.utils.tle_fetcher import get_latest_tle

from apps import flask_cache

logger = logging.getLogger(__name__)

orbits_cache_key = "/api/acquisition/satellite/orbits"

stations_cache_key = "/api/acquisition/stations"

assets_cache_duration = 604800

sat_ids = ["S1A", "S1C", "S1D", "S2A", "S2B", "S2C", "S3A", "S3B", "S5P"]
norad_id_map = {
    "S1A": 39634,
    "S1B": 41456,
    "S1C": 62261,
    "S1D": 66315,
    "S2A": 40697,
    "S2B": 42063,
    "S2C": 60989,
    "S3A": 41335,
    "S3B": 43437,
    "S5P": 42969,
}


""" def get_latest_tle(sat_id):
    norad_id = norad_id_map[sat_id]
    raw = fetch_tle_from_celestrak(norad_id)

    # Celestrak now returns OMM CSV format instead of TLE
    # raw is a tuple: (header_row, data_row, '')
    if isinstance(raw, tuple) and len(raw) >= 2 and "," in raw[0]:
        return _omm_csv_to_tle(raw[0], raw[1], sat_id)

    return raw
"""

""" def _omm_csv_to_tle(header_row, data_row, sat_id):
    headers = header_row.split(",")
    values = data_row.split(",")
    omm = dict(zip(headers, values))

    name = omm.get("OBJECT_NAME", sat_id)

    # --- Line 1 ---
    norad = omm["NORAD_CAT_ID"].strip().zfill(5)
    classification = omm.get("CLASSIFICATION_TYPE", "U").strip()

    # International designator: "2014-016A" → "14016A  " (2-digit year + rest, 8 chars)
    intl_raw = omm.get("OBJECT_ID", "").strip().replace("-", "")
    intl_desig = (intl_raw[2:] if len(intl_raw) > 6 else intl_raw).ljust(8)
    # correct format is YY + LLLPPP: 2-digit year + launch number + piece
    # "2014-016A" → year=14, launch=016, piece=A → "14016A"
    parts = omm.get("OBJECT_ID", "").strip().split("-")
    if len(parts) == 3:
        intl_desig = (parts[0][2:] + parts[1] + parts[2]).ljust(8)
    elif len(parts) == 2:
        intl_desig = (parts[0][2:] + parts[1]).ljust(8)

    epoch_tle = _epoch_to_tle(omm.get("EPOCH", "").strip())
    ndot = _format_ndot(omm.get("MEAN_MOTION_DOT", "0"))
    nddot = _format_tle_decimal(omm.get("MEAN_MOTION_DDOT", "0"))
    bstar = _format_tle_decimal(omm.get("BSTAR", "0"))
    ephemeris = omm.get("EPHEMERIS_TYPE", "0").strip()
    element_set = omm.get("ELEMENT_SET_NO", "999").strip().rjust(4)

    # Strict column format — no checksum digit yet (it goes in position 68)
    line1_body = f"1 {norad}{classification} {intl_desig} {epoch_tle} {ndot} {nddot} {bstar} {ephemeris}{element_set}"
    line1 = line1_body + str(_tle_checksum(line1_body))

    # --- Line 2 ---
    inclination = f"{float(omm['INCLINATION']):8.4f}"
    raan = f"{float(omm['RA_OF_ASC_NODE']):8.4f}"
    # drop "0." prefix, pad to 7 digits
    ecc_raw = omm["ECCENTRICITY"].strip().lstrip("0").lstrip(".")
    eccentricity = ecc_raw.ljust(7, "0")[:7]
    arg_perigee = f"{float(omm['ARG_OF_PERICENTER']):8.4f}"
    mean_anomaly = f"{float(omm['MEAN_ANOMALY']):8.4f}"
    mean_motion = f"{float(omm['MEAN_MOTION']):11.8f}"
    rev_at_epoch = omm.get("REV_AT_EPOCH", "0").strip().rjust(5)

    line2_body = f"2 {norad} {inclination} {raan} {eccentricity} {arg_perigee} {mean_anomaly} {mean_motion}{rev_at_epoch}"
    line2 = line2_body + str(_tle_checksum(line2_body))

    # logger.info(f"[TLE] Converted OMM→TLE for {sat_id}:\n  {line1}\n  {line2}")
    return (name, line1, line2)
"""

""" def _epoch_to_tle(epoch_str):
    #Convert ISO epoch to TLE format: YYDDD.DDDDDDDD
    from datetime import datetime

    dt = datetime.fromisoformat(epoch_str)
    year = dt.year % 100
    start_of_year = datetime(dt.year, 1, 1)
    day_fraction = (dt - start_of_year).total_seconds() / 86400 + 1
    return f"{year:02d}{day_fraction:012.8f}"
"""


""" def _format_ndot(val):
    #    Format mean_motion_dot as +.NNNNNNNN (TLE assumed-decimal, signed).
    # e.g. 0.00000277 → '+.00000277', -0.00000277 → '-.00000277'

    f = float(val)
    sign = "+" if f >= 0 else "-"
    # Remove leading zero: 0.00000277 → .00000277
    abs_str = f"{abs(f):.8f}"[1:]  # strips the "0" before the "."
    return f"{sign}{abs_str}"
"""

""" def _format_tle_decimal(val):
    # Format BSTAR / MEAN_MOTION_DDOT in TLE assumed-decimal notation.
    # e.g. '.68422E-4' → '+68422-4', '0' → '+00000-0'
    s = str(val).strip().upper()

    if s in ("0", "0.0", ".0", ""):
        return "+00000-0"

    # Already in TLE-ish form like '.68422E-4' or '1.234E-5'
    if "E" in s:
        mantissa_str, exp_str = s.split("E")
        exp = int(exp_str)
        # Remove sign, decimal point from mantissa, keep 5 digits
        mantissa_str = mantissa_str.replace(".", "").replace("+", "").replace("-", "")
        mantissa_str = mantissa_str.lstrip("0").ljust(5, "0")[:5]
        sign = "-" if float(val) < 0 else "+"
        return f"{sign}{mantissa_str}{exp:+d}".replace("+", "+").replace("+-", "-")

    # Plain float fallback
    f = float(val)
    if f == 0:
        return "+00000-0"

    exp = math.floor(math.log10(abs(f))) + 1
    mantissa = int(round(abs(f) * 10 ** (5 - exp)))
    sign = "+" if f >= 0 else "-"
    return f"{sign}{mantissa:05d}{exp-1:+d}"
"""

""" def _tle_checksum(line):
    # TLE line checksum: sum all digits + 1 for each '-', mod 10.
    total = 0
    for c in line[:-1]:  # exclude last char (the checksum slot)
        if c.isdigit():
            total += int(c)
        elif c == "-":
            total += 1
    return total % 10
"""

def load_satellite_orbits():
    """
    Build the CZML satellite orbit, in the specified time period
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Copernicus Sentinels orbits")
    cache_start_time = perf_counter()

    # Init satellite and color maps
    multiple_sats = []
    color_map = {
        "S1A": [72, 171, 247, 255],
        "S1B": [72, 171, 247, 255],
        "S1C": [72, 171, 247, 255],
        "S1D": [72, 171, 247, 255],
        "S2A": [49, 206, 54, 255],
        "S2B": [49, 206, 54, 255],
        "S2C": [49, 206, 54, 255],
        "S3A": [255, 173, 70, 255],
        "S3B": [255, 173, 70, 255],
        "S5P": [104, 97, 206, 255],
    }
    marker_map = {
        "S1A": "static/assets/img/sentinel-1.png",
        "S1B": "static/assets/img/sentinel-1.png",
        "S1C": "static/assets/img/sentinel-1.png",
        "S1D": "static/assets/img/sentinel-1.png",
        "S2A": "static/assets/img/sentinel-2.png",
        "S2B": "static/assets/img/sentinel-2.png",
        "S2C": "static/assets/img/sentinel-2.png",
        "S3A": "static/assets/img/sentinel-3.png",
        "S3B": "static/assets/img/sentinel-3.png",
        "S5P": "static/assets/img/sentinel-5p.png",
    }

    # To avoid breaking the scheduler, protect the connection loop in a try-except block
    try:

        # Calculate orbits for each satellite
        for sat_id in sat_ids:
            try:
                # get_latest_tle is now imported from apps.utils.tle_fetcher
                tle = get_latest_tle(norad_id_map[sat_id], sat_id)
                sat = satellite(
                    tle,
                    description="Satellite: " + tle[0],
                    marker_scale=1,
                    image=marker_map[sat_id],
                    use_default_image=False,
                    start_time=pytz.utc.localize(datetime.now() - timedelta(days=20)),
                    end_time=pytz.utc.localize(datetime.now() + timedelta(days=20)),
                    show_label=True,
                    show_path=True,
                )
                sat.build_path(rebuild=True, show=True, color=color_map[sat_id], width=2)
                sat.build_label(rebuild=True, show=True, font="12pt Lato",
                                color=color_map[sat_id],
                                outlineColor=color_map[sat_id],
                                outlineWidth=3)
                multiple_sats.append(sat)
            except Exception as ex:
                logger.error("Failed to load orbit for satellite %s: %s", sat_id, ex, exc_info=True)
                continue  # skip this satellite, load the rest

        # Convert the satellites in CZML objects
        czml_obj = satellite_czml(satellite_list=multiple_sats)
        czml_string = czml_obj.get_czml()

        # Populate the orbit cache
        _set_satellite_orbit_cache(czml_string)

    except Exception as ex:
        logger.error(ex)

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading satellite orbits - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


def load_stations():
    """
    Build the CZML ground stations positions
    """

    # Log an acknowledgement message
    logger.info("[BEG] Loading Acquisition Stations")
    cache_start_time = perf_counter()

    # Init stations and color maps
    stations_map = {
        "Svalbard": [15.399, 78.228, 450],
        "Inuvik": [-133.72181, 68.34986, 15.00],
        "Maspalomas": [-15.6332, 27.76329, 153],
        "Matera": [16.7046, 40.6486, 536.9],
        "Neustrelitz": [13.0670437, 53.3622189, 73.00],
    }
    color = [215, 222, 252, 255]
    marker = "static/assets/img/antenna.png"

    # Initialize the CZML document
    doc = czml.CZML()
    packet1 = czml.CZMLPacket(id="document", version="1.0")
    doc.packets.append(packet1)

    # Loop over each station and build the corresponding CZML
    for station, position in stations_map.items():

        # Create and append a new station object
        packet = czml.CZMLPacket(id=station)
        bb = czml.Billboard(scale=1.0, show=True)
        bb.image = marker
        bb.scale = 0.5
        bb.color = {"rgba": color}
        packet.billboard = bb
        packet.position = {"cartographicDegrees": position}
        doc.packets.append(packet)

    # Populate the stations cache
    filename = "/tmp/stations.txt"
    doc.write(filename)
    with open(filename, "r") as file:
        _set_stations_cache(file.read().rstrip())

    # Log an acknowledgement message
    cache_end_time = perf_counter()
    logger.info(
        f"[END] Loading Acquisition Stations - Execution Time : {cache_end_time - cache_start_time:0.6f}"
    )


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
