# SentiBoard backend

FastAPI + OpenSearch, run with Docker. Only Docker is needed, not Python.

## 1. Start

```
cd backend
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
- Add `--include-dashboard` to also load the 4 hidden "Dashboard" anomalies.
- Git Bash on Windows: put `MSYS_NO_PATHCONV=1` before `docker compose run`, or the path gets mangled.

Check it worked:

```
curl "localhost:8000/anomaly/?limit=5"
```

Endpoints: `/anomaly/`, `/news/`, `/instantmessage/`, `/processor/` (empty until processor data is loaded).
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
