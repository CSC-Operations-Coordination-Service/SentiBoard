"""Migrate legacy SentiBoard SQLite rows into the new schemas.

Dry run only for now: maps every legacy row, validates it through the
Pydantic schema, and reports failures per field. Opens the DB read-only.

    python migrate_legacy.py ../apps/db/db.sqlite3
"""

import ast
import re
import sqlite3
import sys
from collections import Counter

from pydantic import ValidationError

from schemas.anomaly import Anomaly
from schemas.instantmessage import Instantmessage
from schemas.news import News


def snake(name):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def parse_completeness(raw):
    # legacy stores str(list_of_dicts), not JSON
    return ast.literal_eval(raw) if raw else []


def has_real_completeness(entries):
    return any(e.get(k) for e in entries for k in ("L0_", "L1_", "L2_"))


def map_row(row):
    data = {snake(k): v for k, v in dict(row).items()}
    # legacy has tabs, CR/LF and no-break spaces around datatake ids
    if data.get("environment"):
        data["environment"] = ";".join(t.strip() for t in data["environment"].split(";"))
    # one representation for "missing" on optional fields
    for f in ("impacted_satellite", "impacted_item", "news_link", "news_title"):
        if data.get(f) == "":
            data[f] = None
    if "datatakes_completeness" in data:
        data["datatakes_completeness"] = parse_completeness(data["datatakes_completeness"])
    return data


def merge_anomalies(rows):
    """Same rules as scripts/dedupe_anomaly_keys.py: one doc per canonical
    GSANOM key, canonical row survives, takes a twin's completeness if it has none.
    Unlike that script, also keeps a twin's news link if the survivor has none."""
    groups = {}
    for row in rows:
        canonical = re.sub(r"^PDGSANOM", "GSANOM", row["key"])
        groups.setdefault(canonical, []).append(row)
    for canonical, members in groups.items():
        members.sort(key=lambda r: r["key"] != canonical)
        survivor, *twins = members
        survivor["key"] = canonical
        if not has_real_completeness(survivor["datatakes_completeness"]):
            donor = next((t for t in twins if has_real_completeness(t["datatakes_completeness"])), None)
            if donor:
                survivor["datatakes_completeness"] = donor["datatakes_completeness"]
        # admin-entered news links live on some legacy twins only
        if not survivor["news_link"]:
            donor = next((t for t in twins if t["news_link"]), None)
            if donor:
                survivor["news_link"], survivor["news_title"] = donor["news_link"], donor["news_title"]
        yield survivor


def load(db, table):
    tables = {r[0] for r in db.execute("select name from sqlite_master where type='table'")}
    if table not in tables:
        return None
    return [map_row(r) for r in db.execute(f'select * from "{table}"')]


def dry_run(db):
    for table, schema in [("instantMessages", Instantmessage), ("news", News), ("anomalies", Anomaly)]:
        rows = load(db, table)
        if rows is None:
            print(f"{table}: MISSING TABLE, skipped")
            continue
        source = len(rows)
        if table == "anomalies":
            # Dashboard anomalies are hidden in legacy; delete this filter to migrate them
            rows = [r for r in merge_anomalies(rows) if (r["category"] or "").lower() != "dashboard"]
        errors, examples = Counter(), {}
        for row in rows:
            try:
                schema.model_validate(row)
            except ValidationError as ex:
                for err in ex.errors():
                    field = ".".join(str(p) for p in err["loc"] if not isinstance(p, int))
                    errors[(field, err["type"])] += 1
                    examples.setdefault((field, err["type"]), (row["id"], err["input"]))
        print(f"{table}: {source} rows -> {len(rows)} docs, {sum(errors.values())} errors")
        for (field, kind), n in errors.most_common():
            print(f"  {n:5}  {field}  [{kind}]  e.g. {examples[(field, kind)]!r:.120}")


if __name__ == "__main__":
    db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    dry_run(db)
