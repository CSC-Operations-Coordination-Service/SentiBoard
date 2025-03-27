# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) - 
All rights reserved.

This document discloses subject matter in which  has 
proprietary rights. Recipient of the document shall not duplicate, use or 
disclose in whole or in part, information contained herein except for or on 
behalf of  to fulfill the purpose for which the document was 
delivered to him.
"""

import datetime
import logging
from dataclasses import dataclass
from sys import stdout

from lxml import etree
from pykml.factory import KML_ElementMaker as KML

logger = logging.getLogger(__name__)

INTERVAL_TIME_FMT = '%Y-%m-%dT%H:%M:%SZ'


class DatatakeCompleteness:
    PLANNED_STATUS = "PLANNED"
    PROCESSING_STATUS = "PROCESSING"
    ACQUIRED_STATUS = "ACQUIRED"
    PUBLISHED_STATUS = "PUBLISHED"
    PARTIAL_STATUS = "PARTIAL"
    DELAYED_STATUS = "DELAYED"
    LOST_STATUS = "LOST"
    UNDEFINED_STATUS = "undef"


@dataclass
class FragmentInterval:
    start: datetime
    end: datetime


def get_interval_time(time_span_part):
    return datetime.datetime.strptime(str(time_span_part),
                                      INTERVAL_TIME_FMT)


class AcqDatatake:
    ACQ_STATUS_LABEL = 'Acquisition Status'
    PUB_STATUS_LABEL = 'Publication Status'

    def __init__(self, placemark, id_key):
        self._pm = placemark
        self._id_key = id_key

    def __repr__(self):
        # Return string containing all values for
        # extended data
        return ", ".join([f"{pm_data.attrib['name']}: {pm_data.value.text}"
                          for pm_data in self._pm.ExtendedData.Data])

    @property
    def name(self):
        return self._pm.name

    @property
    def datatake_id(self):
        attr_record = self.get_data_record(self._id_key)
        attr_value = None
        if attr_record is not None:
            attr_value = str(attr_record.value.text).strip()
        else:
            logger.warning("Datatake has no Extended Data record for ID with key %s",
                           self._id_key)
        return attr_value

    @datatake_id.setter
    def datatake_id(self, new_id):
        """
        Set or update the Datatake id
        Update the Data item in Extended Data section of Placemark
        with name self._id_key
        Args:
            new_id ():

        Returns:

        """
        self.update_data_record(self._id_key, new_id)

    def get_data_record(self, attr_name):
        # Take the Data record with attribute name = id_key ;
        # retrieve the datatake id value
        attr_record = next((pm_data
                            for pm_data in self._pm.ExtendedData.Data
                            if pm_data.attrib['name'] == attr_name),
                           None)
        return attr_record

    def update_data_record(self, attr_name, attr_value):
        record = self.get_data_record(attr_name)
        record.value = KML.value(attr_value)

    def exists_data_record(self, attr_name):
        return self.get_data_record(attr_name) is not None

    def add_update_data_record(self, attr_name, attr_value):
        logger.debug("Adding or Updating Data record with name %s, value %s to datatake with ID %s",
                     attr_name, attr_value,
                     self.datatake_id)
        if not self.exists_data_record(attr_name):
            self.add_data_record(attr_name, attr_value)
        else:
            self.update_data_record(attr_name, attr_value)

    def add_data_record(self, attr_name, attr_value):
        logger.debug("Adding Data record with name %s, value %s to Placemark of datatake with ID %s",
                     attr_name, attr_value,
                     self.datatake_id)
        new_data_record = KML.Data(KML.value(attr_value),
                                   name=attr_name)
        self._pm.ExtendedData.append(new_data_record)

    def add_id_prefix(self, id_prefix, id_decoder):
        """

        Args:
            id_prefix ():
            id_decoder ():

        Returns: the Datatake id with the specified prefix

        """
        # Get Placemark ID.
        original_dt_id: str = self.datatake_id
        if not original_dt_id.startswith(id_prefix):
            decoded_id = id_decoder(original_dt_id)
            # Add Prefix if not existing
            dt_id = f"{id_prefix}-{decoded_id}"
            logger.debug("Updated Placemark ID from %s to %s", original_dt_id, dt_id)
            # Update Placemark ID
            self.datatake_id = dt_id
        else:
            dt_id = original_dt_id
        return dt_id

    def set_status_style(self, status_str):
        self._pm.styleUrl = KML.styleUrl(status_str)


# Two Subclass, depending on Mission
# Different ways of extracting Placemark list
class AcqPlanDayFragment:
    """
# TODO Add functions: to compare / order Day Fragments (to sort a list by interval)
# TODO Add function to merge two AcqPlanDayFragments for same day
# TODO: Add Mission and/or satellite information, to allow
#     understand the origin of a single fragment
    """
    FOLDER_DAY_FMT = '%Y-%m-%d'
    # Select File ingestion order: newer first, older later
    # When newer first, if we find a fragment for same day,
    # we do not override it
    _override_existing = False

    def __init__(self, day_str, folder):
        self._interval = None
        self.day = day_str
        self.folder_kml = folder
        self.placemark_table = None
        # PLACEMARK have elements:
        # <name>2023-06-27T19:10:41</name>
        # <TimeSpan>
        #          <begin>2023-06-27T19:10:41</begin>
        #          <end>2023-06-27T19:14:13</end>
        #       </TimeSpan>
        # To select Placemark position, just compare name to name

    @property
    def interval(self):
        if self._interval is None:
            self._compute_coverage_interval()
        return self._interval

    @property
    def placemarks_folder(self):
        if self.folder_kml is not None:
            return self.folder_kml.Folder[0]
        else:
            raise Exception("Main folder not defined")

    @property
    def placemark_list(self):
        folder = self.placemarks_folder
        return folder.Placemark if hasattr(folder, "Placemark") else []

    @property
    def placemark_names(self):
        return [pm.name.text for pm in self.placemark_list]

    @property
    def placemark_ids(self):
        return [pm.name for pm in self.placemark_list]

    @property
    def placemark_intervals(self):
        # TODO Build Unit test against a known Placemark list in folder
        # Replace folder.Placemark using self.placemark_list
        folder = self.placemarks_folder
        intervals = []
        for pm in folder.Placemark:
            start = get_interval_time(pm.TimeSpan[0]['begin'])
            end = get_interval_time(pm.TimeSpan[0]['end'])
            intervals.append(FragmentInterval(start, end))
        return intervals

    @property
    def is_future(self):
        today = datetime.datetime.today()
        fragment_date = datetime.datetime.strptime(self.day, AcqPlanDayFragment.FOLDER_DAY_FMT)
        return fragment_date > today

    @staticmethod
    def _set_utc_format(time_string):
        return time_string.rstrip('Z') + 'Z'

    def set_placemark_intervals_utc(self):
        placemark_list = self.placemark_list
        for pm in placemark_list:
            time_interval = pm.TimeSpan[0]
            start_time_str = self._set_utc_format(str(time_interval['begin']))
            end_time_str = self._set_utc_format(str(time_interval['end']))
            pm.TimeSpan[0] = KML.TimeSpan(KML.begin(start_time_str),
                                          KML.end(end_time_str))

    def _compute_coverage_interval(self):
        """
        Compute the interval covered in the fragment
        by taking the min start time of the contained fragments
        and the max end time.
        Returns: Updates internal variable

        """
        folder = self.placemarks_folder
        # get kml_folder time interval
        folder_start = min(get_interval_time(placemark.TimeSpan[0]['begin'])
                           for placemark in folder.Placemark)
        folder_end = max(get_interval_time(placemark.TimeSpan[0]['end'])
                         for placemark in folder.Placemark)
        self._interval = FragmentInterval(folder_start, folder_end)

    def _remove_interval_placemarks(self, time_interval: FragmentInterval):
        """

        Args:
            time_interval ():

        Returns:

        """
        reference_time_str = datetime.datetime.strftime(time_interval.start,
                                                        INTERVAL_TIME_FMT)
        place_folder = self.placemarks_folder
        logger.debug("Removing from folder %s placemarks from %s, to %s",
                     place_folder.name,
                     time_interval.start, time_interval.end)
        # logger.debug("Folder as string: %s", etree.tostring(place_folder))
        if hasattr(place_folder, 'Placemark'):
            logger.debug("Extracting list of placemarks to remove")
            logger.debug("Fist Placemark in current folder: %s, last : %s",
                         place_folder.Placemark[0].name,
                         place_folder.Placemark[len(place_folder.Placemark) - 1].name)
            pm_to_remove = [pm for pm in place_folder.Placemark if pm.name.text >= reference_time_str]
            logger.debug("Found %d Placemarks to remove",
                         len(pm_to_remove))
            for pm in pm_to_remove:
                place_folder.remove(pm)
            logger.debug("Completed removal of Placemarks in Interval for Fragment of day %s", self.day)
        else:
            logger.debug("Placemark Folder for Fragment for day %s had no placemarks", self.day)

    def remove_placemarks(self, pm_list):
        """
        Remove from this fragment the placemarks in the list
        Args:
            pm_list (): a list of Placemark objects

        Returns:

        """
        place_folder = self.placemarks_folder
        logger.debug("Removing from folder %s list of placemarks ",
                     place_folder.name)
        # logger.debug("Folder as string: %s", etree.tostring(place_folder))
        if hasattr(place_folder, 'Placemark'):
            for pm in pm_list:
                place_folder.remove(pm)
            logger.debug("Removal completed")

    def _add_placemark(self, placemark):
        # Add placemark to folder, so that its interval is
        #    just in the right position
        place_folder = self.placemarks_folder
        logger.debug("Adding placemark %s to folder %s",
                     placemark.name,
                     place_folder.name)
        logger.debug("Placemark object being added id: %s", id(placemark))

        # TODO: Insert after last placemark with name < placemark.name
        # Find last item in placemark list with name 
        # last_pm = next((pm 
        #            for pm in reversed(place_folder.Placemark) 
        #            if pm.name < placemark.interval.start), None)
        # get last item position ( considering case where all items were before new placemark
        #                   and case where all items were after new placemark)
        #   Insert new placemark at that position!
        place_folder.append(placemark)

    def merge(self, other_fragment):
        """
        Merge this fragment with other fragment.
        Fragments shall refer to same DAY
        Result should be:
            Placemarks are taken from fragment with precedence
                if they belong to the intersection of fragments time intervals
            otherwise for time intervals not in common,
            placemarks are kept (if time interval belongs to SELF)
            or added (if time interval belongs to other).
            Placemark shall be sorted by time (ascending)
        Args:
            other_fragment (AcqPlanDayFragment):

        Returns:

        """
        logger.debug("Merging folder for day %s with other fragment folder",
                     self.day)

        # logger.debug("Current folder interval: from %s to %s",
        #             self.interval.start, self.interval.end)
        # logger.debug("Other folder interval: from %s to %s",
        #             other_fragment.interval.start, other_fragment.interval.end)
        if self.day != other_fragment.day:
            raise Exception("Trying to merge fragments for different days")

        self._save_not_existent_placemarks(other_fragment)
        # self._replace_interval_placemarks(other_fragment)
        logger.debug("Completed merging folders for same day")

    def _replace_interval_placemarks(self, other_fragm):
        # TODO: Check that other_fragm time interval is partially overlapping
        #    with self
        # Compute new interval
        # Replace Placemarks
        # Remove from self placemarks, those included in other_fragment
        #    time interval
        logger.debug("Replacing existing placemarks from other folder")
        self._remove_interval_placemarks(other_fragm.interval)

        # append to self placemarks placemarks from other_fragm
        other_place_folder = other_fragm.placemarks_folder
        logger.debug("Adding placemarks from other folder")
        for pm in other_place_folder.Placemark:
            self._add_placemark(pm)
        # Cases: self.interval < other.interval
        #   self.interval includes other.interval
        # self.interval intersects with other.interval (self.start < other.start)
        # self.interval > other.interval
        # Recompute fragment interval
        self._compute_coverage_interval()

    def _save_not_existent_placemarks(self, other_fragm):
        # append to self placemarks placemarks from other_fragm
        other_place_folder = other_fragm.placemarks_folder
        logger.debug("Adding to folder day %s not already existing placemarks from other folder",
                     self.day)

        # Integrate presence of Placemark attribute, with length of corresponding array
        if hasattr(other_place_folder, 'Placemark'):
            for pm in other_place_folder.Placemark:
                if pm.name.text not in self.placemark_names:
                    logger.debug("Adding not existent Placemark %s", pm.name.text)
                    self._add_placemark(pm)
                # else:
                #    logger.debug("Placemark already existing: %s in folder %s",
                #                 pm.name.text, self.day)
        else:
            logger.warning("While merging fragments for day %s, older folder had no Placemark",
                           self.day)

    def sort_placemarks(self):
        # TODO Unit test to be defined
        pm_folder = self.placemarks_folder
        # TODO: USE DIRECTLY self.placemark_list
        if hasattr(pm_folder, 'Placemark'):

            placemarks = list(pm_folder.Placemark)
    
            placemarks.sort(key=lambda plm: plm.TimeSpan.end)
            self.remove_placemarks(placemarks)
            for pm in placemarks:
                pm_folder.append(pm)
        else:
            logger.warning("Tried to sort not existent Placemarks for Fragment %s",
                           self.day)


def get_past_day_str(max_age, date_format):
    today_day = datetime.datetime.today()
    _earliest_day = today_day - datetime.timedelta(days=max_age)
    return _earliest_day.strftime(date_format)


class AcqPlanFragments:
    """
    This class organizes AcqPlan fragments collected from KML Files
    Each fragment contains a single day folder, with many Placemark objects
    Up to two fragments could be related to the same day.
    (one for the first part of the day, the other one for the second part)
    It shall be possible to retrieve all the fragments extracted from a single file
    Each file is associated to its start/end date
        Note that since Files are partially overlapping,
        when loading a more recent file, the Fragments related to the
        overlapping days will be removed.
    The class allows:
        To ingest fragments from a KML File
        To retrieve fragments for a specified Day
    """
    # Configuration of Datatake IDS, based on Mission
    # Placemark/Datatake IDs are found in Extended Data section of acquisition KML
    placemark_id_keys = {
        'S1': 'DatatakeId',
        'S2': 'ID'
    }

    def __init__(self, fragments_id, platform, max_age):
        """
            max_age: max number of folder days  kept in memory
        """
        self._fragments = {}
        self._max_age = max_age
        self._earliest_day_str = get_past_day_str(max_age, AcqPlanDayFragment.FOLDER_DAY_FMT)
        self._id = fragments_id
        self.satellite = platform
        logger.debug("Initializing Table for AcqPlan Fragments f satellite %s", platform)
        logger.debug("Earliest day accepted for age: %s:  %s", max_age, self._earliest_day_str)

    @staticmethod
    def _print_kml_fragment(fragment):
        et = etree.ElementTree(fragment)
        et.write(stdout.buffer, pretty_print=True)

    def _add_fragment(self, fragment: AcqPlanDayFragment):
        logger.debug("Adding fragment for day %s - earliest day accepted: %s",
                     fragment.day, self._earliest_day_str)
        #  Fragment is older than today - max_age, discard it
        if fragment.day >= self._earliest_day_str:
            # Add fragment if no other fragment is present for same day
            # If a fragment for same day is present:
            #  Merge fragments with priority to this one (this one replaces all placemarks in same interval)
            if fragment.day in self._fragments:
                logger.debug("Merging fragments for day %s", fragment.day)
                self._fragments[fragment.day].merge(fragment)
            else:
                logger.debug("Adding fragment for new day %s", fragment.day)
                # logger.debug("Adding fragment for new day %s with placeks %s",
                #              fragment.day,
                #              fragment.placemark_names)
                self._fragments[fragment.day] = fragment
            self._fragments[fragment.day].sort_placemarks()
        else:
            logger.debug("Discarded fragment for day %s, since older than Earliest day: %s",
                         fragment.day, self._earliest_day_str)

    def process_kml_folder(self, kml_folder):
        """
        Adds the KML folder (object generated from KML) to
        the Fragments Table
        It is expected that:
            the folder (referring to a single day)
            contains another folder, having as name the
            satellite name.
            This other folder contains the Placemarks of the
            planned acquisitions of the satellite for the day
        Args:
            kml_folder (): a Folder object

        Returns:
            N/A: it adds, or merges if existent, the folder
            to the Fragments table

        """
        # Folder organization is dependent on mission
        # extract from kml_folder covered interval
        # add folder string to fragments dictionary
        folder_name = kml_folder['name']
        logger.debug("Fragment table %s - Adding fragment for folder %s",
                     self._id, folder_name)
        # self._print_kml_fragment(kml_folder)

        # Key: date
        # each date has a list of fragments, with the start/end time associated
        # We are assuming that folder name is folder day!
        # Convert to string: name element is a String Element
        fragment = AcqPlanDayFragment(str(folder_name), kml_folder)
        fragment.set_placemark_intervals_utc()
        # if fragment.is_empty
        self._add_fragment(fragment)

    def remove_fragments_before(self, oldest_day):
        """
        Remove all fragments in class, related to days
        before the specified oldest_day
        Args:
            oldest_day (): a string for the day to be kept 

        Returns: N/A

        """
        # Sort Day keys
        # Select day keys before oldest_day
        # Remove fragments for the selected day keys
        keys_to_remove = [day
                          for day in self._fragments
                          if day < oldest_day]
        for key in keys_to_remove:
            if key in self._fragments:
                del self._fragments[key]

    def purge_by_age(self, day_number=None):
        """
            keep day_number before current day.
            Remove older days
            Find oldest day to keep.
            Find oldest day in memory
            delete folders from oldest day to day before oldest day to keep
        """
        if day_number is None:
            day_number = self._max_age
        today_day = datetime.datetime.today()
        oldest_day_to_keep = today_day - datetime.timedelta(days=day_number)
        oldest_day_str = oldest_day_to_keep.strftime(AcqPlanDayFragment.FOLDER_DAY_FMT)
        self.remove_fragments_before(oldest_day_str)

    def get_fragment(self, day_str):
        logger.debug("Retrieving fragment for day %s; day fragments: %s",
                     day_str,
                     ",".join(list(self._fragments.keys())))
        if day_str not in self._fragments:
            raise Exception(f"No data for day {day_str}")
        return self._fragments.get(day_str)

    @property
    def days_interval(self):
        day_list = list(sorted(self._fragments.keys()))

        return FragmentInterval(day_list[0], day_list[len(day_list) - 1])

    @property
    def day_list(self):
        return list(sorted(self._fragments.keys()))

    @property
    def num_fragments(self):
        return len(self._fragments)
