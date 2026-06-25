import logging
import math
import requests

logger = logging.getLogger(__name__)

REQUESTS_TIMEOUT = 20


def get_latest_tle(norad_id, sat_id='unknown'):
    """
    Fetch classic 3-line TLE from Celestrak.
    Handles Celestrak's OMM CSV format by converting to classic TLE.
    """
    from satellite_tle import fetch_tle_from_celestrak
    raw = fetch_tle_from_celestrak(norad_id)

    # Celestrak now returns OMM CSV format instead of TLE
    # raw is a tuple: (header_row, data_row, '')
    if isinstance(raw, tuple) and len(raw) >= 2 and "," in raw[0]:
        return _omm_csv_to_tle(raw[0], raw[1], sat_id)

    return raw


def _omm_csv_to_tle(header_row, data_row, sat_id):
    headers = header_row.split(",")
    values = data_row.split(",")
    omm = dict(zip(headers, values))

    name = omm.get("OBJECT_NAME", sat_id)

    # --- Line 1 ---
    norad = omm["NORAD_CAT_ID"].strip().zfill(5)
    classification = omm.get("CLASSIFICATION_TYPE", "U").strip()

    parts = omm.get("OBJECT_ID", "").strip().split("-")
    if len(parts) == 3:
        intl_desig = (parts[0][2:] + parts[1] + parts[2]).ljust(8)
    elif len(parts) == 2:
        intl_desig = (parts[0][2:] + parts[1]).ljust(8)
    else:
        intl_desig = "        "

    epoch_tle = _epoch_to_tle(omm.get("EPOCH", "").strip())
    ndot = _format_ndot(omm.get("MEAN_MOTION_DOT", "0"))
    nddot = _format_tle_decimal(omm.get("MEAN_MOTION_DDOT", "0"))
    bstar = _format_tle_decimal(omm.get("BSTAR", "0"))
    ephemeris = omm.get("EPHEMERIS_TYPE", "0").strip()
    element_set = omm.get("ELEMENT_SET_NO", "999").strip().rjust(4)

    line1_body = f"1 {norad}{classification} {intl_desig} {epoch_tle} {ndot} {nddot} {bstar} {ephemeris}{element_set}"
    line1 = line1_body + str(_tle_checksum(line1_body))

    # --- Line 2 ---
    inclination = f"{float(omm['INCLINATION']):8.4f}"
    raan = f"{float(omm['RA_OF_ASC_NODE']):8.4f}"
    ecc_raw = omm["ECCENTRICITY"].strip().lstrip("0").lstrip(".")
    eccentricity = ecc_raw.ljust(7, "0")[:7]
    arg_perigee = f"{float(omm['ARG_OF_PERICENTER']):8.4f}"
    mean_anomaly = f"{float(omm['MEAN_ANOMALY']):8.4f}"
    mean_motion = f"{float(omm['MEAN_MOTION']):11.8f}"
    rev_at_epoch = omm.get("REV_AT_EPOCH", "0").strip().rjust(5)

    line2_body = f"2 {norad} {inclination} {raan} {eccentricity} {arg_perigee} {mean_anomaly} {mean_motion}{rev_at_epoch}"
    line2 = line2_body + str(_tle_checksum(line2_body))

    logger.info("Converted OMM→TLE for %s: %s", sat_id, line1[18:32])
    return (name, line1, line2)


def _epoch_to_tle(epoch_str):
    from datetime import datetime
    dt = datetime.fromisoformat(epoch_str)
    year = dt.year % 100
    start_of_year = datetime(dt.year, 1, 1)
    day_fraction = (dt - start_of_year).total_seconds() / 86400 + 1
    return f"{year:02d}{day_fraction:012.8f}"


def _format_ndot(val):
    f = float(val)
    sign = "+" if f >= 0 else "-"
    abs_str = f"{abs(f):.8f}"[1:]
    return f"{sign}{abs_str}"


def _format_tle_decimal(val):
    s = str(val).strip().upper()
    if s in ("0", "0.0", ".0", ""):
        return "+00000-0"
    if "E" in s:
        mantissa_str, exp_str = s.split("E")
        exp = int(exp_str)
        mantissa_str = mantissa_str.replace(".", "").replace("+", "").replace("-", "")
        mantissa_str = mantissa_str.lstrip("0").ljust(5, "0")[:5]
        sign = "-" if float(val) < 0 else "+"
        return f"{sign}{mantissa_str}{exp:+d}"
    f = float(val)
    if f == 0:
        return "+00000-0"
    exp = math.floor(math.log10(abs(f))) + 1
    mantissa = int(round(abs(f) * 10 ** (5 - exp)))
    sign = "+" if f >= 0 else "-"
    return f"{sign}{mantissa:05d}{exp-1:+d}"


def _tle_checksum(line):
    total = 0
    for c in line[:-1]:
        if c.isdigit():
            total += int(c)
        elif c == "-":
            total += 1
    return total % 10
