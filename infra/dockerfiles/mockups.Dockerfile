# Static image for the React UI mockups (design/react-mockups).
# Build context is the REPO ROOT.
#
# The mockups carry no live data and call no API, so this is the whole deployment:
# build once, serve the files. Nothing here depends on the Flask app, the Next.js
# frontend, or the processors service.
#
# Where it is served from is decided HERE, at build time, via VITE_BASE:
#   (unset)              → served at the root of a host/port
#   VITE_BASE=/mockups/  → served at https://host/mockups/
# The value feeds both the asset URLs in index.html and react-router's basename, so
# the two cannot drift. Must end with a slash. Changing it needs a rebuild.

# ---- build ---------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app
# npm reads the lowercase forms; accept either casing from the build args.
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ENV http_proxy=$HTTP_PROXY https_proxy=$HTTPS_PROXY
COPY design/react-mockups/package.json design/react-mockups/package-lock.json ./
RUN npm ci
COPY design/react-mockups/ ./
ARG VITE_BASE=/
ENV VITE_BASE=$VITE_BASE
# `npm run build` is `tsc -b && vite build`, so a type error fails the image build
# rather than shipping a broken bundle. Output lands in /app/dist (~23 MB, mostly the
# home page video).
RUN npm run build

# ---- serve ---------------------------------------------------------------
# Unprivileged nginx: runs as uid 101, listens on 8080, no root needed at runtime.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY infra/nginx/mockups.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1
