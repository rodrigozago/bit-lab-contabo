#!/usr/bin/env bash
# install.sh — Instala/atualiza o Ponto Studio na VPS bit-lab (ponto.bit-lab.tech)
#
# Uso:
#   ./scripts/install.sh                       # pede a chave da OpenRouter se faltar
#   OPENROUTER_API_KEY=sk-or-... ./scripts/install.sh   # não-interativo
#
# O que faz:
#   1. Confere docker/docker compose
#   2. Cria ponto-studio/.env (se não existir) com OPENROUTER_API_KEY
#   3. docker compose build + up -d (web:127.0.0.1:3003, api:127.0.0.1:4001, redis/worker internos)
#   4. Copia nginx/bit-lab.tech.conf (atualizado com o bloco ponto.bit-lab.tech)
#      para /etc/nginx/conf.d/ (ou sites-enabled), testa e recarrega o nginx
#
# Idempotente — pode rodar de novo a qualquer momento para atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/ponto-studio
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "🪡  $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "Ponto Studio — instalação em $PROJECT_DIR"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker não encontrado. Instale o Docker antes de continuar."
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não encontrado. Instale docker-compose-plugin."

# ── 2. .env com a chave da OpenRouter ──────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -n "${OPENROUTER_API_KEY:-}" ]; then
    KEY="$OPENROUTER_API_KEY"
  elif [ -t 0 ]; then
    read -rp "Cole a OPENROUTER_API_KEY: " KEY
  else
    die "Nenhum .env encontrado e OPENROUTER_API_KEY não foi definida no ambiente."
  fi
  [ -n "$KEY" ] || die "OPENROUTER_API_KEY vazia."
  printf 'OPENROUTER_API_KEY=%s\n' "$KEY" > "$ENV_FILE"
  log ".env criado em $ENV_FILE"
else
  log ".env já existe — mantendo"
fi

# ── 3. Build + up ──────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
log "Buildando imagens (web, api, worker)..."
docker compose build

log "Subindo a stack (redis, api, worker, web)..."
docker compose up -d

log "Aguardando a API responder..."
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:4001/health >/dev/null 2>&1; then
    log "API ok em 127.0.0.1:4001"
    break
  fi
  [ "$i" -eq 20 ] && warn "API não respondeu em http://127.0.0.1:4001/health — confira 'docker compose logs api'"
  sleep 1
done

if curl -sf -o /dev/null http://127.0.0.1:3003/ 2>&1; then
  log "Web ok em 127.0.0.1:3003"
else
  warn "Web não respondeu em http://127.0.0.1:3003/ — confira 'docker compose logs web'"
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
echo "  1. DNS: ponto.bit-lab.tech apontando para o mesmo IP de bit-lab.tech (via Cloudflare)"
echo "  2. Certificado /etc/ssl/cloudflare/bit-lab.tech.pem cobre ponto.bit-lab.tech (wildcard *.bit-lab.tech)"
echo "  3. https://ponto.bit-lab.tech carrega o editor"
echo ""
echo "Logs:            docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Atualizar:       git pull && $SCRIPT_DIR/install.sh"
