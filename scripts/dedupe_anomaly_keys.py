# -*- encoding: utf-8 -*-
"""
One-time data migration: collapse duplicate anomalies caused by the upstream
key-prefix rename ("PDGSANOM-" -> "GSANOM-").

Background
----------
The same logical anomaly was ingested under two different keys over time
(old: ``PDGSANOM-<n>``, new: ``GSANOM-<n>``). Because ``update_anomaly`` dedups
on an exact key match, an old-range backfill inserted the new-keyed row instead
of updating the existing one, producing duplicate calendar traces. The old row
also holds the computed ``datatakes_completeness`` snapshot, which cannot be
recomputed (data-availability detail is restricted to ~3 months).

What this script does
---------------------
Groups every anomaly by its canonical key (``normalize_anomaly_key``). For each
group:
  * 1 row  -> if its key is the legacy form, rename it to the canonical form.
  * 2 rows -> keep the canonical (GSANOM) row as the survivor; if the survivor
              has no real completeness but its legacy twin does, copy the twin's
              ``datatakes_completeness`` onto the survivor; then delete the twin.

The operation is idempotent: a second run finds nothing to change.

Usage
-----
    # Safe preview (no writes) — DEFAULT:
    python -m scripts.dedupe_anomaly_keys

    # Apply the changes:
    python -m scripts.dedupe_anomaly_keys --apply

    # Apply, snapshotting the table into anomalies_backup_<suffix> first:
    python -m scripts.dedupe_anomaly_keys --apply --backup pre_dedupe

By default it targets the local sqlite DB (apps/db/db.sqlite3). On staging/prod,
point it at the live DB by exporting SENTIBOARD_DB_URI (a SQLAlchemy URI), e.g.
    export SENTIBOARD_DB_URI="postgresql://user:pass@host:5432/dbname"
"""

import argparse
import ast
import os
import socket
from collections import defaultdict

# Importing the apps package runs a module-level Redis probe
# (socket.connect_ex on 127.0.0.1:7478). Where that port is filtered rather than
# refused, the probe blocks for the full TCP connect timeout. Cap it during the
# import, then restore the previous default so DB sockets are unaffected.
_prev_timeout = socket.getdefaulttimeout()
socket.setdefaulttimeout(3)
try:
    import apps
    from apps import db
    from apps.models.anomalies import Anomalies, normalize_anomaly_key
finally:
    socket.setdefaulttimeout(_prev_timeout)

from flask import Flask


def _resolve_db_uri():
    """SQLAlchemy URI for the target DB.

    We deliberately do NOT import apps.config: instantiating its config classes
    runs manage_cache_config(), which connects to Redis and hangs where Redis is
    not reachable. Honor an explicit override env var, otherwise fall back to the
    same local sqlite file the app uses (apps/db/db.sqlite3).
    """
    override = os.getenv("SENTIBOARD_DB_URI") or os.getenv("SQLALCHEMY_DATABASE_URI")
    if override:
        return override
    apps_dir = os.path.dirname(os.path.abspath(apps.__file__))
    return "sqlite:///" + os.path.join(apps_dir, "db", "db.sqlite3")


def _build_minimal_app(db_uri):
    """A bare Flask app bound to the target DB.

    We deliberately avoid apps.create_app() — it boots blueprints, the
    scheduler and Elasticsearch connections, which this data migration does not
    need (and which block/hang in a headless run).
    """
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    return app


def _has_real_completeness(raw):
    """True if the stored datatakes_completeness has any non-zero L0/L1/L2 value."""
    try:
        entries = ast.literal_eval(raw or "[]")
    except (ValueError, SyntaxError):
        return False
    if not isinstance(entries, list):
        return False
    for entry in entries:
        if isinstance(entry, dict) and any(
            isinstance(entry.get(k), (int, float)) and entry.get(k)
            for k in ("L0_", "L1_", "L2_")
        ):
            return True
    return False


def _backup_table(suffix):
    """Snapshot the anomalies table into anomalies_backup_<suffix> (same engine)."""
    backup = "anomalies_backup_" + suffix
    # CREATE TABLE AS SELECT is supported by sqlite, postgres and mysql.
    db.session.execute(
        db.text("CREATE TABLE {} AS SELECT * FROM anomalies".format(backup))
    )
    db.session.commit()
    print("  backup table created: {}".format(backup))


def run(apply_changes):
    rows = Anomalies.query.all()
    print("Loaded {} anomalies".format(len(rows)))

    groups = defaultdict(list)
    for r in rows:
        groups[normalize_anomaly_key(r.key)].append(r)

    renamed = merged = deleted = donated = untouched = 0

    for norm_key, members in groups.items():
        if len(members) == 1:
            r = members[0]
            if r.key != norm_key:
                print("  RENAME  {!r} -> {!r}".format(r.key, norm_key))
                r.key = norm_key
                renamed += 1
            else:
                untouched += 1
            continue

        # >1 member: same anomaly under both prefixes. Keep the canonical row.
        survivor = next((m for m in members if m.key == norm_key), members[0])
        others = [m for m in members if m is not survivor]

        if not _has_real_completeness(survivor.datatakes_completeness):
            donor = next(
                (m for m in others if _has_real_completeness(m.datatakes_completeness)),
                None,
            )
            if donor is not None:
                survivor.datatakes_completeness = donor.datatakes_completeness
                donated += 1

        survivor.key = norm_key
        for m in others:
            print("  MERGE   delete {!r} (id={}) into survivor {!r}".format(
                m.key, m.id, norm_key))
            db.session.delete(m)
            deleted += 1
        merged += 1

    print("\nSummary:")
    print("  duplicate groups merged : {}".format(merged))
    print("  legacy rows deleted     : {}".format(deleted))
    print("  completeness donated    : {}".format(donated))
    print("  twinless rows renamed   : {}".format(renamed))
    print("  rows already canonical  : {}".format(untouched))

    if not apply_changes:
        db.session.rollback()
        print("\nDRY-RUN — no changes written. Re-run with --apply to commit.")
        return

    db.session.commit()
    print("\nAPPLIED — changes committed.")


def main():
    parser = argparse.ArgumentParser(description="Collapse PDGSANOM/GSANOM anomaly duplicates.")
    parser.add_argument("--apply", action="store_true",
                        help="commit changes (default is a dry-run preview)")
    parser.add_argument("--backup", metavar="SUFFIX", default=None,
                        help="snapshot anomalies into anomalies_backup_<SUFFIX> before applying")
    args = parser.parse_args()

    db_uri = _resolve_db_uri()
    print("Target DB: {}".format(db_uri))
    app = _build_minimal_app(db_uri)

    with app.app_context():
        if args.apply and args.backup:
            _backup_table(args.backup)
        run(apply_changes=args.apply)


if __name__ == "__main__":
    main()
