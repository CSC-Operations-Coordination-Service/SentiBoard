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
| `OPENSEARCH_USER`, `OPENSEARCH_PASSWORD` | none: no authentication. Set both or neither |
| `OPENSEARCH_VERIFY_CERTS` | `true`. Only the value `false` turns TLS verification off |
| `OPENSEARCH_CA_CERTS` | none: the system CA store. A path to a CA bundle to trust instead |
| `CORS_ORIGINS` | `http://localhost:3000` (comma-separated) |

## Startup and probes

At start the API installs the index templates and creates the first indices
(`setup_indices.py`). It writes to OpenSearch, so its user needs that right.

| situation at start | result |
|---|---|
| OpenSearch answers | indices set up, `/readyz` is 200 |
| OpenSearch is unreachable | the API starts anyway and retries every 30 s. Routes that need OpenSearch answer 503, `/readyz` is 503 |
| anything else: rejected credentials, a TLS error, a template or index that cannot be applied | the process exits before it is healthy, so a rolling update stops on the new task and the old one keeps serving |

| probe | meaning |
|---|---|
| `/healthz` | liveness: 200 whenever the process answers, whatever OpenSearch does |
| `/readyz` | readiness: 200 only when OpenSearch answers and the indices are set up |
| `/health` | 200 when OpenSearch answers, 503 otherwise. Kept for existing callers |
