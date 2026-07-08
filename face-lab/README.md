# Face Lab

Indexação e compartilhamento de fotos por **reconhecimento facial**. Producers criam álbuns a partir de pastas do **próprio Google Drive** (as fotos originais nunca são armazenadas aqui — só miniaturas, recortes de rosto, embeddings e os links do Drive); convidados cadastram o rosto pela webcam e recebem automaticamente todas as fotos em que aparecem.

Faz parte do monorepo `bit-lab-agents`, servido em **face.bit-lab.tech**.

## Atores

- **Guest** (convidado) — cria conta, cadastra o rosto, vê suas fotos por álbum.
- **Producer** — conecta o Google Drive, cria álbuns (link de pasta), dispara o scan.
- **Admin** — promove usuários a producer, monitora uso, recalcula matches.

Todo mundo entra como `guest`; um admin promove a `producer`. Papéis vivem no banco do face-lab, keados pela identidade do SSO.

## Arquitetura

| Componente | Stack | Porta (loopback) |
|---|---|---|
| `apps/web` | React 18 + Vite (nginx) | 127.0.0.1:3004 |
| `apps/api` | Fastify 4 + TS (BFF OIDC) | 127.0.0.1:4003 |
| `workers/face` | Python 3.12 + InsightFace (CPU) | — |
| postgres | pgvector/pgvector:pg16 | interno |
| redis | fila + sessões + rate limit | interno |

- **SSO**: OIDC completo (Authorization Code + PKCE) contra `auth.bit-lab.tech`. A API é um **BFF** — troca o code, mantém sessão própria (`fl_session`, cookie host-only), a SPA nunca vê tokens.
- **Reconhecimento**: InsightFace `buffalo_l` (SCRFD + ArcFace 512-d) em onnxruntime CPU. Matching por distância de cosseno no pgvector, pré-computado (`matches`).
- **Fila**: API `RPUSH facelab:jobs` → worker `BLPOP` → `PUBLISH facelab:results` → API persiste no Postgres.

## Setup

### 1. Pré-requisitos no `auth`
No `auth/.env`, defina e reinstale o auth:
```
FACE_LAB_OIDC_SECRET=<secret longo aleatório>
ALLOW_SELF_SIGNUP=true
```
(o client OIDC `face-lab` e as rotas de interação já estão no serviço auth).

### 2. Google Cloud (uma vez)
1. Crie um projeto → habilite a **Google Drive API**.
2. Tela de consentimento OAuth: **External**, scope `.../auth/drive.readonly`; adicione os Gmails dos producers como **test users** (em modo Testing o refresh token expira em 7 dias — publique o app para produção).
3. Credenciais → OAuth Client ID → **Web application** → redirect URIs:
   - `https://face.bit-lab.tech/api/google/callback`
   - `http://localhost:3004/api/google/callback` (dev)
4. Copie client id/secret para o `.env`.

### 3. `.env`
```bash
cp .env.example .env
# preencha: senhas, OIDC_CLIENT_SECRET (== FACE_LAB_OIDC_SECRET do auth),
# GOOGLE_CLIENT_ID/SECRET, GOOGLE_TOKEN_ENC_KEY (openssl rand -hex 32)
# (admins do auth — is_admin — entram como admin no face-lab automaticamente)
```

### 4. Subir
```bash
./scripts/install.sh          # build + up + sincroniza o nginx
```

## Desenvolvimento local

```bash
pnpm install
docker compose up -d postgres redis        # infra
pnpm --filter @face-lab/shared build
pnpm --filter @face-lab/api dev             # API em :4003 (precisa do worker p/ processar)
pnpm --filter @face-lab/web dev             # Vite em :5173 (proxy /api → :4003)
docker compose up -d --build worker         # worker Python (baixa modelos no 1º build)
```

Para o fluxo OIDC funcionar em dev, o `auth` precisa estar acessível e com o redirect `http://localhost:4003/api/auth/callback` registrado (já incluído quando `NODE_ENV != production`).

## Notas de privacidade

- Fotos originais são baixadas do Drive só para processar e **apagadas** imediatamente (`/media/incoming`).
- Frames de cadastro de rosto são descartados após gerar o embedding.
- Deletar um enrollment remove o embedding e os matches automáticos; deletar um álbum apaga thumbs/crops do disco e faz cascade no banco.

## Rate limiting

Contadores por minuto no Redis (`RATE_LIMIT_PRODUCER_PER_MIN`, `_GLOBAL_`, `_ENROLL_`) freiam o consumo durante os testes — o scan desacelera em vez de falhar. `usage_events` guarda 1 linha por reconhecimento (base para planos/cotas futuros), visível em `/api/admin/usage`.
