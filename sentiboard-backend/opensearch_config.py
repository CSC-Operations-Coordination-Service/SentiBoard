"""Where and how to reach OpenSearch, read once from the environment.

OPENSEARCH_URL            address, default http://localhost:9200
OPENSEARCH_USER           basic auth user; set together with OPENSEARCH_PASSWORD
OPENSEARCH_PASSWORD       basic auth password
OPENSEARCH_VERIFY_CERTS   "false" turns TLS verification off, anything else keeps it on
OPENSEARCH_CA_CERTS       path to a CA bundle to trust instead of the system store

The credentials are separate from the URL so a password with special characters needs no
URL-encoding, and so the URL can be logged.
"""

import os

from opensearchpy import OpenSearch

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")


def client_kwargs() -> dict:
    """Keyword arguments for `OpenSearch(...)` and `connections.create_connection(...)`."""
    user = os.getenv("OPENSEARCH_USER")
    password = os.getenv("OPENSEARCH_PASSWORD")
    if bool(user) != bool(password):
        raise ValueError("OPENSEARCH_USER and OPENSEARCH_PASSWORD must be set together")

    verify = os.getenv("OPENSEARCH_VERIFY_CERTS", "true").strip().lower() != "false"
    kwargs: dict = {"verify_certs": verify}
    if not verify:
        # One urllib3 warning per request otherwise; the choice is already explicit.
        kwargs["ssl_show_warn"] = False
    ca_certs = os.getenv("OPENSEARCH_CA_CERTS")
    if ca_certs:
        kwargs["ca_certs"] = ca_certs
    if user:
        kwargs["http_auth"] = (user, password)
    return kwargs


def new_client(**extra) -> OpenSearch:
    """A client for OPENSEARCH_URL with the settings above; `extra` overrides them."""
    return OpenSearch(OPENSEARCH_URL, **{**client_kwargs(), **extra})
