# node:20-slim (glibc). O better-sqlite3 v12 não publica prebuild pro Node 20
# (ABI 115), então compilamos do fonte no builder — toolchain abaixo — e o
# runtime instala com --ignore-scripts e recebe o binário compilado via COPY.
FROM node:20-slim AS builder
WORKDIR /app

RUN corepack enable

# toolchain do node-gyp pra compilar o better-sqlite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Manifests primeiro — cache de deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY tsconfig.base.json ./

WORKDIR /app/apps/api
RUN pnpm exec tsc -p tsconfig.json

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/api/package.json ./apps/api/

# --ignore-scripts: sem toolchain aqui — o binding compilado vem do builder
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# binding nativo compilado no builder (node_modules/better-sqlite3/build/Release)
COPY --from=builder /app/node_modules/better-sqlite3/build ./node_modules/better-sqlite3/build

COPY --from=builder /app/apps/api/dist ./apps/api/dist
# schema aplicado no boot (migrate-on-boot) — dist/db.js procura ../db/schema.sql
COPY db/schema.sql ./apps/api/db/schema.sql

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
