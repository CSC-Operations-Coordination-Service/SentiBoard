# SentiBoard backend

FastAPI + OpenSearch, run with Docker. Only Docker is needed, not Python.

## 1. Start

```
cd sentiboard-backend
docker compose up -d --build
curl localhost:8000/health          # {"status":"ok"} once ready (~30s on first start)
```

- API docs: http://localhost:8000/docs
- OpenSearch: http://localhost:9200 (security off, development only)

## 2. Load the legacy data

Put the SQLite backup in `legacy_data/sentiboard/` at the repo root.
That folder is gitignored and must never be committed.

```
# dry run: checks every row, writes nothing
docker compose run --rm api python migrate_legacy.py /legacy_data/sentiboard/<file>.db

# write it
docker compose run --rm api python migrate_legacy.py /legacy_data/sentiboard/<file>.db --apply
```

- Safe to re-run: records already loaded are skipped.
- Anomalies: 3895 rows become 3720 docs. 171 are duplicate pairs from the old
  `PDGSANOM-` → `GSANOM-` key rename, merged into one record each (no data lost),
  and 4 are hidden "Dashboard" anomalies, excluded by default.
- Add `--include-dashboard` to also load the 4 Dashboard anomalies.
- Git Bash on Windows: put `MSYS_NO_PATHCONV=1` before `docker compose run`, or the path gets mangled.

### Processor releases

Put the Config Tools Mongo dump in `legacy_data/config_tools/` (also gitignored, never commit).

```
# dry run
docker compose run --rm api python migrate_processors.py /legacy_data/config_tools/<dump>/configuration_tool_db/Graph.bson

# write it
docker compose run --rm api python migrate_processors.py /legacy_data/config_tools/<dump>/configuration_tool_db/Graph.bson --apply
```

- Safe to re-run, same as above.
- 3 of 231 releases are skipped (no `release_date`, which the monthly processor indices need); their ids are printed.
- A version saved as `undefined` by the Config Tool (3 releases) is stored as no version, e.g. `S1_L1L2:`.

Check it worked:

```
curl "localhost:8000/anomaly/?limit=5"
curl "localhost:8000/processor/?limit=5"
```

Endpoints: `/anomaly/`, `/news/`, `/instantmessage/`, `/processor/`.
Lists take `?offset=0&limit=100` (max 1000).

## 3. Stop

```
docker compose down        # stop, keep data
docker compose down -v     # stop and wipe all data
```

## Settings

| Variable | Default |
|---|---|
| `OPENSEARCH_URL` | `http://localhost:9200` (`http://opensearch:9200` in Docker) |
| `CORS_ORIGINS` | `http://localhost:3000` (comma-separated) |
