import unittest

from apps.models.anomalies import _build_datatakes_completeness, normalize_anomaly_key


class NormalizeAnomalyKeyTest(unittest.TestCase):
    def test_legacy_prefix_is_rewritten(self):
        self.assertEqual(normalize_anomaly_key("PDGSANOM-11869"), "GSANOM-11869")

    def test_canonical_prefix_unchanged(self):
        self.assertEqual(normalize_anomaly_key("GSANOM-11869"), "GSANOM-11869")

    def test_unrelated_key_unchanged(self):
        self.assertEqual(normalize_anomaly_key("FOO-123"), "FOO-123")

    def test_none_and_empty_are_safe(self):
        self.assertIsNone(normalize_anomaly_key(None))
        self.assertEqual(normalize_anomaly_key(""), "")

    def test_only_leading_prefix_is_touched(self):
        # "PD" elsewhere in the string must not be altered.
        self.assertEqual(normalize_anomaly_key("GSANOM-PD-5"), "GSANOM-PD-5")


class BuildDatatakesCompletenessTest(unittest.TestCase):
    def test_build_from_environment_when_no_existing(self):
        result = _build_datatakes_completeness("DT1;DT2")
        self.assertEqual(
            result,
            [
                {"datatakeID": "DT1", "L0_": 0, "L1_": 0, "L2_": 0},
                {"datatakeID": "DT2", "L0_": 0, "L1_": 0, "L2_": 0},
            ],
        )

    def test_empty_environment_returns_empty_list(self):
        self.assertEqual(_build_datatakes_completeness(""), [])
        self.assertEqual(_build_datatakes_completeness(None), [])

    def test_skips_empty_segments(self):
        result = _build_datatakes_completeness("DT1;;DT2;")
        self.assertEqual([e["datatakeID"] for e in result], ["DT1", "DT2"])

    def test_merge_preserves_existing_counters(self):
        existing = [
            {"datatakeID": "DT1", "L0_": 5, "L1_": 3, "L2_": 1},
        ]
        result = _build_datatakes_completeness("DT1", existing=existing)
        # The already-computed counters for DT1 must be kept, not reset to zero.
        self.assertEqual(result, [{"datatakeID": "DT1", "L0_": 5, "L1_": 3, "L2_": 1}])

    def test_merge_keeps_existing_and_zeroes_new_ids(self):
        existing = [{"datatakeID": "DT1", "L0_": 5, "L1_": 3, "L2_": 1}]
        result = _build_datatakes_completeness("DT1;DT2", existing=existing)
        self.assertEqual(
            result,
            [
                {"datatakeID": "DT1", "L0_": 5, "L1_": 3, "L2_": 1},
                {"datatakeID": "DT2", "L0_": 0, "L1_": 0, "L2_": 0},
            ],
        )

    def test_merge_drops_ids_no_longer_in_environment(self):
        existing = [
            {"datatakeID": "DT1", "L0_": 5, "L1_": 3, "L2_": 1},
            {"datatakeID": "DT2", "L0_": 9, "L1_": 9, "L2_": 9},
        ]
        result = _build_datatakes_completeness("DT1", existing=existing)
        self.assertEqual(result, [{"datatakeID": "DT1", "L0_": 5, "L1_": 3, "L2_": 1}])

    def test_merge_accepts_string_repr_of_existing(self):
        # The DB stores the field as the str() of a list (single-quoted repr).
        existing = "[{'datatakeID': 'DT1', 'L0_': 5, 'L1_': 3, 'L2_': 1}]"
        result = _build_datatakes_completeness("DT1", existing=existing)
        self.assertEqual(result, [{"datatakeID": "DT1", "L0_": 5, "L1_": 3, "L2_": 1}])

    def test_merge_tolerates_malformed_existing_string(self):
        result = _build_datatakes_completeness("DT1", existing="not-a-list")
        self.assertEqual(result, [{"datatakeID": "DT1", "L0_": 0, "L1_": 0, "L2_": 0}])


if __name__ == "__main__":
    unittest.main()
