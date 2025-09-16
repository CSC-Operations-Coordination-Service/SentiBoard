from datetime import datetime
import logging
from apps.utils import date_utils
from dateutil.relativedelta import relativedelta
import logging
from apps.models.anomalies import Anomalies

def get_previous_quarter_anomalies():
    start_date, _ = date_utils.prev_quarter_interval_from_date(datetime.today())
    end_date = datetime.today().replace(hour=23, minute=59, second=59)
    result = Anomalies.query.filter(
        Anomalies.start >= start_date,
        Anomalies.start <= end_date
    ).all()
    return result

def get_last_quarter_anomalies():
    start_date = datetime.today() - relativedelta(months=3)
    end_date = datetime.today().replace(hour=23, minute=59, second=59)
    return Anomalies.query.filter(
        Anomalies.start >= start_date,
        Anomalies.start <= end_date
    ).all()

def serialize_anomalie(anomalie):
    return {
        "id": anomalie.id,
        "key": anomalie.key,
        "title": anomalie.title,
        "text": anomalie.text,
        "publicationDate": anomalie.publicationDate.isoformat() if anomalie.publicationDate else None,
        "category": anomalie.category,
        "impactedSatellite": anomalie.impactedSatellite,
        "impactedItem": anomalie.impactedItem,
        "startDate": anomalie.start.isoformat() if anomalie.start else None,
        "endDate": anomalie.end.isoformat() if anomalie.end else None,
        "environment": anomalie.environment,
        "datatakesCompleteness": anomalie.datatakes_completeness,
        "newsLink": anomalie.newsLink,
        "newsTitle": anomalie.newsTitle,
        "modifyDate": anomalie.modifyDate.isoformat() if anomalie.modifyDate else None
    }
