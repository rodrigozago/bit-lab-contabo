#!/usr/bin/env bash
# install.sh — Publica os estáticos de nginx/www (bit-lab.tech, /precos, ...)
# em /var/www/bit-lab.tech e atualiza a config do nginx na VPS.
#
# Uso:
#   sudo ./scripts/install.sh
#
# O que faz:
#   1. Copia nginx/www/ (site estático + /precos) pra /var/www/bit-lab.tech
#   2. Copia nginx/bit-lab.tech.conf pra /etc/nginx/conf.d/ (ou sites-enabled),
#      com backup da config anterior
#   3. Testa a config (nginx -t) e recarrega o nginx
#
# Idempotente — pode rodar de novo a qualquer momento pra atualizar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # .../bit-lab-contabo/nginx
WWW_SRC="$PROJECT_DIR/www"
WWW_DST="/var/www/bit-lab.tech"
NGINX_SRC="$PROJECT_DIR/bit-lab.tech.conf"
NGINX_CONF_NAME="bit-lab.tech.conf"

log()  { echo "🌐 $*"; }
warn() { echo "⚠️   $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

log "nginx/www — instalação em $WWW_DST"

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
command -v nginx >/dev/null 2>&1 || die "nginx não encontrado nesta máquina."
[ -d "$WWW_SRC" ] || die "não encontrei $WWW_SRC"
[ -f "$NGINX_SRC" ] || die "não encontrei $NGINX_SRC"

# ── 2. Estáticos (nginx/www -> /var/www/bit-lab.tech) ─────────────────────────
mkdir -p "$WWW_DST"
if [ ! -w "$WWW_DST" ] && [ ! -w "$(dirname "$WWW_DST")" ]; then
  die "sem permissão de escrita em $WWW_DST — rode este script com sudo."
fi

if command -v rsync >/dev/null 2>&1; then
  rsync -a "$WWW_SRC"/ "$WWW_DST"/
else
  cp -r "$WWW_SRC"/. "$WWW_DST"/
fi
log "estáticos copiados de $WWW_SRC para $WWW_DST"

# ── 3. nginx ────────────────────────────────────────────────────────────────────
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
  warn "para que eu configure o nginx automaticamente (estáticos já foram copiados)."
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
echo "  1. https://bit-lab.tech carrega normalmente"
echo "  2. https://studio.bit-lab.tech/precos carrega a página de preços"
echo ""
echo "Atualizar:       git pull && sudo $SCRIPT_DIR/install.sh"
