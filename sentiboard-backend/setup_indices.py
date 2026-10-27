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


def stringify_meta(node, field_names=False):
    """The templates, ready for OpenSearch.

    OpenSearch only accepts strings as the values of a field's `meta`, but the template files
    carry hints for the schema generator as booleans (`"meta": {"optional": true}`): a request
    with them is a 400, "[meta] values can only be strings", and the API never starts. The
    files stay as they are (the generator reads them); only what is sent is changed.

    An object or nested field (one with `properties`) takes no `meta` at all: OpenSearch refuses
    it ("unsupported parameters: [meta : {array=true}]"), so the hint is left out there.

    `field_names` is True for the dict under `properties`, whose keys are field names: a field
    called "meta" is a field, not a hint.
    """
    if isinstance(node, list):
        return [stringify_meta(item) for item in node]
    if not isinstance(node, dict):
        return node
    out = {}
    is_object_field = "properties" in node and not field_names
    for key, value in node.items():
        if key == "meta" and is_object_field:
            continue
        if key == "meta" and not field_names and isinstance(value, dict):
            out[key] = {k: (str(v).lower() if isinstance(v, bool) else str(v)) for k, v in value.items()}
        else:
            out[key] = stringify_meta(value, field_names=(key == "properties" and not field_names))
    return out


class SetupError(RuntimeError):
    """The existing OpenSearch state needs a manual fix before the API can run."""


def setup(client, apply):
    for path in sorted(TEMPLATES.glob("*_template.json")):
        name = path.name.removesuffix("_template.json")
        body = stringify_meta(json.loads(path.read_text()))
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
