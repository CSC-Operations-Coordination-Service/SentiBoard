# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
"""

from bs4 import BeautifulSoup


class ScarperHtml:

    def __init__(self, html_text):
        self.__soup = BeautifulSoup(html_text, "html.parser")
        return

    def html_format(self):
        return self.__soup.prettify()

    def find_all_element(self, type):
        return self.__soup.findAll(type)

    def get_element_by_id(self, element_type, element_id):
        return self.__soup.find(element_type, {"id": element_id})

    def get_element_by_class(self, element_type, element_id):
        return self.__soup.find(element_type, {"class": element_id})

    def get_elements_by_class(self, element_type, element_id):
        return self.__soup.findAll(element_type, {"class": element_id})

    def ingestion_by_string(self, html_text):
        self.__soup = BeautifulSoup(html_text, "html.parser")
        return
