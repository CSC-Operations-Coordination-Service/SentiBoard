"""setup_indices: a conflict it cannot fix must stop the API, not be printed and ignored."""

from unittest import mock

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
