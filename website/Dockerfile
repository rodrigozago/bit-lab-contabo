# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* é inlinado no bundle em build time — precisa entrar como
# ARG (passado pelo docker-compose via `build.args`), não só como env de
# runtime. STORYBLOK_PREVIEW_TOKEN/SECRET não entram aqui de propósito:
# são server-only e só existem em runtime (ver docker-compose.yml).
ARG NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN
ENV NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN=$NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
