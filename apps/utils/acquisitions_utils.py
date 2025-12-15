def build_acquisition_payload(acquisitions, edrs_acquisitions):
    payload = {
        "global": {
            "planned": 0,
            "successful": 0,
            "fail_sat": 0,
            "fail_acq": 0,
            "fail_other": 0,
        },
        "stations": {},
        "edrs": {
            "successful": 0,
            "percentage": 0,
        },
    }

    stations = ["svalbard", "inuvik", "matera", "maspalomas", "neustrelitz"]

    for st in stations:
        payload["stations"][st] = {
            "successful": 0,
            "total": 0,
            "percentage": 0,
        }

    # ---- Acquisitions ----
    for row in acquisitions:
        src = row["_source"]

        payload["global"]["planned"] += 1

        ok = (
            src.get("antenna_status") == "OK"
            and src.get("delivery_push_status") == "OK"
            and src.get("front_end_status") == "OK"
        )

        station = src.get("ground_station", "").lower()

        if ok:
            payload["global"]["successful"] += 1
            if station in payload["stations"]:
                payload["stations"][station]["successful"] += 1
        else:
            origin = (src.get("cams_origin") or "").lower()
            if "sat" in origin:
                payload["global"]["fail_sat"] += 1
            elif "acquis" in origin:
                payload["global"]["fail_acq"] += 1
            else:
                payload["global"]["fail_other"] += 1

        if station in payload["stations"]:
            payload["stations"][station]["total"] += 1

    # ---- Percentages ----
    for st, data in payload["stations"].items():
        if data["total"] > 0:
            data["percentage"] = round(100 * data["successful"] / data["total"], 1)

    # ---- EDRS ----
    total_edrs = len(edrs_acquisitions)
    success_edrs = sum(
        1 for r in edrs_acquisitions if r["_source"].get("total_status") == "OK"
    )

    payload["edrs"]["successful"] = success_edrs
    payload["edrs"]["percentage"] = (
        round(100 * success_edrs / total_edrs, 1) if total_edrs else 0
    )

    return payload
