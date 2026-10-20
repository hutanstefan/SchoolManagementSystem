# syntax=docker/dockerfile:1

# School Management web app: built with Vite, served by nginx, which also
# forwards /api (REST and WebSockets) to the API container.

# ---- Build ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# ---- Runtime: nginx running as a non-root user, listening on 8080 ----
FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
