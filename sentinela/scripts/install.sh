#!/usr/bin/env bash
# install.sh — Instala/atualiza o Sentinela na VPS bit-lab (sentinela.bit-lab.tech)
#
# Uso:
#   ./scripts/install.sh
#
# O que faz:
#   1. Confere docker/docker compose
#   2. Cria sentinela/.env (se não existir) — pede POSTGRES_PASSWORD,
#      SENTINELA_OIDC_SECRET e OPENAI_API_KEY; gera SCRAPOXY_API_TOKEN e
#      SOCIAL_ACCOUNTS_ENCRYPTION_KEY sozinho se não vierem definidos
#   3. docker compose build + up -d (postgres+pgvector, redis, scrapoxy,
#      api:127.0.0.1:4005, web:127.0.0.1:3007, 3 workers)
#   4. Copia nginx/bit-lab.tech.conf (com o bloco sentinela.bit-lab.tech) pra
#      /etc/nginx/conf.d (ou sites-enabled), testa e recarrega o nginx
#
# IMPORTANTE: SENTINELA_OIDC_SECRET precisa ser o MESMO valor cadastrado em
# auth/.env (variável de mesmo nome) — sem isso o SSO não autentica. Esse
# script não mexe no auth/.env nem reinicia o serviço auth — isso é manual
# (ver instruções no final).
#
# Idempotente — pode rodar de novo a qualquer momento pra atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/sentinela
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "🛰️  $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "Sentinela — instalação em $PROJECT_DIR"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker não encontrado. Instale o Docker antes de continuar."
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não encontrado. Instale docker-compose-plugin."

# ── 2. .env ─────────────────────────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -t 0 ]; then
    read -rp "POSTGRES_PASSWORD (senha nova pro banco): " PG_PASS
    read -rp "SENTINELA_OIDC_SECRET (tem que ser IGUAL ao valor em auth/.env): " OIDC_SECRET
    read -rp "OPENAI_API_KEY (usada pelo worker de análise — pode deixar em branco e completar depois): " OPENAI_KEY
  else
    PG_PASS="${POSTGRES_PASSWORD:-}"
    OIDC_SECRET="${SENTINELA_OIDC_SECRET:-}"
    OPENAI_KEY="${OPENAI_API_KEY:-}"
  fi
  [ -n "$PG_PASS" ] && [ -n "$OIDC_SECRET" ] \
    || die "Faltou alguma variável (rode interativo ou exporte POSTGRES_PASSWORD/SENTINELA_OIDC_SECRET)."

  SCRAPOXY_TOKEN="${SCRAPOXY_API_TOKEN:-$(openssl rand -hex 24)}"
  SOCIAL_KEY="${SOCIAL_ACCOUNTS_ENCRYPTION_KEY:-$(openssl rand -base64 32)}"

  cat > "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=$PG_PASS
SENTINELA_OIDC_SECRET=$OIDC_SECRET
OPENAI_API_KEY=$OPENAI_KEY
SCRAPOXY_API_TOKEN=$SCRAPOXY_TOKEN
SOCIAL_ACCOUNTS_ENCRYPTION_KEY=$SOCIAL_KEY
EOF
  log ".env criado em $ENV_FILE"
  [ -z "$OPENAI_KEY" ] && warn "OPENAI_API_KEY vazia — worker-analysis não vai subir até você preencher o .env e rodar 'docker compose up -d worker-analysis' de novo."
else
  log ".env já existe — mantendo"
fi

# ── 3. Build + up ──────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
log "Buildando imagens (api, web, workers)..."
docker compose build

log "Subindo a stack (postgres, redis, scrapoxy, api, web, workers)..."
docker compose up -d

log "Aguardando a API responder..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:4005/health >/dev/null 2>&1; then
    log "API ok em 127.0.0.1:4005"
    break
  fi
  [ "$i" -eq 30 ] && warn "API não respondeu em http://127.0.0.1:4005/health — confira 'docker compose logs api'"
  sleep 1
done

if curl -sf -o /dev/null http://127.0.0.1:3007/ 2>&1; then
  log "Web ok em 127.0.0.1:3007"
else
  warn "Web não respondeu em http://127.0.0.1:3007/ — confira 'docker compose logs web'"
fi

# ── 4. nginx ────────────────────────────────────────────────────────────────────
NGINX_DST=""
if [ -d /etc/nginx/conf.d ]; then
  NGINX_DST="/etc/nginx/conf.d/$NGINX_CONF_NAME"
elif [ -d /etc/nginx/sites-enabled ]; then
  NGINX_DST="/etc/nginx/sites-enabled/$NGINX_CONF_NAME"
fi

if [ -z "$NGINX_DST" ]; then
  warn "Não encontrei /etc/nginx/conf.d nem /etc/nginx/sites-enabled — copie"
  warn "$NGINX_SRC manualmente para a config do seu nginx e recarregue."
elif [ ! -w "$(dirname "$NGINX_DST")" ]; then
  warn "Sem permissão de escrita em $(dirname "$NGINX_DST") — rode este script com sudo"
  warn "para que eu configure o nginx automaticamente (build/up do Docker já foram feitos)."
else
  if [ -f "$NGINX_DST" ]; then
    BACKUP="$NGINX_DST.bak.$(date +%Y%m%d%H%M%S)"
    cp "$NGINX_DST" "$BACKUP"
    log "Backup do nginx conf atual em $BACKUP"
  fi
  cp "$NGINX_SRC" "$NGINX_DST"
  log "nginx conf atualizado em $NGINX_DST"

  if nginx -t 2>&1; then
    if command -v systemctl >/dev/null 2>&1; then
      systemctl reload nginx
    else
      service nginx reload
    fi
    log "nginx recarregado com sucesso"
  else
    die "nginx -t falhou — revertendo. Restaure com: cp $BACKUP $NGINX_DST (se existir) e corrija o erro acima."
  fi
fi

echo ""
log "Instalação concluída!"
echo ""
echo "Confirme antes de considerar tudo pronto:"
echo "  1. DNS: sentinela.bit-lab.tech apontando pro mesmo IP de bit-lab.tech (via Cloudflare)"
echo "  2. Certificado /etc/ssl/cloudflare/bit-lab.tech.pem cobre sentinela.bit-lab.tech (wildcard *.bit-lab.tech)"
echo "  3. SENTINELA_OIDC_SECRET aqui é IGUAL ao de auth/.env — senão o login falha"
echo "  4. O serviço 'auth' foi rebuildado/reiniciado depois de adicionar esse secret"
echo "     (o client OIDC só é registrado com o secret presente no ambiente dele)"
echo "  5. https://sentinela.bit-lab.tech carrega a tela de login e o SSO completa"
echo "  6. Cadastre pelo menos uma conta X no pool:"
echo "     docker compose exec worker-ingest-social python manage_accounts.py add --username ... --auth-token ... --ct0 ..."
echo ""
echo "Logs:      docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Atualizar: git pull && $SCRIPT_DIR/install.sh"
