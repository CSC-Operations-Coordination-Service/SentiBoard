# Production image for the Next.js frontend: multi-stage, non-root, standalone output.
# Build context is the REPO ROOT (see infra/compose/docker-compose.dev.yml).
#
# Unlike ocs-portal's frontend image there is no BACKEND_ORIGIN build arg. That one
# exists because ocs-portal's next.config.mjs uses rewrites(), which Next resolves at
# build time and bakes in. This app has no rewrites(): lib/data.ts reads
# PROCESSORS_API_URL per request, server-side, so the API location stays a pure runtime
# environment variable and can be repointed without rebuilding.
#
# Fonts are next/font/local (app/fonts/*.woff2), so `npm run build` makes no outbound
# request. Only `npm ci` needs the proxy.

# ---- deps ----------------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /app
# npm reads the lowercase forms; accept either casing from the build args.
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ENV http_proxy=$HTTP_PROXY https_proxy=$HTTPS_PROXY
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# ---- build ---------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime -------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN useradd --system --uid 10001 sentiboard
# standalone/ carries server.js and a pruned node_modules; static/ and public/ are
# not included in it and must be copied separately.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER sentiboard
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
    CMD node -e "fetch('http://localhost:3000/v1/processors').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
