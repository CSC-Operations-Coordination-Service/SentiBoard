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
import logging

from apps.ingestion.acquisition_plans.acq_plan_fragments import (
    AcqPlanDayFragment,
    AcqDatatake,
    DatatakeCompleteness,
)

logger = logging.getLogger(__name__)


PLANNED_COMPLETENESS = {
    "ACQ": {"status": DatatakeCompleteness.PLANNED_STATUS, "percentage": 0},
    "PUB": {"status": DatatakeCompleteness.PLANNED_STATUS, "percentage": 0},
}


def datatake_id_identity(dt_id):
    return dt_id


def datatake_id_hex_to_dec(hex_dt_id):
    dt_id_int = int(hex_dt_id, 16)
    dec_dt_id = str(dt_id_int)
    return dec_dt_id


datatake_id_decoders = {"S1": datatake_id_hex_to_dec, "S2": datatake_id_identity}


class MissionDatatakeIdHandler:
    _id_keys = {"S1": "DatatakeId", "S2": "ID", "S3": "DatatakeId", "S5": "DatatakeId"}

    def __init__(self, mission):
        self._dt_id_decoder = datatake_id_decoders.get(mission)
        self._dt_id_key = self._get_mission_datatake_id_key(mission)

    # TODO: Move to Configuration
    @classmethod
    def _get_mission_datatake_id_key(cls, mission):
        if mission in cls._id_keys:
            return cls._id_keys.get(mission)
        else:
            raise Exception(
                "Trying to retrieve unknown Datatake ID KML Extended Data name for mission "
                + mission
            )

    @property
    def datatake_id_key(self):
        return self._dt_id_key

    @property
    def datatake_id_decoder(self):
        return self._dt_id_decoder


def _format_completeness_status(status_dict):
    """
    Format values defining Completeness status
    Args:
        status_dict ():

    Returns: "status (percentage %)"

    """
    # Float value is formatted to 2 decimal digits
    perc_str = (
        f"({status_dict['percentage']:.2f}%)" if "percentage" in status_dict else ""
    )
    return f"{status_dict['status']} {perc_str}"


# TODO Build tests for this class method
class FragmentCompletenessHandler:
    def __init__(self, mission, fragments_table: dict, daily_datatakes: dict):
        """

        Args:
            mission ():
            fragments_table (dict): a table with key a satellite id,
            and value a AcqPlanFragments object
            daily_datatakes ():
        """
        self.mission = mission
        mission_id_hnd = MissionDatatakeIdHandler(mission)
        self.datatake_id_decoder = mission_id_hnd.datatake_id_decoder
        self.datatake_id_key = mission_id_hnd.datatake_id_key
        self.mission_fragments = fragments_table
        self.daily_datatakes = daily_datatakes
        if self.daily_datatakes is None:
            logger.warning("No Datatake index information found in cache")
        # TODO: Inject completeness formatting funciton into AcqDatatake Class
        # AcqDatatake.CompletenessFormatFun = _format_completeness_status

    @staticmethod
    def _load_datatake_completeness_on_placemarks(
        datatake_table,
        day_fragment: AcqPlanDayFragment,
        datatake_id_prefix,
        datatake_id_key,
        datatake_id_decoder,
    ):
        """
        Sets the Acquisition/Publication completeness values of the corresponding
        Datatake, by adding/updating the corresponding Extended data record in the
        KML Placemark.
        The completeness value is taken from the datatake table.
        If a datatake is not found in the datatake table:
            if it is in the future, its completeness status is set to PLANNED
            otherwise the placemark is removed.
        Args:
            datatake_table (): a table of datatakes related to a day of acquisition,
            and to a satellite
            day_fragment (): the day fragment whose placemarks we are updating
            datatake_id_prefix (): the prefix that Datatake id's must have. If not present, add it
            datatake_id_key (): the name of the data element in extended data section of
            placemarks, that contains the datatake id

        Returns:

        """
        pm_to_remove = []

        # For each Placemark in Day Fragment:
        # 1. retrieve Datatake data from cache, and completeness
        #  2. add completeness info to Placemark
        #  Browse Placemarks, and extract Completeness from datatake table
        # day_fragment.apply_placemark_fun(add_completeness_to_placemark)
        # TODO: Define a function to be used on each DayFragment placemark
        #   Miisng: datatake id key and decoder, that depend mission and are common to all fragments
        # They can be injected in the Funciton object (instanteted, () operator executes function)
        for pm in day_fragment.placemark_list:
            acq_dt = AcqDatatake(pm, datatake_id_key)
            dt_id = acq_dt.add_id_prefix(datatake_id_prefix, datatake_id_decoder)
            logger.debug(
                "Placemark with datatake id %s is object with id %s", dt_id, id(pm)
            )
            # Search for completeness in Datatake Table
            datatake_data = (
                datatake_table.get(dt_id, None) if datatake_table is not None else None
            )
            if datatake_data is not None:
                logger.debug("Adding Completeness data to Placemark")
                logger.debug("Datatake data: %s", datatake_data)
                # Extract completeness information from datatake_data
                completeness = datatake_data.get("completeness_status")
            else:
                logger.debug("No datatake data found for Datatake id: %s", dt_id)
                # Check if Placemark has a date in the future
                if day_fragment.is_future:
                    completeness = PLANNED_COMPLETENESS
                else:
                    logger.warning(
                        "Placemark with ID %s, day %s: no datatake found in Datatake cache.",
                        dt_id,
                        day_fragment.day,
                    )
                    # Remove placemark from Fragment
                    pm_to_remove.append(pm)
                    continue
            # Otherwise, if placemark is in teh paste, the status is N/A and no percentage is given
            # TODO: Move to acq_dt.set_completeness(completeness) or to self.add_datatake_completeness
            FragmentCompletenessHandler.add_datatake_completeness(acq_dt, completeness)
            # logger.debug("Placemark after update: %s", acq_dt)
        logger.debug(
            "Removing from Fragment %s placemarks not found in Datatakes cache",
            day_fragment.day,
        )
        day_fragment.remove_placemarks(pm_to_remove)

    @staticmethod
    def add_datatake_completeness(acq_dt, completeness):
        if "ACQ" in completeness:
            acq_completeness = completeness["ACQ"]
            acq_status = _format_completeness_status(acq_completeness)
            acq_dt.add_update_data_record(acq_dt.ACQ_STATUS_LABEL, acq_status)
        if "PUB" in completeness:
            pub_completeness = completeness["PUB"]
            pub_status = _format_completeness_status(pub_completeness)
            acq_dt.add_update_data_record(acq_dt.PUB_STATUS_LABEL, pub_status)
            acq_dt.set_status_style(pub_completeness["status"])
            logger.debug(
                "Set completeness status %s for Placemark with ID %s",
                pub_completeness["status"],
                acq_dt.datatake_id,
            )

    # TODO: Extend to extract from day list
    # only days not older than N days ago, up to today
    def set_completeness(self):
        logger.debug(
            "Loading Completeness values on Fragments for mission %s", self.mission
        )
        # For each Placemark in mission fragments, look for
        # completeness retrieved in Datatake completeness cache
        # Apply to fragments a function with arguments acq_day, day_fragment
        for satellite, sat_fragments in self.mission_fragments.items():
            logger.debug(
                "Setting Completeness on fragments for satellite: %s", satellite
            )
            # browse sat fragments
            fragment_days = sat_fragments.day_list
            # TODO: Receive notification if fragments needs to be removed!
            self._set_completeness_day_list(fragment_days, sat_fragments, satellite)

    def _set_completeness_day_list(self, day_list, sat_fragments, satellite):
        for acq_day in day_list:
            logger.debug(
                "Setting completeness for Fragment of satellite %s, day %s",
                satellite,
                acq_day,
            )
            # each sat_fragment is a folder related to a single day
            day_fragment = sat_fragments.get_fragment(acq_day)
            logger.debug(
                "Day fragment for day %s - name: %s",
                acq_day,
                day_fragment.folder_kml.name,
            )

            # Extract datatakes with completeness data
            # from  cache
            day_datatakes = self.daily_datatakes.get(acq_day)
            if day_datatakes is not None:
                day_sat_datatakes = day_datatakes.get(satellite)
                # logger.debug("From Cache, datatakes for day %s: and sat %s: %s",
                #             acq_day, satellite, day_sat_datatakes)
                self._load_datatake_completeness_on_placemarks(
                    day_sat_datatakes,
                    day_fragment,
                    satellite,
                    self.datatake_id_key,
                    self.datatake_id_decoder,
                )
            else:
                # if folder in the future,  set  PLANNED COMPLETENESS on all Placemarks
                logger.debug(
                    "No datatakes found for day %s and sat %s", acq_day, satellite
                )
                if day_fragment.is_future:
                    self._load_completeness_on_placemarks(
                        PLANNED_COMPLETENESS, satellite, day_fragment.placemark_list
                    )
                else:
                    # TODO : Remove the whole folder if in the past,
                    logger.debug(
                        "Removing from Fragment %s placemarks not found in Datatakes cache",
                        day_fragment.day,
                    )

    def _load_completeness_on_placemarks(self, completeness, id_prefix, placemarks):
        for pm in placemarks:
            acq_dt = AcqDatatake(pm, self.datatake_id_key)
            dt_id = acq_dt.add_id_prefix(id_prefix, self.datatake_id_decoder)
            # TODO: Move to acq_dt.set_completeness(completeness) or to self.add_datatake_completeness
            FragmentCompletenessHandler.add_datatake_completeness(acq_dt, completeness)
            # logger.debug("Placemark after update: %s", acq_dt)
