# infra — container images for the new apps (DEVOCS-219)

Nothing here touches the existing Flask deployment. The root `Dockerfile`,
`docker-compose.yml` and `gunicorn-cfg.py` are unchanged, and the current staging
container keeps working exactly as it does today.

| File | Builds | Status |
| --- | --- | --- |
| `dockerfiles/mockups.Dockerfile` | React UI mockups → static files behind nginx | **ready to deploy** |
| `nginx/mockups.conf` | SPA routing for the above | ready |
| `dockerfiles/frontend.Dockerfile` | Next.js app, production (standalone) | written, untested on the server |
| `dockerfiles/frontend.dev.Dockerfile` | Next.js app, dev with hot reload | written, untested on the server |

Not written yet, because the frontend + API deployment is still an open question (see
the bottom of this file): the processors-API image and a compose file to wire the two
together.

All images build from the **repository root** as context. `.dockerignore` at the root
trims that from ~804 MB to ~344 MB and excludes only regenerable artefacts, so the
Flask image is unaffected.

---

## Deploying the mockups

The mockups are static: no API, no database, no `.env`, no certificates. The `patch/`
folder the Flask deployment needs is **not** required here, so the usual procedure
loses its two most fragile steps.

### Decide where it is served from first

Asset URLs are baked at build time, so this cannot be changed afterwards without a
rebuild.

| Hosting | Build argument |
| --- | --- |
| own subdomain, e.g. `mockups.ocs.staging…` | none — defaults to `/` |
| path on the existing domain, e.g. `…/mockups/` | `--build-arg VITE_BASE=/mockups/` |
| raw port, e.g. `172.28.89.5:8082` | none — defaults to `/` |

`VITE_BASE` feeds both Vite's asset base and react-router's `basename`, so the two
cannot drift apart. It must end with a slash.

### Commands

On the staging host, in a fresh directory:

```bash
git clone --single-branch --branch feature-DEVOCS-219-Frontend-Restyling \
  https://github.com/CSC-Operations-Coordination-Service/SentiBoard.git
cd SentiBoard

sudo docker rm -f sentiboard-mockups
sudo docker image rm -f sentiboard-mockups:latest

# add --build-arg VITE_BASE=/mockups/ if serving under a path
sudo docker build \
  --build-arg HTTP_PROXY=http://192.168.80.2:3128 \
  --build-arg HTTPS_PROXY=http://192.168.80.2:3128 \
  -f infra/dockerfiles/mockups.Dockerfile \
  -t sentiboard-mockups:latest .

sudo docker run -d --restart always -p 8082:8080 \
  --name sentiboard-mockups sentiboard-mockups:latest

sudo docker logs sentiboard-mockups
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:8082/    # expect 200
```

The container listens on **8080** and needs no proxy at runtime — it serves files and
makes no outbound calls. Only the build needs the proxy, for `npm ci`.

### Reverse proxy

If it goes behind a path on the existing domain, the proxy should **strip** the prefix
before forwarding — the trailing slash on `proxy_pass` does that:

```nginx
location /mockups/ {
    proxy_pass http://127.0.0.1:8082/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The browser requests `/mockups/assets/x.js`, the proxy forwards `/assets/x.js`, nginx
serves it. If the prefix is forwarded *unstripped* instead, `nginx/mockups.conf` needs
adjusting — say so rather than working around it.

### Check it actually works

Deep links are the thing that breaks with a misconfigured SPA, and they are exactly
what gets shared:

```
/                  landing page
/about             About layout A
/examples/about    About layout B
/examples          index proposals
/processors        processors mockup (static data — not the live page)
```

Open `/examples/about` **directly** and reload it. If that 404s, the SPA fallback or
the proxy prefix is wrong. Everything working from the nav but failing on reload is
the classic signature.

### Known risks

- **`npm ci` through the proxy** has never been exercised on that host. It is the most
  likely failure, and it fails at build time, so it is safe to discover.
- The image is ~23 MB of assets, 20 MB of which is the home page video
  (`public/assets/mv/home.mp4`).

---

## The frontend + processors API is still open

Deploying the Next.js app alongside the FastAPI processors service needs a decision
nobody has made yet:

1. Can the devsecops pipeline build a **compose stack**, or does it expect one image
   per repository? SentiBoard currently produces a single Flask image.
2. Who owns the processors-API image — it packages `apps/sentiboard_backend`, which is
   DEVOCS-220 work, not DEVOCS-219.
3. Should this have its own ticket? It is a change to how SentiBoard deploys, which is
   broader than a frontend ticket.

Until those are answered, the frontend is demonstrated locally:

```bash
cd apps/sentiboard_backend && ./.venv/bin/uvicorn main:app --port 8000   # terminal 1
cd frontend && npm run dev                                              # terminal 2
# → http://localhost:3000/v1/processors
```

The two frontend Dockerfiles here follow the pattern in `ocs-portal`
(`infra/dockerfiles/`, `infra/compose/docker-compose.dev.yml`) so they should drop into
that arrangement when the questions above are settled. One deliberate difference: no
`BACKEND_ORIGIN` build argument. `ocs-portal` bakes it because its `next.config.mjs`
uses `rewrites()`, which resolves at build time. This app has no `rewrites()` —
`lib/data.ts` reads `PROCESSORS_API_URL` per request, server-side — so the API location
stays a runtime environment variable and can be repointed without rebuilding.
