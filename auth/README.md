# 🔐 bit-lab-auth

Serviço de autenticação central pros apps do bit-lab. Não é um SSO completo
(sem OAuth entre apps ainda) — hoje é: login único + sessão compartilhada via
cookie `.bit-lab.tech` + gate por app no nginx (`auth_request`), com um
provider OIDC real (`oidc-provider`) já rodando por baixo pra quando algum app
precisar de login via token de verdade.

O portal central — dashboard de apps + administração — vive em
**`apps.bit-lab.tech`**, servido pela SPA em [`web/`](web) (React + Vite +
shadcn/ui), que fala com este serviço via proxy interno (`/api`, `/admin/api`).
`auth.bit-lab.tech` continua sendo o `ISSUER` do OIDC e onde vivem
`/login`, `/signup` e `/interaction/:uid` (telas vanilla, sem framework).

## Papéis

| Papel | Onde mora | Significado |
|---|---|---|
| **Superuser** | `users.is_superuser` | Acesso total: administração completa, vincula usuários a apps, gera links de convite. |
| **Admin (de app)** | `app_access.role = 'app_admin'` | Papel elevado só naquele app específico. |
| **End user** | `app_access.role = 'end_user'` (default) | Uso normal do app. |

Não existe mais self-signup ligado por padrão nem fila de solicitação de
acesso — cada app tem seu próprio toggle `allow_self_signup`, configurável
pelo superuser em `apps.bit-lab.tech/admin/apps`. Contas de end user/app admin
são criadas por **links de convite** (`apps.bit-lab.tech/admin/tokens`): o
superuser escolhe o papel, quais apps o link concede, e-mail opcional e
validade — o link só mostra o token uma vez. Quem abre o link e já tem conta
clica em "Já tenho conta" (`/invite/redeem?token=...`): loga normal e o
convite é resgatado pra essa conta já existente, sem criar uma segunda.

## Como funciona

- **Login:** `POST /login` (email/senha) → cria sessão no Redis → cookie
  `bl_session` (`Domain=.bit-lab.tech`, `HttpOnly`, `Secure`, `SameSite=Lax`).
- **Gate:** nginx usa `auth_request` apontando pra `GET /verify?app=<slug>`.
  Sem sessão → `401` (nginx redireciona pro login). Sessão válida mas sem
  acesso ao app → `403`. Acesso concedido → `200` (+ header `X-User-Email`
  repassado pro app de baixo).
- **Admin:** `apps.bit-lab.tech/admin` (SPA, protegida por sessão + superuser)
  — CRUD de usuários, apps (+ toggle de self-signup), acessos (+ papel) e
  links de convite. A API JSON por trás mora em `/admin/api/*` neste serviço.
- **OIDC:** `Provider` real montado (discovery, JWKS, `/auth`, `/token`,
  `/userinfo`) — clients registrados: `face-lab`, `bordado-digital`. Ver
  comentário em `src/oidc.js`.

## Rodando localmente

```bash
cp .env.example .env      # edite os valores
docker compose up --build
curl http://127.0.0.1:4002/health
```

Pra testar o fluxo completo:
```bash
# sem sessão → 401
curl -i http://127.0.0.1:4002/verify?app=bordado-digital

# login (usa as credenciais de INITIAL_ADMIN_EMAIL/PASSWORD do .env)
curl -i -c /tmp/cookies.txt -X POST http://127.0.0.1:4002/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=SEU_EMAIL&password=SUA_SENHA"

# com sessão + acesso concedido (bordado-digital é semeado automaticamente) → 200
curl -i -b /tmp/cookies.txt "http://127.0.0.1:4002/verify?app=bordado-digital"

# app sem grant → 403
curl -i -b /tmp/cookies.txt "http://127.0.0.1:4002/verify?app=nao-existe"
```

A SPA (`web/`) sobe junto no `docker compose up --build` (serviço `web`,
`127.0.0.1:3006`) — em dev, rode `cd web && npm install && npm run dev`
(proxy do Vite já aponta `/api`, `/admin`, `/login`, `/signup`, `/logout` pro
backend em `localhost:4000`).

## Instalar na VPS

```bash
cd bit-lab-agents/auth
sudo ./scripts/install.sh
```

Prepara `.env` (pergunta as senhas se faltarem), builda e sobe
Postgres+Redis+auth+web, e sincroniza o `nginx/bit-lab.tech.conf` (que já traz
os blocos `auth.bit-lab.tech` e `apps.bit-lab.tech` — o gate do
`bordado.digital` vive em `nginx/bordado.digital.conf`, próprio) — com backup
do conf anterior e teste (`nginx -t`) antes de recarregar.

## Adicionando um novo app ao gate

1. No painel (`apps.bit-lab.tech/admin/apps`), cria o app (slug + nome) e
   concede acesso aos usuários certos em Acessos (ou gera um link de convite
   em Links de convite).
2. No nginx, adiciona no server block do domínio desse app o mesmo bloco
   `auth_request` usado nos outros apps (troca só o slug na query string
   `?app=` e a porta do `proxy_pass` de destino).

Nenhuma mudança no serviço `auth` em si é necessária.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `POSTGRES_PASSWORD` | senha do Postgres |
| `SESSION_SECRET` | usada pelas cookies do oidc-provider (não é a sessão própria, que fica só no Redis) |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | criam o primeiro admin no primeiro boot (tabela `users` vazia) — depois disso não têm mais efeito |
| `ISSUER` | URL pública do provider OIDC (`https://auth.bit-lab.tech`) |
| `COOKIE_DOMAIN` | domínio do cookie de sessão (`.bit-lab.tech` em produção; vazio pra testar local em `127.0.0.1`) |

## Limitações conhecidas (aceitas de propósito, não são bugs)

- **Adapter do oidc-provider em memória** — ok pra uma instância só sem
  clients OAuth ativos. Trocar por um adapter Redis antes do primeiro client
  real entrar em produção ou de rodar mais de uma instância.
- **Sem CSRF token nas rotas de admin** — mitigado por `SameSite=Lax` (bloqueia
  o vetor de ataque principal em requests não-GET entre sites). Suficiente
  pra uma ferramenta interna de time pequeno; adicionar token de verdade se
  isso crescer.
- **Sem "esqueci minha senha" por e-mail** — de propósito, reset de senha é
  sempre feito pelo superuser no painel (sem depender de SMTP). Self-signup
  existe, mas é opt-in por app (ver seção Papéis) — nunca ligado globalmente.
