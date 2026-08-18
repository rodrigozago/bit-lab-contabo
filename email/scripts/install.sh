#!/usr/bin/env bash
# install.sh — Instala/atualiza o bit-lab-email na VPS (mail.bit-lab.tech)
#
# Uso:
#   ./scripts/install.sh
#
# O que faz:
#   1. Confere docker/docker compose
#   2. Cria email/.env (se não existir) — pede RESEND_API_KEY, EMAIL_FROM, INTERNAL_KEY
#   3. docker compose build + up -d (email em 127.0.0.1:4006)
#   4. Copia nginx/bit-lab.tech.conf (com o bloco mail.bit-lab.tech) pra
#      /etc/nginx/conf.d (ou sites-enabled), testa e recarrega o nginx
#
# Idempotente — pode rodar de novo a qualquer momento pra atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/email
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "📧 $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "bit-lab-email — instalação em $PROJECT_DIR"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker não encontrado. Instale o Docker antes de continuar."
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não encontrado. Instale docker-compose-plugin."

# ── 2. .env ─────────────────────────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -t 0 ]; then
    read -rp "RESEND_API_KEY (https://resend.com/api-keys): " RESEND_KEY
    read -rp "EMAIL_FROM (ex: bit-lab <no-reply@bit-lab.tech>): " FROM
    read -rp "INTERNAL_KEY (ex: openssl rand -hex 32 — mesmo valor vai em auth/.env como MAIL_INTERNAL_KEY): " INTKEY
  else
    RESEND_KEY="${RESEND_API_KEY:-}"
    FROM="${EMAIL_FROM:-}"
    INTKEY="${INTERNAL_KEY:-}"
  fi
  [ -n "$RESEND_KEY" ] && [ -n "$FROM" ] && [ -n "$INTKEY" ] \
    || die "Faltou alguma variável (rode interativo ou exporte RESEND_API_KEY/EMAIL_FROM/INTERNAL_KEY)."

  cat > "$ENV_FILE" <<EOF
RESEND_API_KEY=$RESEND_KEY
EMAIL_FROM=$FROM
INTERNAL_KEY=$INTKEY
EOF
  log ".env criado em $ENV_FILE"
else
  log ".env já existe — mantendo"
fi

# ── 3. Build + up ──────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
log "Buildando imagem..."
docker compose build

log "Subindo o serviço..."
docker compose up -d

log "Aguardando o serviço responder..."
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:4006/health >/dev/null 2>&1; then
    log "email ok em 127.0.0.1:4006"
    break
  fi
  [ "$i" -eq 20 ] && warn "email não respondeu em http://127.0.0.1:4006/health — confira 'docker compose logs email'"
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
echo "  1. Domínio bit-lab.tech verificado no Resend (SPF/DKIM via DNS) — https://resend.com/domains"
echo "  2. DNS: mail.bit-lab.tech aponta pro mesmo IP de bit-lab.tech (via Cloudflare) — reusa o cert wildcard *.bit-lab.tech"
echo "  3. curl -s -X POST https://mail.bit-lab.tech/send -H 'X-Internal-Key: SEU_INTERNAL_KEY' -H 'Content-Type: application/json' -d '{\"template\":\"invite\",\"to\":\"voce@exemplo.com\",\"data\":{\"url\":\"https://apps.bit-lab.tech\"}}'"
echo ""
echo "Logs:      docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Atualizar: git pull && $SCRIPT_DIR/install.sh"
