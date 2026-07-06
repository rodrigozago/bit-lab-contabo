#!/usr/bin/env bash
# install.sh — Instala/atualiza o bit-lab-auth na VPS (auth.bit-lab.tech)
#
# Uso:
#   ./scripts/install.sh
#
# O que faz:
#   1. Confere docker/docker compose
#   2. Cria auth/.env (se não existir) — pede POSTGRES_PASSWORD, SESSION_SECRET,
#      INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD
#   3. docker compose build + up -d (postgres, redis, auth em 127.0.0.1:4002)
#   4. Copia nginx/bit-lab.tech.conf (com o bloco auth.bit-lab.tech e o gate
#      do ponto.bit-lab.tech) pra /etc/nginx/conf.d (ou sites-enabled), testa
#      e recarrega o nginx
#
# Idempotente — pode rodar de novo a qualquer momento pra atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/auth
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "🔐 $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "bit-lab-auth — instalação em $PROJECT_DIR"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker não encontrado. Instale o Docker antes de continuar."
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não encontrado. Instale docker-compose-plugin."

# ── 2. .env ─────────────────────────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -t 0 ]; then
    read -rp "POSTGRES_PASSWORD (senha nova pro banco): " PG_PASS
    read -rp "SESSION_SECRET (string aleatória longa, ex: openssl rand -hex 32): " SESSION_SECRET
    read -rp "INITIAL_ADMIN_EMAIL: " ADMIN_EMAIL
    read -rp "INITIAL_ADMIN_PASSWORD: " ADMIN_PASS
  else
    PG_PASS="${POSTGRES_PASSWORD:-}"
    SESSION_SECRET="${SESSION_SECRET:-}"
    ADMIN_EMAIL="${INITIAL_ADMIN_EMAIL:-}"
    ADMIN_PASS="${INITIAL_ADMIN_PASSWORD:-}"
  fi
  [ -n "$PG_PASS" ] && [ -n "$SESSION_SECRET" ] && [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASS" ] \
    || die "Faltou alguma variável (rode interativo ou exporte POSTGRES_PASSWORD/SESSION_SECRET/INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD)."

  cat > "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=$PG_PASS
SESSION_SECRET=$SESSION_SECRET
INITIAL_ADMIN_EMAIL=$ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD=$ADMIN_PASS
EOF
  log ".env criado em $ENV_FILE"
else
  log ".env já existe — mantendo"
fi

# ── 3. Build + up ──────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
log "Buildando imagem..."
docker compose build

log "Subindo a stack (postgres, redis, auth)..."
docker compose up -d

log "Aguardando o serviço responder..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:4002/health >/dev/null 2>&1; then
    log "auth ok em 127.0.0.1:4002"
    break
  fi
  [ "$i" -eq 30 ] && warn "auth não respondeu em http://127.0.0.1:4002/health — confira 'docker compose logs auth'"
  sleep 1
done

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
echo "  1. DNS: auth.bit-lab.tech apontando pro mesmo IP de bit-lab.tech (via Cloudflare)"
echo "  2. Certificado /etc/ssl/cloudflare/bit-lab.tech.pem cobre auth.bit-lab.tech (wildcard *.bit-lab.tech)"
echo "  3. https://auth.bit-lab.tech/login carrega a tela de login"
echo "  4. https://ponto.bit-lab.tech redireciona pro login se você não estiver logado"
echo ""
echo "Logs:      docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Atualizar: git pull && $SCRIPT_DIR/install.sh"
