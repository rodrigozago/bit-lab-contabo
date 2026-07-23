# 🛰️ sentinela

Monitoramento político em redes sociais e sites de notícia — SaaS
multi-tenant do ecossistema bit-lab. Cada cliente (tenant) cadastra seus
próprios candidatos/partidos/influenciadores e palavras-chave; workers em
Python coletam menções (RSS/notícias + X/Twitter via scraping próprio) e um
worker de análise usa a OpenAI pra sentimento, entidades e embeddings.

Plano completo (contexto, decisões, roadmap): ver o plano salvo em
`~/.claude/plans/` desta conversa, ou pedir pro Claude recapitular.

## Rodando localmente

```bash
cp .env.example .env      # edite os valores (senhas, OPENAI_API_KEY, etc.)
npx pnpm@9.15.4 install
docker compose up --build
curl http://127.0.0.1:4005/health
```

Frontend em dev (hot reload, fora do Docker):
```bash
npx pnpm@9.15.4 --filter @sentinela/web dev   # http://localhost:3000
```

## Estrutura

```
apps/api/          Fastify — API + BFF OIDC (SSO via bit-lab-agents/auth)
apps/web/           React + Vite + Tailwind — dashboard multi-tenant
packages/shared/    DTOs compartilhados entre api e web
workers/ingest-news/    RSS/notícias (feedparser)
workers/ingest-social/  X/Twitter via twscrape (pool de contas), atrás do Scrapoxy
workers/analysis/       OpenAI: sentimento + entidades + embeddings
db/schema.sql       schema aplicado no boot da API (migrate-on-boot)
```

## Pool de contas X (worker-ingest-social)

A X exige login pra busca/timeline — não dá pra raspar de forma confiável
sem sessão autenticada. O worker usa [twscrape](https://github.com/vladkens/twscrape)
com um pool de contas dedicadas (nunca pessoais), guardado no Postgres
(tabela `social_accounts`) com `auth_token`/`ct0` **cifrados com AES-256-GCM**
em nível de aplicação (não é hash — hash é de mão única e o twscrape precisa
do valor original pra autenticar; ver `workers/ingest-social/crypto.py`).

Setup:
```bash
# 1. gere a chave de criptografia (uma vez só) e coloque em .env:
openssl rand -base64 32   # → SOCIAL_ACCOUNTS_ENCRYPTION_KEY

# 2. logue no X com uma conta dedicada num navegador, DevTools → Application
#    → Cookies → copie auth_token e ct0

# 3. cadastre a conta no pool (dentro do container, já tem as libs certas):
docker compose exec worker-ingest-social python manage_accounts.py add \
  --username minha_conta_dedicada --auth-token XXX --ct0 YYY

# gerenciar depois:
docker compose exec worker-ingest-social python manage_accounts.py list
docker compose exec worker-ingest-social python manage_accounts.py disable <id>
```

Sem nenhuma conta ativa em `social_accounts`, o worker pula o ciclo de
ingestão social (loga um aviso) sem quebrar o resto do stack.

## Integração com o auth central e o nginx (já feita no código)

- `auth/src/oidc.js`: client OIDC `sentinela` registrado (guardado por
  `SENTINELA_OIDC_SECRET`, mesmo padrão do ponto-studio/face-lab).
- `auth/src/bootstrapAdmin.js`: `sentinela` adicionado ao `SEED_APPS` — a
  linha na tabela `apps` é criada/atualizada automaticamente no próximo boot
  do serviço `auth` (`apps.ensure()` roda em todo boot, não só no primeiro).
- `auth/.env.example`: documentada a variável `SENTINELA_OIDC_SECRET`.
- `auth/web/src/pages/Dashboard.tsx`: **nenhuma mudança necessária** — o
  slug `sentinela` já cai no fallback `${slug}.bit-lab.tech` com path `""`
  (raiz), que é exatamente a rota de entrada pós-login do app.
- `nginx/bit-lab.tech.conf`: novo `server` block pra `sentinela.bit-lab.tech`
  (porta `3007`, modelo do bloco `face.bit-lab.tech` — BFF OIDC, sem gate) +
  adicionado ao `server_name` do redirect HTTP→HTTPS.

## Pendências manuais antes de ir pra produção

Só o que exige acesso à VPS/infra viva — não dá pra fazer só editando o repo:

1. Gerar um `SENTINELA_OIDC_SECRET` real (`openssl rand -hex 32`) e colocar o
   **mesmo valor** em `auth/.env` (na VPS) e em `sentinela/.env`.
2. Emitir/ajustar o certificado TLS pra cobrir `sentinela.bit-lab.tech` (o
   conf usa o wildcard `bit-lab.tech.pem` já existente — só confirmar que
   cobre o novo subdomínio) e apontar o DNS.
3. Rodar `nginx -t` e recarregar o nginx da VPS depois do deploy (o
   `auth/scripts/install.sh` já sincroniza o conf pros outros apps; replicar
   o mesmo processo aqui, ou instalar via script próprio quando existir).
4. Reiniciar o serviço `auth` pra aplicar o novo client OIDC + seed do app.
5. Conceder acesso ao app pra usuários específicos (ou ligar
   `allow_self_signup`) em `apps.bit-lab.tech/admin/apps` — controla quem
   pode logar, mas não afeta o modelo de tenant (que é interno do sentinela).
