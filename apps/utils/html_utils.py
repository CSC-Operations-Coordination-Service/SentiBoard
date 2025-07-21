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

import logging
import ssl
import urllib.request

logger = logging.getLogger(__name__)


def get_html_page(url, decode_utf=True):
    try:
        ctx = ssl.create_default_context()
        
        with urllib.request.urlopen(url, context=ctx) as fp:
            mybytes = fp.read()
            html_page = mybytes.decode('utf-8', 'ignore') if decode_utf else mybytes
        # fp.close()
        return html_page
    except Exception as ex:
        logger.error("While invoking url: %s, received error: %s", url, ex, exc_info=True)
        return None
