#!/usr/bin/env bash
# install.sh — Instala/atualiza o Face Lab na VPS bit-lab (face.bit-lab.tech)
#
# O que faz:
#   1. Confere docker / docker compose
#   2. Exige face-lab/.env (copie de .env.example e preencha)
#   3. docker compose build + up -d (web:127.0.0.1:3004, api:127.0.0.1:4003, postgres/redis/worker internos)
#   4. Copia nginx/bit-lab.tech.conf (com o bloco face.bit-lab.tech) para o nginx, testa e recarrega
#
# ⚠️  O auth (auth.bit-lab.tech) precisa estar atualizado ANTES: rode
#     bit-lab-agents/auth/scripts/install.sh com FACE_LAB_OIDC_SECRET e
#     ALLOW_SELF_SIGNUP=true no auth/.env — o client OIDC face-lab vive lá.
#
# Idempotente — pode rodar de novo a qualquer momento para atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/face-lab
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "📸  $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "Face Lab — instalação em $PROJECT_DIR"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker não encontrado."
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não encontrado."

# ── 2. .env ────────────────────────────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  die "Nenhum .env encontrado. Copie face-lab/.env.example para face-lab/.env e preencha (OIDC/Google/senhas)."
fi

# ── 3. Build + up ──────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
log "Buildando imagens (postgres usa imagem pronta; api, worker, web via build)..."
log "  (o build do worker baixa os modelos InsightFace ~300MB — pode demorar na 1ª vez)"
docker compose build

log "Subindo a stack (postgres, redis, api, worker, web)..."
docker compose up -d

log "Aguardando a API responder..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:4003/health >/dev/null 2>&1; then
    log "API ok em 127.0.0.1:4003"
    break
  fi
  [ "$i" -eq 30 ] && warn "API não respondeu em http://127.0.0.1:4003/health — confira 'docker compose logs api'"
  sleep 2
done

if curl -sf -o /dev/null http://127.0.0.1:3004/ 2>&1; then
  log "Web ok em 127.0.0.1:3004"
else
  warn "Web não respondeu em http://127.0.0.1:3004/ — confira 'docker compose logs web'"
fi

# ── 4. nginx ────────────────────────────────────────────────────────────────────
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
echo "  1. DNS: face.bit-lab.tech apontando pro mesmo IP (via Cloudflare)"
echo "  2. Cert /etc/ssl/cloudflare/bit-lab.tech.pem cobre *.bit-lab.tech"
echo "  3. auth/.env tem FACE_LAB_OIDC_SECRET == face-lab/.env OIDC_CLIENT_SECRET"
echo "  4. Google Cloud OAuth: redirect https://face.bit-lab.tech/api/google/callback autorizado"
echo "  5. https://face.bit-lab.tech carrega a landing"
echo ""
echo "Logs:      docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Atualizar: git pull && $SCRIPT_DIR/install.sh"
