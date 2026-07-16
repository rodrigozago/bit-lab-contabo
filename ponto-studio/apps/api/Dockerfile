FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copia manifests para cache de deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# Copia código-fonte
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Compila shared com o tsc do shared
WORKDIR /app/packages/shared
RUN node_modules/.bin/tsc -p tsconfig.json

# Compila API com o tsc local da API
WORKDIR /app/apps/api
RUN node_modules/.bin/tsc -p tsconfig.json

# ── Runtime image ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# schema aplicado no boot (migrate-on-boot) — dist/db.js procura ../db/schema.sql
COPY db/schema.sql ./apps/api/db/schema.sql

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
