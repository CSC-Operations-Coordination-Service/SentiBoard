"""setup_indices: a conflict it cannot fix must stop the API, not be printed and ignored."""

from unittest import mock

import json

import pytest

import setup_indices


def client(alias_exists, index_exists):
    c = mock.MagicMock()
    c.indices.exists_index_template.return_value = True
    c.indices.exists_alias.return_value = alias_exists
    c.indices.exists.return_value = index_exists
    return c


def test_plain_index_without_alias_raises():
    with pytest.raises(setup_indices.SetupError, match="without mappings"):
        setup_indices.setup(client(alias_exists=False, index_exists=True), apply=True)


def test_existing_aliases_are_left_alone():
    c = client(alias_exists=True, index_exists=False)
    setup_indices.setup(c, apply=True)
    c.indices.create.assert_not_called()


def test_missing_indices_are_created_with_the_alias_template():
    c = client(alias_exists=False, index_exists=False)
    setup_indices.setup(c, apply=True)
    created = {call.kwargs["index"] for call in c.indices.create.call_args_list}
    assert {"anomaly-000001", "instantmessage-000001", "news-000001"} <= created
    assert not any(name.startswith("processor") for name in created)  # date-partitioned


def test_meta_hints_are_sent_as_strings():
    # OpenSearch answers 400 "[meta] values can only be strings" to a boolean.
    node = {"mappings": {"properties": {"a": {"type": "keyword", "meta": {"optional": True, "n": 3}}}}}
    out = setup_indices.stringify_meta(node)
    assert out["mappings"]["properties"]["a"]["meta"] == {"optional": "true", "n": "3"}
    assert node["mappings"]["properties"]["a"]["meta"]["optional"] is True  # the input is untouched


def test_an_object_field_takes_no_meta():
    # OpenSearch: "Mapping definition for [x] has unsupported parameters: [meta : {array=true}]".
    node = {"properties": {"x": {"type": "nested", "meta": {"array": True}, "properties": {
        "y": {"type": "keyword", "meta": {"optional": True}}}}}}
    out = setup_indices.stringify_meta(node)
    assert "meta" not in out["properties"]["x"]
    assert out["properties"]["x"]["properties"]["y"]["meta"] == {"optional": "true"}


def test_a_field_called_meta_is_not_a_hint():
    node = {"properties": {"meta": {"type": "object", "properties": {"id": {"type": "keyword"}}}}}
    assert setup_indices.stringify_meta(node) == node


def test_every_shipped_template_is_clean_after_conversion():
    def metas(n, field_names=False):
        if isinstance(n, list):
            for i in n:
                yield from metas(i)
        elif isinstance(n, dict):
            for k, v in n.items():
                if k == "meta" and not field_names and isinstance(v, dict):
                    yield v
                else:
                    yield from metas(v, field_names=(k == "properties" and not field_names))

    for path in sorted(setup_indices.TEMPLATES.glob("*_template.json")):
        found = list(metas(setup_indices.stringify_meta(json.loads(path.read_text()))))
        assert found, f"{path.name}: expected at least one meta hint"
        assert all(isinstance(v, str) for m in found for v in m.values()), path.name


def test_setup_sends_string_meta_to_opensearch():
    c = client(alias_exists=True, index_exists=False)
    setup_indices.setup(c, apply=True)
    for call in c.indices.put_index_template.call_args_list:
        assert '"meta": {"optional": true' not in json.dumps(call.kwargs["body"])
