# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${owner}
All rights reserved.

This document discloses subject matter in which ${ownerShort} has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of ${ownerShort} to fulfill the purpose for which the document was
delivered to him.
"""
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime

from dateutil.relativedelta import relativedelta
from typing import List
from urllib.parse import urlparse

from apps.cache.cache import ConfigCache
from apps.ingestion import news_scraper as scraper
from apps.utils import html_utils as html_utils

logger = logging.getLogger(__name__)


@dataclass
class SatelliteAcqPlanLink:
    ref_url: str
    base_url: str
    start_date: datetime = field(init=False)
    end_date: datetime = field(init=False)

    def _parse_ref_url(self):
        """
        Parse the reference url and extract parameters:
        start and end date
        Filename components are expected to be separated by _
        Last two components are expected to be Start/End time
        and having date/time format: %Y%m%dt%H%M%S
        Returns:

        """
        # Extract ref_url start date/end date
        # expected form:
        # /documents/d/sentinel/s1a_mp_user_20230526t174000_20230615t194000
        # Get filename
        # Split and get latest two parts of the name
        # logger.debug("Parsing Url: %s", self.ref_url)
        basename = os.path.basename(self.ref_url)
        basename_noext = os.path.splitext(basename)[0]
        name_components = basename_noext.split("_")
        logger.debug("Name components: %s", name_components)
        date_fmt = "%Y%m%dt%H%M%S"
        end_date_str = name_components[-1]
        start_date_str = name_components[-2]
        # # fromisoformat
        self.end_date = datetime.strptime(end_date_str, date_fmt)
        self.start_date = datetime.strptime(start_date_str, date_fmt)

    def _normalize_ref_url(self):
        """
        Remove protocol, port and host if prsent in ref_url
        Returns:

        """
        self.ref_url = self.ref_url.removeprefix(self.base_url)

    def __post_init__(self):
        logger.debug("AcqPlan LInk with base: %s, url %s", self.base_url, self.ref_url)
        self._normalize_ref_url()
        # parse ref_url and compute start/end date
        self._parse_ref_url()
        if self.ref_url.startswith("http"):
            logger.warning(
                "AcqPlan link URL (%s) invalid: starts with http", self.ref_url
            )

    @property
    def full_url(self):
        return f"{self.base_url}/{self.ref_url}"

    def __repr__(self):
        return f"{os.path.basename(self.ref_url)}"

    def __hash__(self):
        return hash(self.ref_url)


def select_acq_link_after(acq_link: SatelliteAcqPlanLink, reference_date: datetime):
    logger.debug(
        "Comparing for after - Acq Link Start %s, End %s, to ref: %s",
        acq_link.start_date,
        acq_link.end_date,
        reference_date,
    )
    return acq_link.start_date >= reference_date or acq_link.end_date >= reference_date


def select_acq_link_before(acq_link: SatelliteAcqPlanLink, reference_date: datetime):
    logger.debug(
        "Comparing for before - Acq Link Start %s, End %s, to ref: %s",
        acq_link.start_date,
        acq_link.end_date,
        reference_date,
    )
    return acq_link.start_date <= reference_date


def select_acq_link_includes_after_n_days_past(
    n_days, acq_link: SatelliteAcqPlanLink, reference_date: datetime
):
    logger.debug(
        "Comparing for before - Acq Link Start %s, End %s, to ref: %s",
        acq_link.start_date,
        acq_link.end_date,
        reference_date,
    )
    new_ref_date = reference_date - relativedelta(days=n_days)
    return acq_link.start_date <= new_ref_date or acq_link.end_date >= new_ref_date


class AcqLinksTable:
    """
    Manages a list of AcqPlan link objects:
    Links are added to the collection
    Links after a specified day are retrieved
    """

    def __init__(self):
        # SatId :  Class
        self._acq_link_objs = {}
        self._selection_funcs = []

    def add_selection_func(self, sel_fun):
        logger.debug("Adding selection func %s", sel_fun.__name__)
        self._selection_funcs.append(sel_fun)

    def add_acq_link_url(self, satellite, link_url: SatelliteAcqPlanLink):
        # From link_url, get satellite
        # add to the Satellite
        sat_acq_links = self._acq_link_objs.setdefault(satellite, [])
        sat_acq_links.append(link_url)

    def add_acq_link_url_list(
        self, satellite, link_url_list: List[SatelliteAcqPlanLink]
    ):
        logger.debug("Adding to Ingestor links: %s", link_url_list)
        sat_acq_links = self._acq_link_objs.setdefault(satellite, [])
        sat_acq_links.extend(link_url_list)

    def select_acqlinks(self, reference_date, from_newer=True):
        # 1 sort links by their start date, end date
        # 2 add to returned list, links having start date
        #    greater than reference, or end date greater than reference
        # Or maybe just end date greater than reference
        selected_links = {}
        for satellite, link_lists in self._acq_link_objs.items():
            # Use set, to ensure that no duplicated link is retrieved.
            sat_selection = selected_links.setdefault(satellite, set())
            logger.debug("Selecting for satellite %s", satellite)
            for sel_fun in self._selection_funcs:
                logger.debug("Applying function %s", sel_fun.__name__)
                sat_selection.update(
                    [
                        link_record
                        for link_record in link_lists
                        if sel_fun(link_record, reference_date)
                    ]
                )
                logger.debug(
                    "After selection, %d links to be downloaded", len(sat_selection)
                )
        # Replace sets with ordered lists
        return {
            sat: list(sorted(link_set, reverse=from_newer, key=lambda x: x.start_date))
            for sat, link_set in selected_links.items()
        }

    @property
    def len(self):
        return len(self._acq_link_objs)

    @property
    def satellites(self):
        return list(self._acq_link_objs.keys())


def get_url_base(url_addr):
    url_comps = urlparse(url_addr)
    return "{}://{}".format(url_comps.scheme, url_comps.netloc)


class AcqPlanLinksPageParser:
    """ """

    ACQPLAN_DIV_KEY = "acqplan_div"

    def __init__(
        self, page_url, page_parser, page_config, acq_links_table: AcqLinksTable
    ):
        self.base_url = get_url_base(page_url)
        self._html_parser = page_parser
        self._sat_div_cfg = page_config.get(self.ACQPLAN_DIV_KEY)
        logger.debug("Div Config: %s", self._sat_div_cfg)
        # Sat Div Cfg is a dictionary:
        self._acq_link_objs = acq_links_table

    def get_acqplan_link_urls(self):
        for sat, div_class in self._sat_div_cfg.items():
            logger.debug(
                "Satellite %s, retrieving element with class: %s", sat, div_class
            )
            sat_acqplan_links_element = self._html_parser.get_element_by_class(
                "div", div_class
            )
            if sat_acqplan_links_element:
                # logger.debug("Scraped Element %s", sat_acqplan_links_element)
                html_link_list = sat_acqplan_links_element.find_all("a", href=True)
                ref_links = [link_el["href"] for link_el in html_link_list]
                logger.debug("Retrieved links from page: %s", ref_links)
                # Retrieve the list of urls sorted by end date
                list_of_acq_link_urls = list(
                    sorted(
                        [
                            SatelliteAcqPlanLink(ref_link, self.base_url)
                            for ref_link in ref_links
                        ],
                        key=lambda x: x.end_date,
                    )
                )
                self._acq_link_objs.add_acq_link_url_list(sat, list_of_acq_link_urls)

    @property
    def acqplan_links(self):
        return self._acq_link_objs

    @property
    def satellites(self):
        return self._acq_link_objs.satellites


class AcqPlanKmlRetriever:
    def __init__(self, mission):
        # Define a table of Acqplan Mission/satellite KML links
        self._mission_acqplan_links = AcqLinksTable()
        self._mission_acqplan_links.add_selection_func(select_acq_link_after)
        self._mission_acqplan_links.add_selection_func(select_acq_link_before)
        self._mission = mission

    def retrieve_link_urls(self, link_type):
        logger.info(
            "Scraping Acquisition Plan KML files links for mission %s, type of plans %s",
            self._mission,
            link_type,
        )
        cfg = ConfigCache.load_object("acqplans_config")
        mission_cfg = cfg.get(self._mission)
        # TODO  Replace with a LinkPage Retriever
        url = mission_cfg["url"][link_type]
        page_contents = html_utils.get_html_page(url)
        html_page = scraper.ScarperHtml(page_contents)
        # For each platform in platform list
        acqplan_div = mission_cfg["acqplan_div"]
        logger.debug("Scraping from page div: %s", acqplan_div)
        acqplan_config = {"acqplan_div": acqplan_div}
        plan_retriever = AcqPlanLinksPageParser(
            url, html_page, acqplan_config, self._mission_acqplan_links
        )
        # Each acqplan link in retrieved list shall be of form:
        #   datetime interval of data in acqplan
        #   url to download the file
        #   mission
        #   satellite
        plan_retriever.get_acqplan_link_urls()

    def select_links(self, reference_day_str):
        """
        Select from the list of acquired links a subset, according to
        configured rules.
        Selected  links point to KML files containing acquisition plans
        for a date interval.
        Args:
            reference_day_str (): String representing a day in format YYYY-mm-DD

        Returns:
            a dict in the form:
                satellite: link list
                Link are object of type SatelliteAcqPlanLink
        """
        ref_date = datetime.strptime(reference_day_str, "%Y-%m-%d")
        return self._mission_acqplan_links.select_acqlinks(ref_date)


class AcqPlanKmlLinkIngestor:
    def __init__(self, mission, acqplan_fragmts, kml_loader):
        """

        Args:
            mission ():
            acqplan_fragmts ():
            kml_loader ():
        """
        # TODO: Inject Retriever Class,
        #  to allow different implementtioano/protcols
        # e.g. retrieving files from a shared folder
        self._acqplan_retriever = AcqPlanKmlRetriever(mission)
        self.mission_acqplan_fragments = acqplan_fragmts
        self.mission_kml_loader = kml_loader
        self._mission = mission

    @staticmethod
    def _download_kml(kml_link: SatelliteAcqPlanLink):
        # TODO: use a AcqPlanRetriever injected in the class object
        return html_utils.get_html_page(kml_link.full_url, decode_utf=False)

    def _load_kml_fragments(self, sat_kml_links):
        """
        Download KML files from Links associated to Satellites
        of this mission
        Extract from KML files fragments and save them to interval
        repository of acqplan kml fragments (daily based)
        Args:
            sat_kml_links (): a dictionary mapping satellites to a list
            of url strings for KML files to be downloaded

        Returns:

        """
        logger.debug("Extracting KML Fragments from links: %s", sat_kml_links)
        for sat, kml_links in sat_kml_links.items():
            logger.debug("Satellite %s links to be downloaded: %s", sat, kml_links)
            if sat not in self.mission_acqplan_fragments:
                logger.warning(
                    "Satellite KML files will on be downloaded, since not configured in ACQPLAN Fragments table"
                )
            else:
                sat_acq_plan_fragments = self.mission_acqplan_fragments[sat]
                # Instantiate a new Loader, mission dependent,
                # in charge of extracting daily fragments from Satellite Acquisiton KML file
                satellite_loader = self.mission_kml_loader()
                for kml_link in kml_links:
                    logger.info(
                        "Mission: %s - Downloading Acquisition Plan KML from link %s for satellite %s",
                        self._mission,
                        kml_link,
                        sat,
                    )
                    kml_file = self._download_kml(kml_link)
                    if kml_file is not None:
                        try:
                            # Extract from file KML daily fragments on Fragments Table
                            satellite_loader.load_acqplan_kml(
                                kml_file, sat_acq_plan_fragments
                            )
                        except Exception as ex:
                            logger.warning(
                                "Error parsing requested KML file for mission %s, sat %s, KML URL (%s)",
                                self._mission,
                                sat,
                                kml_link,
                            )
                            logger.error(ex)
                    else:
                        logger.warning(
                            "Requested KML file for mission %s, sat %s, KML URL (%s) could not be downloaded",
                            self._mission,
                            sat,
                            kml_link,
                        )

    def retrieve_mission_acq_plans(self, from_date):
        # Put div class in Configuration (acqplans-config[div_class]
        #    One URL for each Mission
        #     One div for each Satellite
        #      A URL for Current, a URL for Archive

        #   for each satellite in mission
        #    Retrieve list of links to current acquisition plans
        #    retrieve list of links to archived acquisition plan (up to date in past)
        logger.info(
            "Retrieving from internet Acquisition Plan KML files for mission %s, date %s",
            self._mission,
            from_date,
        )
        self._acqplan_retriever.retrieve_link_urls("latest")
        # self._retrieve_link_urls(mission, ["S1A", "S1B"], "archive")
        mission_kml_links = self._acqplan_retriever.select_links(from_date)
        # download the selected acquisition plans
        #  from the oldest to the newest
        # And split in fragments (by folder)
        self._load_kml_fragments(mission_kml_links)
