"""Adapters to the outside world (OpenSearch, HTTP), implementing the ports in
`domain/ports.py`. Blocking clients: called from sync routes, which FastAPI runs in its
threadpool, so the event loop is never blocked."""
