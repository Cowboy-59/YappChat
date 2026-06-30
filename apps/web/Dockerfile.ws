# syntax=docker/dockerfile:1
#
# Spec 003 — standalone WebSocket Engine image (deployed SEPARATELY from the web
# app, e.g. ws.wxperts.com on ECS Express Mode). Build context = apps/web.
#
#   docker build -f Dockerfile.ws -t yappchat-ws .
#   docker run --rm -p 3001:3001 --env-file ws.env yappchat-ws
#
# The engine runs TypeScript directly via tsx (a devDependency), so the runtime
# image keeps dev deps — do NOT prune them. Debian-slim (glibc) is used over
# alpine (musl) to avoid native-binary surprises from transitive deps.
FROM node:22-slim

WORKDIR /app

# Install deps first for layer caching. apps/web has no committed lockfile, so
# `npm install` (not `npm ci`). Runs before NODE_ENV=production so tsx + other
# devDeps are included in the image.
COPY package.json ./
RUN npm install --no-audit --no-fund

# Only what the engine actually needs at runtime: its source, the TS config tsx
# reads, and the drizzle config imported by the db layer. .env* is excluded via
# .dockerignore — configuration comes from the ECS task environment instead.
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

ENV NODE_ENV=production
ENV WS_PORT=3001
EXPOSE 3001

# ALB/ECS health check target. The engine serves GET /health -> 200 {ok:true}.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WS_PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "src/server/ws.ts"]
