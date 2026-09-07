# syntax=docker/dockerfile:1
# EMD container image (v1.20). Build: docker build -f Containerfile -t emd .
# Runtime layout: /app (cwd, all server paths are cwd-relative), state on the /data volume
# via baked-in symlinks (config/settings.yaml → /data/settings.yaml, feedback → /data/feedback).
ARG NODE=node:24-bookworm-slim

# --- 1. SPA build — arch-independent output, so build on the host arch (no QEMU for vite/tsc)
FROM --platform=$BUILDPLATFORM $NODE AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# dist/data is an 18 MB duplicate of public/data that nothing serves (/data is 403-guarded,
# the UI fetches bundles via /api/fhir/*).
RUN npm run build && rm -rf dist/data

# --- 2. Runtime deps on the TARGET arch (better-sqlite3 / esbuild prebuilds are per-arch)
FROM $NODE AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- 3. Runtime
FROM $NODE
LABEL org.opencontainers.image.source="https://github.com/okohlbacher/eyematics-emd-app" \
      org.opencontainers.image.title="EyeMatics Clinical Demonstrator (EMD)" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY server server
COPY shared shared
COPY public public
COPY deploy/entrypoint.sh deploy/healthcheck.mjs deploy/settings.yaml deploy/
COPY --from=build /app/dist dist
# /data is seeded by the entrypoint on first start; chown so a fresh named volume works too.
RUN mkdir -p config /data && chown node:node /data \
 && ln -s /data/settings.yaml config/settings.yaml \
 && ln -s /data/feedback feedback
USER node
EXPOSE 3000
VOLUME ["/data"]
# Docker honours this; Podman ignores HEALTHCHECK on OCI images → deploy/EMD.container sets HealthCmd.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD ["node", "/app/deploy/healthcheck.mjs"]
ENTRYPOINT ["sh", "/app/deploy/entrypoint.sh"]
