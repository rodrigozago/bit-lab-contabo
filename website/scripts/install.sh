#!/usr/bin/env bash
# install.sh — Instala/atualiza o site principal na VPS bit-lab (bit-lab.tech)
#
# Uso:
#   ./scripts/install.sh    # lê website/.env; falha se não existir (crie a partir do .env.example)
#
# O que faz:
#   1. Confere docker/docker compose
#   2. Confere que website/.env existe (tokens do Storyblok)
#   3. docker compose build + up -d (web:127.0.0.1:3008)
#   4. Copia nginx/bit-lab.tech.conf para /etc/nginx/conf.d/ (ou sites-enabled),
#      testa e recarrega o nginx
#
# Idempotente — pode rodar de novo a qualquer momento para atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/website
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "🌐 $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "bit-lab.tech — instalação em $PROJECT_DIR"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker não encontrado. Instale o Docker antes de continuar."
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não encontrado. Instale docker-compose-plugin."

# ── 2. .env com os tokens do Storyblok ─────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  die "Nenhum $ENV_FILE encontrado. Copie website/.env.example pra website/.env e preencha os tokens do Storyblok antes de rodar este script."
fi
log ".env encontrado em $ENV_FILE"

# ── 3. Build + up ──────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
log "Buildando a imagem (web)..."
docker compose build

log "Subindo a stack (web)..."
docker compose up -d

log "Aguardando o site responder..."
for i in $(seq 1 20); do
  if curl -sf -o /dev/null http://127.0.0.1:3008/ 2>&1; then
    log "Web ok em 127.0.0.1:3008"
    break
  fi
  [ "$i" -eq 20 ] && warn "Web não respondeu em http://127.0.0.1:3008/ — confira 'docker compose logs web'"
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
echo "  1. DNS: bit-lab.tech e www.bit-lab.tech apontando pro IP do servidor (via Cloudflare)"
echo "  2. Certificado /etc/ssl/cloudflare/bit-lab.tech.{pem,key} existem e são válidos"
echo "  3. https://bit-lab.tech carrega o site"
echo "  4. https://bit-lab.tech/opencdj e https://studio.bit-lab.tech/precos continuam funcionando"
echo "  5. Visual editor do Storyblok abre a home com os bloks clicáveis"
echo ""
echo "Logs:            docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Atualizar:       git pull && $SCRIPT_DIR/install.sh"
