# 🔐 bit-lab-auth

Serviço de autenticação central pros apps do bit-lab. Não é um SSO completo
(sem OAuth entre apps ainda) — hoje é: login único + sessão compartilhada via
cookie `.bit-lab.tech` + gate por app no nginx (`auth_request`), com um
provider OIDC real (`oidc-provider`) já rodando por baixo pra quando algum app
precisar de login via token de verdade.

## Como funciona

- **Login:** `POST /login` (email/senha) → cria sessão no Redis → cookie
  `bl_session` (`Domain=.bit-lab.tech`, `HttpOnly`, `Secure`, `SameSite=Lax`).
- **Gate:** nginx usa `auth_request` apontando pra `GET /verify?app=<slug>`.
  Sem sessão → `401` (nginx redireciona pro login). Sessão válida mas sem
  acesso ao app → `403`. Acesso concedido → `200` (+ header `X-User-Email`
  repassado pro app de baixo).
- **Admin:** `/admin` (protegido, só admin) — CRUD de usuários, apps e quem
  acessa o quê.
- **OIDC:** `Provider` real montado (discovery, JWKS, `/auth`, `/token`,
  `/userinfo`) — sem nenhum client registrado ainda porque nenhum app
  consome o protocolo hoje. Ver comentário em `src/oidc.js` pro próximo passo
  quando isso for necessário.

## Rodando localmente

```bash
cp .env.example .env      # edite os valores
docker compose up --build
curl http://127.0.0.1:4002/health
```

Pra testar o fluxo completo:
```bash
# sem sessão → 401
curl -i http://127.0.0.1:4002/verify?app=ponto-studio

# login (usa as credenciais de INITIAL_ADMIN_EMAIL/PASSWORD do .env)
curl -i -c /tmp/cookies.txt -X POST http://127.0.0.1:4002/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=SEU_EMAIL&password=SUA_SENHA"

# com sessão + acesso concedido (ponto-studio é semeado automaticamente) → 200
curl -i -b /tmp/cookies.txt "http://127.0.0.1:4002/verify?app=ponto-studio"

# app sem grant → 403
curl -i -b /tmp/cookies.txt "http://127.0.0.1:4002/verify?app=nao-existe"
```

## Instalar na VPS

```bash
cd bit-lab-agents/auth
sudo ./scripts/install.sh
```

Prepara `.env` (pergunta as senhas se faltarem), builda e sobe
Postgres+Redis+auth, e sincroniza o `nginx/bit-lab.tech.conf` (que já traz o
bloco `auth.bit-lab.tech` e o gate do `ponto.bit-lab.tech`) — com backup do
conf anterior e teste (`nginx -t`) antes de recarregar.

## Adicionando um novo app ao gate

1. No painel admin (`/admin`), cria o app (slug + nome) e concede acesso aos
   usuários certos.
2. No nginx, adiciona no server block do domínio desse app o mesmo bloco
   `auth_request` usado em `ponto.bit-lab.tech` (troca só o slug na query
   string `?app=` e a porta do `proxy_pass` de destino).

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
- **Sem self-signup nem "esqueci minha senha" por e-mail** — de propósito,
  criação/reset de senha é sempre feito pelo admin no painel (sem depender de
  SMTP).
