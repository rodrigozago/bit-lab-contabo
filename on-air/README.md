# On Air — on-air.bit-lab.tech

Quem está tocando agora: um vinil girando com a foto do artista no selo central,
nome/gênero/horário ao lado, e o timetable com os próximos DJs e os que já tocaram.
A página pública decide quem exibe pelo horário atual contra os slots cadastrados
no `/admin` (protegido pelo bit-lab-auth).

## Stack

- **web** — React 18 + Vite 5 + TypeScript + Tailwind v4 (`apps/web`). Accent
  International Klein Blue `#002FA7` sobre navy escuro.
- **api** — Fastify 4 + better-sqlite3 (`apps/api`). SQLite em volume Docker,
  fotos dos artistas em volume próprio (`/media`).
- **auth** — nenhum código aqui: `/admin` e `/api/admin/` são gated na borda
  (nginx `auth_request` → `auth.bit-lab.tech`), mesmo modelo do ponto-studio.
  O resto é público.

## Dev local

```bash
npx pnpm@9.15.4 install
npx pnpm@9.15.4 dev          # api (tsx, :3001) + web (vite, :5173) em paralelo
```

- http://localhost:5173 — página pública
- http://localhost:5173/admin — admin (sem SSO local: o gate só existe no nginx da VPS)
- SQLite/fotos ficam em `apps/api/.data/` (gitignored)

## Fuso horário

SQLite guarda tudo em **UTC ISO-8601**; o admin edita e o público vê
**America/Sao_Paulo**. A conversão parede→UTC acontece só no servidor
(`apps/api/src/time.ts`) — nunca parseie `datetime-local` com `new Date()`.

## Deploy na VPS

1. **Auth**: redeploy do `bit-lab-agents/auth` (o seed em `src/bootstrapAdmin.js`
   cria o app `on-air`) e conceda acesso aos admins em
   https://auth.bit-lab.tech/admin — sem grant, `/admin` devolve 403.
2. **DNS**: registro `on-air` no Cloudflare apontando pro mesmo origin
   (o cert wildcard já cobre).
3. **App**: `git pull && sudo scripts/install.sh` — builda/sobe os containers
   (web `127.0.0.1:3005`, api debug `127.0.0.1:4004`) e atualiza/recarrega o
   nginx da VPS com `nginx/bit-lab.tech.conf`.

## Portas

| Serviço | Loopback VPS | Container |
|---|---|---|
| web (nginx estático + proxy /api) | 3005 | 80 |
| api (Fastify, debug) | 4004 | 3001 |
