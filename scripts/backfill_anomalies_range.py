# -*- encoding: utf-8 -*-
"""
Chunked historical backfill of anomalies from the Elastic/CAMS source.

Why this exists
---------------
The /admin/backfill_anomalies HTTP endpoint runs the whole date range inside a
single request, so a multi-year backfill (e.g. 2022 -> today) reliably exceeds
the nginx/gunicorn timeout and dies part-way. This script does the same work but
as a long-running process (no HTTP timeout), splitting the range into month- or
quarter-sized chunks and ingesting them one at a time with progress logging.

It deliberately stops ~3 months before today by default: the recent window is
already kept current by the daily scheduled ingestion (which covers the last
quarter), so there is no need to re-ingest it here.

Safety
------
* Idempotent: ingestion upserts by the canonical anomaly key
  (see apps.models.anomalies.update_anomaly / normalize_anomaly_key), so
  re-running a chunk updates rows instead of duplicating them.
* --dry-run only *fetches* from Elastic and reports counts per chunk; it never
  writes to the database.

Usage (typically inside the container, where Elastic is reachable)
------------------------------------------------------------------
    # Preview what would be ingested, month by month:
    python -m scripts.backfill_anomalies_range --dry-run

    # Backfill 2022-01-01 up to ~3 months ago, in monthly chunks:
    python -m scripts.backfill_anomalies_range

    # Custom range / quarterly chunks:
    python -m scripts.backfill_anomalies_range --start 2022-01-01 --end 2026-03-01 --chunk quarter

Target DB: defaults to the local sqlite file (apps/db/db.sqlite3); override with
SENTIBOARD_DB_URI if needed.
"""

import argparse
import os
import socket

# Importing the apps package runs a module-level Redis probe
# (socket.connect_ex on 127.0.0.1:7478) that blocks where the port is filtered.
# Cap the timeout during import, then restore it so DB/Elastic sockets are
# unaffected. (Inside the container Redis is reachable, so this is a no-op there.)
_prev_timeout = socket.getdefaulttimeout()
socket.setdefaulttimeout(5)
try:
    import apps
    from apps import db
    import apps.config  # noqa: F401 — side effect: populates ConfigCache (Elastic config)
    from dateutil.relativedelta import relativedelta
    from apps.ingestion.anomalies_ingestor import AnomaliesIngestor
finally:
    socket.setdefaulttimeout(_prev_timeout)

from datetime import datetime

from flask import Flask


def _resolve_db_uri():
    override = os.getenv("SENTIBOARD_DB_URI") or os.getenv("SQLALCHEMY_DATABASE_URI")
    if override:
        return override
    apps_dir = os.path.dirname(os.path.abspath(apps.__file__))
    return "sqlite:///" + os.path.join(apps_dir, "db", "db.sqlite3")


def _build_minimal_app(db_uri):
    """A bare Flask app bound to the target DB (no blueprints/scheduler)."""
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    return app


def _chunks(start, end, step_months):
    """Yield [chunk_start, chunk_end) windows covering [start, end)."""
    cur = start
    while cur < end:
        nxt = min(cur + relativedelta(months=step_months), end)
        yield cur, nxt
        cur = nxt


def _parse_date(s):
    return datetime.strptime(s, "%Y-%m-%d")


def run(start, end, step_months, dry_run):
    ingestor = AnomaliesIngestor()
    total_seen = total_ingested = total_skipped = 0

    windows = list(_chunks(start, end, step_months))
    print("Backfill {} -> {} in {} chunk(s) of {} month(s){}".format(
        start.date(), end.date(), len(windows), step_months,
        "  [DRY-RUN]" if dry_run else ""))

    for i, (cs, ce) in enumerate(windows, 1):
        label = "[{}/{}] {} -> {}".format(i, len(windows), cs.date(), ce.date())
        try:
            if dry_run:
                records = ingestor.get_anomalies_elastic(start=cs, end=ce)
                n = len(records)
                total_seen += n
                print("  {}  would ingest {} anomalies".format(label, n))
            else:
                ingested, skipped = ingestor.ingest_anomalies_range(start=cs, end=ce)
                total_ingested += ingested
                total_skipped += skipped
                print("  {}  ingested {}, skipped {}".format(label, ingested, skipped))
        except Exception as ex:  # one bad chunk shouldn't abort the whole run
            print("  {}  ERROR: {}".format(label, ex))

    print("\nDone.")
    if dry_run:
        print("  total anomalies that would be ingested: {}".format(total_seen))
    else:
        print("  total ingested: {}  total skipped: {}".format(total_ingested, total_skipped))


def main():
    parser = argparse.ArgumentParser(description="Chunked historical anomaly backfill.")
    parser.add_argument("--start", default="2022-01-01", metavar="YYYY-MM-DD",
                        help="range start (default 2022-01-01)")
    parser.add_argument("--end", default=None, metavar="YYYY-MM-DD",
                        help="range end (default: ~3 months ago, since the daily "
                             "ingestion already covers the recent quarter)")
    parser.add_argument("--chunk", choices=("month", "quarter"), default="month",
                        help="chunk size (default month)")
    parser.add_argument("--dry-run", action="store_true",
                        help="only fetch and report counts; do not write to the DB")
    args = parser.parse_args()

    start = _parse_date(args.start)
    if args.end:
        end = _parse_date(args.end)
    else:
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        end = today - relativedelta(months=3)

    if start >= end:
        raise SystemExit("start ({}) must be before end ({})".format(start.date(), end.date()))

    step_months = 1 if args.chunk == "month" else 3

    db_uri = _resolve_db_uri()
    print("Target DB: {}".format(db_uri))
    app = _build_minimal_app(db_uri)
    with app.app_context():
        run(start, end, step_months, args.dry_run)


if __name__ == "__main__":
    main()
