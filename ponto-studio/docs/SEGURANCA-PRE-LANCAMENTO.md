# Segurança pré-lançamento — Ponto Studio + auth/ (SSO)

> **Documento de prontidão pra lançamento.** Auditoria feita em 2026-07-20 lendo o código de
> `ponto-studio/` (web + api + worker) e `auth/` (provider OIDC/SSO). Cada item tem severidade, o
> **porquê**, o **arquivo/linha** e a **correção**. Marque `[ ]` → `[x]` conforme resolver.
>
> **Regra de ouro pra lançar:** todos os itens 🔴 BLOQUEADOR resolvidos e verificados. Os 🟠 ALTO
> idealmente também. 🟡 MÉDIO e 🟢 podem ser fast-follow pós-lançamento, mas estão listados pra não
> se perderem.

**Escopo auditado:** `ponto-studio/apps/api` (Fastify), `ponto-studio/apps/web` (React/SPA),
`ponto-studio/workers/embroidery` (Python + Ink/Stitch), `auth/` (Express + oidc-provider), e o
`docker-compose.yml` de cada um. **Fora do escopo desta rodada:** pentest ativo, revisão do nginx da VPS
(só referenciado), e os outros apps do monorepo (face-lab, on-air etc.) — mas várias conclusões do `auth/`
valem pra todos os RPs.

---

## 0. Resumo por severidade

| # | Severidade | Item | Onde |
|---|---|---|---|
| 1 | 🔴 BLOQUEADOR | Rotas da API sem autenticação nem checagem de dono (IDOR) | `apps/api/src/routes/{export,stitchPreview,preview,analyze,upload}.ts` |
| 2 | 🔴 BLOQUEADOR | `SESSION_SECRET` com fallback fixo público no auth | `auth/src/oidc.js:61` |
| 3 | 🔴 BLOQUEADOR | `OIDC_CLIENT_SECRET` aceita string vazia como default | `apps/api/src/config.ts:17` |
| 4 | 🟠 ALTO | CORS reflete qualquer origem com credenciais | `apps/api/src/index.ts:28` |
| 5 | 🟠 ALTO | Sem rate limit na API (upload/analyze/export) | `apps/api/src/index.ts` |
| 6 | 🟠 ALTO | Rollbar (error tracking) ausente nas 4 superfícies | web/api/auth/worker |
| 7 | 🟡 MÉDIO | `/exports` e `/uploads` servidos sem auth | `apps/api/src/index.ts:32-45` |
| 8 | 🟡 MÉDIO | Sem headers de segurança no app (CSP/HSTS/etc.) | api + auth |
| 9 | 🟡 MÉDIO | Sem validação de schema nos corpos de request | `apps/api/src/routes/*` |
| 10 | 🟡 MÉDIO | `email_verified: true` fixo + signup sem verificação de e-mail | `auth/src/oidc.js`, `auth/src/routes/auth.js` |
| 11 | 🟡 MÉDIO | Sem log de auditoria nas ações de admin | `auth/src/routes/admin.js` |
| 12 | 🟡 MÉDIO | Persistência/segredo do JWKS (perder = derruba todos; vazar = forja tokens) | `auth` volume `jwks` |
| 13 | 🟡 MÉDIO | Decisão de self-signup do ponto-studio | `auth` env `ALLOW_SELF_SIGNUP` |
| 14 | 🟢 BAIXO | PII (e-mail/sub) logada em nível info | `apps/api/src/routes/auth.ts:32`, `auth/src/index.js` |
| 15 | 🟢 BAIXO | `trust proxy: true` amplo demais | `auth/src/index.js:16` |
| 16 | 🟢 BAIXO | Redis/Postgres sem senha (rede interna só) | ambos compose |
| 17 | 🟢 BAIXO | Rate limit de login por IP+email (rotação de e-mail escapa) | `auth/src/routes/auth.js:44` |
| 18 | 🟢 BAIXO | XXE potencial no parse de SVG pelo Ink/Stitch | `workers/embroidery` |

**Já verificado OK (não precisa fazer nada):** subprocess do worker usa lista de args, sem `shell=True`
(sem shell injection — `inkstitch_runner.py:96`); nenhum `.env` versionado no git (`.gitignore` cobre);
bcrypt com custo 12 no auth; cookies `httpOnly` + `secure` em produção nos dois apps; `requireAdmin`
rechecando `is_admin` no banco (revogar admin tem efeito imediato); portas dos containers só no loopback
(`127.0.0.1:...`), nginx na frente.

---

## 1. 🔴 BLOQUEADOR — Rotas da API sem auth nem checagem de dono (IDOR)

**O quê:** só `projects.ts` e `hoops.ts` têm o `preHandler` que exige sessão (`readSession`). As demais
rotas **não exigem login nenhum**, e duas delas ainda buscam projeto por id **sem conferir o dono**:

- `POST /api/export` e `POST /api/export/svg` (`export.ts`) — recebem um `projectId`, fazem
  `projectsRepo.get(projectId)` e devolvem o SVG/arquivo de bordado de **qualquer** projeto, de qualquer
  usuário, mesmo deslogado. IDOR clássico: `projectId` é um UUID, mas se vazar (URL, log, referer), o
  desenho do cliente é exposto.
- `POST /api/stitch-preview` (`stitchPreview.ts`) — idem: qualquer `projectId` → sequência de pontos.
- `POST /api/preview` (`preview.ts`) — sem auth; aceita um `element` no corpo e dispara o worker.
- `POST /api/analyze/local` (`analyze.ts`) — sem auth; qualquer um sobe imagem e dispara a análise
  (job caro de CPU/vtracer).
- `POST /api/upload` (`upload.ts`) — sem auth; qualquer um grava arquivos de até 10MB no servidor.

**Impacto:** vazamento de dados de outros usuários (IDOR nos dois de export/preview) + abuso de recursos
(qualquer anônimo enfileira jobs pesados e enche o disco de uploads).

**Correção:**
- [ ] Extrair o `preHandler` de sessão que já existe em `projects.ts` (linhas 26–32) pra um helper
      compartilhado (ex.: `services/requireSession.ts`) e aplicá-lo em **export, stitchPreview, preview,
      analyze, upload**.
- [ ] Em `export.ts` e `stitchPreview.ts`, adicionar a checagem de dono que `projects.ts` já faz:
      `if (!project || project.ownerId !== req.sessionUser.sub) → 404`. (404, não 403, pra não vazar
      existência — mesmo padrão que projects já usa.)
- [ ] `preview.ts`: além de exigir sessão, considerar receber `projectId`+`elementId` em vez do
      `element` inteiro no corpo, pra validar dono (hoje o element vem solto do cliente).
- [ ] Reteste: deslogado, todas essas rotas devem responder 401; logado, projeto de outro dono → 404.

---

## 2. 🔴 BLOQUEADOR — `SESSION_SECRET` com fallback fixo no auth

**O quê:** `auth/src/oidc.js:61` — `keys: [process.env.SESSION_SECRET || 'dev-secret-troque-em-producao']`.
Essa chave assina os cookies do oidc-provider (sessão do provider, cookies de interação). Se a env não
estiver setada em produção, a chave vira **uma string pública que está no código-fonte** → dá pra forjar
cookies de sessão do provider.

**Impacto:** comprometimento total do SSO se `SESSION_SECRET` faltar em prod (o compose passa a env, mas
nada garante que ela exista e não seja o default).

**Correção:**
- [ ] Trocar o fallback por um **erro fatal em produção**: se `NODE_ENV === 'production'` e
      `SESSION_SECRET` ausente/igual ao default, `throw` no boot (não subir).
- [ ] Gerar um `SESSION_SECRET` forte e único (`openssl rand -hex 32`) e pôr no `.env` de produção do auth.
- [ ] (Bônus) suportar array de chaves pra rotação futura sem derrubar sessões.

---

## 3. 🔴 BLOQUEADOR — `OIDC_CLIENT_SECRET` aceita vazio como default

**O quê:** `apps/api/src/config.ts:17` — `clientSecret: env("OIDC_CLIENT_SECRET", "")`. O helper `env`
só falha se **não houver nem env nem fallback**; com fallback `""`, se a env faltar em prod o client sobe
com segredo vazio e o handshake OIDC quebra silenciosamente (ou pior, aceita um client mal configurado).

**Impacto:** login quebrado ou client OIDC sem autenticação de client em produção.

**Correção:**
- [ ] Remover o fallback `""` de `OIDC_CLIENT_SECRET` (e reavaliar os outros `env(...)` com fallback de
      prod: `publicUrl`, `databaseUrl`, `oidc.issuer` — em produção devem ser obrigatórios, não ter
      default de localhost).
- [ ] Garantir que `PONTO_STUDIO_OIDC_SECRET` (no auth) e `OIDC_CLIENT_SECRET` (no ponto) sejam **o mesmo
      valor forte**, único por ambiente.

---

## 4. 🟠 ALTO — CORS reflete qualquer origem com credenciais

**O quê:** `apps/api/src/index.ts:28` — `cors({ origin: true, credentials: true })` reflete o `Origin` de
qualquer site e permite credenciais. Hoje o cookie `ps_session` é `SameSite=lax`, o que **mitiga bastante**
(o navegador não manda o cookie em fetch cross-site), então não é um buraco aberto — mas é permissivo
demais e frágil (qualquer mudança futura pra `SameSite=none` viraria CSRF/vazamento).

**Correção:**
- [ ] Fixar `origin` na origem do app: `origin: [config.publicUrl]` (ex.: `https://ponto.bit-lab.tech`),
      mantendo `credentials: true`. Em dev, incluir `http://localhost:<porta>`.

---

## 5. 🟠 ALTO — Sem rate limit na API do ponto-studio

**O quê:** o `auth/` tem rate limit no login/signup, mas a **API do ponto-studio não tem nenhum**. Combinado
com o item 1 (rotas abertas), qualquer um pode martelar `POST /api/analyze/local` (job caro) e
`POST /api/upload` (10MB por request) até estourar CPU/disco.

**Correção:**
- [ ] Registrar `@fastify/rate-limit` global (ex.: 100 req/min por IP) + limites mais apertados nas rotas
      caras (`/api/upload`, `/api/analyze/local`, `/api/export`).
- [ ] Definir cota de storage / limpeza (já existe `startCleanup` pra exports/uploads antigos — confirmar
      TTL e que roda; ver `services/cleanup.ts`).
- [ ] Confirmar `bodyLimit` do Fastify (default 1MB) contra o tamanho real de um `PUT /api/projects/:id`
      com `svgContent` grande — se projetos reais passam de 1MB, subir o limite **conscientemente** (não
      pra ilimitado) e cobrir com o rate limit.

---

## 6. 🟠 ALTO — Rollbar (rastreio de erros) ausente — pedido explícito pra lançamento

**O quê:** não há Rollbar (nem Sentry/equivalente) em nenhuma das 4 superfícies. Sem isso, erro em produção
= usuário reclama e você não tem stack trace. Necessário nas 4:

- [ ] **`apps/web` (React/SPA)** — `@rollbar/react` (ou `rollbar` browser). Envolver o app num
      `ErrorBoundary` do Rollbar, capturar erros não tratados e rejeições de promise. Token: **client-side
      access token** (post_client_item — é público por natureza, escopo mínimo). Setar `environment` e
      `code_version` (hash do build) pra agrupar.
- [ ] **`apps/api` (Fastify)** — `rollbar` (Node). Hook `onError`/`setErrorHandler` do Fastify manda o erro
      pro Rollbar com contexto (rota, sub do usuário — sem PII sensível no payload). Token: **server access
      token** (post_server_item), **secreto**, via env `ROLLBAR_SERVER_TOKEN`.
- [ ] **`auth` (Express)** — `rollbar` (Node). Encaixar no error handler que já existe em
      `auth/src/index.js` (hoje só faz `console.error`). Token server secreto próprio.
- [ ] **`workers/embroidery` (Python)** — `pyrollbar`. `rollbar.init(...)` + capturar exceções no laço de
      processamento de job (`worker.py`) e no `inkstitch_runner`. Token server secreto próprio.
- [ ] Não commitar tokens: todos via `.env` (client token do web pode ir no build, mas ainda via env de
      build, não hardcoded). Documentar cada `ROLLBAR_*_TOKEN` no `.env.example`.
- [ ] Configurar no Rollbar: ambientes (production/staging), owner/notificações, e **scrub** de campos
      sensíveis (senha, cookies, tokens) no payload — o Rollbar tem scrubbing por nome de campo, garantir
      que `password`, `authorization`, `cookie`, `client_secret` estão na lista.

---

## 7. 🟡 MÉDIO — `/exports` e `/uploads` servidos sem auth

**O quê:** `apps/api/src/index.ts:32-45` monta `staticFiles` em `/exports/` e `/uploads/` sem nenhuma
verificação. Os nomes são UUIDs (não enumeráveis à toa), mas a URL do upload é **devolvida ao cliente** e
os exports contêm o arquivo de bordado real — se a URL vazar, o arquivo está acessível a qualquer um.

**Correção (escolher um):**
- [ ] Proteger os dois mounts com o mesmo `preHandler` de sessão (e, pra exports, checar que o arquivo
      pertence a um job/projeto do usuário) — mais trabalho, mais seguro; **ou**
- [ ] Manter os UUIDs mas com TTL curto e agressivo (o `cleanup` já apaga antigos — confirmar janela) e
      tratar as URLs como "capability links" de vida curta, documentando isso como decisão consciente.

---

## 8. 🟡 MÉDIO — Sem headers de segurança no nível do app

**O quê:** nem a API nem o auth setam headers de segurança. Parte disso pode estar no nginx da VPS (fora
do escopo desta auditoria) — **precisa confirmar**.

**Correção:**
- [ ] Confirmar no `nginx/` da VPS se já há `Strict-Transport-Security` (HSTS), `X-Content-Type-Options:
      nosniff`, `X-Frame-Options`/CSP `frame-ancestors`, `Referrer-Policy`. Se não:
- [ ] Adicionar `@fastify/helmet` na API e `helmet` no auth (ou centralizar no nginx). Atenção à CSP do
      tldraw/SPA (usa blobs/workers) e das páginas de login do auth (inline styles) — testar sem quebrar.

---

## 9. 🟡 MÉDIO — Sem validação de schema nos corpos de request

**O quê:** as rotas leem `req.body` sem schema (Fastify suporta JSON Schema nativo). `name` de projeto,
`canvas` (dimensões), params de análise — tudo entra como veio. Não é um RCE, mas abre porta pra dados
malformados/gigantes persistidos e pra bugs.

**Correção:**
- [ ] Adicionar `schema: { body: {...} }` nas rotas que recebem corpo (projects POST/PUT, export, analyze,
      stitch-preview), com limites de tamanho/tipo. Bônus: valida e documenta a API de uma vez.

---

## 10. 🟡 MÉDIO — `email_verified: true` fixo + signup sem verificação

**O quê:** `auth/src/oidc.js` `findAccount().claims()` devolve `email_verified: true` sempre; e o signup
self-service (`auth/src/routes/auth.js`) cria a conta sem confirmar o e-mail. Se algum RP (agora ou futuro)
confiar em `email_verified`, ele estará confiando num valor que nunca foi verificado.

**Correção:**
- [ ] Decidir: (a) implementar verificação de e-mail no signup (link por e-mail) e refletir o valor real
      em `email_verified`; ou (b) se nenhum RP usa essa claim, remover/documentar que ela é sempre `true`
      por design e **não deve ser usada como garantia**. Para o lançamento do ponto-studio, (b) + decisão
      do item 13 pode bastar.

---

## 11. 🟡 MÉDIO — Sem log de auditoria nas ações de admin

**O quê:** `auth/src/routes/admin.js` cria/deleta usuário, reseta senha, concede/revoga acesso — sem
registrar quem fez o quê e quando. Numa investigação (conta comprometida, acesso indevido) não há trilha.

**Correção:**
- [ ] Gravar um log de auditoria (tabela `audit_log` ou ao menos `console.log` estruturado que o Rollbar/
      coletor capture) pra cada mutação de admin: ator, ação, alvo, timestamp.

---

## 12. 🟡 MÉDIO — Persistência e segredo do JWKS

**O quê:** as chaves de assinatura dos tokens ficam no volume `jwks` (`auth/data/jwks.json`). Perder o
volume = todos os tokens/sessões do provider invalidam de uma vez. Vazar o arquivo = forjar tokens de
qualquer usuário.

**Correção:**
- [ ] Incluir o volume `jwks` na rotina de backup da VPS.
- [ ] Garantir permissão restrita do arquivo (só o usuário do container lê).
- [ ] Documentar o procedimento de rotação de chave (o oidc-provider suporta múltiplas chaves no JWKS pra
      rotação sem downtime).

---

## 13. 🟡 MÉDIO — Decisão de self-signup do ponto-studio

**O quê:** `ALLOW_SELF_SIGNUP` + `SELF_SIGNUP_GRANT_APPS` controlam se qualquer um cria conta e já ganha
acesso. Hoje o default de grant é `face-lab`. **Decisão de negócio + segurança pro lançamento:** o
ponto-studio vai ser aberto (qualquer um cria conta e usa) ou fechado (admin provisiona)?

**Correção:**
- [ ] Decidir explicitamente e configurar `ALLOW_SELF_SIGNUP` / `SELF_SIGNUP_GRANT_APPS` de acordo. Se
      aberto, o item 5 (rate limit) e o item 10 (verificação de e-mail) ficam mais importantes.

---

## 14–18. 🟢 BAIXO — fast-follow pós-lançamento (não bloqueiam, mas anota)

- [ ] **14 — PII em log:** `apps/api/src/routes/auth.ts:32` loga `{ sub, email }` em info; o auth também
      loga e-mail. Rebaixar pra debug ou mascarar o e-mail. (Rollbar scrubbing cobre parte disso.)
- [ ] **15 — `trust proxy: true`** no auth (`src/index.js:16`) confia em qualquer proxy. Como só o loopback
      é exposto e o nginx está na frente, o risco é baixo; idealmente apontar pro IP/rede do nginx.
- [ ] **16 — Redis/Postgres sem senha:** estão só na rede interna do docker, não expostos. Defesa em
      profundidade: pôr senha no Redis/PG mesmo assim, especialmente se um dia compartilhar rede.
- [ ] **17 — Rate limit de login por IP+email:** rotacionar e-mail escapa do limite por conta. Adicionar um
      limite por IP puro (independente do e-mail) como segunda barreira contra brute-force distribuído por
      conta.
- [ ] **18 — XXE no parse de SVG:** o `svgContent` (vindo da análise, potencialmente de imagem do usuário)
      é alimentado ao Ink/Stitch, que parseia XML. XXE é improvável de vazar algo (subprocess sandboxado,
      sem segredos montados além de exports/uploads), mas vale confirmar que nenhum parser de SVG **nosso**
      (worker ou API) expande entidades externas, e considerar desabilitar entidades explicitamente.

---

## 19. Observabilidade & operação (pré-lançamento)

- [ ] **Rollbar** configurado nas 4 superfícies (item 6) e recebendo eventos de teste (dispara um erro
      proposital em cada e confirma que chega).
- [ ] **Healthchecks + alerta:** ambos os serviços têm `/health`; garantir monitor externo (uptime) que
      alerta se cair.
- [ ] **Backups:** Postgres do auth (usuários/acessos) e do ponto (projetos) + volume `jwks` — rotina de
      backup testada (fazer um restore de teste).
- [ ] **Segredos de produção:** gerar frescos e únicos (`SESSION_SECRET`, `PONTO_STUDIO_OIDC_SECRET`/
      `OIDC_CLIENT_SECRET`, `POSTGRES_PASSWORD`, `INITIAL_ADMIN_PASSWORD`) — não reusar valores de dev. O
      `INITIAL_ADMIN_PASSWORD` deve ser trocado após o primeiro login.
- [ ] **`.env.example` atualizado** em auth e ponto com todas as vars novas (Rollbar incluso) e sem valores
      reais.
- [ ] **HTTPS/HSTS** confirmado no nginx pra `ponto.bit-lab.tech` e `auth.bit-lab.tech`.

---

## 20. Gate final de lançamento (checklist de saída)

- [ ] Todos os 🔴 BLOQUEADOR (itens 1, 2, 3) resolvidos e **reverificados manualmente** (deslogado bate em
      401; projeto alheio bate em 404; auth não sobe sem `SESSION_SECRET` forte).
- [ ] Itens 🟠 ALTO (4, 5, 6) resolvidos — CORS fixo, rate limit ativo, Rollbar recebendo.
- [ ] Decisões tomadas: self-signup (13), proteção de exports/uploads (7), headers no nginx vs app (8).
- [ ] Backups e segredos de produção conferidos (seção 19).
- [ ] `tsc` limpo + testes passando nos dois apps (regressão das mudanças de segurança).

---

## Log

| Data | O que | Quem |
|------|-------|------|
| 2026-07-20 | Auditoria inicial + este documento criado (18 achados + Rollbar + ops) | — |
