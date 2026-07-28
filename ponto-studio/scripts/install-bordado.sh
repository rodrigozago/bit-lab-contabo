#!/usr/bin/env bash
# install-bordado.sh — Configura o Ponto Studio na raiz de bordado.digital
#
# Muda APENAS o nginx — o Docker e .env já estão rodando (compartilhados com ponto.bit-lab.tech).
# A mesma stack serve ambos os domínios (porta 3003 é compartilhada).
#
# Uso:
#   sudo ./scripts/install-bordado.sh
#
# O que faz:
#   1. Copia nginx/bordado.digital.conf para /etc/nginx/conf.d/ (ou sites-enabled)
#   2. Testa e recarrega nginx
#
# Pré-requisitos:
#   - A stack do Ponto Studio já deve estar rodando (docker compose up -d)
#   - Certificado SSL pra bordado.digital já deve estar em /etc/ssl/cloudflare/
#   - Nginx configurado e rodando
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-agents/ponto-studio
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"        # .../bit-lab-agents
NGINX_SRC="$REPO_ROOT/nginx/bordado.digital.conf"
NGINX_CONF_NAME="bordado.digital.conf"

log()  { echo "🎯 $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "Ponto Studio — configuração em bordado.digital (raiz)"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
[ -f "$NGINX_SRC" ] || die "Arquivo nginx não encontrado: $NGINX_SRC"
command -v nginx >/dev/null 2>&1 || die "nginx não encontrado. Instale antes de continuar."

# ── 2. Verificar certificado ──────────────────────────────────────────────────
if [ ! -f /etc/ssl/cloudflare/bordado.digital.pem ] || [ ! -f /etc/ssl/cloudflare/bordado.digital.key ]; then
  warn "Certificado SSL não encontrado em /etc/ssl/cloudflare/bordado.digital.{pem,key}"
  warn "Certificado precisa estar em lugar e com extensão correta."
  warn "Se estiver em outro lugar, copie com:"
  warn "  sudo cp /caminho/para/seu/cert.pem /etc/ssl/cloudflare/bordado.digital.pem"
  warn "  sudo cp /caminho/para/sua/key.key /etc/ssl/cloudflare/bordado.digital.key"
fi

# ── 3. nginx ────────────────────────────────────────────────────────────────────
NGINX_DST=""
if [ -d /etc/nginx/conf.d ]; then
  NGINX_DST="/etc/nginx/conf.d/$NGINX_CONF_NAME"
elif [ -d /etc/nginx/sites-enabled ]; then
  NGINX_DST="/etc/nginx/sites-enabled/$NGINX_CONF_NAME"
fi

if [ -z "$NGINX_DST" ]; then
  die "Não encontrei /etc/nginx/conf.d nem /etc/nginx/sites-enabled"
elif [ ! -w "$(dirname "$NGINX_DST")" ]; then
  die "Sem permissão de escrita em $(dirname "$NGINX_DST") — rode este script com sudo"
else
  if [ -f "$NGINX_DST" ]; then
    BACKUP="$NGINX_DST.bak.$(date +%Y%m%d%H%M%S)"
    cp "$NGINX_DST" "$BACKUP"
    log "Backup do nginx conf em $BACKUP"
  fi

  cp "$NGINX_SRC" "$NGINX_DST"
  log "nginx conf adicionado em $NGINX_DST"

  if nginx -t 2>&1; then
    if command -v systemctl >/dev/null 2>&1; then
      systemctl reload nginx
    else
      service nginx reload
    fi
    log "nginx recarregado com sucesso"
  else
    die "nginx -t falhou — revertendo. Restaure com: cp $BACKUP $NGINX_DST e corrija o erro acima."
  fi
fi

echo ""
log "Configuração concluída!"
echo ""
echo "Confirme antes de considerar tudo pronto:"
echo "  1. DNS: bordado.digital apontando para o mesmo IP de ponto.bit-lab.tech (via Cloudflare)"
echo "  2. Certificado /etc/ssl/cloudflare/bordado.digital.{pem,key} existem e são válidos"
echo "  3. https://bordado.digital carrega o editor (mesma app de ponto.bit-lab.tech)"
echo ""
echo "Logs:            docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "Status nginx:    sudo systemctl status nginx"
echo ""
