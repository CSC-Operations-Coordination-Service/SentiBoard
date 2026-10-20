"""Test event-calendar fixture validation against partner schema.

Validates all event-calendar fixtures against the JSON schema.
Note: Partner spec has $ref typo: "#/$defs/Event" should be "#/definitions/Event".
This test validates using corrected schema.
"""

import json
import os
import pytest
from jsonschema import validate, ValidationError


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "chatbot")
SCHEMA_FILE = os.path.join(FIXTURES_DIR, "event_calendar_schema.json")


def load_schema():
    """Load event-calendar schema from fixture."""
    with open(SCHEMA_FILE, "r") as f:
        return json.load(f)


def load_fixture(filename):
    """Load fixture JSON file."""
    path = os.path.join(FIXTURES_DIR, filename)
    with open(path, "r") as f:
        return json.load(f)


@pytest.fixture
def schema():
    """Load schema once per test session."""
    return load_schema()


class TestEventCalendarSchema:
    """Validate event-calendar fixtures against schema."""

    def test_event_calendar_full_fixture(self, schema):
        """Validate event_calendar_full.json against schema."""
        fixture = load_fixture("event_calendar_full.json")
        # Should not raise ValidationError
        validate(instance=fixture, schema=schema)

    def test_schema_structure(self, schema):
        """Verify schema has required definitions."""
        assert "$defs" in schema
        assert "Event" in schema["$defs"]

        event_def = schema["$defs"]["Event"]
        assert "properties" in event_def
        assert "required" in event_def

        # Check Event has required fields
        required = set(event_def["required"])
        assert "key" in required
        assert "title" in required
        assert "category" in required
        assert "status" in required

    def test_event_calendar_full_has_required_fields(self, schema):
        """Verify fixture has all required top-level fields."""
        fixture = load_fixture("event_calendar_full.json")

        assert "data_id" in fixture
        assert fixture["data_id"].startswith("artifact_")
        assert "title" in fixture
        assert "events" in fixture
        assert isinstance(fixture["events"], list)
        assert len(fixture["events"]) > 0

    def test_all_events_have_required_fields(self, schema):
        """Verify all events have required fields."""
        fixture = load_fixture("event_calendar_full.json")
        event_required = set(schema["$defs"]["Event"]["required"])

        for i, event in enumerate(fixture["events"]):
            missing = event_required - set(event.keys())
            assert not missing, f"Event {i} ({event.get('key')}) missing fields: {missing}"

    def test_nullable_occurred_at(self, schema):
        """Verify occurred_at can be null."""
        fixture = load_fixture("event_calendar_full.json")

        # Should have at least one event with null occurred_at
        has_null = any(e.get("occurred_at") is None for e in fixture["events"])
        assert has_null, "Fixture should include at least one event with null occurred_at"

        # Should have at least one event with ISO datetime
        has_datetime = any(e.get("occurred_at") is not None for e in fixture["events"])
        assert has_datetime, "Fixture should include at least one event with occurred_at"

    def test_nullable_criticality(self, schema):
        """Verify criticality can be null."""
        fixture = load_fixture("event_calendar_full.json")

        # Should have at least one event with null criticality
        has_null = any(e.get("criticality") is None for e in fixture["events"])
        assert has_null, "Fixture should include at least one event with null criticality"

        # Should have at least one event with criticality
        has_value = any(e.get("criticality") is not None for e in fixture["events"])
        assert has_value, "Fixture should include at least one event with criticality value"

    def test_criticality_enum_values(self, schema):
        """Verify criticality values match enum."""
        fixture = load_fixture("event_calendar_full.json")
        valid_criticality = {"Blocking", "Critical", "Routine", None}

        for event in fixture["events"]:
            crit = event.get("criticality")
            assert crit in valid_criticality, \
                f"Event {event['key']} has invalid criticality: {crit}"

    def test_status_enum_values(self, schema):
        """Verify status values match enum."""
        fixture = load_fixture("event_calendar_full.json")
        valid_status = {"Open", "Closed", "Completed", "Delegated", "Rejected"}

        for event in fixture["events"]:
            status = event.get("status")
            assert status in valid_status, \
                f"Event {event['key']} has invalid status: {status}"

    def test_category_enum_values(self, schema):
        """Verify category values match enum."""
        fixture = load_fixture("event_calendar_full.json")
        valid_category = {"rfi", "production", "acquisition", "satellite"}

        for event in fixture["events"]:
            cat = event.get("category")
            assert cat in valid_category, \
                f"Event {event['key']} has invalid category: {cat}"

    def test_datatake_ids_is_array(self, schema):
        """Verify datatake_ids is always an array."""
        fixture = load_fixture("event_calendar_full.json")

        for event in fixture["events"]:
            datatake_ids = event.get("datatake_ids")
            assert isinstance(datatake_ids, list), \
                f"Event {event['key']}: datatake_ids must be array"

    def test_associated_datatake_count_matches_length(self, schema):
        """Verify associated_datatake_count matches datatake_ids length."""
        fixture = load_fixture("event_calendar_full.json")

        for event in fixture["events"]:
            count = event.get("associated_datatake_count", 0)
            actual = len(event.get("datatake_ids", []))
            assert count == actual, \
                f"Event {event['key']}: count {count} != len(datatake_ids) {actual}"

    def test_empty_description_allowed(self, schema):
        """Verify empty description strings are valid."""
        fixture = load_fixture("event_calendar_full.json")

        # Should have at least one event with empty description
        has_empty = any(e.get("description") == "" for e in fixture["events"])
        assert has_empty, "Fixture should include at least one event with empty description"

    def test_data_id_format(self, schema):
        """Verify data_id follows artifact_ prefix pattern."""
        fixture = load_fixture("event_calendar_full.json")

        data_id = fixture.get("data_id")
        assert data_id is not None
        assert data_id.startswith("artifact_")
        assert len(data_id) > len("artifact_")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
