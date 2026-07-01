# syntax=docker/dockerfile:1
#
# YappChat web app (Next.js 16) image — deployed as its own ECS Express service
# (e.g. app.yappchatt.com), separate from the WebSocket engine (Dockerfile.ws).
# Build context = apps/web.
#
#   docker build -t yappchat-web .
#   docker run --rm -p 3000:3000 --env-file app.env yappchat-web
#
# Installation MIRRORS Dockerfile.ws: node:22-slim (glibc, avoids musl native-binary
# surprises), `npm install` (apps/web has no committed lockfile), and NO baked env —
# runtime config comes from the ECS task environment (.env* excluded via .dockerignore).
# Single stage keeps it simple + consistent with the WS image; standalone/multi-stage
# is a later size optimisation (see DEPLOY-WEB.md).
FROM node:22-slim

WORKDIR /app

# Deps first for layer caching. Installed BEFORE NODE_ENV=production so the build
# toolchain (next, typescript, tailwind) is present for `next build`.
COPY package.json ./
RUN npm install --no-audit --no-fund

# App source + the config files the build reads. .env* is excluded via
# .dockerignore — configuration comes from the ECS task environment instead.
COPY tsconfig.json next.config.ts postcss.config.mjs drizzle.config.ts ./
COPY src ./src
COPY public ./public

# NEXT_PUBLIC_* are inlined into the CLIENT bundle at BUILD time, so they must be
# supplied as build args (the runtime task env cannot change them post-build).
# Passed by the deploy framework from target.build.args (deploy/targets/yappchat.json).
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

# The app is designed to build with NO database (getDb() returns null → seed
# defaults), so `next build` needs no DATABASE_URL. Runtime secrets arrive via ECS.
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ALB/ECS health check target — GET /api/health returns 200 {ok:true} (dependency-free).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `next start` binds to $PORT.
CMD ["npm", "run", "start"]
