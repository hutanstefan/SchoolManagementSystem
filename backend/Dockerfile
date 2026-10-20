# syntax=docker/dockerfile:1

# School Management API. Targets:
#   runtime - the API itself: compiled code and production dependencies only
#   tools   - migrations and demo seed (run once by the "migrate" service)

# ---- Base: Node + OpenSSL (used by the Prisma CLI) ----
FROM node:24-bookworm-slim AS base
# OpenSSL comes from the base image's Debian release, so it is not pinned.
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- All dependencies (postinstall generates the Prisma client) ----
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- Compile ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- Migrations + seed (needs the dev tools: Prisma CLI, tsx, faker) ----
FROM build AS tools
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts --if-empty"]

# ---- Production dependencies only ----
FROM build AS prod-deps
RUN npm prune --omit=dev

# ---- Runtime ----
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main.js"]
