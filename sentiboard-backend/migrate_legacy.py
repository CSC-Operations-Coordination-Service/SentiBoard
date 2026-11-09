"""Migrate legacy SentiBoard SQLite rows into the new schemas.

Maps every legacy row, validates it through the Pydantic schema, and bulk
loads it into OpenSearch with its legacy id. Sets up the indices first (see
setup_indices.py). Opens the DB read-only. Writes nothing unless --apply is
given, and nothing at all if any row fails validation. Safe to re-run.

    python migrate_legacy.py <legacy.db>                        # dry run
    python migrate_legacy.py <legacy.db> --apply                # write
    python migrate_legacy.py <legacy.db> --include-dashboard    # also Dashboard anomalies
"""

import ast
import re
import sqlite3
import sys
from collections import Counter

from maas_model.schema_adapter import schema_to_document
from opensearchpy.helpers import bulk
from pydantic import ValidationError

from documents.anomaly import Anomaly as AnomalyDocument
from documents.instantmessage import Instantmessage as InstantmessageDocument
from documents.news import News as NewsDocument
from schemas.anomaly import Anomaly
from schemas.instantmessage import Instantmessage
from schemas.news import News
from opensearch_config import new_client
from setup_indices import setup

TABLES = [
    ("instantMessages", Instantmessage, InstantmessageDocument),
    ("news", News, NewsDocument),
    ("anomalies", Anomaly, AnomalyDocument),
]


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


def run(db, client, apply=False, include_dashboard=False):
    setup(client, apply)
    actions, failed = [], False
    for table, schema, document_cls in TABLES:
        rows = load(db, table)
        if rows is None:
            print(f"{table}: MISSING TABLE, skipped")
            continue
        source, notes = len(rows), ""
        if table == "anomalies":
            rows = list(merge_anomalies(rows))
            merged = len(rows)
            # Dashboard anomalies are hidden in legacy; pass --include-dashboard to migrate them
            rows = [r for r in rows
                    if include_dashboard or (r["category"] or "").lower() != "dashboard"]
            notes = f" ({source - merged} duplicate keys merged, {merged - len(rows)} Dashboard excluded)"
        errors, examples = Counter(), {}
        for row in rows:
            try:
                item = schema.model_validate(row)
            except ValidationError as ex:
                for err in ex.errors():
                    field = ".".join(str(p) for p in err["loc"] if not isinstance(p, int))
                    errors[(field, err["type"])] += 1
                    examples.setdefault((field, err["type"]), (row["id"], err["input"]))
                continue
            # legacy UUID as _id: a re-run skips rows already migrated (409)
            document = schema_to_document(item, document_cls, document_id=row["id"])
            actions.append(document.to_bulk_action(op_type="create"))
        print(f"{table}: {source} rows -> {len(rows)} docs{notes}, {sum(errors.values())} errors")
        for (field, kind), n in errors.most_common():
            print(f"  {n:5}  {field}  [{kind}]  e.g. {examples[(field, kind)]!r:.120}")
        failed = failed or bool(errors)

    if failed:
        print("Validation errors: nothing written.")
        return
    if not apply:
        print(f"Dry run: {len(actions)} documents ready. Pass --apply to write them.")
        return

    _, errors = bulk(client, actions, raise_on_error=False)
    existing = [e for e in errors if e["create"]["status"] == 409]
    others = [e for e in errors if e["create"]["status"] != 409]
    print(f"Written {len(actions) - len(errors)}, already migrated {len(existing)}, failed {len(others)}")
    for e in others[:5]:
        print("  ", e)
    names = [document_cls.Index.name for _, _, document_cls in TABLES]
    client.indices.refresh(index=",".join(names))
    for name in names:
        print(f"  {name}: {client.count(index=name)['count']} documents")


if __name__ == "__main__":
    db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    run(db, new_client(), apply="--apply" in sys.argv,
        include_dashboard="--include-dashboard" in sys.argv)
