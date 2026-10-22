"""Migrate processor releases from the Config Tools Mongo dump.

Reads configuration_tool_db/Graph.bson, takes the graph holding
`processors_releases`, validates each release through the Pydantic schema and
bulk loads it into OpenSearch with its Config Tools id. Sets up the indices
first (see setup_indices.py). Writes nothing unless --apply is given, and
nothing at all if any release fails validation. Safe to re-run.

    python migrate_processors.py <Graph.bson>            # dry run
    python migrate_processors.py <Graph.bson> --apply    # write
"""

import json
import sys
from collections import Counter

from bson import decode_file_iter
from maas_model.schema_adapter import schema_to_document
from opensearchpy import OpenSearch
from opensearchpy.helpers import bulk
from pydantic import ValidationError

from documents.processor import Processor as ProcessorDocument
from schemas.processor import Processor
from setup_indices import OPENSEARCH_URL, setup


def load(path):
    with open(path, "rb") as f:
        for doc in decode_file_iter(f):
            graph = json.loads(doc["graph"])  # stored as a JSON string
            if "processors_releases" in graph:
                return graph["processors_releases"]
    raise SystemExit(f"{path}: no graph with processors_releases")


def map_release(release):
    data = dict(release)
    # 30 releases hold a string ("S1A" or "S1A, S1C") instead of a list
    if isinstance(data["satellite_units"], str):
        data["satellite_units"] = [s.strip() for s in data["satellite_units"].split(",") if s.strip()]
    # 3 releases hold the Config Tool's "undefined" for a missing version:
    # store them like the other versionless entries ("S1_L1L2:")
    data["target_ipfs"] = [t.replace(":undefined", ":") for t in data["target_ipfs"] or []]
    # one representation for "missing" (dates: ApiDate already maps "" to None)
    for f in ("mission", "processing_baseline", "release_notes"):
        if data.get(f) == "":
            data[f] = None
    return data


def run(releases, client, apply=False):
    setup(client, apply)
    actions, skipped, errors, examples = [], [], Counter(), {}
    for release in releases:
        data = map_release(release)
        try:
            item = Processor.model_validate(data)
        except ValidationError as ex:
            for err in ex.errors():
                field = ".".join(str(p) for p in err["loc"] if not isinstance(p, int))
                errors[(field, err["type"])] += 1
                examples.setdefault((field, err["type"]), (data["id"], err["input"]))
            continue
        # Config Tools id as _id: a re-run skips releases already migrated (409)
        document = schema_to_document(item, ProcessorDocument, document_id=data["id"])
        # the index is partitioned by release_date: no date, no index to write to
        if not document.has_partition_field_value:
            skipped.append(data)
            continue
        actions.append(document.to_bulk_action(op_type="create"))

    print(f"processor: {len(releases)} releases -> {len(actions)} docs, "
          f"{len(skipped)} skipped, {sum(errors.values())} errors")
    for (field, kind), n in errors.most_common():
        print(f"  {n:5}  {field}  [{kind}]  e.g. {examples[(field, kind)]!r:.120}")
    for d in skipped:
        print(f"  skipped (no release_date): {d['id']}  {d['mission']}  {d['target_ipfs']}")

    if errors:
        print("Validation errors: nothing written.")
        return
    if not apply:
        months = len({a["_index"] for a in actions})
        print(f"Dry run: {len(actions)} documents ready across {months} monthly indices. "
              f"Pass --apply to write them.")
        return

    # first load creates ~96 monthly indices inside one bulk call: slower than the 10s default
    _, errors = bulk(client, actions, raise_on_error=False, request_timeout=120)
    existing = [e for e in errors if e["create"]["status"] == 409]
    others = [e for e in errors if e["create"]["status"] != 409]
    print(f"Written {len(actions) - len(errors)}, already migrated {len(existing)}, failed {len(others)}")
    for e in others[:5]:
        print("  ", e)
    client.indices.refresh(index="processor")
    print(f"  processor: {client.count(index='processor')['count']} documents")


if __name__ == "__main__":
    run(load(sys.argv[1]), OpenSearch(OPENSEARCH_URL), apply="--apply" in sys.argv)
