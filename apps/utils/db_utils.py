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

import json
import logging
import uuid
from datetime import datetime

from sqlalchemy.ext.declarative import DeclarativeMeta

logger = logging.getLogger(__name__)


class AlchemyEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, list):
            list_obj = []
            for o in obj:
                list_obj.append(self.cast(o))
            return list_obj
        else:
            return self.cast(obj)

    def cast(self, obj):
        if isinstance(obj.__class__, DeclarativeMeta):
            fields = {}
            for field in [x for x in dir(obj) if not x.startswith('_') and x != 'metadata']:
                data = obj.__getattribute__(field)
                try:
                    if isinstance(data, datetime):
                        format_data = "%d/%m/%Y %H:%M:%S"
                        data = data.strftime(format_data)
                    else:
                        json.dumps(data)
                    fields[field] = data
                except TypeError:
                    fields[field] = None
            return fields


def generate_uuid():
    return str(uuid.uuid1()).replace('-', '_')
