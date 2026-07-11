#!/usr/bin/env bash
# install.sh — Instala/atualiza o On Air na VPS bit-lab (on-air.bit-lab.tech)
#
# O que faz:
#   1. Confere docker / docker compose
#   2. docker compose build + up -d (web:127.0.0.1:3005, api:127.0.0.1:4004)
#   3. Copia nginx/bit-lab.tech.conf (com o bloco on-air.bit-lab.tech) para o nginx, testa e recarrega
#
# ⚠️  SSO desligado por enquanto: /admin é protegido por senha simples
#     (ADMIN_PASSWORD no docker-compose.yml, header x-admin-key).
#
# Idempotente — pode rodar de novo a qualquer momento para atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/on-air
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "📀  $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "On Air — instalação em $PROJECT_DIR"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker não encontrado."
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não encontrado."

# ── 2. Build + up ──────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
log "Buildando imagens (api + web)..."
docker compose build

log "Subindo a stack..."
docker compose up -d

log "Aguardando a API responder..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:4004/api/health >/dev/null 2>&1; then
    log "API ok em 127.0.0.1:4004"
    break
  fi
  [ "$i" -eq 30 ] && warn "API não respondeu em http://127.0.0.1:4004/api/health — confira 'docker compose logs api'"
  sleep 2
done

if curl -sf -o /dev/null http://127.0.0.1:3005/ 2>&1; then
  log "Web ok em 127.0.0.1:3005"
else
  warn "Web não respondeu em http://127.0.0.1:3005/ — confira 'docker compose logs web'"
fi

# ── 3. nginx ────────────────────────────────────────────────────────────────────
NGINX_DST=""
if [ -d /etc/nginx/conf.d ]; then
  NGINX_DST="/etc/nginx/conf.d/$NGINX_CONF_NAME"
elif [ -d /etc/nginx/sites-enabled ]; then
  NGINX_DST="/etc/nginx/sites-enabled/$NGINX_CONF_NAME"
fi

if [ -z "$NGINX_DST" ]; then
  warn "Não encontrei /etc/nginx/conf.d nem /etc/nginx/sites-enabled — copie $NGINX_SRC manualmente e recarregue."
elif [ ! -w "$(dirname "$NGINX_DST")" ]; then
  warn "Sem permissão de escrita em $(dirname "$NGINX_DST") — rode este script com sudo para configurar o nginx."
else
  if [ -f "$NGINX_DST" ]; then
    BACKUP="$NGINX_DST.bak.$(date +%Y%m%d%H%M%S)"
    cp "$NGINX_DST" "$BACKUP"
    log "Backup do nginx conf atual em $BACKUP"
  fi
  cp "$NGINX_SRC" "$NGINX_DST"
  log "nginx conf atualizado em $NGINX_DST"

  if nginx -t 2>&1; then
    if command -v systemctl >/dev/null 2>&1; then systemctl reload nginx; else service nginx reload; fi
    log "nginx recarregado com sucesso"
  else
    die "nginx -t falhou — corrija o erro acima (restaure com: cp \$BACKUP $NGINX_DST se necessário)."
  fi
fi

echo ""
log "Instalação concluída!"
echo ""
echo "Confirme:"
echo "  1. DNS: on-air.bit-lab.tech apontando pro mesmo IP (via Cloudflare)"
echo "  2. Cert /etc/ssl/cloudflare/bit-lab.tech.pem cobre *.bit-lab.tech"
echo "  3. https://on-air.bit-lab.tech carrega a página pública sem login"
echo "  4. https://on-air.bit-lab.tech/admin pede a senha (ADMIN_PASSWORD do docker-compose.yml)"
echo ""
echo "Logs:      docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Atualizar: git pull && $SCRIPT_DIR/install.sh"
