#!/usr/bin/env python3
"""
Tiny stand-in backend for the SentiBoard frontend demo.

Serves JSON on http://localhost:5005 so the Next.js SERVER-SIDE fetch in
`lib/data.ts` succeeds — letting you watch a real HTTP call between the
frontend server and a backend. Uses only the Python standard library
(no Flask, no pip install needed).

Run it (in its own terminal):
    python3 frontend/dev-mock-backend/server.py

Then reload http://localhost:3000/ and watch BOTH terminals:
  - the Next.js terminal logs:  [data] getNews → OK, 3 items from backend
  - this terminal logs:         [mock-backend] GET /api/events/news/last-1w

This is throwaway — replace it with the real Flask backend on :5005 when ready.
"""
import json
import math
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

# Shaped like the REAL DB "Instant Messages" the home page serves
# (fields: id, title, text, messageType, publicationDate, link).
NEWS = [
    {"id": 1, "title": "Sentinel-2C commissioning enters its final phase", "messageType": "warning",
     "publicationDate": "2026-06-19T09:40:00Z", "link": "",
     "text": "Sentinel-2C has completed its in-orbit commissioning checks and is moving into the final calibration phase before joining the operational constellation."},
    {"id": 2, "title": "Copernicus data feeds new pan-European flood-mapping service", "messageType": "success",
     "publicationDate": "2026-06-17T14:05:00Z", "link": "",
     "text": "A new Copernicus Emergency Management service combines Sentinel-1 SAR and Sentinel-2 optical data to deliver rapid flood-extent maps within hours of acquisition."},
    {"id": 3, "title": "Ground-segment incident affecting product publication", "messageType": "danger",
     "publicationDate": "2026-06-16T08:00:00Z", "link": "",
     "text": "An incident is delaying product publication for several hours. Acquisitions continue nominally while recovery is in progress."},
    {"id": 4, "title": "Sentinel-1 SAR processor baseline 003.71 released to production", "messageType": "info",
     "publicationDate": "2026-06-12T11:20:00Z", "link": "",
     "text": "The updated IPF baseline improves SLC and GRD product quality and now applies to all Sentinel-1A datatakes."},
]


# Shaped like the REAL anomalies (Elasticsearch) the /index banner reads:
# start "dd/mm/YYYY HH:MM:SS", impactedSatellite, category, datatakes_completeness.
# Timestamps are relative to NOW so they land inside the last-24h window and the
# React banner logic (allowed satellite + completeness < 90%) actually fires.
def _anomalies():
    now = datetime.now(timezone.utc)

    def start(hours_ago):
        return (now - timedelta(hours=hours_ago)).strftime("%d/%m/%Y %H:%M:%S")

    return [
        # All recovered (completeness >= 90) → nothing impacting → the UI shows
        # the "Nominal operations" check-circle. To demo a BANNER instead, drop
        # any of these below 90, e.g. change acq to 62.0.
        {"start": start(2), "impactedSatellite": "Copernicus Sentinel-3A", "category": "Platform",
         "publicationDate": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
         "datatakes_completeness": [{"acq": 98.0, "pub": 96.0, "arch": 99.0}]},
        {"start": start(0.5), "impactedSatellite": "Copernicus Sentinel-2B", "category": "Acquisition",
         "publicationDate": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
         "datatakes_completeness": [{"acq": 100.0, "pub": 97.0, "arch": 100.0}]},
        # too old (> 24h) → filtered out regardless
        {"start": start(40), "impactedSatellite": "Copernicus Sentinel-2A", "category": "Calibration",
         "publicationDate": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
         "datatakes_completeness": [{"acq": 10.0, "pub": 0.0, "arch": 5.0}]},
    ]


# Shaped like the REAL /events_data response:
#   { year, month, anomalies, anomalies_by_date: { "YYYY-MM-DD": [ {category, ...} ] }, events }
# `category` is the issue type (acquisition/calibration/manoeuvre/production/satellite).
EVENTS_DATA = {
    "year": 2026, "month": 6, "anomalies": [], "events": [], "count": 8,
    "anomalies_by_date": {
        "2026-06-03": [{"category": "acquisition", "impactedSatellite": "Sentinel-2A", "description": "Acquisition activity"}],
        "2026-06-12": [{"category": "production", "impactedSatellite": "Sentinel-1A", "description": "IPF baseline promoted"}],
        "2026-06-17": [{"category": "production", "impactedSatellite": "Sentinel-2B", "description": "L1C publication latency"}],
        "2026-06-22": [{"category": "manoeuvre", "impactedSatellite": "Sentinel-5P", "description": "Orbit manoeuvre"}],
        "2026-06-24": [{"category": "calibration", "impactedSatellite": "Sentinel-2A", "description": "Calibration window"}],
        "2026-06-27": [
            {"category": "satellite", "impactedSatellite": "Sentinel-3A", "description": "OLCI downlink anomaly"},
            {"category": "calibration", "impactedSatellite": "Sentinel-2A", "description": "Calibration"},
        ],
        "2026-06-29": [{"category": "satellite", "impactedSatellite": "Sentinel-3A", "description": "Partial downlink"}],
    },
}


# Shaped like the REAL /data-availability?ajax=1 response.
def _dt(id_, plat, t, acq, pub, acq_pct, pub_pct):
    return {"id": id_, "platform": plat, "observation_time_start": t,
            "acquisition_status": acq, "publication_status": pub,
            "raw": {"completeness_status": {"ACQ": {"status": acq, "percentage": acq_pct},
                                            "PUB": {"status": pub, "percentage": pub_pct}}}}

AVAILABILITY = {"has_more": False, "datatakes": [
    _dt("S1A_44218_001", "S1A", "2026-06-29T09:12:00Z", "ACQUIRED", "PROCESSING", 100, 75),
    _dt("S2A_31002_012", "S2A", "2026-06-29T08:40:00Z", "ACQUIRED", "PUBLISHED", 100, 100),
    _dt("S3A_22887_044", "S3A", "2026-06-29T07:55:00Z", "PARTIAL", "UNAVAILABLE", 61, 0),
    _dt("S2B_31010_021", "S2B", "2026-06-29T06:30:00Z", "ACQUIRED", "PROCESSING", 100, 78),
    _dt("S5P_19920_007", "S5P", "2026-06-29T04:20:00Z", "ACQUIRED", "PUBLISHED", 100, 100),
    _dt("S2A_31003_015", "S2A", "2026-06-29T10:05:00Z", "PLANNED", "PLANNED", 0, 0),
]}


# Shaped like the real /api/processors-releases (proxy of the Copernicus baseline API):
# a list of releases, each with processing_baseline, validity_start_date, target_ipfs[].
PROCESSORS = [
    {"release_id": "r1", "processing_baseline": "001.00", "validity_start_date": "2023-01-15", "target_ipfs": ["S1_L0"]},
    {"release_id": "r2", "processing_baseline": "001.02", "validity_start_date": "2024-03-01", "target_ipfs": ["S1_L0"]},
    {"release_id": "r3", "processing_baseline": "001.03", "validity_start_date": "2025-08-01", "target_ipfs": ["S1_L0"]},
    {"release_id": "r4", "processing_baseline": "003.52", "validity_start_date": "2023-01-10", "target_ipfs": ["S1_L1L2"]},
    {"release_id": "r5", "processing_baseline": "003.61", "validity_start_date": "2024-06-01", "target_ipfs": ["S1_L1L2"]},
    {"release_id": "r6", "processing_baseline": "003.71", "validity_start_date": "2026-06-12", "target_ipfs": ["S1_L1L2"]},
    {"release_id": "r7", "processing_baseline": "001.00", "validity_start_date": "2024-01-01", "target_ipfs": ["S1_SETAP"]},
    {"release_id": "r8", "processing_baseline": "001.01", "validity_start_date": "2025-07-01", "target_ipfs": ["S1_SETAP"]},
    {"release_id": "r9", "processing_baseline": "05.09", "validity_start_date": "2023-01-15", "target_ipfs": ["S2_L1C"]},
    {"release_id": "r10", "processing_baseline": "05.11", "validity_start_date": "2025-03-01", "target_ipfs": ["S2_L1C"]},
    {"release_id": "r11", "processing_baseline": "05.10", "validity_start_date": "2024-06-01", "target_ipfs": ["S2_L2A"]},
    {"release_id": "r12", "processing_baseline": "OL_06.10", "validity_start_date": "2023-05-01", "target_ipfs": ["S3_OLCI"]},
    {"release_id": "r13", "processing_baseline": "OL_07.01", "validity_start_date": "2024-09-01", "target_ipfs": ["S3_OLCI"]},
    {"release_id": "r14", "processing_baseline": "02.04", "validity_start_date": "2023-09-01", "target_ipfs": ["S5P_L2"]},
    {"release_id": "r15", "processing_baseline": "02.06", "validity_start_date": "2025-02-01", "target_ipfs": ["S5P_L2"]},
]


# Ground stations (real endpoint /api/acquisitions/stations is login-protected).
ACQ_STATIONS = [
    {"name": "Svalbard", "lat": 78, "lon": 15},
    {"name": "Matera", "lat": 40, "lon": 16},
    {"name": "Maspalomas", "lat": 27, "lon": -15},
    {"name": "Inuvik", "lat": 68, "lon": -133},
]

# Datatakes for the globe (real endpoint is @internal_only, per satellite/day).
# Shape mirrors what getAcquisitions maps: id, sat, station, lat/lon, comp, status, cls, prods[].
ACQ_DATATAKES = [
    {"id": "S1A-44218-1", "sat": "Sentinel-1A", "station": "Svalbard", "lat": 74, "lon": 18, "comp": 100, "status": "Acquired", "cls": "ok",
     "mode": "IW", "observation_time_start": "2026-07-22T01:31:13Z", "observation_time_stop": "2026-07-22T01:38:37Z",
     "observation_duration": 444, "absolute_orbit": 44218, "relative_orbit": 74, "number_of_scenes": 123,
     "acquisition_status": "ACQUIRED (100%)", "publication_status": "PUBLISHED (100%)",
     "prods": [{"lvl": "L0", "sub": "RAW", "st": "Published"}, {"lvl": "L1", "sub": "SLC", "st": "Published"}, {"lvl": "L1", "sub": "GRD", "st": "Published"}, {"lvl": "L2", "sub": "OCN", "st": "Processing"}]},
    {"id": "S1A-44219-5", "sat": "Sentinel-1A", "station": "Matera", "lat": 41, "lon": 16, "comp": 61, "status": "Downlink loss", "cls": "crit",
     "mode": "EW", "observation_time_start": "2026-07-22T03:02:00Z", "observation_time_stop": "2026-07-22T03:07:41Z",
     "observation_duration": 341, "absolute_orbit": 44219, "relative_orbit": 92, "number_of_scenes": 44,
     "acquisition_status": "PARTIAL (61%)", "publication_status": "UNAVAILABLE (0%)",
     "prods": [{"lvl": "L0", "sub": "RAW", "st": "Partial"}, {"lvl": "L1", "sub": "SLC", "st": "Failed"}]},
    {"id": "S2A_31002_012", "sat": "Sentinel-2A", "station": "Maspalomas", "lat": 22, "lon": -22, "comp": 99, "status": "Acquired", "cls": "ok",
     "prods": [{"lvl": "L0", "sub": "—", "st": "Published"}, {"lvl": "L1", "sub": "C", "st": "Published"}, {"lvl": "L2", "sub": "A", "st": "Published"}]},
    {"id": "S3A_22887_044", "sat": "Sentinel-3A", "station": "Svalbard", "lat": 80, "lon": 6, "comp": 88, "status": "Partial", "cls": "warn",
     "prods": [{"lvl": "L0", "sub": "—", "st": "Published"}, {"lvl": "L1", "sub": "EFR", "st": "Published"}, {"lvl": "L2", "sub": "LFR", "st": "Processing"}]},
    {"id": "S2B_31010_021", "sat": "Sentinel-2B", "station": "Inuvik", "lat": 62, "lon": -122, "comp": 100, "status": "Acquired", "cls": "ok",
     "prods": [{"lvl": "L0", "sub": "—", "st": "Published"}, {"lvl": "L1", "sub": "C", "st": "Published"}, {"lvl": "L2", "sub": "A", "st": "Published"}]},
    {"id": "S5P_19920_007", "sat": "Sentinel-5P", "station": "Svalbard", "lat": 55, "lon": 62, "comp": 100, "status": "Acquired", "cls": "ok",
     "prods": [{"lvl": "L1", "sub": "B", "st": "Published"}, {"lvl": "L2", "sub": "NO2", "st": "Published"}, {"lvl": "L2", "sub": "O3", "st": "Published"}]},
]


# Sample CZML satellite orbits (real endpoint builds CZML from TLEs; @internal_only).
# Crude parametric polar orbits — enough to show moving satellites + orbit paths locally.
def _orbit_czml():
    now = datetime.now(timezone.utc)
    epoch = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    end = (now + timedelta(minutes=100)).strftime("%Y-%m-%dT%H:%M:%SZ")

    def sat(sid, name, color, raan, period_min):
        pts, steps, alt = [], 72, 700000
        for i in range(steps + 1):
            frac = i / steps
            pts += [
                round(frac * period_min * 60, 1),                    # seconds since epoch
                round(((raan + frac * 360 + 180) % 360) - 180, 3),   # lon
                round(80 * math.sin(2 * math.pi * frac), 3),         # lat
                alt,
            ]
        return {
            "id": sid, "name": name, "availability": f"{epoch}/{end}",
            "label": {"text": name, "font": "12pt Lato", "fillColor": {"rgba": color + [255]},
                      "pixelOffset": {"cartesian2": [0, -18]}, "show": True},
            "point": {"pixelSize": 10, "color": {"rgba": color + [255]}},
            "path": {"width": 2, "material": {"solidColor": {"color": {"rgba": color + [200]}}},
                     "leadTime": period_min * 60, "trailTime": period_min * 60, "resolution": 120},
            "position": {"epoch": epoch, "cartographicDegrees": pts,
                         "interpolationAlgorithm": "LAGRANGE", "interpolationDegree": 2},
        }

    doc = {"id": "document", "name": "orbits", "version": "1.0",
           "clock": {"interval": f"{epoch}/{end}", "currentTime": epoch,
                     "multiplier": 60, "range": "LOOP_STOP", "step": "SYSTEM_CLOCK_MULTIPLIER"}}
    return [doc,
            sat("S1A", "Sentinel-1A", [54, 208, 224], 0, 99),
            sat("S2A", "Sentinel-2A", [61, 214, 140], 120, 100),
            sat("S3A", "Sentinel-3A", [245, 181, 68], 240, 101)]


# Sample acquisition-plan KML (the real endpoint returns KML; @internal_only).
# A couple of coloured footprint polygons — mirrors the real per-datatake polygons.
SAMPLE_KML = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>Acquisition plan (demo)</name>
  <Placemark><name>S1A-DEMO-1</name>
    <Style><PolyStyle><color>663dd68c</color></PolyStyle><LineStyle><color>ff3dd68c</color><width>2</width></LineStyle></Style>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      -20,5,0 -8,12,0 -2,2,0 -14,-5,0 -20,5,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
  <Placemark><name>S1A-DEMO-2</name>
    <Style><PolyStyle><color>66f5b544</color></PolyStyle><LineStyle><color>fff5b544</color><width>2</width></LineStyle></Style>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      30,40,0 42,46,0 48,36,0 36,30,0 30,40,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
</Document></kml>"""


# Acquisition-plan day coverage {mission: {satellite: ["YYYY-MM-DD", ...]}}.
def _plan_coverage():
    now = datetime.now(timezone.utc)
    days = [(now - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(0, 6)]
    return {
        "S1": {"S1A": days, "S1C": days},
        "S2": {"S2A": days, "S2B": days, "S2C": days},
        "S3": {"S3A": days, "S3B": days},
        "S5P": {"S5P": days},
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, code, text, ctype="text/plain"):
        body = text.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        print(f"[mock-backend] GET {self.path}")
        if self.path.startswith("/api/instant-messages"):
            self._send(200, {"messages": NEWS, "total": len(NEWS)})
        elif self.path.startswith("/api/ssr/anomalies/") or self.path.startswith("/api/events/anomalies/"):
            self._send(200, _anomalies())
        elif self.path.startswith("/api/events/news/"):
            self._send(200, NEWS)
        elif self.path.startswith("/events_data"):
            self._send(200, EVENTS_DATA)
        elif self.path.startswith("/data-availability"):
            self._send(200, AVAILABILITY)
        elif self.path.startswith("/api/processors-releases"):
            self._send(200, PROCESSORS)
        elif self.path.startswith("/api/acquisitions/acquisition-plans"):
            self._send_text(200, SAMPLE_KML, "application/vnd.google-earth.kml+xml")
        elif self.path.startswith("/api/ssr/acquisitions/plan-days"):
            self._send(200, _plan_coverage())
        elif self.path.startswith("/api/ssr/acquisitions/orbits"):
            self._send(200, _orbit_czml())
        elif self.path.startswith("/api/ssr/acquisitions/stations") or self.path.startswith("/api/acquisitions/stations"):
            self._send(200, ACQ_STATIONS)
        elif self.path.startswith("/api/acquisitions/acquisition-datatakes"):
            self._send(200, ACQ_DATATAKES)
        else:
            self._send(404, {"error": "not found", "path": self.path})

    def log_message(self, *args):  # silence default noisy logging; we print our own
        pass


if __name__ == "__main__":
    print("SentiBoard demo backend → http://localhost:5005  (Ctrl+C to stop)")
    HTTPServer(("127.0.0.1", 5005), Handler).serve_forever()
