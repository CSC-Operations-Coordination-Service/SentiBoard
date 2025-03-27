import logging
import os
import unittest
from apps.ingestion.acq_plan_fragments import AcqPlanFragments, S1MissionAcqPlanLoader, S2MissionAcqPlanLoader
from apps.ingestion.acq_plan_geo_fragments import AcqPlanGeoPlacemarks


class AcqPlanGeoPlacemarksTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.kml_filenames = ["S1A_MP_USER_20230607T174000_20230627T194000.kml",
                           "S1A_MP_USER_20230609T174000_20230629T194000.kml",
                            "S1A_MP_USER_20230613T174000_20230703T194000.kml",
                            "S1A_MP_USER_20230614T174000_20230704T194000.kml"]
        cls.s2_kml_filenames = [
            "S2A_MP_ACQ__KML_20230615T120000_20230703T150000.kml"
        ]
        cls.kml_path = "./test_acqplan_kml"

    def setUp(self) -> None:
        logging.basicConfig(handlers=[logging.FileHandler("unittest.log"),
                                      logging.StreamHandler()],
                            level=logging.DEBUG,
                            format=' %(asctime)s - %(filename)s: %(lineno)s :: %(funcName)20s - %(levelname)s :: %(message)s')

    def load_S1_kml_file(self, frag_mgr: AcqPlanFragments,
                         kmlfile, expected_num):
        kml_fullpath = os.path.join(self.kml_path, kmlfile)
        loader = S1MissionAcqPlanLoader()
        with open(kml_fullpath, 'rb') as kmlf:
            kml_file1 = kmlf.read()
            loader.load_acqplan_kml(kml_file1, frag_mgr)
        self.assertEqual(expected_num, frag_mgr.num_fragments,
                         f"Expected {expected_num} daily fragments")

    def load_S2_kml_file(self, frag_mgr: AcqPlanFragments,
                         kmlfile, expected_num):
        kml_fullpath = os.path.join(self.kml_path, kmlfile)
        loader = S2MissionAcqPlanLoader()
        with open(kml_fullpath, 'rb') as kmlf:
            kml_file1 = kmlf.read()
            loader.load_acqplan_kml(kml_file1, frag_mgr)
        self.assertEqual(expected_num, frag_mgr.num_fragments,
                         f"Expected {expected_num} daily fragments")

    def test_min_lat_placemarks(self):
        max_age = 5
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                           self.kml_filenames[0], 21)

        geo_placemarks = AcqPlanGeoPlacemarks(lat_step=20, lon_step=20)
        geo_placemarks.load_fragments(fragments_manager)
        expected_lat_slots = [-90.0, -70.0, -50.0, -30.0, -10.0, 10.0, 30.0, 50.0, 70.0]
        self.assertListEqual(expected_lat_slots, list(geo_placemarks.lat_slots))

        # Check that Placemark with name 2023-06-07T17:49:47
        # is present in min lat S1 Slot 50.0
        expected_allocation = geo_placemarks._min_lat_placemarks[50.0]['S1A']
        self.assertTrue('2023-06-07T17:49:47' in [str(pm.name) for pm in expected_allocation])

    def test_max_lat_placemarks(self):
        max_age = 5
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                           self.kml_filenames[0], 21)

        geo_placemarks = AcqPlanGeoPlacemarks(lat_step=20, lon_step=20)
        geo_placemarks.load_fragments(fragments_manager)
        expected_lat_slots = [-90.0, -70.0, -50.0, -30.0, -10.0, 10.0, 30.0, 50.0, 70.0]
        self.assertListEqual(expected_lat_slots, list(geo_placemarks.lat_slots))

        # Check that Placemark with name 2023-06-07T17:49:47
        # is present in min lat S1 Slot 50.0
        expected_allocation = geo_placemarks._max_lat_placemarks[50.0]['S1A']
        self.assertTrue('2023-06-07T17:49:47' in [str(pm.name) for pm in expected_allocation])

    def test_min_lon_placemarks(self):
        max_age = 5
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                           self.kml_filenames[0], 21)

        geo_placemarks = AcqPlanGeoPlacemarks(lat_step=20, lon_step=20)
        geo_placemarks.load_fragments(fragments_manager)
        expected_lat_slots = [-90.0, -70.0, -50.0, -30.0, -10.0, 10.0, 30.0, 50.0, 70.0]
        self.assertListEqual(expected_lat_slots, list(geo_placemarks.lat_slots))

        # Check that Placemark with name 2023-06-07T17:49:47
        # is present in min lat S1 Slot 50.0
        expected_allocation = geo_placemarks._min_lon_placemarks[50.0]['S1A']
        self.assertTrue('2023-06-07T17:49:47' in [str(pm.name) for pm in expected_allocation])

    def test_max_lon_placemarks(self):
        max_age = 5
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                           self.kml_filenames[0], 21)

        geo_placemarks = AcqPlanGeoPlacemarks(lat_step=20, lon_step=20)
        geo_placemarks.load_fragments(fragments_manager)
        expected_lat_slots = [-90.0, -70.0, -50.0, -30.0, -10.0, 10.0, 30.0, 50.0, 70.0]
        self.assertListEqual(expected_lat_slots, list(geo_placemarks.lat_slots))

        # Check that Placemark with name 2023-06-07T17:49:47
        # is present in min lat S1 Slot 50.0
        expected_allocation = geo_placemarks._max_lon_placemarks[50.0]['S1A']
        self.assertTrue('2023-06-07T17:49:47' in [str(pm.name) for pm in expected_allocation])

    def test_intersect_rect_overlap(self):
        pass

    def test_intersect_rect_not_overlap(self):
        pass

    def test_intersect_hex_overlap(self):
        pass
    def test_intersect_rect_south_emi(self):
        pass

    def test_intersect_rect_negative_lon(self):
        pass

    def test_intersect_rect_north_pole(self):
        pass

    def test_intersect_rect_enclosing_placemark(self):
        pass

if __name__ == '__main__':
    unittest.main()
