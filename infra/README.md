# infra — container images for the new apps (DEVOCS-219)

Nothing here touches the existing Flask deployment. The root `Dockerfile`,
`docker-compose.yml` and `gunicorn-cfg.py` are unchanged, and the current staging
container keeps working exactly as it does today.

| File | Builds | Status |
| --- | --- | --- |
| `dockerfiles/mockups.Dockerfile` | React UI mockups → static files behind nginx | **deployed** on `172.28.89.6:3000` |
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

### The branch never reaches the server

There is no git checkout on the staging host — logging in shows an empty home directory,
and that is correct. The image is built **on your own machine** from whatever branch is
checked out, saved to a tar, and the tar is transferred. The server only ever holds the
resulting image.

Two consequences worth knowing before you build:

- `docker build` reads the **working tree**, not the commit. Uncommitted changes ship, and
  the deployed image then corresponds to no commit. Run `git status --short` first and
  decide whether that is what you want.
- Updating the deployment means rebuilding locally and repeating the transfer. There is
  nothing to `git pull` on the host.

### Hosts

Internal short names have **no DNS** from a laptop on the VPN — `oer-sbd-bend-01` is only
what the machine calls itself in its own shell prompt. Always use the IP, or add the name
to your local `/etc/hosts`.

| Host | IP | Runs |
| --- | --- | --- |
| `oer-sbd-bend-01` | `172.28.89.6` | **the mockups**, port 3000 |
| `oer-sbd-fend-01` | `172.28.89.5` | the Flask app — *not* the mockups host |

`172.28.89.5` is the IP most used historically for the Flask deployment, which makes it
the easy wrong answer. Confirm with `hostname` after logging in.

Access is by key (`~/.ssh/OCS`) and is not optional: these hosts refuse password auth with
`Permission denied (publickey)`.

### Decide where it is served from first

Asset URLs are baked at build time, so this cannot be changed afterwards without a
rebuild.

| Hosting | Build argument |
| --- | --- |
| own subdomain, e.g. `mockups.ocs.staging…` | none — defaults to `/` |
| path on the existing domain, e.g. `…/mockups/` | `--build-arg VITE_BASE=/mockups/` |
| raw port — **what is deployed today**, `172.28.89.6:3000` | none — defaults to `/` |

`VITE_BASE` feeds both Vite's asset base and react-router's `basename`, so the two
cannot drift apart. It must end with a slash.

### Commands

Every command below is labelled by where it runs. Crossing that line is the most common
way this goes wrong — the transfer step in particular looks like a server command and is
not.

**On your machine — build:**

```bash
git status --short          # whatever this lists gets baked into the image

# add --build-arg VITE_BASE=/mockups/ if serving under a path
docker build \
  -f infra/dockerfiles/mockups.Dockerfile \
  -t sentiboard-mockups:latest .
```

Add the proxy build arguments only if `npm ci` fails on DNS — a laptop with direct
internet does not need them:

```bash
  --build-arg HTTP_PROXY=http://192.168.80.2:3128 \
  --build-arg HTTPS_PROXY=http://192.168.80.2:3128 \
```

**On your machine — test before transferring.** The image is identical to what the server
will run, so a failure here is a failure there, discovered 71 MB earlier:

```bash
docker run -d --rm -p 3000:8080 --name mockups-test sentiboard-mockups:latest
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3000/                # 200
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3000/examples/about  # 200
docker stop mockups-test
```

**On your machine — transfer:**

```bash
docker save -o /tmp/sentiboard-mockups.tar sentiboard-mockups:latest
ls -lh /tmp/sentiboard-mockups.tar      # ~71 MB
scp -i ~/.ssh/OCS /tmp/sentiboard-mockups.tar adelvalle@172.28.89.6:/tmp/
```

**On the server — load and run:**

```bash
ssh -i ~/.ssh/OCS adelvalle@172.28.89.6

hostname                                # expect oer-sbd-bend-01
ls -lh /tmp/sentiboard-mockups.tar      # must show ~71 MB before continuing

# tag first: loading a new :latest orphans the current image and loses the rollback
sudo docker tag sentiboard-mockups:latest sentiboard-mockups:previous

sudo docker load -i /tmp/sentiboard-mockups.tar
sudo docker stop sentiboard-mockups && sudo docker rm sentiboard-mockups
sudo docker run -d --restart always -p 3000:8080 \
  --name sentiboard-mockups sentiboard-mockups:latest

sudo docker logs sentiboard-mockups
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3000/
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3000/examples/about
rm /tmp/sentiboard-mockups.tar
exit
```

Port **3000** is not a free choice — it is the only port known to be open on that host.
The container itself listens on 8080 as an unprivileged nginx, and needs no proxy at
runtime: it serves files and makes no outbound calls. Only the build needs the proxy, for
`npm ci`.

**On your machine — verify the new build is actually live:**

```bash
curl -s http://172.28.89.6:3000/ | grep -oE 'src="/assets/[^"]*"'
rm /tmp/sentiboard-mockups.tar
```

Vite hashes the bundle filename, so the hash changing is the proof. A `200` alone is not —
the old container returns that too.

### Rollback

```bash
sudo docker rm -f sentiboard-mockups
sudo docker run -d --restart always -p 3000:8080 \
  --name sentiboard-mockups sentiboard-mockups:previous
```

### Reverse proxy

If it goes behind a path on the existing domain, the proxy should **strip** the prefix
before forwarding — the trailing slash on `proxy_pass` does that:

```nginx
location /mockups/ {
    proxy_pass http://127.0.0.1:3000/;
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

### Known gotchas

Ordered by how much time each one has actually cost:

- **Running a laptop command on the server.** `scp` from inside an SSH session tries to copy
  the server to itself; the key is not there and it fails with `Permission denied
  (publickey)`. `scp`, `docker build` and `docker save` run on the laptop; `docker load`,
  `docker run` and `docker stop` run on the server.
- **Using the hostname instead of the IP.** `Could not resolve hostname oer-sbd-bend-01`.
  See *Hosts* above.
- **Deploying to `172.28.89.5`.** That is the Flask host.
- **Forgetting to tag `:previous`.** `docker load` untags the running image, so the rollback
  disappears silently and only becomes a problem once you need it.
- `npm ci` needs the proxy arguments only where the build runs. On a laptop with direct
  internet the build completes without them; this has never been exercised through the
  Serco proxy, and it fails at build time, so it is safe to discover.
- The image is ~23 MB of assets, 20 MB of which is the home page video
  (`public/assets/mv/home.mp4`), giving a ~71 MB tar to transfer.

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
