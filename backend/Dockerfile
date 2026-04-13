# Sofia voice backend — Fly.io image.
# Single-stage, Alpine, non-root. No build step (pure ESM, no bundler).
# Blueprint: specs/BLUEPRINT_flyio_deployment.md §2

FROM node:20-alpine

# wget is needed for the Docker HEALTHCHECK below. Alpine ships busybox's
# wget which is sufficient (~0KB extra; provided by the base image already).

WORKDIR /app

# Dependency layer first so source-only changes don't bust the install cache.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source.
COPY . .

# Drop privileges. The `node` user and group ship with node:20-alpine.
USER node

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Container-level healthcheck. Fly also has its own service http_check
# in fly.toml; this one gives `docker run`/local-smoke parity.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
