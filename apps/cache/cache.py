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

import threading


class ConfigCacheSingleton:
    _instance = None
    _lock = threading.Lock()
    __magazine = []

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super(ConfigCacheSingleton, cls).__new__(cls)
        return cls._instance

    def store_object(self, key, value):
        obj = {key: value}
        return self.__magazine.append(obj)

    def load_object(self, key):
        for item in self.__magazine:
            value = item.get(key, None)
            if value is not None:
                return value
        return None

    def load_all(self):
        return self.__magazine


class PublicationProductTreeCacheSingleton:
    _instance = None
    _lock = threading.Lock()
    __magazine = []

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super(
                        PublicationProductTreeCacheSingleton, cls
                    ).__new__(cls)
        return cls._instance

    def store_object(self, key, value):
        obj = {key: value}
        return self.__magazine.append(obj)

    def load_object(self, key):
        for item in self.__magazine:
            value = item.get(key, None)
            if value is not None:
                return value
        return None

    def load_all(self):
        return self.__magazine


class MissionTimelinessCacheSingleton:
    _instance = None
    _lock = threading.Lock()
    __magazine = []

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super(MissionTimelinessCacheSingleton, cls).__new__(
                        cls
                    )
        return cls._instance

    def store_object(self, key, value):
        obj = {key: value}
        return self.__magazine.append(obj)

    def load_object(self, key):
        for item in self.__magazine:
            value = item.get(key, None)
            if value is not None:
                return value
        return None

    def load_all(self):
        return self.__magazine


class PublicationProductTreeCache(metaclass=PublicationProductTreeCacheSingleton):
    pass


class MissionTimelinessCache(metaclass=MissionTimelinessCacheSingleton):
    pass


class ConfigCache(metaclass=ConfigCacheSingleton):
    pass
