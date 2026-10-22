"""SentiBoard backend API.

    uvicorn main:app --reload        # API docs: http://localhost:8000/docs
    (or `docker compose up -d`, see docker-compose.yml)

OPENSEARCH_URL  OpenSearch address, default http://localhost:9200
CORS_ORIGINS    comma-separated frontend origins, default http://localhost:3000
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from opensearchpy import OpenSearch, connections

from routers import router
from setup_indices import OPENSEARCH_URL, setup


@asynccontextmanager
async def lifespan(app):
    # Default connection used by every generated document; setup() creates any
    # missing index templates/indices so the API also works on a fresh OpenSearch.
    setup(connections.create_connection(hosts=[OPENSEARCH_URL]), apply=True)
    yield


app = FastAPI(title="SentiBoard API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Location"],  # set by POST, holds the new resource's URL
)
app.include_router(router)

# Own client without retries, so /health answers in seconds when OpenSearch is down.
_health_client = OpenSearch(OPENSEARCH_URL, max_retries=0)


@app.get("/health")
def health():
    """200 when the API and OpenSearch are both up, 503 otherwise."""
    if not _health_client.ping():
        raise HTTPException(status_code=503, detail="OpenSearch unreachable")
    return {"status": "ok"}
