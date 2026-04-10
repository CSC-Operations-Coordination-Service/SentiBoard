import datetime


def normalize_anomalie(anomaly):
    return {
        "id": anomaly.get("_id"),
        "key": anomaly.get("key"),
        "title": anomaly.get("title"),
        "text": anomaly.get("text"),
        "publicationDate": anomaly.get("publicationDate").isoformat() if anomaly.get("publicationDate") else None,
        "category": anomaly.get("category"),
        "impactedSatellite": anomaly.get("impactedSatellite"),
        "impactedItem": anomaly.get("impactedItem"),
        "startDate": anomaly.get("start").isoformat() if anomaly.get("start") else None,
        "endDate": anomaly.get("end").isoformat() if anomaly.get("end") else None,
        "environment": anomaly.get("environment"),
        "datatakesCompleteness": anomaly.get("datatakes_completeness"),
        "newsLink": anomaly.get("newsLink"),
        "newsTitle": anomaly.get("newsTitle"),
        "modifyDate": anomaly.get("modifyDate").isoformat() if anomaly.get("modifyDate") else None
    }
    
def model_to_dict(obj, exclude=None):
    """Convert SQLAlchemy or dataclass-like objects into JSON-safe dicts."""
    
    if obj is None:
        return None
    
    if exclude is None:
        exclude = set()
        
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, datetime.datetime):
        return obj.strftime("%Y-%m-%d %H:%M:%S")

    if isinstance(obj, datetime.date):
        return obj.strftime("%Y-%m-%d")

    if isinstance(obj, dict):
        return {k: model_to_dict(v, exclude) for k, v in obj.items() if k not in exclude}

    if isinstance(obj, (list, tuple, set)):
        return [model_to_dict(item, exclude) for item in obj]

    # Try to handle SQLAlchemy model objects
    if hasattr(obj, "__dict__"):
        result = {}
        for key, value in vars(obj).items():
            if key.startswith("_") or key in exclude:
                continue
            result[key] = model_to_dict(value, exclude)
        return result

    # Fallback: just convert to string
    return str(obj)