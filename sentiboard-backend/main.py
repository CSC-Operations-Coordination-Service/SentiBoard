"""SentiBoard backend API.

    uvicorn main:app --reload        # API docs: http://localhost:8000/docs
    (or `docker compose up -d`, see docker-compose.yml)

OPENSEARCH_*    where and how to reach OpenSearch, see opensearch_config.py
CORS_ORIGINS    comma-separated frontend origins, default http://localhost:3000

Startup installs the index templates and first indices (setup_indices.py), then:
  - OpenSearch unreachable: the API starts anyway and retries the setup in the background.
    Data routes answer 503 until it is back; /healthz stays 200, /readyz says 503.
  - any other failure (bad credentials, TLS, a conflicting index, a rejected template): the
    process exits before it is ever healthy, so a rolling update stops on the new task and the
    old one keeps serving.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opensearchpy import connections
from opensearchpy.exceptions import ConnectionError as OpenSearchConnectionError
from opensearchpy.exceptions import SSLError

from opensearch_config import client_kwargs, new_client, OPENSEARCH_URL
from routers import router
from setup_indices import setup

log = logging.getLogger("uvicorn.error")

SETUP_RETRY_SECONDS = 30


def unreachable(exc: Exception) -> bool:
    """True when OpenSearch cannot be reached. A TLS failure is a ConnectionError too, but it
    is a configuration error that waiting will not fix, so it does not count."""
    return isinstance(exc, OpenSearchConnectionError) and not isinstance(exc, SSLError)


async def _retry_setup(app: FastAPI) -> None:
    """Run the setup again until OpenSearch answers. Any other failure ends the task and is
    logged; /readyz keeps saying 503, so the problem shows up instead of being hidden."""
    while True:
        await asyncio.sleep(SETUP_RETRY_SECONDS)
        try:
            await run_in_threadpool(setup, connections.get_connection(), True)
        except Exception as exc:
            if unreachable(exc):
                log.warning("OpenSearch still unreachable, setup retried in %ss",
                            SETUP_RETRY_SECONDS)
                continue
            log.exception("Index setup failed after startup; the API stays up on 503")
            return
        app.state.indices_ready = True
        log.info("OpenSearch reachable, indices set up")
        return


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Default connection used by every generated document; setup() creates any
    # missing index templates/indices so the API also works on a fresh OpenSearch.
    client = connections.create_connection(hosts=[OPENSEARCH_URL], **client_kwargs())
    app.state.indices_ready = False
    retry = None
    try:
        await run_in_threadpool(setup, client, True)
        app.state.indices_ready = True
    except Exception as exc:
        if not unreachable(exc):
            raise  # not healthy, ever: see the module docstring
        log.warning("OpenSearch unreachable at startup (%s); serving without it, "
                    "setup retried every %ss", OPENSEARCH_URL, SETUP_RETRY_SECONDS)
        retry = asyncio.create_task(_retry_setup(app))
    yield
    if retry:
        retry.cancel()
        with suppress(asyncio.CancelledError):
            await retry


app = FastAPI(title="SentiBoard API", lifespan=lifespan)
# Read by /readyz. TestClient without `with` never runs the lifespan, so it needs a value.
app.state.indices_ready = False
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Location"],  # set by POST, holds the new resource's URL
)
app.include_router(router)


@app.exception_handler(OpenSearchConnectionError)
async def opensearch_unreachable(request: Request, exc: OpenSearchConnectionError):
    """Any route that needed OpenSearch while it was down: one JSON shape, not a stack trace."""
    return JSONResponse(status_code=503, content={"detail": "OpenSearch unreachable"})


# Own client without retries, so the probes answer in seconds when OpenSearch is down.
_health_client = new_client(max_retries=0)


@app.get("/healthz")
def healthz():
    """Liveness: 200 whenever the process answers. Never looks at OpenSearch, so an outage
    does not make the orchestrator restart a healthy API."""
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    """Readiness: 200 when OpenSearch answers and the indices are set up, 503 otherwise."""
    if not _health_client.ping():
        raise HTTPException(status_code=503, detail="OpenSearch unreachable")
    if not app.state.indices_ready:
        raise HTTPException(status_code=503, detail="Indices not set up yet")
    return {"status": "ok"}


@app.get("/health")
def health():
    """200 when the API and OpenSearch are both up, 503 otherwise. Kept for existing callers;
    new ones want /healthz or /readyz."""
    if not _health_client.ping():
        raise HTTPException(status_code=503, detail="OpenSearch unreachable")
    return {"status": "ok"}
