import datetime
import functools
import json
import logging
import os
import unittest
import apps.ingestion.news_scraper as scraper
import apps.utils.html_utils as html_utils
from apps.cache.cache import ConfigCache
from apps.ingestion.acq_plan_ingestor import AcqPlanIngestor, \
    select_acq_link_after, select_acq_link_before, select_acq_link_includes_after_n_days_past
from apps.ingestion.acq_link_page import SatelliteAcqPlanLink, AcqLinksTable, AcqPlanLinksPageParser

logger = logging.getLogger(__name__)


def read_config_file(path, filename):
    filepath = os.path.join(path, filename)
    with open(filepath, 'r') as f:
        array = json.load(f)
    return array


class AcqPlanTestCase(unittest.TestCase):
    mission_cfg = {
        "S1": {"S1A": 'sentinel-1a', "S1B": 'sentinel-1b'},
        "S2": {"S2A": 'sentinel-2a', "S2B": 'sentinel-2b'}
    }
    mission_urls = {
        "S1": {
            'latest': "https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-1/observation-scenario/acquisition-segments",
            'archive': "https://sentinels.copernicus.eu/web/sentinel/missions//sentinel-1/observation-scenario/acquisition-segments/archives"
        },
        "S2": {
            'latest': "https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2/acquisition-plans",
            'archive': "https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2/acquisition-plans/archive"
        }
    }
    test_config_path = 'config'

    @classmethod
    def manage_cache_config(cls, environment):
        config = read_config_file(cls.test_config_path,
                                  environment)['config']
        for key in config.keys():
            ConfigCache.store_object(key, config[key])

    @classmethod
    def setUpClass(cls):
        print("Setup Class")
        cls.        ref_url = 'https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-1/observation-scenario/acquisition-segments'


    def setUp(self) -> None:
        logging.basicConfig(handlers=[logging.FileHandler("unittest.log"),
                                      logging.StreamHandler()],
                            level=logging.DEBUG,
                            format=' %(asctime)s - %(filename)s: %(lineno)s :: %(funcName)20s - %(levelname)s :: %(message)s')
        self.manage_cache_config('config-test.json')
        acqplan_links = {
            "S1": AcqLinksTable(),
            "S2": AcqLinksTable()
        }
        acqplan_links["S1"].add_selection_func(select_acq_link_after)
        acqplan_links["S1"].add_selection_func(select_acq_link_before)
        acqplan_links["S2"].add_selection_func(select_acq_link_after)
        acqplan_links["S2"].add_selection_func(select_acq_link_before)
        self._acqplan_links = acqplan_links

    def _get_div_class(self, mission, satellite):
        if mission in self.mission_cfg:
            return self.mission_cfg.get(mission).get(satellite, None)

    def _get_mission_url(self, mission, page_type):
        if mission in self.mission_urls:
            return self.mission_urls.get(mission).get(page_type, None)

    def _scraper_from_file(self, filepath):
        mission_page = ""
        with open(filepath, 'r') as f:
            mission_page = f.read()
        html_page = scraper.ScarperHtml(mission_page)
        self.assertIsNotNone(html_page)  # add assertion here
        return html_page

    def _scraper_from_url(self, url):
        html_page = scraper.ScarperHtml(html_utils.get_html_page(url))
        self.assertIsNotNone(html_page)  # add assertion here
        return html_page

    def testAcqPlanLinkParser(self):
        slink_1 = SatelliteAcqPlanLink("/documents/d/sentinel/s1a_mp_user_20230526t174000_20230615t194000", "https://abc")
        self.assertEqual( "/documents/d/sentinel/s1a_mp_user_20230526t174000_20230615t194000", slink_1.ref_url)
        self.assertEqual("2023-05-26 17:40:00", slink_1.start_date.strftime("%Y-%m-%d %H:%M:%S"))

        slink_1 = SatelliteAcqPlanLink("/d/sentinel/s4a_mp_user_20230512t174000_20230618t194000", "https://abc")
        self.assertEqual("/d/sentinel/s4a_mp_user_20230512t174000_20230618t194000", slink_1.ref_url)
        self.assertEqual("2023-05-12 17:40:00", slink_1.start_date.strftime("%Y-%m-%d %H:%M:%S"))

    # Test On Archive Page
    # TEst On year Zip Page

# Test Retrive List of HREF
    # TEst Convert HRef to Download URL
    # Test Download
    # Tst Pslit KML
    # Test Select Link
    # Test Manage Cache of KML Fragments
    # Test Update cache with new KML File (check number of fragemnents in cache, and related contents

    def load_page_links(self, mission, page, div_config, num_acqplans):
        acqparser = AcqPlanLinksPageParser(self.ref_url,
                                           page, div_config,
                                           self._acqplan_links[mission])
        acqparser.get_acqplan_link_urls()
        acqplans = acqparser.acqplan_links._acq_link_objs
        self.assertEqual(num_acqplans,
                          len(acqplans),
                          f"Expected {num_acqplans} satellites AcqPlan lists")
        for sat, acqplan_satlist in acqplans.items():
            self.assertNotEqual(len(acqplan_satlist), 0,
                                 f"Exepected not empty Link List for sat {sat}")
        return acqplans

    # TODO: Test on HTML File, instead of URL
    def load_links(self, mission, acqtype, satellites):
        url = self._get_mission_url(mission, acqtype)
        print("Test on url ", url)
        html_page = self._scraper_from_url(url)
        div_classes = {}
        for sat in satellites:
            div_classes[sat] = self._get_div_class(mission, sat)
            self.assertIsNotNone(div_classes[sat])
        div_cfg = {
            AcqPlanLinksPageParser.ACQPLAN_DIV_KEY: div_classes
        }
        return self.load_page_links(mission, html_page, div_cfg, len(satellites))

    def test_loadS2LatestLinks(self):
        self.load_links("S2", "latest", ["S2A", "S2B"])

    def test_loadS1LatestLinks(self):
        self.load_links("S1", "latest", ["S1A", "S1B"])

    def load_links_from_file(self, mission, satellites, filename):
        test_folder = "test_acqplan_pages"
        arc_path = os.path.join(test_folder, filename)
        html_page = self._scraper_from_file(arc_path)
        div_classes = {}
        for sat in satellites:
            div_classes[sat] = self._get_div_class(mission, sat)
            self.assertIsNotNone(div_classes[sat])
        div_cfg = {
            AcqPlanLinksPageParser.ACQPLAN_DIV_KEY: div_classes
        }
        return self.load_page_links(mission, html_page, div_cfg, len(satellites))

    @unittest.skip('Archive Links scraping to be implemented')
    def test_loadArchiveLinksFile(self):
        arc_file = "Acquisition Plans archive - Sentinel-2 - Sentinel Online.htm"
        self.load_links_from_file("S2", ["S2A", "S2B"], arc_file)

    @unittest.skip('Archive Links scraping to be implemented')
    def test_loadpage_fromArchiveFile(self):
        arc_file= "Acquisition Plans archive - Sentinel-2 - Sentinel Online.htm"
        test_folder = "test_acqplan_pages"
        arc_path = os.path.join(test_folder, arc_file)
        html_page = self._scraper_from_file(arc_path)
        div_class = self._get_div_class("S2", "S2A")
        self.assertIsNotNone(div_class)
        s2_latest_link_el = html_page.get_element_by_class("div", div_class)
        self.assertIsNotNone(s2_latest_link_el)

        html_link_list = s2_latest_link_el.find_all("a", href=True)
        self.assertIsNotNone(html_link_list)
        # TODO: extract first link
        for link_el in html_link_list:
            self.assertIsNotNone(link_el['href'])
            print(link_el['href'])

    def test_loadpage_fromLatestFile(self):
        link_file= "Sentinel-2 Acquisition Plans - Sentinel Online - .html"
        test_folder = "test_acqplan_pages"
        link_file_path = os.path.join(test_folder, link_file)
        html_page = self._scraper_from_file(link_file_path)
        div_class = self._get_div_class("S2", "S2A")
        self.assertIsNotNone(div_class)
        s2_latest_link_el = html_page.get_element_by_class("div", div_class)
        self.assertIsNotNone(s2_latest_link_el)

        html_link_list = s2_latest_link_el.find_all("a", href=True)
        self.assertIsNotNone(html_link_list)
        # TODO: extract first link
        for link_el in html_link_list:
            self.assertIsNotNone(link_el['href'])
            print(link_el['href'])
    def test_loadpage_sortedlinks_fromFile_S1(self):
        # S1 FIle has a bigger list of links
        link_file = "Acquisition Segments - Sentinel-1 - Sentinel Online.html"
        acqplans_table = self.load_links_from_file("S1", ["S1A", "S1B"], link_file)
        print("Table File URL Links: ", acqplans_table)
        s1a_acqplans  = acqplans_table.get("S1A")
        # check that acquplans are sorted
        end_date_list1 = [link.end_date for link in s1a_acqplans]
        test_list1 = end_date_list1[:]
        test_list1.sort()
        self.assertListEqual (test_list1,  end_date_list1, "Expected S1a Links sorted")

    def test_loadpage_sortedlinks_fromFile_S2(self):
        arc_file = "Sentinel-2 Acquisition Plans - Sentinel Online - .html"
        acqplans_table = self.load_links_from_file("S2", ["S2A", "S2B"], arc_file)
        print("Table File URL Links: ", acqplans_table)
        s2a_acqplans  = acqplans_table.get("S2A")
        # check that acquplans are sorted
        end_date_list1 = [link.end_date for link in s2a_acqplans]
        test_list1 = end_date_list1[:]
        test_list1.sort()
        self.assertListEqual (test_list1,  end_date_list1, "Expected S2a Links sorted")

    # Alternatively, load page from local file
    def test_loadpage_fromURL(self):
        # URL Depends on : Mission / latest or archive
        url=self._get_mission_url("S2", "latest")
        html_page = self._scraper_from_url(url)
        div_class = self._get_div_class("S2", "S2A")
        self.assertIsNotNone(div_class)
        s2_latest_link_el = html_page.get_element_by_class("div", div_class)
        self.assertIsNotNone(s2_latest_link_el)

        html_link_list = s2_latest_link_el.find_all("a", href=True)
        self.assertIsNotNone(html_link_list)
        # TODO: extract first link
        for link_el in html_link_list:
            self.assertIsNotNone(link_el['href'])
            print(link_el['href'])
# TODO : parse first link, create a AcqLink Object
    # TODO : check list of link AcqPlans against latest Date in Cache
    # TODO: Update Cache , remove oldest


    def test_link_selection(self):
        # Test selection of "latest" links for S2, including or after
        # 12 June 2023
        arc_file = "Sentinel-2 Acquisition Plans - Sentinel Online - .html"
        mission = "S2"
        satellites = ["S2A", "S2B"]
        reference_date = "2023-06-12"
        expected_sat_links = 3
        test_folder = "test_acqplan_pages"
        arc_path = os.path.join(test_folder, arc_file)
        html_page = self._scraper_from_file(arc_path)
        div_classes = {}
        for sat in satellites:
            div_classes[sat] = self._get_div_class(mission, sat)
            self.assertIsNotNone(div_classes[sat])
        div_cfg = {
            AcqPlanLinksPageParser.ACQPLAN_DIV_KEY: div_classes
        }
        acqlinks = AcqLinksTable()
        acqlinks.add_selection_func(select_acq_link_after)
        acqlinks.add_selection_func(select_acq_link_before)
        # past_days = 15
        # acqlinks.add_selection_func(functools.partial(select_acq_link_includes_after_n_days_past,past_days))
        acqparser = AcqPlanLinksPageParser(self.ref_url,
                                           html_page, div_cfg, acqlinks)
        acqparser.get_acqplan_link_urls()
        acquired_acqplans = acqparser.acqplan_links
        ref_date = datetime.datetime.strptime(reference_date, "%Y-%m-%d")
        # Selection Strategies:
        # get_after
        # get_after_including
        # get_after_and_past_days(num_days)
        # Strategy is a function that is applied to each Link object
        #   get_af_and_past_days is a partial function
        selected_acq_plans = acquired_acqplans.select_acqlinks(ref_date)
        for sat, sat_links in selected_acq_plans.items():
            # Sat LInks is a Set: is not ordered
            print("Satellite ", sat, ", retrieved: ", sat_links)
            self.assertEqual(expected_sat_links, len(sat_links))
            # CHeck that list of links is sorted
            tosort_list = list(sat_links)[:]
            self.assertListEqual(list(sat_links),
                                 sorted(tosort_list, reverse=True,
                                        key=lambda x: x.start_date))

    def test_download_links(self):
        # TODO: Modify Configuration in order to have
        #   the url to be scraped pointing to a local test file
        ingestor = AcqPlanIngestor(past_num_days = 15)
        ingestor.retrieve_acq_plans("2023-07-12")
        with self.assertRaises(Exception,
                               msg="Getting KML Fragments for old date did not raise exception") as raises_cm:
            ingestor.get_kml_fragments("S2", "S2A",
                                       ['2023-07-07'])
            excep = raises_cm.exception
            self.assertEqual(excep.args, ("No data for day 2023-07-07"))

        # # Retreive list from test HTML file
        # # and select for the refnce date
        # arc_file = "Sentinel-2 Acquisition Plans - Sentinel Online - .html"
        # mission = "S2"
        # satellites = ["S2A", "S2B"]
        # reference_date = "2023-06-12"
        # expected_sat_links = 3
        # test_folder = "test_acqplan_pages"
        # arc_path = os.path.join(test_folder, arc_file)
        # html_page = self._scraper_from_file(arc_path)
        # div_classes = {}
        # for sat in satellites:
        #     div_classes[sat] = self._get_div_class(mission, sat)
        #     self.assertIsNotNone(div_classes[sat])
        # div_cfg = {
        #     AcqPlanPageParser.ACQPLAN_DIV_KEY: div_classes
        # }
        # acqlinks  = ingestor._acqplan_links['S2']
        # acqparser = AcqPlanPageParser(html_page, div_cfg, acqlinks)
        # acqparser.get_acqplan_link_urls()
        # acquired_acqplans = acqparser.acqplan_links
        # ref_date = datetime.datetime.strptime(reference_date, "%Y-%m-%d")
        # selected_acq_plans = acquired_acqplans.select_acqlinks(ref_date)
        # # PROBLEM: links in file could not be valied :
        # # a Mock to execute download is needed
        # ingestor._load_kml_fragments("S2", selected_acq_plans)
        # self.assertEqual(21, ingestor.acqplan_fragments.get("S2"))


if __name__ == '__main__':
    # logging.basicConfig(handlers = [logging.FileHandler("unittest.log"),
    #                                 logging.StreamHandler()],
    #                     level=logging.DEBUG,
    #                     format=' %(name)s :: %(levelname)s :: %(message)s')
    #logger = logging.getLogger('apps.ingestion.acq_plan_ingestor')
    #logger.addHandler(logging.StreamHandler(sys.stdout))

    unittest.main()
