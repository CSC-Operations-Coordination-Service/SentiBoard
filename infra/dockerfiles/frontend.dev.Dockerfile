# Dev-only image: `next dev` with hot reload (compose `dev` profile). Source is
# bind-mounted by compose; node_modules and .next live in anonymous volumes so the
# host copies never shadow the container's.
# Never built by CI — CI builds frontend.Dockerfile.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ENV http_proxy=$HTTP_PROXY https_proxy=$HTTPS_PROXY
COPY frontend/package.json frontend/package-lock.json ./
# --include=dev regardless of NODE_ENV on the build host — `next dev` needs the dev
# toolchain, and an inherited NODE_ENV=production would strip it.
RUN npm ci --include=dev
# Pre-create .next owned by `node` (uid 1000, matching the WSL2 host uid) so the
# anonymous volume seeds with the right ownership. node_modules stays root-owned on
# purpose — it is readable by uid 1000, and chown -R would double the layer size.
RUN mkdir -p /app/.next && chown node:node /app /app/.next
# The proxy must not leak into the running dev server: it would try to route the
# server-side fetch to processors-api through it. Unset for runtime only.
ENV http_proxy="" https_proxy=""
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]
