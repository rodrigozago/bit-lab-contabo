FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Compila shared com o tsc do shared
WORKDIR /app/packages/shared
RUN node_modules/.bin/tsc -p tsconfig.json

# Token client do Rollbar precisa estar presente NO BUILD (Vite bakeia as
# VITE_* no bundle). Vazio = Rollbar desligado no front. Ver
# docs/SEGURANCA-PRE-LANCAMENTO.md item 6.
ARG VITE_ROLLBAR_CLIENT_TOKEN=""
ARG VITE_BUILD_SHA="dev"
ENV VITE_ROLLBAR_CLIENT_TOKEN=$VITE_ROLLBAR_CLIENT_TOKEN
ENV VITE_BUILD_SHA=$VITE_BUILD_SHA

# Typecheck + build do frontend com os binários locais do web
WORKDIR /app/apps/web
RUN node_modules/.bin/tsc -p tsconfig.json --noEmit
RUN node_modules/.bin/vite build
# Pré-renderiza só a landing (rota "/") pro dist/index.html — ver
# scripts/prerender.tsx. Roda em Node puro (vite-node), sem browser/Chromium;
# não toca nas rotas autenticadas. `pnpm exec` (não node_modules/.bin direto):
# node-linker=hoisted deixa os bins só no node_modules/.bin da raiz do
# monorepo, não em apps/web/node_modules/.bin.
RUN pnpm exec vite-node scripts/prerender.tsx

# ── Serve estático com nginx ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
