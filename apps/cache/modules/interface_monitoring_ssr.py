# apps.cache.modules.interface_monitoring_ssr
import logging
from datetime import datetime, timedelta
from time import perf_counter
from flask import Response
import json

from apps import flask_cache
import apps.elastic.modules.interface_monitoring as elastic_interface_monitoring

logger = logging.getLogger(__name__)

# SAME KEY, SAME TTL → DIFFERENT CONTENT (python objects)
interface_monitoring_cache_key = (
    "/api/reporting/cds-interface-status-monitoring/{}-{}/{}"
)

interface_monitoring_cache_duration = 604800  # 7 days

SERVICE_NAME_MAP = {
    "DAS": "DD_DAS",
    "DHUS": "DD_DHUS",
    "ACRI": "LTA_Acri",
    "CLOUDFERRO": "LTA_CloudFerro",
    "EXPRIVIA": "LTA_Exprivia",
    "WERUM": "LTA_Werum",
}


def load_interface_monitoring_cache_last_quarter_ssr(es_service):
    """
    SSR-only loader.
    Stores RAW python objects in cache (NO Flask Response).
    """
    logger.info("[SSR][BEG] Loading Interface Monitoring Status (last quarter)")
    t0 = perf_counter()

    status_list_last_quarter = (
        elastic_interface_monitoring.fetch_interface_monitoring_last_quarter(es_service)
    )

    now = datetime.utcnow()

    last_24h = []
    last_7d = []
    last_30d = []

    for ev in status_list_last_quarter:
        try:
            status_start = datetime.strptime(
                ev["_source"]["status_time_start"],
                "%Y-%m-%dT%H:%M:%S.%fZ",
            )
        except Exception:
            continue

        if now - timedelta(hours=24) <= status_start:
            last_24h.append(ev)
        if now - timedelta(days=7) <= status_start:
            last_7d.append(ev)
        if now - timedelta(days=30) <= status_start:
            last_30d.append(ev)

    _set_interface_monitoring_cache_ssr("24h", es_service, last_24h)
    _set_interface_monitoring_cache_ssr("7d", es_service, last_7d)
    _set_interface_monitoring_cache_ssr("30d", es_service, last_30d)
    _set_interface_monitoring_cache_ssr("quarter", es_service, status_list_last_quarter)

    logger.info(
        "[SSR][END] Last quarter cache ready in %.4fs",
        perf_counter() - t0,
    )


def load_interface_monitoring_cache_prev_quarter_ssr(service_name):
    """
    SSR-only previous quarter loader.
    """
    logger.info("[SSR][BEG] Loading Interface Monitoring Status (prev quarter)")
    t0 = perf_counter()

    status_list_prev_quarter = (
        elastic_interface_monitoring.fetch_interface_monitoring_prev_quarter(
            service_name
        )
    )

    _set_interface_monitoring_cache_ssr(
        "previous-quarter", service_name, status_list_prev_quarter
    )

    logger.info(
        "[SSR][END] Previous quarter cache ready in %.4fs",
        perf_counter() - t0,
    )


def _set_interface_monitoring_cache_ssr(period_id, service_name, period_data):
    """
    SSR-safe cache writer.
    Stores ONLY python objects (list[dict]).
    """
    logger.debug(
        "[SSR][CACHE SET] period=%s service=%s size=%d",
        period_id,
        service_name,
        len(period_data),
    )

    if period_id == "previous-quarter":
        cache_key = interface_monitoring_cache_key.format(
            "previous", "quarter", service_name
        )
    else:
        cache_key = interface_monitoring_cache_key.format(
            "last", period_id, service_name
        )

    flask_cache.set(
        cache_key,
        period_data,  #  NO Response
        interface_monitoring_cache_duration,
    )


def load_interface_events_ssr(*, service: str, period_type: str, period_id: str):
    es_service = SERVICE_NAME_MAP.get(service)
    if not es_service:
        logger.error("[SSR][IM] Unknown service: %s", service)
        return []

    # Resolve cache key
    if period_type == "previous":
        cache_key = interface_monitoring_cache_key.format(
            "previous", "quarter", es_service
        )
    else:
        cache_key = interface_monitoring_cache_key.format("last", period_id, es_service)

    cached = flask_cache.get(cache_key)

    logger.info(
        "[SSR][IM CACHE READ] service=%s key=%s-%s hit=%s size=%s",
        es_service,
        cache_key,
        bool(cached),
        len(cached) if isinstance(cached, list) else "N/A",
    )

    # Type safety (CRITICAL)
    if not cached:
        return []

    if not isinstance(cached, list):
        logger.error(
            "[SSR][IM][INVALID CACHE TYPE] key=%s type=%s",
            cache_key,
            type(cached),
        )
        return []

    return cached


def read_interface_events_ssr(service: str, period_type: str, period_id: str):
    es_service = SERVICE_NAME_MAP[service]
    if not es_service:
        logger.error("[SSR][IM] Unknown service: %s", service)
        return []

    # MATCH ORIGINAL WRITER EXACTLY
    if period_type == "previous" and period_id == "quarter":
        cache_key = (
            interface_monitoring_cache_key.format("previous-quarter", "", es_service)
            .replace("--", "-")
            .rstrip("-")
        )
    elif period_type == "last":
        cache_key = interface_monitoring_cache_key.format("last", period_id, es_service)
    else:
        return []

    cached = flask_cache.get(cache_key)

    logger.info(
        "[SSR][IM CACHE READ] service=%s key=%s hit=%s size=%s",
        service,
        cache_key,
        bool(cached),
        len(cached.get_data()) if hasattr(cached, "get_data") else 0,
    )

    if not cached:
        return []

    if isinstance(cached, Response):
        return json.loads(cached.get_data(as_text=True))

    if isinstance(cached, str):
        return json.loads(cached)

    return cached


def ensure_interface_cache_loaded_ssr(service: str):
    """
    Load ALL interface monitoring cache for a service ONCE.
    Must be called before any read_interface_events_ssr().
    """
    es_service = SERVICE_NAME_MAP.get(service)
    if not es_service:
        logger.error("[SSR][IM] Unknown service: %s", service)
        return

    # Load once per service
    load_interface_monitoring_cache_last_quarter_ssr(es_service)
    load_interface_monitoring_cache_prev_quarter_ssr(es_service)
