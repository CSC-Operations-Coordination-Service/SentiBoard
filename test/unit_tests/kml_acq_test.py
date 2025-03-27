import gzip
import json
import logging
import math
import os
import unittest
from collections import Counter, defaultdict
from datetime import datetime, timedelta

import time_machine
from lxml import etree
from pykml import parser as KMLparser
from pykml.parser import Schema
from skyfield.toposlib import GeographicPosition, wgs84 as skywgs84
from skyfield.units import Angle

from apps.cache.cache import ConfigCache
from apps.cache.modules.datatakes import _build_datatakes_daily_index
from apps.elastic.modules.datatakes import _get_cds_datatakes, _get_cds_s1s2_datatakes, ELASTIC_TIME_FORMAT, \
    _get_cds_s3_datatakes
from apps.ingestion.acquisition_plans.acq_plan_fragments import AcqPlanFragments, \
    AcqPlanDayFragment, AcqDatatake, DatatakeCompleteness, INTERVAL_TIME_FMT
from apps.ingestion.acquisition_plans.acq_plan_kml_loader import S1MissionAcqPlanLoader, S2MissionAcqPlanLoader
from apps.ingestion.acquisition_plans.fragment_completeness import FragmentCompletenessHandler, \
    MissionDatatakeIdHandler
from apps.ingestion.acquisition_plans.orbit_acquisitions_kml import OrbitAcquisitionKmlFragmentBuilder, \
    _build_datatake_placemark, _points_to_coordinates, build_acquisition_line_placemark
from apps.ingestion.acquisition_plans.orbit_datatake_acquisitions import DatatakeAcquisition, GeographicGeoPoint, \
    OrbitPropagator, AcquisitionLineProfileFromOrbit, OrbitAcquisitionsBuilder, AcquisitionPolygonProfileFromOrbit, \
    OrbitPropagatorSkyfield, GeoPointOperations, swaths, OBSERVATION_END_KEY, OBSERVATION_START_KEY
from apps.ingestion.kml_processor import AcqPlanKmlBuilder
from apps.ingestion.orbit_acquisitions import AcquisitionPlanOrbitDatatakeBuilder, ORBIT_PROPAGATION_STEP


def read_config_file(path, filename):
    filepath = os.path.join(path, filename)
    with open(filepath, 'r') as f:
        array = json.load(f)
    return array


class AcqPlanFragmentsTestCaseBase(unittest.TestCase):
    test_config_path = 'config'
    @classmethod
    def manage_cache_config(cls, environment):
        config = read_config_file(cls.test_config_path,
                                  environment)['config']
        for key in config.keys():
            ConfigCache.store_object(key, config[key])

    @classmethod
    def setUpClass(cls):
        cls.kml_filenames = ["S1A_MP_USER_20230607T174000_20230627T194000.kml",
                             "S1A_MP_USER_20230609T174000_20230629T194000.kml",
                             "S1A_MP_USER_20230613T174000_20230703T194000.kml",
                             "S1A_MP_USER_20230614T174000_20230704T194000.kml"]
        cls.s1_kml_aug_sep_filenames = ["S1A_MP_USER_20230907T174000_20230927T194000.kml",
                                        "S1A_MP_USER_20230908T174000_20230928T194000.kml",
                                        "S1A_MP_USER_20230912T174000_20231002T194000.kml"
                                        ]
        cls.s1_sep_filenames = ["S1A_MP_USER_20230915T174000_20231005T194000.kml.gz",
                                "S1A_MP_USER_20230919T174000_20231009T194000.kml.gz",
                                "S1A_MP_USER_20230920T174000_20231010T194000.kml.gz",
                                "S1A_MP_USER_20230926T174000_20231016T194000.kml.gz"
                                ]
        cls.s2_kml_filenames = [
            "S2A_MP_ACQ__KML_20230601T120000_20230619T150000.kml",
            "S2A_MP_ACQ__KML_20230615T120000_20230703T150000.kml",
            "S2A_MP_ACQ__KML_20230629T120000_20230717T150000.kml"
        ]
        cls.kml_path = "./test_acqplan_kml"

    def setUp(self) -> None:
        self.manage_cache_config('config-test.json')
        test_case = unittest.TestCase.id(self)
        logging.basicConfig(handlers=[logging.FileHandler(f"unittest_{test_case}.log"),
                                      logging.StreamHandler()],
                            level=logging.DEBUG,
                            format=' %(asctime)s - %(filename)s: %(lineno)s :: %(funcName)20s - %(levelname)s :: %(message)s')

    def load_S1_kml_file(self, frag_mgr: AcqPlanFragments,
                         kmlfile, expected_num):
        self.load_S1_kml_file_no_check(frag_mgr, kmlfile)
        self.assertEqual(expected_num, frag_mgr.num_fragments,
                         f"Expected {expected_num} daily fragments")

    def load_S2_kml_file(self, frag_mgr: AcqPlanFragments,
                         kmlfile, expected_num):
        kml_fullpath = os.path.join(self.kml_path, kmlfile)
        print("Loading S2 KML: ", kml_fullpath)
        loader = S2MissionAcqPlanLoader()
        with open(kml_fullpath, 'rb') as kmlf:
            kml_file1 = kmlf.read()
            loader.load_acqplan_kml(kml_file1, frag_mgr)
        self.assertEqual(expected_num, frag_mgr.num_fragments,
                         f"Expected {expected_num} daily fragments")

    def load_S1_kml_file_no_check(self, frag_mgr: AcqPlanFragments,
                         kmlfile):
        kml_fullpath = os.path.join(self.kml_path, kmlfile)
        loader = S1MissionAcqPlanLoader()
        if kmlfile.endswith(".gz"):
            with gzip.open(kml_fullpath, 'rb') as kmlcompr:
                kml_file1 = kmlcompr.read()
        else:
            with open(kml_fullpath, 'rb') as kmlf:
                kml_file1 = kmlf.read()
        loader.load_acqplan_kml(kml_file1, frag_mgr)


class AcqPlanFragmentsTestCase(AcqPlanFragmentsTestCaseBase):
    Datatakes_S1S2_JSON = "KML_TEST_DATATAKES_2023_June.json"
    Datatakes_S1_StartSeptember_JSON = "KML_TEST_DATATAKES_2023_S1_September.json"

    s1_bug_kml_filenames = [ "S1A_MP_USER_20230926T174000_20231016T194000.kml.gz",
                             "S1A_MP_USER_20230920T174000_20231010T194000.kml.gz",
                             "S1A_MP_USER_20230919T174000_20231009T194000.kml.gz",
                             "S1A_MP_USER_20230915T174000_20231005T194000.kml.gz"
        ]

    @time_machine.travel("2023-06-16"
                         " 03:00 +0000")
    def test_kmlAcquisitionExtractDailyFolders(self):
        days_list = ['2023-06-11', '2023-06-12']
        max_age = 5
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], 17)
        for day_str in days_list:
            self.assertTrue(fragments_manager.get_fragment(day_str))

    @time_machine.travel("2023-06-21"
                         " 03:00 +0000")
    def test_kmlS1AcquisitionOrderedPlacemarks(self):
        day = '2023-06-11'
        max_age = 10
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], max_age + 7)
        day_fragment:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list = day_fragment.placemark_list
        self.assertNotEqual(len(pm_list), 0, "No Placemarsk found")
        pm_names_dates = [(pm.name, pm.TimeSpan.end) for pm in pm_list]
        pm_to_sort = pm_names_dates[:]
        pm_to_sort.sort(key=lambda x: x[1])
        self.assertListEqual(pm_names_dates, pm_to_sort, "Placemark List not sorted")
        # TODO: Repeat for S2, repeat for mutiple files with MERGE
        #  (on first day older file, last day older file, last day newer file, first day newr file, full day common to the two files

    @time_machine.travel("2023-06-21"
                         " 03:00 +0000")
    def test_kmlS1MultipleKmlOrderedPlacemarks(self):
        day = '2023-06-11'
        max_age = 10
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], max_age + 7)
        day_fragment:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list1 = day_fragment.placemark_list
        self.assertNotEqual(len(pm_list1), 0, "No Placemarsk found")
        pm_names_dates1 = [(pm.name, pm.TimeSpan.end) for pm in pm_list1]
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[1], max_age + 9)
        day_fragment2:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list2 = day_fragment2.placemark_list
        self.assertNotEqual(len(pm_list2), 0, "No Placemarsk found")
        pm_names_dates2 = [(pm.name, pm.TimeSpan.end) for pm in pm_list2]
        #self.assertListEqual(pm_names_dates1, pm_names_dates2[:len(pm_names_dates1)],
        # "Placemark list should remain after loading second file")
        pm_to_sort = pm_names_dates2[:]
        pm_to_sort.sort(key=lambda x : x[1])
        print("Placemark Names lits: ", pm_names_dates2)
        print("Placemark Sorted: ", pm_to_sort)
        self.assertListEqual(pm_names_dates2, pm_to_sort, "Placemark List not sorted")
        # TODO: Repeat for S2, repeat for mutiple files with MERGE (on first day older file, last day older file, last day newer file, first day newr file, full day common to the two files

    def test_kml_endSeptMultipleDatatakesBug(self):
        # Load multiple KML (some are compressed with gzip)
        # Check that no reptetioiin Placemark ID is present for
        # 26 Septembre

        pass

    @time_machine.travel("2023-07-01"
                         " 03:00 +0000")
    def test_kmlS2AcquisitionOrderedPlacemarks(self):
        day = '2023-06-21'
        max_age = 10
        fragments_manager = AcqPlanFragments("kmltest", "S2A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S2_kml_file(fragments_manager,
                           self.s2_kml_filenames[1], max_age + 3)
        day_fragment:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list = day_fragment.placemark_list
        self.assertNotEqual(len(pm_list), 0, "No Placemarks found")
        pm_names_dates = [(pm.name, pm.TimeSpan.end) for pm in pm_list]
        pm_to_sort = pm_names_dates[:]
        pm_to_sort.sort(key=lambda x : x[1])
        self.assertListEqual(pm_names_dates, pm_to_sort, "Placemark List not sorted")
        # TODO: Repeat for S2, repeat for mutiple files with MERGE (on first day older file, last day older file, last day newer file, first day newr file, full day common to the two files

    @time_machine.travel("2023-07-01"
                         " 03:00 +0000")
    def test_kmlS2MultipleKmlOrderedPlacemarks(self):
        day = '2023-06-30'
        max_age = 10
        fragments_manager = AcqPlanFragments("kmltest", "S2A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S2_kml_file(fragments_manager,
                              self.s2_kml_filenames[2], 19)
        day_fragment:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list1 = day_fragment.placemark_list
        self.assertNotEqual(len(pm_list1), 0, "No Placemarks found")
        pm_names_dates1 = [(pm.name, pm.TimeSpan.end) for pm in pm_list1]
        # Expected num fragments includes previous number + new fragments
        self.load_S2_kml_file(fragments_manager,
                              self.s2_kml_filenames[1], 19 + 8)
        day_fragment2:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list2 = day_fragment2.placemark_list
        self.assertNotEqual(len(pm_list2), 0, "No Placemarks found")
        pm_names_dates2 = [(pm.name, pm.TimeSpan.end) for pm in pm_list2]
        #self.assertListEqual(pm_names_dates1, pm_names_dates2[:len(pm_names_dates1)], "Placemark list should remain after loading second file")
        pm_to_sort = pm_names_dates2[:]
        pm_to_sort.sort(key=lambda x : x[1])
        print("Placemark Names lits: ", pm_names_dates2)
        print("Placemark Sorted: ", pm_to_sort)
        self.assertListEqual(pm_names_dates2, pm_to_sort, "Placemark List not sorted")

    @time_machine.travel("2023-07-01"
                         " 03:00 +0000")
    def test_kmlS2MultipleKmlNoDupPlacemarks(self):
        day = '2023-06-30'
        max_age = 10
        fragments_manager = AcqPlanFragments("kmltest", "S2A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S2_kml_file(fragments_manager,
                              self.s2_kml_filenames[2], 19)
        day_fragment:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list1 = day_fragment.placemark_list
        self.assertNotEqual(len(pm_list1), 0, "No Placemarks found")

        # Expected num fragments includes previous number + new fragments
        self.load_S2_kml_file(fragments_manager,
                              self.s2_kml_filenames[1], 19 + 8)
        day_fragment2:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list2 = day_fragment2.placemark_list
        self.assertNotEqual(len(pm_list2), 0, "No Placemarks found")
        pm_names = [pm.name for pm in pm_list2]
        print("Placemark Names list: ", pm_names)
        # Remove duplicates using a set
        pm_unique_names = set(pm_names)
        self.assertEqual(len(pm_names), len(pm_unique_names), "Placemark List has duplicates")

    @time_machine.travel("2023-09-26"
                         " 18:00 +0000")
    def test_kmlS1MultipleKmlNoDupPlacemarksSeptBug(self):
        day = '2023-09-26'
        max_age = 15
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file_no_check(fragments_manager,
                              self.s1_bug_kml_filenames[0])

        # Expected num fragments includes previous number + new fragments
        self.load_S1_kml_file_no_check(fragments_manager,
                              self.s1_bug_kml_filenames[1])
        self.load_S1_kml_file_no_check(fragments_manager,
                              self.s1_bug_kml_filenames[2])
        self.load_S1_kml_file_no_check(fragments_manager,
                              self.s1_bug_kml_filenames[3])
        day_fragment:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list2 = day_fragment.placemark_list
        self.assertNotEqual(len(pm_list2), 0, "No Placemarks found")
        pm_names = [pm.name for pm in pm_list2]
        # print("Placemark Names list: ", pm_names)
        # Remove duplicates using a set
        pm_unique_names = set(pm_names)
        self.assertEqual(len(pm_names), len(pm_unique_names), "Placemark List has duplicates")
        # Retrieve Datatake IDS, and chkce there are no duplicates
        mission_dt_ids = MissionDatatakeIdHandler('S1')
        id_key = mission_dt_ids.datatake_id_key
        acq_list = [AcqDatatake(pm, id_key) for pm in pm_list2]
        acq_id_list = [acq.datatake_id for acq in acq_list]
        acq_unique_ids = set(acq_id_list)
        # print("Lista Acquisition Id ", acq_id_list)
        # print("Lista Unique     IDS ", sorted(list(acq_unique_ids)))
        discriminator = defaultdict(list)
        for acq in acq_list:
            discriminator[acq.datatake_id].append(acq.name)
        # print(discriminator)
        duplicates = [(acq_id, acq_names_list)
                      for acq_id, acq_names_list
                      in discriminator.items()
                      if len(acq_names_list) > 1]
        print("Duplicati: ", duplicates)
        self.assertEqual(len(acq_list), len(acq_unique_ids), "Acquisition List has duplicates")


    @unittest.skip("Code not implemented")
    @time_machine.travel("2023-06-16"
                         " 03:00 +0000")
    def test_kmlAcquisitionExtractDayPlacemarks(self):
        day = '2023-06-11'
        max_age = 5
        satellite = 'SA'
        fragments_manager = AcqPlanFragments("kmltest", satellite, max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], 17)
        day_fragment:  AcqPlanDayFragment = fragments_manager.get_fragment(day)
        pm_list = day_fragment.placemark_list
        self.assertNotEquals(len(pm_list), 0, "No Placemarks found")
        searched_pm = day_fragment.get_placemark_by_id('DatatakeId', "5E29E")
        self.assertIsNotNone(searched_pm, "No Placemark found with ID 5E29E")


    @time_machine.travel("2023-06-30"
                         " 03:00 +0000")
    def test_kmlS2AcquisitionExtractDailyFolders(self):
        days_list = ['2023-06-29', '2023-06-30']
        max_age = 5
        fragments_manager = AcqPlanFragments("s2kmltest", "S2A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S2_kml_file(fragments_manager,
                              self.s2_kml_filenames[0], 8)
        for day_str in days_list:
            self.assertTrue(fragments_manager.get_fragment(day_str))

    @unittest.skip('Test to be designed')
    def test_kmlMergeErrorFoldersDifferentDays(self, daily_fragments):
        pass

    @unittest.skip('Test to be designed')
    def test_kmlMergeDailyFolders(self, daily_fragments):
        # First File: 20230607T174000_20230627T194000
        # Second FIle: 20230609T174000_20230629T194000
        # Only in first File: 20230607T174000, 20230608
        #  Shared: 20230609 : First file only 20230609T000000 - T174000
        #               common 20230609T174001 - 2023
        max_age = 5
        fragment_table = AcqPlanFragments("kmltest", "S1A", max_age)
        # Load Kml 1 fragments
        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[0], 21)
        # Load Kml 2 fragments
        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[1], 23)
        # for each fragment in fragment table.
        # check if not already present

        # Compute expected interval intersection
        # check that for each day in Interval intersection, the corresponding folder is full
        # Count placemarks inside the folders
        # Check that placemark are sorted
        # check that placemark are without holes

    def kml_getFragmentsForDay(self, day_str):
        # Create a fragment from a KML file
        # Create a second fragment
        # merge the second fragment on the first one
        # Perform checks on the first fragment
        max_age = 5
        older_fragment_table = AcqPlanFragments("kmltest1", "S1A", max_age)
        # Load Kml 1 fragments
        self.load_S1_kml_file(older_fragment_table,
                              self.kml_filenames[0], 21)
        # Load Kml 2 fragments
        newer_fragment_table = AcqPlanFragments("kmltest2", "S1A", max_age)
        self.load_S1_kml_file(newer_fragment_table,
                              self.kml_filenames[1], 21)
        older_day_fragment = older_fragment_table.get_fragment(day_str)
        self.assertIsNotNone(older_day_fragment)
        newer_day_fragment = newer_fragment_table.get_fragment(day_str)
        self.assertIsNotNone(newer_day_fragment)
        older_day_fragment.merge(newer_day_fragment)
        return older_day_fragment

    @unittest.skip('To Be implemented')
    def test_kmlFolderMergeBothFullDay(self):
        # Execute MERGE of the two fragments
        #   Test : day coverage is the sum of the two fragments coverage
        #   Number of placemarks in fragment is the sum of the two fragments

        merged_frag = self.kml_getFragmentsForDay("2023-06-11")
        # Check that no duplicate placemark are present
        # All placemarks in Merged fragment shall come from newer KML (second one)
        pass

    @unittest.skip('To Be implemented')
    def test_kmlFolderMergeSecondPartialDay(self):
        # first day of second file
        # it should inlcude first part of day from first file
        #    second part of day from second file
        merged_frag = self.kml_getFragmentsForDay("2023-06-09")
        # Check that no duplicate placemark are present
        # check that placemark are present for all day
        # check that placemark from start of second KML day start were selected.

        pass

    #@unittest.skip('To Be implemented')
    def test_kmlFolderMergeFirstPartialDay(self):
        # Last day of first file
        # it should include all placemarks from second file
        # since it is fully contained in second file
        merged_frag = self.kml_getFragmentsForDay("2023-06-27")
        # Get Placemark list under Satellite folder
        placemark_names = merged_frag.placemark_names
        # Check that no duplicate placemark are present
        num_placemakrs = len(placemark_names)
        num_different_placemarks = len(set(placemark_names))
        print("Duplicated dates: ", [name for name, count in Counter(placemark_names).items() if count > 1])
        self.assertEqual(num_different_placemarks, num_placemakrs, f"Expected {num_different_placemarks}, found {num_placemakrs}")
        # TODO check that placemark are present for all day
        # TODO check that placmark come all from second KML .

    @time_machine.travel("2023-06-21"
                         " 03:00 +0000")
    def test_kmlAcquisitionBuildFromDailyFolders(self):
        max_age = 11
        kml_title = "KmlFromDailyFolders"
        # Load Kml 1 fragments
        fragment_table = AcqPlanFragments("kmltest", "S1A", max_age)

        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[0], max_age + 7)
        day_list = ["2023-06-10", "2023-06-11"]
        # Test that a kml file is built
        # test that kml file contains folders for each day in day_list
        # test also time interval for each day
        kml_builder = AcqPlanKmlBuilder(kml_title, 'S1')
        for day_str in day_list:
            day_folder = fragment_table.get_fragment(day_str)
            kml_builder.add_folder(day_folder)
        # Close KML file
        print(kml_builder.to_string())

        # Get KML String
        #  Search for KML substrings according to expected results
        # Parse with PyKml and check contained objects

        # Check resut: Compare with saved KML file contents
        kml_builder_s2 = AcqPlanKmlBuilder(kml_title, 'S2')
        for day_str in day_list:
            day_folder = fragment_table.get_fragment(day_str)
            kml_builder.add_folder(day_folder)


    @time_machine.travel("2023-06-21"
                         " 03:00 +0000")
    def test_kmlLoadOneFile(self):
        max_age = 5
        fragment_table = AcqPlanFragments("kmltest", "S1A", max_age)

        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[0], max_age + 7)

    @time_machine.travel("2023-06-21"
                         " 03:00 +0000")
    def test_kmlLoadTwoFiles(self):

        max_age = 5
        fragment_table = AcqPlanFragments("kmltest", "S1A", max_age)

        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[0], max_age + 7)
        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[1], max_age + 9)
        # Check that no duplicate days are present in fragment table
        num_fragments = fragment_table.num_fragments
        fragments_days = set(fragment_table.day_list)
        self.assertEqual(len(fragments_days), num_fragments,
                         f"Number of fragments ({num_fragments} different from number of days ( {len(fragments_days)})")

    # def test merge two files:
    # Test on 09/06 ( first day second file, contained in first file)
    # Test on 10/06 --- 26/06 : days contained fully in both files
    # Test on 27/06: day contained partially in first file and fully in second file

    @time_machine.travel("2023-06-11 03:00 +0000")
    def test_purgeByAge(self):
        max_age = 5
        fragment_table = AcqPlanFragments("kmltest", 'S1A', max_age)
        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[0], 21)
        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[1], 23)
        # TODO: Add a Mock for datetime, setting current date to 2023-06-11
        fragment_table.purge_by_age(2)
        self.assertEquals(fragment_table.num_fragments, 21)
        self.assertIsNotNone(fragment_table.get_fragment('2023-06-10'))
        with self.assertRaises(Exception):
            fragment_table.get_fragment('2023-06-08')

    def _generateKmlOneDay(self, day_str):
        max_age = 5
        fragment_table = AcqPlanFragments("kmltest", "S1A", max_age)
        self.load_S1_kml_file(fragment_table,
                              self.kml_filenames[0], 21)
        processor = AcqPlanKmlBuilder("TestOneDayKml", 'S1')

        day_kml_folder = fragment_table.get_fragment(day_str)
        processor.add_folder(day_kml_folder)
        # Vaidate KML
        kml_str = processor.to_string()
        generated_doc = KMLparser.fromstring(kml_str)
        schema_ogc = Schema("ogckml22.xsd")
        #print(etree.tostring(generated_doc, pretty_print=True))
        et = etree.ElementTree(generated_doc)
        et.write('extract_one_day.kml', pretty_print=True)
        if not schema_ogc.validate(generated_doc):
            schema_ogc.assertValid(generated_doc)
        self.assertTrue(schema_ogc.validate(generated_doc),
                     "Generated KML was not valid for OGC")
        return generated_doc

    @unittest.skip("Incomplete definition")
    def test_kmlExtractFirstDaySecondFile(self):
        gen_kml = self._generateKmlOneDay('2023-06-09')
        # Check contents of generated KML
        # If sorted


def _retrieve_elastic_datatakes(datatakes_path, json_file):
    """
    Utility to access datatakes information from elastic and save
    it on JSON (after having computed Completeness)
    Returns:

    """
    start_date = datetime.strptime('2023-06-07', '%Y-%m-%d')

    end_date = datetime.strptime('2023-06-28', '%Y-%m-%d')

    # Retrieve datatakes, Then apply Completness computation
    end_date_str = end_date.strftime('%d-%m-%Y')
    start_date_str = start_date.strftime('%d-%m-%Y')
    dt_interval = _get_cds_s1s2_datatakes(start_date_str, end_date_str)
    #compute_datatakes_completeness_status(dt_interval)
    # Save on JSON FILE Datatakes_S1S2_JSON
    json_path = os.path.join(datatakes_path,
                             json_file)
    with open(json_path, "w") as json_o:
        json.dump(dt_interval, json_o,)


class AcqPlanFragmentsCompletenessTestCase(AcqPlanFragmentsTestCaseBase):
    Datatakes_S1S2_JSON = "KML_TEST_DATATAKES_2023_June.json"
    Datatakes_S1_StartSeptember_JSON = "KML_TEST_DATATAKES_2023_S1_September.json"
    Datatakes_S1_EndSeptember_JSON = "KML_TEST_DATATAKES_2023_S1_EndSeptember.json"

    @classmethod
    def setUpClass(cls):
        # Execute setup CLass from base class
        super(AcqPlanFragmentsCompletenessTestCase, cls).setUpClass()
        cls.datatakes_path = "./test_datatakes"

    def _setup_datatakes_from_Json(self, json_file):
        json_path = os.path.join(self.datatakes_path,
                                 json_file)
        with open(json_path, "r") as json_i:
            dt_last_30d = json.load(json_i)
        return dt_last_30d

    def _setup_datatakes_S1_table(self, json_file):
        # This Json File contains datatakes taken from Elastic
        dt_on_interval = self._setup_datatakes_from_Json(json_file)
        daily_datatakes = _build_datatakes_daily_index(dt_on_interval)
        return daily_datatakes

    def _setup_datatakes_S1_kml(self):
        # Read Datatakes Json File
        # Read from JSON FILE Datatakes_S1S2_JSON
        # dt_last_30d
        dt_last_30d = self._setup_datatakes_from_Json(self.Datatakes_S1S2_JSON)
        return _build_datatakes_daily_index(dt_last_30d)

    def _kmlS1DatatakePartial(self, day, dt_id):
        max_age = 8
        mission = 'S1'
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        # self.datatake_id_decoder = mission_id_hnd.datatake_id_decoder
        datatake_id_key = mission_id_hnd.datatake_id_key
        daily_datatakes = self._setup_datatakes_S1_table(self.Datatakes_S1S2_JSON)

        print("Daily Datatakes keys: ", list(daily_datatakes.keys()))
        # 2. build datatkes index by day and id
        # Import AcqPlan KML
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.s1_kml_aug_sep_filenames[2], 21)
        self.load_S1_kml_file(fragments_manager,
                              self.s1_kml_aug_sep_filenames[1], 25)
        satellite = 'S1A'

        # Fill KML fragments with Datatake Completeness
        # browse sat fragments
        acq_day = day
        day_fragment = fragments_manager.get_fragment(acq_day)
        # Extract datatakes with completenes data
        # from  cache
        day_datatakes = daily_datatakes.get(acq_day)
        self.assertIsNotNone(day_datatakes, f"Not found datatakes for day {acq_day}")
        self.assertEqual(dict, type(day_datatakes),
                         "Day datatakes is not a Dict")
        print("Datatakes satellites for day ", acq_day, ": ", list(day_datatakes.keys()))
        day_sat_datatakes = day_datatakes.get(satellite)
        print("S1 Datatake IDS for day ", acq_day, ":", list(day_sat_datatakes.keys()))

        id_decoder = mission_id_hnd.datatake_id_decoder
        FragmentCompletenessHandler._load_datatake_completeness_on_placemarks(day_sat_datatakes,
                                                                              day_fragment,
                                                                              satellite,
                                                                              datatake_id_key, id_decoder)
        # TODO: Check taht pmocleteness has been loaded on KML fragments
        one_fragment: AcqPlanDayFragment = fragments_manager.get_fragment(day)

        # Search 396839  Datatke both in Fragment and in datatakes for day
        id_key = mission_id_hnd.datatake_id_key
        # Get first datatake in day_sat_datatakes with id: S1A-

        self.assertTrue(dt_id in day_sat_datatakes.keys(), f"No Datatatake found from Elastic with id {dt_id}")
        # take first placemark with id dt_id
        for pm in one_fragment.placemark_list:
            acq_dt = AcqDatatake(pm, id_key)
            if acq_dt.datatake_id == dt_id:
                break
            self.assertIsNotNone(acq_dt)
            print("Selected placemark has extended data: ", list(pm.ExtendedData.Data))
            for data_rec in pm.ExtendedData.Data:
                print("Data Record with name  ", data_rec.attrib['name'], "has value ", data_rec.value.text)
            acq_dt_status = acq_dt.get_data_record(acq_dt.PUB_STATUS_LABEL)
            self.assertTrue(acq_dt_status.value.text.startswith(DatatakeCompleteness.PARTIAL_STATUS),
                            "Acquistiion Placemark has not Partial Status")

    @time_machine.travel("2023-09-15"
                         " 03:00 +0000")
    def test_kmlS1DatatakePartial1(self):
        day = '2023-09-12'
        dt_id = 'S1A-396839'
        self._kmlS1DatatakePartial(day, dt_id)

    @time_machine.travel("2023-09-15"
                         " 03:00 +0000")
    def test_kmlS1DatatakePartial2(self):
        day = '2023-09-11'
        dt_id = 'S1A-396691'
        self._kmlS1DatatakePartial(day, dt_id)

    @time_machine.travel("2023-06-16"
                         " 03:00 +0000")
    def test_kmlDatatakeCompletenessSteps(self):
        day = '2023-06-11'
        max_age = 5
        mission = 'S1'
        #daily_datatakes = self._old_setup_datatakes()
        daily_datatakes = self._setup_datatakes_S1_kml()
        print("Daily Datatakes keys: ", list(daily_datatakes.keys()))
        # 2. build datatkes index by day and id
        # Import AcqPlan KML
        satellite = 'S1A'
        fragments_manager = AcqPlanFragments("kmltest", satellite, max_age)
        fragments_table = {satellite: fragments_manager}
        completenessHandler = FragmentCompletenessHandler(mission, fragments_table,
                                                          daily_datatakes)
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        # self.datatake_id_decoder = mission_id_hnd.datatake_id_decoder
        datatake_id_key = mission_id_hnd.datatake_id_key
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], 17)

        # Fill KML fragments with Datatake Completeness
        # browse sat fragments
        fragment_days = fragments_manager.day_list
        for acq_day in fragment_days:
            print("Processing day: ", acq_day)
            # each sat_frament is a folder related to a single day
            day_fragment = fragments_manager.get_fragment(acq_day)
            # Extract datatakes with completenes data
            # from  cache
            day_datatakes = daily_datatakes.get(acq_day)
            self.assertIsNotNone(day_datatakes, f"Not found datatakes for day {acq_day}")
            self.assertEqual(dict, type(day_datatakes),
                             "Day datatakes is not a Dict")
            print("Datatakes satellties for day ", acq_day, ": ", list(day_datatakes.keys()))
            day_sat_datatakes = day_datatakes.get(satellite)
            print("S1 Datatake IDS for day ", acq_day, ":", list(day_sat_datatakes.keys()))
            id_decoder = mission_id_hnd.datatake_id_decoder
            completenessHandler._load_datatake_completeness_on_placemarks(day_sat_datatakes,
                                                                          day_fragment,
                                                                          satellite,
                                                                          datatake_id_key, id_decoder)
            # TODO: Check taht pmocleteness has been loaded on KML fragments
        one_fragment: AcqPlanDayFragment = fragments_manager.get_fragment(day)
        # take first placemark
        first_pm = one_fragment.placemark_list[0]
        self.assertIsNotNone(first_pm)
        print("First placemark has extended data: ", list(first_pm.ExtendedData.Data))
        for data_rec in first_pm.ExtendedData.Data:
            print("Data Record with name  ", data_rec.attrib['name'], "has value ", data_rec.value.text)
        self.assertTrue(any([_pmdata.attrib['name'].startswith('Acquisition')
                             for _pmdata in first_pm.ExtendedData.Data]))

    @time_machine.travel("2023-06-16"
                         " 03:00 +0000")
    def test_kmlDatatakeCompleteness(self):
        day = '2023-06-11'
        max_age = 5
        mission = 'S1'
        #daily_datatakes = self._old_setup_datatakes()
        daily_datatakes = self._setup_datatakes_S1_kml()
        print("Daily Datatakes keys: ", list(daily_datatakes.keys()))
        # 2. build datatkes index by day and id
        # Import AcqPlan KML
        satellite = 'S1A'
        sat_fragments_manager = AcqPlanFragments("kmltest", satellite, max_age)
        fragments_table = {satellite: sat_fragments_manager}
        completenessHandler = FragmentCompletenessHandler(mission, fragments_table,
                                                          daily_datatakes)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(sat_fragments_manager,
                              self.kml_filenames[0], 17)

        # Fill KML fragments with Datatake Completeness
        # browse sat fragments
        completenessHandler.set_completeness()
        one_fragment: AcqPlanDayFragment = sat_fragments_manager.get_fragment(day)
        # take first placemark
        first_pm = one_fragment.placemark_list[0]
        self.assertIsNotNone(first_pm)
        print("First placemark has extended data: ", list(first_pm.ExtendedData.Data))
        for data_rec in first_pm.ExtendedData.Data:
            print("Data Record with name  ", data_rec.attrib['name'], "has value ", data_rec.value.text)
        self.assertTrue(any([_pmdata.attrib['name'].startswith('Acquisition')
                             for _pmdata in first_pm.ExtendedData.Data]))

    @time_machine.travel("2023-06-16"
                         " 03:00 +0000")
    def test_kmlDatatakeCompletenessStyle(self):
        day = '2023-06-11'
        max_age = 5
        mission = 'S1'
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        # self.datatake_id_decoder = mission_id_hnd.datatake_id_decoder
        datatake_id_key = mission_id_hnd.datatake_id_key
        #daily_datatakes = self._old_setup_datatakes()
        daily_datatakes = self._setup_datatakes_S1_kml()
        print("Daily Datatakes keys: ", list(daily_datatakes.keys()))
        # 2. build datatkes index by day and id
        # Import AcqPlan KML
        fragments_manager = AcqPlanFragments("kmltest", "S1A", 17)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], 21)
        satellite = 'S1A'

        # Fill KML fragments with Datatake Completeness
        # browse sat fragments
        fragment_days = fragments_manager.day_list
        for acq_day in fragment_days:
            print("Processing day: ", acq_day)
            # each sat_frament is a folder related to a single day
            day_fragment = fragments_manager.get_fragment(acq_day)
            # Extract datatakes with completenes data
            # from  cache
            day_datatakes = daily_datatakes.get(acq_day)
            self.assertIsNotNone(day_datatakes, f"Not found datatakes for day {acq_day}")
            self.assertEqual(dict, type(day_datatakes),
                             "Day datatakes is not a Dict")
            print("Datatakes satellties for day ", acq_day, ": ", list(day_datatakes.keys()))
            day_sat_datatakes = day_datatakes.get(satellite)
            print("S1 Datatake IDS for day ", acq_day, ":", list(day_sat_datatakes.keys()))
            id_decoder = mission_id_hnd.datatake_id_decoder
            FragmentCompletenessHandler._load_datatake_completeness_on_placemarks(day_sat_datatakes,
                                                                                  day_fragment,
                                                                                  satellite,
                                                                                  datatake_id_key, id_decoder)
            # TODO: Check taht pmocleteness has been loaded on KML fragments
        one_fragment: AcqPlanDayFragment = fragments_manager.get_fragment(day)
        # take first placemark
        first_pm = one_fragment.placemark_list[0]
        self.assertIsNotNone(first_pm)
        print("First placemark has extended data: ", list(first_pm.ExtendedData.Data))
        # Check that first pm has style url with a value corresponding to PUB status
        first_style_url = first_pm.styleUrl
        print("StyelURL of first PM: ", first_style_url)
        self.assertTrue(first_style_url in ["PLANNED", "PUBLISHED", "PROGRESS"])
        for data_rec in first_pm.ExtendedData.Data:
            print("Data Record with name  ", data_rec.attrib['name'], "has value ", data_rec.value.text)
        self.assertTrue(any([_pmdata.attrib['name'].startswith('Acquisition')
                             for _pmdata in first_pm.ExtendedData.Data]))

    # Simplify test: U es KML with only one folder, with only two Placemarks
    # Use a Datatakes table with only those two datatakes
    @time_machine.travel("2023-06-21"
                         " 03:00 +0000")
    def test_kml_DatatakeCompletenessResultFile(self):
        day = '2023-06-11'
        max_age = 5
        mission = 'S1'
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        # self.datatake_id_decoder = mission_id_hnd.datatake_id_decoder
        datatake_id_key = mission_id_hnd.datatake_id_key
        #daily_datatakes = self._old_setup_datatakes()
        daily_datatakes = self._setup_datatakes_S1_kml()
        print("Daily Datatakes keys: ", list(daily_datatakes.keys()))
        # 2. build datatkes index by day and id
        # Import AcqPlan KML
        fragments_manager = AcqPlanFragments("kmltest", "S1A", max_age)
        # TODO: manage, mission, satellite, day
        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], max_age + 7)
        satellite = 'S1A'

        # Fill KML fragments with Datatake Completeness
        # browse sat fragments
        fragment_days = fragments_manager.day_list
        for acq_day in fragment_days:
            print("Processing day: ", acq_day)
            # each sat_frament is a folder related to a single day
            day_fragment = fragments_manager.get_fragment(acq_day)
            # Extract datatakes with completenes data
            # from  cache
            day_datatakes = daily_datatakes.get(acq_day)
            self.assertIsNotNone(day_datatakes, f"Not found datatakes for day {acq_day}")
            self.assertEqual(dict, type(day_datatakes),
                             "Day datatakes is not a Dict")
            print("Datatakes satellties for day ", acq_day, ": ", list(day_datatakes.keys()))
            day_sat_datatakes = day_datatakes.get(satellite)
            print("S1 Datatake IDS for day ", acq_day, ":", list(day_sat_datatakes.keys()))
            id_decoder = mission_id_hnd.datatake_id_decoder
            FragmentCompletenessHandler._load_datatake_completeness_on_placemarks(day_sat_datatakes,
                                                                                  day_fragment,
                                                                                  satellite,
                                                                                  datatake_id_key, id_decoder)
        kml_builder = AcqPlanKmlBuilder("title", 'S1')
        for day_str in fragment_days:
            day_folder = fragments_manager.get_fragment(day_str)
            kml_builder.add_folder(day_folder)
        # Close KML file
        print(kml_builder.to_string())

        # Get KML String
        #  Search for KML substrings according to expected results
        # Parse with PyKml and check contained objects

    @unittest.skip('Only to generate test data')
    def test_setup(self):
        self._retrieve_elastic_datatakes(self.datatakes_path,
                                         self.Datatakes_S1S2_JSON)

    @unittest.skip('Only to generate test data')
    def test_S1_setup(self):
        self._retrieve_elastic_S1_sept_datatakes()

    @time_machine.travel("2023-06-16"
                         " 03:00 +0000")
    def test_kmlDatatakeExtendedDataEdit(self):
        # day = '2023-06-11'
        max_age = 5
        mission = 'S1'
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        # self.datatake_id_decoder = mission_id_hnd.datatake_id_decoder
        datatake_id_key = mission_id_hnd.datatake_id_key
        satellite = 'S1A'
        fragments_manager = AcqPlanFragments("kmltest", satellite, max_age)
        # TODO: manage, mission, satellite, day

        self.load_S1_kml_file(fragments_manager,
                              self.kml_filenames[0], 17)
        fragment_days = fragments_manager.day_list
        first_day = fragment_days[0]
        print("Processing day: ", first_day)
        # each sat_frament is a folder related to a single day
        day_fragment = fragments_manager.get_fragment(first_day)
        first_pm = day_fragment.placemark_list[0]
        first_dt = AcqDatatake(first_pm, mission_id_hnd.datatake_id_key)
        first_dt.add_data_record('TestData', 'TestValue')
        check_pm = day_fragment.placemark_list[0]
        for data_rec in check_pm.ExtendedData.Data:
            print("Data Record with name  ", data_rec.attrib['name'], "has value ", data_rec.value.text)
        self.assertTrue(any([_pmdata.attrib['name'] == 'TestData'
                             for _pmdata in check_pm.ExtendedData.Data]))

    def _old_setup_datatakes(self):
        # 1. Load datatakes on temp structure
        # Start date 07 / 06 / 2023
        # End Date 27 / 06 /2023
        start_date = datetime.strptime('2023-06-07', '%Y-%m-%d')
        end_date = datetime.strptime('2023-06-28', '%Y-%m-%d')
        dt_interval = _get_cds_datatakes(start_date, end_date)
        # Read From JSON FILE; save on Datatakes CACHE!
        daily_datatakes = _build_datatakes_daily_index(dt_interval)
        return daily_datatakes

    def _retrieve_elastic_S1_sept_datatakes(self):
        """
        Utility to access datatakes information from elastic and save
        it on JSON (after having computed Completeness)
        Returns:

        """
        start_date = datetime.strptime('2023-08-26', '%Y-%m-%d')

        end_date = datetime.strptime('2023-09-17', '%Y-%m-%d')

        # Retrieve datatakes, Then apply Completness computation
        end_date_str = end_date.strftime('%d-%m-%Y')
        start_date_str = start_date.strftime('%d-%m-%Y')
        dt_interval = _get_cds_s1s2_datatakes(start_date_str, end_date_str)
        # compute_datatakes_completeness_status(dt_interval)
        # Save on JSON FILE Datatakes_S1S2_JSON
        json_path = os.path.join(self.datatakes_path,
                                 self.Datatakes_S1_EndSeptember_JSON)
        with open(json_path, "w") as json_o:
            json.dump(dt_interval, json_o, )


class LocalTleRetriever:
    def __init__(self):
        self.orbits_path = "./test_tles"

    def get_tle_data(self, tle_f):
        tle_path = os.path.join(self.orbits_path, tle_f)
        with open(tle_path, 'r') as tle_in:
            lines = tle_in.readlines()
            for line in lines:
                line.strip()
        return lines

satellite_tles = {
    "S3A": "S3A_20231012.tle",
    "S3B": "S3B_20231017.tle",
    "S5P": "S5P_20231017.tle"
}
def mocked_latest_tle(satellite):
    tle_retriever = LocalTleRetriever()
    tle_file = satellite_tles.get(satellite, None)
    if tle_file is not None:
        return tle_retriever.get_tle_data(tle_file)
    else:
        return None


class GeoOperationsTestCase(unittest.TestCase):
    test_config_path = 'config'
    HalfPi = math.pi / 2.0
    PiCircle = 2.0 * math.pi

    @classmethod
    def manage_cache_config(cls, environment):
        config = read_config_file(cls.test_config_path,
                                  environment)['config']
        for key in config.keys():
            ConfigCache.store_object(key, config[key])

    @classmethod
    def setUpClass(cls):
        cls.tle_retriever = LocalTleRetriever()

    def setUp(self) -> None:
        self.manage_cache_config('config-test.json')
        logging.basicConfig(handlers=[logging.FileHandler("unittest.log"),
                                      logging.StreamHandler()],
                            level=logging.DEBUG,
                            format=' %(asctime)s - %(filename)s: %(lineno)s :: %(funcName)20s - %(levelname)s :: %(message)s')
        test_tle_1 = "S3A_20231012.tle"
        tle_data = self.tle_retriever.get_tle_data(test_tle_1)
        self.step = 60
        self.propagator = OrbitPropagatorSkyfield(tle_data,
                                                  step=self.step,
                                                  extra_point=False)

    @staticmethod
    def _value_included(value, first_val, second_val):
        return (first_val < value < second_val) or (first_val > value > second_val)

    @unittest.skip("Not needed")
    def test_angle_range(self):
        ang1 = Angle(radians=0.23)
        self.assertAlmostEqual(0.23, ang1.radians, 2)
        ang2 = Angle(radians=-0.23)
        self.assertAlmostEqual(math.pi - 0.23, ang2.radians, 2)

    def test_point_between_east_west(self):
        time1_str = "2023-10-12T12:21:10.00Z"
        time1 = datetime.strptime(time1_str, "%Y-%m-%dT%H:%M:%S.%fZ")
        interval_len = 40 * self.step
        distance = 5000
        time2 = time1 + timedelta(seconds=interval_len)
        num_points, lla_points = self.propagator.get_orbit_lla_points(time1, time2)
        # Get Fist Point and second point
        point1, point2 = lla_points[0:2]
        print("Firsst Point: ", point1)
        print("Second Point: ", point2)
        # compute orthogonal points
        pnt_ops = GeoPointOperations(point1)
        north_bng = pnt_ops.get_point_north_bearing(point2)
        print("North Bearing: ", north_bng.radians)

        east_rad = north_bng.radians + self.HalfPi
        if east_rad > math.pi:
            east_rad -= self.PiCircle
        elif east_rad < -math.pi:
            east_rad += math.pi
        east_bng =  Angle(radians=east_rad)
        west_rad = north_bng.radians - self.HalfPi
        if west_rad > math.pi:
            west_rad -= self.PiCircle
        elif west_rad < -math.pi:
            west_rad += math.pi

        west_bng = Angle(radians=west_rad)
        east_trg = pnt_ops.get_target(east_bng, distance)
        print("East bearing: ", east_rad, ", point: ", east_trg)
        west_trg = pnt_ops.get_target(west_bng, distance)
        east_trg.degrees_to_radians()
        west_trg.degrees_to_radians()
        print("West bearing: ", west_rad, ", point: ", west_trg)
        # verify that longitude is included either in one or the other direction
        self.assertTrue(self._value_included(point1.longitude.radians, west_trg.lon, east_trg.lon),
                        "Target east/west have not longitude around start point")
        self.assertTrue(self._value_included(point1.latitude.radians, west_trg.lat, east_trg.lat),
                        "Target east/west have not latitude around start point")
        #verify that latitude is included either in one or the other direction (depending on the asc/desc)

    def point_between(self, point1, point2, distance):
        pnt_ops = GeoPointOperations(point1)
        north_bng = pnt_ops.get_point_north_bearing(point2)
        east_rad = north_bng.radians + self.HalfPi
        east_bng =  Angle(radians=east_rad)
        west_rad = north_bng.radians - self.HalfPi
        west_bng = Angle(radians=west_rad)
        east_trg = pnt_ops.get_target(east_bng, distance)
        west_trg = pnt_ops.get_target(west_bng, distance)
        # verify that longitude is included either in one or the other direction
        self.assertTrue(self._value_included(point1.longitude.radians, west_trg.lon, east_trg.lon),
                        "Target east/west have not longitude around start point")
        self.assertTrue(self._value_included(point1.latitude.radians, west_trg.lat, east_trg.lat),
                        "Target east/west have not latitude around start point")

    def test_points_between_on_equator(self):
        distance = 7000
        # Test any point on equator
        point1 = skywgs84.latlon(0.0, 43.0)
        point2 = skywgs84.latlon(12.2, 38.1)
        self.point_between(point1, point2, distance)
        # test any point on equator and near longitude change
        point1 = skywgs84.latlon(0.0, 170.0)
        point2 = skywgs84.latlon(12.10,  -175.0)
        self.point_between(point1, point2, distance)
        # test any point at north pole, elevation=0
        point1 = skywgs84.latlon( 85.0,  120.0)
        point2 = skywgs84.latlon(87.0,  -120.0)
        self.point_between(point1, point2, distance)

class OrbitAcqPlanTestCase(AcqPlanFragmentsTestCaseBase):
    Datatakes_S1S2_JSON = "KML_TEST_DATATAKES_2023_S1_September.json"
    Datatakes_S3_JSON = "KML_TEST_DATATAKES_2023_S3_September.json"
    Datatakes_S3_October_JSON = "KML_TEST_DATATAKES_2023_S3_October.json"
    @classmethod
    def setUpClass(cls):
        # Execute setup CLass from base class
        super(OrbitAcqPlanTestCase, cls).setUpClass()
        cls.datatakes_path = "./test_datatakes"
        cls.tle_retriever = LocalTleRetriever()

    def setUp(self) -> None:
        self.manage_cache_config('config-test.json')
        test_case = unittest.TestCase.id(self)
        logging.basicConfig(handlers=[logging.FileHandler(f"unittest_{test_case}.log"),
                                      logging.StreamHandler()],
                            level=logging.DEBUG,
                            format=' %(asctime)s - %(filename)s: %(lineno)s :: %(funcName)20s - %(levelname)s :: %(message)s')

    def _setup_datatakes_from_Json(self, json_file):
        json_path = os.path.join(self.datatakes_path,
                                 json_file)
        with open(json_path, "r") as json_i:
            dt_last_30d = json.load(json_i)
        return dt_last_30d

    def _setup_datatakes_S1_table(self, json_file):
        # This Json File contains datatakes taken from Elastic
        dt_on_interval = self._setup_datatakes_from_Json(json_file)
        daily_datatakes = _build_datatakes_daily_index(dt_on_interval)
        return daily_datatakes

    def _retrieve_elastic_S3_datatakes(self, fromd, to, outfile):
        """
        Utility to access datatakes information from elastic and save
        it on JSON (after having computed Completeness)
        Returns:

        """
        start_date = datetime.strptime(fromd, '%Y-%m-%d')

        end_date = datetime.strptime(to, '%Y-%m-%d')

        # Retrieve datatakes, Then apply Completness computation
        end_date_str = end_date.strftime('%d-%m-%Y')
        start_date_str = start_date.strftime('%d-%m-%Y')
        dt_interval = _get_cds_s3_datatakes(start_date_str, end_date_str)
        # compute_datatakes_completeness_status(dt_interval)
        # Save on JSON FILE Datatakes_S1S2_JSON
        json_path = os.path.join(self.datatakes_path,
                                 outfile)
        with open(json_path, "w") as json_o:
            json.dump(dt_interval, json_o, )

    @unittest.skip('Only to generate test data')
    def test_S3_setup(self):
        # self._retrieve_elastic_S3_datatakes('2023-08-26',
        #                                     '2023-09-20',
        #                                     self.Datatakes_S3_JSON)
        self._retrieve_elastic_S3_datatakes('2023-09-26',
                                            '2023-10-20',
                                            self.Datatakes_S3_October_JSON)


    def _create_fake_point_list(self):
        points = []

        points.append(GeographicGeoPoint(43.5, 85.73, 0))
        points.append(GeographicGeoPoint(-13.87, 145.143, 20.10))
        points.append(GeographicGeoPoint(76.43, -121.98, 760.860))
        return points

    def test_point_list_string(self):
        # Create a reefence list of Points
        points = self._create_fake_point_list()
        # Convert to a Coordinates String
        coord_str = _points_to_coordinates(points)
        # Check result
        ref_str = "85.73000,43.50000,0 145.14300,-13.87000,20.1 -121.98000,76.43000,760.86"
        self.assertEqual(ref_str, coord_str, "Generated coordinates string not matching")

    def test_build_line_placemark(self):
        mission = 'S1'
        satellite = 'S1A'
        acq_day = "2023-09-03"
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        # Load Datatakes
        # Read JSON datatkes
        daily_datatakes = self._setup_datatakes_S1_table(self.Datatakes_S1S2_JSON)
        day_datatakes = daily_datatakes.get(acq_day)
        sat_datatakes = day_datatakes.get(satellite)

        # Select one dattake
        # Create a Acquisition Dattake
        dt = list(sat_datatakes.values())[0]
        acq_datatake = DatatakeAcquisition(dt)
        # Assign fake Image AcquisitionProfile
        acq_datatake.acquisition_points = self._create_fake_point_list()
        # Generate a line acquisition for the datatake
        # Create the Placemark with the acquistion points
        # Create KML Placemark
        pm = _build_datatake_placemark(acq_datatake, "DT_ID")
        pm.append(build_acquisition_line_placemark(acq_datatake))

        print("Created Placemark with name ", pm.name, " from datatake with id ", acq_datatake.datatake_id)
        # Check contents of KML Placameark
        # check contents of generd KML
        self.assertEqual(acq_datatake.datatake_id, pm.name)
        self.assertEqual(pm.TimeSpan.begin, datetime.strftime(acq_datatake.start_time, INTERVAL_TIME_FMT))
        self.assertIsNotNone(pm.LineString)
        # Check coordinates in pm.linestring
        points_coord_str = _points_to_coordinates(acq_datatake.acquisition_points)
        self.assertEqual(points_coord_str, pm.LineString.coordinates)
        self.assertIsNotNone(pm.LineString.altitudeMode)
        self.assertIsNotNone(pm.LineString.tessellate)

    def test_build_line_fragment_fake_points(self):
        mission = 'S1'
        satellite = 'S1A'
        acq_day = "2023-09-03"
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        fragm_builder = OrbitAcquisitionKmlFragmentBuilder(acq_day,
                                                           satellite)
        # Load Datatakes For Acq day
        # Create N Acquisition Dattake
        # Read JSON datatkes
        daily_datatakes = self._setup_datatakes_S1_table(self.Datatakes_S1S2_JSON)
        day_datatakes = daily_datatakes.get(acq_day)
        sat_datatakes = day_datatakes.get(satellite)

        # Select one dattake
        # Create a Acquisition Dattake
        dt1 = list(sat_datatakes.values())[0]
        acq_datatake1 = DatatakeAcquisition(dt1)
        # Assign fake Image AcquisitionProfile
        acq_datatake1.acquisition_points = self._create_fake_point_list()
        # Generate a line acquisition for the datatake
        # Create the Placemark with the acquistion points
        # Create KML Placemark
        pm1 = _build_datatake_placemark(acq_datatake1, "DT_ID")
        pm1.append(build_acquisition_line_placemark(acq_datatake1))
        # Assign fake Image AcquisitionProfile

        dt2 = list(sat_datatakes.values())[1]
        acq_datatake2 = DatatakeAcquisition(dt2)
        # Assign fake Image AcquisitionProfile
        acq_datatake2.acquisition_points = self._create_fake_point_list()
        # Generate a line acquisition for the datatake
        # Create the Placemark with the acquistion points
        # Create KML Placemark
        pm2 = _build_datatake_placemark(acq_datatake2, "DT_ID")
        pm2.append(build_acquisition_line_placemark(acq_datatake2))

        # Create KML Placemark
        sat_kml_builder = OrbitAcquisitionKmlFragmentBuilder(acq_day, satellite)
        sat_kml_builder.add_to_daily_folder(acq_day, satellite, pm1)
        # Check contents of KML Fragment
        d_frag = AcqPlanDayFragment(acq_day, sat_kml_builder.fragment)
        self.assertEqual(1, len(d_frag.placemark_list))
        sat_kml_builder.add_to_daily_folder(acq_day, satellite, pm2)
        d_frag = AcqPlanDayFragment(acq_day, sat_kml_builder.fragment)
        self.assertEqual(2, len(d_frag.placemark_list))

    def test_tle_two_days_datatakes_to_fragments(self):
        # Take a TLE orbit
        # Take two days of datatakes
        # Create Placemarks for each datatake, combining
        # with Orbit
        # Save placemarks on Daily Fragments
        # Check Fragments Contents (number of Placemarks shall
        #   be the same as number of daily datatakes)
        mission = 'S3'
        satellite = 'S3A'
        acq_days = ["2023-09-03", "2023-09-04"]
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        # Load Datatakes
        # Read JSON datatakes
        daily_datatakes = self._setup_datatakes_S1_table(self.Datatakes_S3_JSON)

        # Take a TLE
        step = 10
        test_tle_1 = "S3A_20231012.tle"
        tle_data = self.tle_retriever.get_tle_data(test_tle_1)
        orbit_propagator = OrbitPropagator(tle_data, step)
        # Instantiate a Orbit Acquisition Builder
        acquisition_builder = AcquisitionLineProfileFromOrbit
        orbit_acq_builder = OrbitAcquisitionsBuilder(satellite,
                                                     tle_data,
                                                     step,
                                                     acquisition_builder)
        for acq_day in acq_days:
            sat_kml_builder = OrbitAcquisitionKmlFragmentBuilder(acq_day, satellite)

            day_datatakes = daily_datatakes.get(acq_day)
            sat_datatakes = day_datatakes.get(satellite)
            for dt_id, dt in sat_datatakes.items():
                acq = DatatakeAcquisition(dt)
                # NOTE: DT Has no Start/End Time
                acq.acquisition_points = orbit_acq_builder.compute_acquisition_points(acq.start_time,
                                                                                      acq.end_time)
                acq_placemark = _build_datatake_placemark(acq, "DT_ID")
                acq_placemark.append(build_acquisition_line_placemark(acq))
                sat_kml_builder.add_to_daily_folder(acq_day, satellite,
                                                    acq_placemark)
            # Perform Checks on result, by reading the fragment
            fragment = sat_kml_builder.fragment
            self.assertEqual(len(sat_datatakes),
                             len(sat_kml_builder.placemark_list))

    def test_orbit_time_interval_to_point_list(self):
        # Take a TLE
        step = 10
        test_tle_1 = "S3A_20231012.tle"
        tle_data = self.tle_retriever.get_tle_data(test_tle_1)
        orbit_propagator = OrbitPropagatorSkyfield(tle_data, step)
        # Instantiate a Orbit Acquisition Builder
        acquisition_builder = AcquisitionLineProfileFromOrbit(orbit_propagator, 10)

        # Specify an Interval (from a Datatake) 2 min long
        date1 = datetime.strptime("2023-10-10T11:23:45.000Z", ELASTIC_TIME_FORMAT)
        date2 = date1 + timedelta(seconds=70)
        # Request the Acquisition  for the interval as a Line
        image_p = acquisition_builder.build_image_profile(date1, date2)
        self.assertEqual(9, len(image_p))
        # Request the Acquisition  for the interval as a Polygon

    def test_orbit_time_interval_to_polygon(self):
        # Take a TLE
        step = 10
        test_tle_1 = "S3A_20231012.tle"
        tle_data = self.tle_retriever.get_tle_data(test_tle_1)
        orbit_propagator = OrbitPropagatorSkyfield(tle_data, step,
                                                   extra_point=True)
        # Instantiate a Orbit Acquisition Builder
        acquisition_builder = AcquisitionPolygonProfileFromOrbit(orbit_propagator, 10)

        # Specify an Interval (from a Datatake) 2 min long
        date1 = datetime.strptime("2023-10-10T11:23:45.000Z", ELASTIC_TIME_FORMAT)
        date2 = date1 + timedelta(seconds=70)
        # Request the Acquisition  for the interval as a Line
        image_p = acquisition_builder.build_image_profile(date1, date2)
        self.assertEqual(18, len(image_p))
        # Request the Acquisition  for the interval as a Polygon

    from unittest.mock import Mock, patch

    # TODO: MOVE TO PYTEST eeds also porting setup datatakes table
    @time_machine.travel("2023-10-12"
                         " 03:00 +0000")
    @patch('apps.ingestion.orbit_acquisitions.get_latest_tle')
    def test_satellite_acq_from_orbit_datatakes(self, mock_tle):
        mission = "S3"
        day = "2023-10-11"
        # Instantiate Fragment Table
        past_num_days = 8
        mission_fragments = {
                sat: AcqPlanFragments(sat, sat, past_num_days)
                for sat in ["S3A"]
            }
        # Take fake datatakes, TLE,
        daily_datatakes = self._setup_datatakes_S1_table(self.Datatakes_S3_October_JSON)

        # Configure the mock to return a value using the local mock function.
        # mock_tle.return_value = mocked_latest_tle
        mock_tle.side_effect = mocked_latest_tle
        #
        # AcquisitionPlanOrbitDatatakeBuilder
        acq_builder = AcquisitionPlanOrbitDatatakeBuilder(mission,
                                                          mission_fragments,
                                                          daily_datatakes)
        acq_builder.retrieve_mission_acq_plans("2023-10-07")
        # Verify contents of generated fragments
        s3a_fragments = mission_fragments.get("S3A")
        self.assertTrue(s3a_fragments.num_fragments > 0)
        print(s3a_fragments.day_list)
        day_fragment = s3a_fragments.get_fragment(day)
        s3a_day_datatakes = daily_datatakes.get(day).get("S3A")
        self.assertEqual(len(day_fragment.placemark_list),
                         len(s3a_day_datatakes))

    @time_machine.travel("2023-10-12"
                         " 03:00 +0000")
    @patch('apps.ingestion.orbit_acquisitions.get_latest_tle')
    def test_extract_polygon_points_orbit_datatakes(self, mock_tle):
        """ Build Reference KML for results analysis from orbit and datatakes"""
        mission = "S3"
        day = "2023-10-11"
        satellite = "S3A"
        # Take fake datatakes, TLE,
        daily_datatakes = self._setup_datatakes_S1_table(self.Datatakes_S3_October_JSON)

        day_dt_list = daily_datatakes.get(day).get(satellite)
        sliced_dt_list = list(day_dt_list.values())[:3]
        daily_datatakes[day][satellite] = {dt['datatake_id'] : dt for dt in sliced_dt_list}
        # Configure the mock to return a value using the local mock function.
        curr_dt = sliced_dt_list[2]
        curr_acq = DatatakeAcquisition(curr_dt)
        # Take First Datatake
        start_time = curr_acq.start_time
        end_time = curr_acq.end_time
        # mock_tle.return_value = mocked_latest_tle
        # mock_tle.side_effect = mocked_latest_tle
        tle_data = mocked_latest_tle(satellite)
        propagator = OrbitPropagatorSkyfield(tle_data, ORBIT_PROPAGATION_STEP, extra_point=True)
        fragment_builder = AcquisitionPolygonProfileFromOrbit(propagator, swaths['S3A'])
        half_swath = swaths[satellite] / 2.0
        HalfPi = math.pi / 2.0
        num_samples, points_list = propagator.get_orbit_lla_points(start_time, end_time)

        for index in range(num_samples):
            # point_vel = velocity_list[index]
            curr_point = points_list[index]
            next_point = points_list[index+1]
            point_ops = GeoPointOperations(curr_point)
            point_north_heading = point_ops.get_point_north_bearing(next_point)
            west_rad = point_north_heading.radians - HalfPi
            w_brng = Angle(radians=west_rad)
            west_end_point = point_ops.get_target(w_brng, half_swath)
            east_rad = point_north_heading.radians + HalfPi
            e_brng = Angle(radians=east_rad)
            east_end_point = point_ops.get_target(e_brng, half_swath)
            print("Orbit: ", curr_point, " East: ", east_end_point, " West: ", west_end_point, "Az: ", point_north_heading)
    # Test on Orbit Datatake Acquisition Builder
    # Mock get_latest_tle

    @time_machine.travel("2023-10-12"
                         " 03:00 +0000")
    @patch('apps.ingestion.orbit_acquisitions.get_latest_tle')
    def test_build_kml_acq_from_orbit_datatakes(self, mock_tle):
        """ Build Reference KML for results analysis from orbit and datatakes"""
        mission = "S3"
        day = "2023-10-11"
        # Instantiate Fragment Table
        past_num_days = 8
        mission_fragments = {
                sat: AcqPlanFragments(sat, sat, past_num_days)
                for sat in ["S3A"]
            }
        satellite = "S3A"
        # Take fake datatakes, TLE,
        daily_datatakes = self._setup_datatakes_S1_table(self.Datatakes_S3_October_JSON)

        day_dt_list = daily_datatakes.get(day).get(satellite)
        sliced_dt_list = list(day_dt_list.values())[:3]
        # Reduce End Time by 45'
        # Or reduce Start Time by 45'
        key = OBSERVATION_START_KEY
        time_op = +1
        for dt in sliced_dt_list:

            time_str = dt[key]
            dt_time = datetime.strptime(time_str, ELASTIC_TIME_FORMAT)
            dt_time = dt_time + time_op * timedelta(minutes=45)
            dt[key] = dt_time.strftime(ELASTIC_TIME_FORMAT)

        daily_datatakes[day][satellite] = {dt['datatake_id'] : dt for dt in sliced_dt_list}
        # Configure the mock to return a value using the local mock function.
        # mock_tle.return_value = mocked_latest_tle
        mock_tle.side_effect = mocked_latest_tle
        #
        # AcquisitionPlanOrbitDatatakeBuilder
        acq_builder = AcquisitionPlanOrbitDatatakeBuilder(mission,
                                                          mission_fragments,
                                                          daily_datatakes)
        acq_builder.retrieve_mission_acq_plans("2023-10-07")

        # Verify contents of generated fragments
        s3a_fragments = mission_fragments.get(satellite)
        completeness_hnd = FragmentCompletenessHandler(mission,
                                                       mission_fragments,
                                                       daily_datatakes)
        completeness_hnd.set_completeness()

        self.assertTrue(s3a_fragments.num_fragments > 0)
        kml_title = f"{mission}_{satellite}_{day}"
        kml_builder = AcqPlanKmlBuilder(kml_title, mission)
        kml_builder.add_folder(s3a_fragments.get_fragment(day))

        filepath = os.path.join(self.kml_path, "S3A_20231011_out_reduced.kml")
        kml_string = kml_builder.to_string()
        with open(filepath, 'wb') as out_kml:
            out_kml.write(kml_string)



if __name__ == '__main__':
    unittest.main()
