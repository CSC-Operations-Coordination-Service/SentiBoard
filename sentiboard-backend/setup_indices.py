"""Install the index templates into OpenSearch and create each first index.

Run once against a fresh OpenSearch, before the API or the migration writes
anything. Safe to re-run: existing templates are updated, existing indices kept.

    python setup_indices.py           # dry run: show what would change
    python setup_indices.py --apply

OpenSearch is reached as opensearch_config.py describes (OPENSEARCH_URL and friends).
A conflict it cannot resolve (a plain index where the alias should be) raises SetupError, so
the API refuses to start instead of serving on wrong mappings.
"""

import json
import sys
from pathlib import Path

from opensearch_config import OPENSEARCH_URL, new_client  # noqa: F401 (re-exported)

TEMPLATES = Path(__file__).parent / "index_templates"

# Date-partitioned: indices (e.g. processor-2024-05) are created on first write.
PARTITIONED = {"processor"}


class SetupError(RuntimeError):
    """The existing OpenSearch state needs a manual fix before the API can run."""


def setup(client, apply):
    for path in sorted(TEMPLATES.glob("*_template.json")):
        name = path.name.removesuffix("_template.json")
        body = json.loads(path.read_text())
        template = {"index_patterns": body.pop("index_patterns"), "template": body}

        exists = client.indices.exists_index_template(name=name)
        print(f"{name}: {'update' if exists else 'create'} template {template['index_patterns']}")
        if apply:
            client.indices.put_index_template(name=name, body=template)

        if name in PARTITIONED:
            continue
        # Documents write to `name`; it must be the alias the template adds, not a
        # plain index, or OpenSearch guesses the mappings (losing nested etc).
        if client.indices.exists_alias(name=name):
            print(f"{name}: alias already exists, nothing to do")
        elif client.indices.exists(index=name):
            raise SetupError(
                f"{name}: plain index '{name}' exists without mappings; "
                f"delete it (or `docker compose down -v`) and re-run")
        else:
            print(f"{name}: create index {name}-000001 with alias {name}")
            if apply:
                client.indices.create(index=f"{name}-000001")


if __name__ == "__main__":
    setup(new_client(), "--apply" in sys.argv)
