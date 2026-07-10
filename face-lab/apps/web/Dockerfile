FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

WORKDIR /app/packages/shared
RUN pnpm exec tsc -p tsconfig.json

WORKDIR /app/apps/web
RUN pnpm exec tsc -p tsconfig.json --noEmit
# Vite embute VITE_* no bundle em BUILD time — o token de client do Rollbar
# (post_client_item, público por design) precisa chegar aqui como build arg
ARG VITE_ROLLBAR_ACCESS_TOKEN
ARG VITE_ROLLBAR_MIN_LEVEL=debug
ENV VITE_ROLLBAR_ACCESS_TOKEN=$VITE_ROLLBAR_ACCESS_TOKEN
ENV VITE_ROLLBAR_MIN_LEVEL=$VITE_ROLLBAR_MIN_LEVEL
RUN pnpm exec vite build

# ── Serve estático com nginx (proxy /api → api:3001) ──────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
