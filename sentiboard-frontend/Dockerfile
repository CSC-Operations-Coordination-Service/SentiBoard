# Production image for the SentiBoard Next.js frontend (standalone output, non-root).
#   docker build -t sentiboard-frontend .
#   docker run -p 3000:3000 -e BACKEND_URL=http://sentiboard-backend:8000 sentiboard-frontend
#
# BACKEND_URL, SITE_URL and ALLOW_INDEXING are read on the server at runtime (see .env.sample),
# so they are passed to `docker run`, not baked into the image.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps: `postinstall` runs `pnpm gen:api`, so api/openapi.json must be present ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api ./api
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- build ---
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# schema.d.ts is generated (git-ignored): the deps stage made it, but `COPY . .` does not carry it over.
RUN pnpm gen:api && pnpm build

# --- runtime ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
WORKDIR /app

COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
